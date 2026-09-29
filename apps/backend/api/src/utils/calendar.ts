import { getPlace } from "../db/settings";
import { getForecastByRange } from "../db/weather";
import { getSensorDailyByRange } from "../db/measure";
import {
  jstDate,
  mergeDaily,
  pointsFromForecast,
  sensorToDaily,
  summarizeDaily,
  type DailyWeather,
} from "./weather-daily";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: Record<string, DailyWeather> }>();

export async function getCalendarWeather(start: string, end: string) {
  const key = `${start}:${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const from = new Date(`${start}T00:00:00+09:00`);
  const to = new Date(new Date(`${end}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000);

  const place = await getPlace();
  const [forecastRows, sensorDaily] = await Promise.all([
    getForecastByRange(from, to, place.latitude, place.longitude),
    getSensorDailyByRange(from, to),
  ]);

  const value = mergeDaily(
    sensorToDaily(sensorDaily),
    summarizeDaily(pointsFromForecast(forecastRows)),
    jstDate(new Date()),
  );
  cache.set(key, { at: Date.now(), value });
  return value;
}
