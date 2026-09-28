import { Hono } from "hono";
import { getLatestMeasuresByDevice, getRainfallSumByDevice } from "../db/measure";
import { DAY_MS, STALE_MS } from "./helpers";

export const sensors = new Hono();

type Reading = { value: number; received_at: string };

/**
 * デバイスごとのセンサー状態
 * GET /sensors
 * @returns { device, temp, humidity, rainfall_24h, updated_at, stale }[] device 昇順
 *   temp/humidity は { value, received_at } か null、rainfall_24h は直近24時間に受信が無ければ null
 */
sensors.get("/", async (c) => {
  const now = Date.now();
  const [latest, rainfall] = await Promise.all([
    getLatestMeasuresByDevice(),
    getRainfallSumByDevice(new Date(now - DAY_MS)),
  ]);

  const byDevice = new Map<string, typeof latest>();
  for (const r of latest) {
    const rows = byDevice.get(r.device) ?? [];
    rows.push(r);
    byDevice.set(r.device, rows);
  }

  const toReading = (r: (typeof latest)[number] | undefined): Reading | null =>
    r ? { value: r.value, received_at: r.received_at.toISOString() } : null;
  const isFresh = (r: (typeof latest)[number] | undefined) =>
    r != null && now - r.received_at.getTime() <= STALE_MS;

  return c.json(
    [...byDevice].map(([device, rows]) => {
      const temp = rows.find((r) => r.metric === "temp");
      const humidity = rows.find((r) => r.metric === "humidity");
      return {
        device,
        temp: toReading(temp),
        humidity: toReading(humidity),
        rainfall_24h: rainfall[device] ?? null,
        updated_at: new Date(Math.max(...rows.map((r) => r.received_at.getTime()))).toISOString(),
        stale: !(isFresh(temp) && isFresh(humidity)),
      };
    }),
  );
});
