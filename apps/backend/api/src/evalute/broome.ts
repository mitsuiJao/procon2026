import type { HourlyPoint } from "./types";

/**
 * 灰色かび病 Broome 式（UC IPM 実装仕様）。
 *   logit = b0 + bW*W + bWT*W*T + bWT2*W*T^2
 * 濡れ: 時別 RH >= wetRhMin。乾燥が dryResetHours を超えたら事象を打ち切る。
 * T は濡れ期間の平均気温を tMin〜tMax に丸める。tHardMax 超は感染不適（事象を無視）。
 * 欠損（RH が null）は濡れ／乾燥のどちらでもなく、事象を継続扱いにせず乾燥として数える。
 * @returns 渡された期間内の事象ごとの logit の最大値。事象がなければ null
 */
export function broome(
  hourly: HourlyPoint[],
  p: Record<string, number>,
): number | null {
  let best: number | null = null;
  let wetHours = 0;
  let tempSum = 0;
  let dryRun = 0;
  let open = false;

  const close = () => {
    if (open && wetHours > 0) {
      const meanT = tempSum / wetHours;
      if (meanT <= p.tHardMax) {
        const t = Math.min(Math.max(meanT, p.tMin), p.tMax);
        const logit =
          p.b0 + p.bW * wetHours + p.bWT * wetHours * t + p.bWT2 * wetHours * t * t;
        if (best === null || logit > best) best = logit;
      }
    }
    wetHours = 0;
    tempSum = 0;
    dryRun = 0;
    open = false;
  };

  for (const h of hourly) {
    const wet = h.rhPercent !== null && h.tempC !== null && h.rhPercent >= p.wetRhMin;
    if (wet) {
      open = true;
      dryRun = 0;
      wetHours += 1;
      tempSum += h.tempC as number;
    } else if (open) {
      dryRun += 1;
      if (dryRun > p.dryResetHours) close();
    }
  }
  close();
  return best;
}
