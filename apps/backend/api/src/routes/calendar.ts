import { Hono } from "hono";
import { getCalendarWeather } from "../utils/calendar";
import { getCalendarRisks } from "../utils/calendarRisk";
import { parseRange } from "./helpers";

export const calendar = new Hono();

/**
 * カレンダー用の日次天気
 * GET /calendar?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { "YYYY-MM-DD": { tmax, tmin, humidity, code } }
 */
calendar.get("/", async (c) => {
  const range = parseRange(c.req.query("start"), c.req.query("end"));
  if ("error" in range) return c.json(range, 400);

  return c.json(await getCalendarWeather(range.start, range.end));
});

/**
 * カレンダー用の日次病害リスク
 * GET /calendar/risk?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { "YYYY-MM-DD": { stage, stageSource, diseases } }
 */
calendar.get("/risk", async (c) => {
  const range = parseRange(c.req.query("start"), c.req.query("end"));
  if ("error" in range) return c.json(range, 400);

  return c.json(await getCalendarRisks(range.start, range.end));
});
