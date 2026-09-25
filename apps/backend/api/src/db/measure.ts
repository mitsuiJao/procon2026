import { pool } from "./client";

export type SensorDaily = {
  tmax: number | null;
  tmin: number | null;
  humidity: number | null;
};

/**
 * 指定期間のセンサー値をJST日付ごとに集計する。複数デバイスは区別せず束ねる
 * @param start 開始日時 (含む)
 * @param end 終了日時 (含まない)
 * @returns { "YYYY-MM-DD": { tmax, tmin, humidity } }
 */
export async function getSensorDailyByRange(
  start: Date,
  end: Date,
): Promise<Record<string, SensorDaily>> {
  const { rows } = await pool.query(
    `SELECT (received_at AT TIME ZONE 'Asia/Tokyo')::date::text AS date,
            MAX(value) FILTER (WHERE metric = 'temp')::float8 AS tmax,
            MIN(value) FILTER (WHERE metric = 'temp')::float8 AS tmin,
            ROUND((AVG(value) FILTER (WHERE metric = 'humidity'))::numeric, 1)::float8 AS humidity
       FROM measure
      WHERE metric IN ('temp', 'humidity')
        AND received_at >= $1 AND received_at < $2
      GROUP BY 1`,
    [start, end],
  );
  return Object.fromEntries(
    rows.map((r) => [r.date, { tmax: r.tmax, tmin: r.tmin, humidity: r.humidity }]),
  );
}

/**
 * metricごとの最新のセンサー値を取得する。デバイスは区別しない
 * @returns { metric, value, received_at }[]
 */
export async function getLatestMeasures(): Promise<
  { metric: string; value: number; received_at: Date }[]
> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (metric) metric, value, received_at
       FROM measure
      ORDER BY metric, received_at DESC`,
  );
  return rows;
}

/**
 * 測定データのあるデバイス名の一覧を取得する
 * @returns デバイス名の配列 (昇順)
 */
export async function getSensorDevice(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT device FROM measure ORDER BY device",
  );
  return rows.map((r) => r.device);
}
