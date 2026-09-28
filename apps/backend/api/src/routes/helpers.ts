import type { Context } from "hono";

export const MAX_RANGE_DAYS = 400;
export const STALE_MS = 15 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// 日付妥当性
export function isValidDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00+09:00`);
  return !Number.isNaN(d.getTime()) && d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === s;
}

/** start, end クエリ（YYYY-MM-DD, 両端含む）を検証する */
export function parseRange(start: string | undefined, end: string | undefined): { start: string; end: string } | { error: string } {
  if (!isValidDate(start) || !isValidDate(end)) return { error: "start and end must be valid YYYY-MM-DD dates" };
  const days = (Date.parse(`${end}T00:00:00+09:00`) - Date.parse(`${start}T00:00:00+09:00`)) / DAY_MS;
  if (days < 0) return { error: "start must be on or before end" };
  if (days >= MAX_RANGE_DAYS) return { error: `range must be under ${MAX_RANGE_DAYS} days` };
  return { start, end };
}

/** JSON の body を読む。壊れていれば null */
export async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  const body = await c.req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

/** 数字だけのパスパラメータを id にする。不正なら null */
export function parseId(s: string): number | null {
  return /^\d{1,15}$/.test(s) ? Number(s) : null;
}

export const jstToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
