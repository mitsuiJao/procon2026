import type { HourlyPoint } from "./types";

/** UTC の Date を JST の日付文字列 (YYYY-MM-DD) にする */
function jstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * うどんこ病 Gubler-Thomas 指数（0〜indexMax）。JST の日付ごとに集計する。
 * 開始: startTempMin〜startTempMax ℃が startHours 時間以上の日が startDays 日連続。
 *   文献で開始日があいまいなため、連続の最終日を開始日とし、指数は翌日から加減算する。
 * 開始後: goodTemp 範囲が goodHours 時間を超えた日 +gain、それ以外 −loss、
 *   日最高気温が hotDayMaxC 以上の日は −loss。
 * 渡された系列の範囲だけで再計算する（指数は保存しない）。
 * @returns 最終日の指数。気温データが1日分もなければ null。開始条件未達なら 0
 */
export function gublerThomas(
  hourly: HourlyPoint[],
  p: Record<string, number>,
): number | null {
  const days = new Map<string, number[]>();
  for (const h of hourly) {
    if (h.tempC === null) continue;
    const key = jstDate(h.time);
    const arr = days.get(key);
    if (arr) arr.push(h.tempC);
    else days.set(key, [h.tempC]);
  }
  if (days.size === 0) return null;

  const keys = [...days.keys()].sort();
  let started = false;
  let streak = 0;
  let index = 0;
  let prevKey: string | null = null;

  for (const key of keys) {
    const temps = days.get(key)!;
    // 日付が飛んだら連続は途切れる
    if (prevKey !== null && !isNextDay(prevKey, key)) streak = 0;
    prevKey = key;

    if (started) {
      const goodHrs = temps.filter((t) => t >= p.goodTempMin && t <= p.goodTempMax).length;
      const hot = Math.max(...temps) >= p.hotDayMaxC;
      if (goodHrs > p.goodHours && !hot) index += p.gain;
      else index -= p.loss;
      index = Math.min(Math.max(index, 0), p.indexMax);
    } else {
      const startHrs = temps.filter((t) => t >= p.startTempMin && t <= p.startTempMax).length;
      streak = startHrs >= p.startHours ? streak + 1 : 0;
      if (streak >= p.startDays) started = true;
    }
  }
  return index;
}

function isNextDay(a: string, b: string): boolean {
  const next = new Date(Date.parse(`${a}T00:00:00Z`) + 24 * 3600 * 1000);
  return next.toISOString().slice(0, 10) === b;
}
