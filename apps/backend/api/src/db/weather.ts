import { pool } from "./client";

type weatherData = {
  observed_at: string,
  temperature: number,
  humidity: number,
  latitude: number,
  longitude: number,
  weather_code: number
}

/**
 * 指定期間地点の天気予報を取得
 * @param start 開始日時 閉区間
 * @param end 終了日時 開区間
 * @param latitude 緯度
 * @param longitude 経度
 * @returns { observed_at, temperature, humidity, latitude, longitude, weather_code }[] 時刻昇順
 */
export async function getForecastByRange(start: Date, end: Date, latitude: number, longitude: number) {
  const { rows } = await pool.query(
    `SELECT observed_at,
            temperature::float8 AS temperature,
            humidity::float8 AS humidity,
            latitude, longitude, weather_code
       FROM weather_forecasts
      WHERE observed_at >= $1 AND observed_at < $2
        AND latitude = $3 AND longitude = $4
      ORDER BY observed_at`,
    [start, end, latitude, longitude],
  );
  return rows;
}

/**
 * 天気予報を1時間分保存、同じ時刻, 緯度, 経度があれば上書き
 * @param weatherData weatherData型の予報
 */
export async function writeForecast(weatherData: weatherData) {
  await pool.query(
    `INSERT INTO weather_forecasts
       (observed_at, temperature, humidity, latitude, longitude, weather_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (observed_at, latitude, longitude) DO UPDATE
       SET temperature  = EXCLUDED.temperature,
           humidity     = EXCLUDED.humidity,
           weather_code = EXCLUDED.weather_code`,
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
