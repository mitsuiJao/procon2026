import { Hono } from "hono";
import { getLatestMeasures } from "../db/measure";
import { getPlace } from "../db/settings";
import { getForecastByRange } from "../db/weather";
import { HOUR_MS, STALE_MS } from "./helpers";

export const current = new Hono();

/**
 * 現在値
 * GET /current
 * @returns { temp, humidity, rainfall, code, updated_at, stale } 無い場合Null
 */
current.get("/", async (c) => {
  const now = Date.now();
  const hourStart = new Date(Math.floor(now / HOUR_MS) * HOUR_MS);
  const place = await getPlace();
  const [latest, forecast] = await Promise.all([
    getLatestMeasures(),
    getForecastByRange(hourStart, new Date(hourStart.getTime() + HOUR_MS), place.latitude, place.longitude),
  ]);

  const byMetric = new Map(latest.map((r) => [r.metric, r]));
  const temp = byMetric.get("temp");
  const humidity = byMetric.get("humidity");
  const rainfall = byMetric.get("rainfall");
  const received = latest.map((r) => r.received_at.getTime());
  const isFresh = (r: typeof temp) => r != null && now - r.received_at.getTime() <= STALE_MS;

  return c.json({
    temp: temp?.value ?? null,
    humidity: humidity?.value ?? null,
    rainfall: rainfall?.value ?? null,
    code: forecast[0]?.weather_code ?? null,
    updated_at: received.length ? new Date(Math.max(...received)).toISOString() : null,
    stale: !(isFresh(temp) && isFresh(humidity)),
  });
});
