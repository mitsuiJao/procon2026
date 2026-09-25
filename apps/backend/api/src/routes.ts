import { Hono } from "hono";
import { getLatestMeasures } from "./db/measure";
import { getPlace } from "./db/settings";
import { getForecastByRange } from "./db/weather";
import { getCalendarWeather } from "./utils/calendar";

const MAX_RANGE_DAYS = 400;
const STALE_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// 日付妥当性
function isValidDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00+09:00`);
  return !Number.isNaN(d.getTime()) && d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === s;
}

export const routes = new Hono();

/**
 * カレンダー用の日次天気
 * GET /calendar?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { "YYYY-MM-DD": { tmax, tmin, humidity, code } }
 */
routes.get("/calendar", async (c) => {
  const { start, end } = c.req.query();
  if (!isValidDate(start) || !isValidDate(end)) {
    return c.json({ error: "start and end must be valid YYYY-MM-DD dates" }, 400);
  }
  const days = (Date.parse(`${end}T00:00:00+09:00`) - Date.parse(`${start}T00:00:00+09:00`)) / DAY_MS;
  if (days < 0) return c.json({ error: "start must be on or before end" }, 400);
  if (days >= MAX_RANGE_DAYS) return c.json({ error: `range must be under ${MAX_RANGE_DAYS} days` }, 400);

  return c.json(await getCalendarWeather(start, end));
});

/**
 * 現在値
 * GET /current
 * @returns { temp, humidity, rainfall, code, updated_at, stale } 無い場合Null
 */
routes.get("/current", async (c) => {
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
