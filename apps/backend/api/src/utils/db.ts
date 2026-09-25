import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "myuser",
  password: process.env.PGPASSWORD ?? "pass",
  database: process.env.PGDATABASE ?? "mydb",
});

pool.on("error", (err) => {
  console.error("[DB] 予期しないエラー:", err.message);
});

type sensorData = {
  device: string,
  value: number,
}

type weatherData = {
  observed_at: string,
  temperature: number,
  humidity: number,
  latitude: number,
  longitude: number,
  weather_code: number
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

export async function getSensorDevice(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT device FROM measure ORDER BY device",
  );
  return rows.map((r) => r.device);
}

export async function writeSensorData(sensorData: sensorData) {
  await pool.query("INSERT INTO measure (device, value) VALUES ($1, $2)", [
    sensorData.device,
    sensorData.value,
  ]);
}

export async function getWeatherDataByDay(start: Date, end: Date) {
  const { rows } = await pool.query(
    `SELECT observed_at,
            temperature::float8 AS temperature,
            humidity::float8 AS humidity,
            latitude, longitude, weather_code
       FROM weather_observations
      WHERE observed_at >= $1 AND observed_at < $2
      ORDER BY observed_at`,
    [start, end],
  );
  return rows;
}

export async function writeWeatherData(weatherData: weatherData) {
  await pool.query(
    `INSERT INTO weather_observations
       (observed_at, temperature, humidity, latitude, longitude, weather_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (observed_at, latitude, longitude) DO NOTHING`,
    [
      weatherData.observed_at,
      weatherData.temperature,
      weatherData.humidity,
      weatherData.latitude,
      weatherData.longitude,
      weatherData.weather_code,
    ],
  );
}
