import { pool } from "./client";

export type SensorDaily = {
  tmax: number | null;
  tmin: number | null;
  humidity: number | null;
};

/**
 * 指定期間のセンサー値をJST日付ごとに集計
 * @param start 開始日時 含む
 * @param end 終了日時 含まない
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

export type SensorHourly = {
  tempC: number | null;
  rhPercent: number | null;
  rainfallMm: number | null;
};

/**
 * 指定期間のセンサー値をUTC時間ごとに集計
 * temp/humidity は平均、rainfall は合計、受信値は前回からの増分である
 * @param start 開始日時 含む
 * @param end 終了日時 含まない
 * @returns { "ISO時刻(時単位)": { tempC, rhPercent, rainfallMm } }
 */
export async function getSensorHourlyByRange(
  start: Date,
  end: Date,
): Promise<Record<string, SensorHourly>> {
  const { rows } = await pool.query(
    `SELECT date_trunc('hour', received_at) AS hour,
            ROUND((AVG(value) FILTER (WHERE metric = 'temp'))::numeric, 2)::float8 AS "tempC",
            ROUND((AVG(value) FILTER (WHERE metric = 'humidity'))::numeric, 2)::float8 AS "rhPercent",
            SUM(value) FILTER (WHERE metric = 'rainfall')::float8 AS "rainfallMm"
       FROM measure
      WHERE metric IN ('temp', 'humidity', 'rainfall')
        AND received_at >= $1 AND received_at < $2
      GROUP BY 1`,
    [start, end],
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.hour.toISOString(),
      { tempC: r.tempC, rhPercent: r.rhPercent, rainfallMm: r.rainfallMm },
    ]),
  );
}

/**
 * metricごとの最新のセンサー値を取得
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
 * デバイス・metricごとの最新のセンサー値を取得
 * @returns { device, metric, value, received_at }[] device, metric 昇順
 */
export async function getLatestMeasuresByDevice(): Promise<
  { device: string; metric: string; value: number; received_at: Date }[]
> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (device, metric) device, metric, value, received_at
       FROM measure
      ORDER BY device, metric, received_at DESC`,
  );
  return rows;
}

/**
 * 指定日時以降の雨量をデバイスごとに合計、受信値は前回からの増分である
 * rainfallの受信が1件も無いデバイスは含まれない（0mmと「データが無い」を混同しない）
 * @param since 開始日時 含む
 * @returns { device: 合計mm }
 */
export async function getRainfallSumByDevice(since: Date): Promise<Record<string, number>> {
  const { rows } = await pool.query(
    `SELECT device, SUM(value)::float8 AS sum
       FROM measure
      WHERE metric = 'rainfall' AND received_at >= $1
      GROUP BY device`,
    [since],
  );
  return Object.fromEntries(rows.map((r) => [r.device, r.sum]));
}

/**
 * 測定データのあるデバイス名の一覧を取得
 * @returns デバイス名の配列 (昇順)
 */
export async function getSensorDevice(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT device FROM measure ORDER BY device",
  );
  return rows.map((r) => r.device);
}
