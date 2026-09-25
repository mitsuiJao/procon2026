import { pool } from "./client";

type weatherData = {
  observed_at: string,
  temperature: number,
  humidity: number,
  latitude: number,
  longitude: number,
  weather_code: number
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
