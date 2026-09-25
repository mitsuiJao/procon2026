import { pool } from "./client";

export async function upsertDailySummaries(start: Date, end: Date) {
  await pool.query(
    `INSERT INTO daily_summaries
       (summary_date, device, metric, min_value, max_value, avg_value, sum_value, sample_count)
     SELECT (received_at AT TIME ZONE 'Asia/Tokyo')::date,
            device,
            metric,
            MIN(value),
            MAX(value),
            AVG(value),
            SUM(value),
            COUNT(*)
       FROM measure
      WHERE received_at >= $1 AND received_at < $2
      GROUP BY 1, device, metric
     ON CONFLICT (summary_date, device, metric) DO UPDATE
       SET min_value    = EXCLUDED.min_value,
           max_value    = EXCLUDED.max_value,
           avg_value    = EXCLUDED.avg_value,
           sum_value    = EXCLUDED.sum_value,
           sample_count = EXCLUDED.sample_count,
           updated_at   = now()`,
    [start, end],
  );
}

export async function getDailySummariesByRange(start: string, end: string) {
  const { rows } = await pool.query(
    `SELECT to_char(summary_date, 'YYYY-MM-DD') AS summary_date,
            device, metric, min_value, max_value, avg_value, sum_value, sample_count
       FROM daily_summaries
      WHERE summary_date >= $1 AND summary_date <= $2
      ORDER BY summary_date, device, metric`,
    [start, end],
  );
  return rows;
}
