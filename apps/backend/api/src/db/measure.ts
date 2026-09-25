import { pool } from "./client";

type sensorData = {
  device: string,
  metric: string,
  value: number,
}

export async function getSensorDataByDay(sensor: string, start: Date, end: Date) {
  const { rows } = await pool.query(
    `SELECT device, value, received_at
       FROM measure
      WHERE device = $1 AND received_at >= $2 AND received_at < $3
      ORDER BY received_at`,
    [sensor, start, end],
  );
  return rows;
}

export async function getMeasuresByRange(start: Date, end: Date) {
  const { rows } = await pool.query(
    `SELECT device, metric, value, received_at
       FROM measure
      WHERE metric IN ('temp', 'humidity')
        AND received_at >= $1 AND received_at < $2
      ORDER BY received_at`,
    [start, end],
  );
  return rows;
}

export async function getSensorDevice(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT device FROM measure ORDER BY device",
  );
  return rows.map((r) => r.device);
}

export async function writeSensorData(sensorData: sensorData) {
  await pool.query("INSERT INTO measure (device, metric, value) VALUES ($1, $2, $3)", [
    sensorData.device,
    sensorData.metric,
    sensorData.value,
  ]);
}
