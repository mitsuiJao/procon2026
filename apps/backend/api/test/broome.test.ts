import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { broome } from "../src/evalute";
import type { HourlyPoint } from "../src/evalute";

// rules.yaml の BOT-1 と同じ係数
const params = {
  b0: -2.647866,
  bW: -0.374927,
  bWT: 0.061601,
  bWT2: -0.001511,
  tMin: 12,
  tMax: 32,
  tHardMax: 40,
  wetRhMin: 95,
  dryResetHours: 4,
};

const WET = { tempC: 20, rhPercent: 97 };
const DRY = { tempC: 20, rhPercent: 60 };
const MISSING = { tempC: null, rhPercent: null };

/** 1時間ごとの系列を作る */
const series = (...points: { tempC: number | null; rhPercent: number | null }[]): HourlyPoint[] =>
  points.map((p, i) => ({ time: new Date(Date.UTC(2026, 5, 1, i)), ...p }));
const repeat = <T>(x: T, n: number): T[] => Array.from({ length: n }, () => x);

/** 20℃で W 時間濡れたときの logit（手計算） */
const logitAt20 = (w: number) => params.b0 + params.bW * w + params.bWT * w * 20 + params.bWT2 * w * 400;

const close = (actual: number | null, expected: number) => {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
};

describe("broome", () => {
  it("データが無ければ null（判定不能）", () => {
    assert.equal(broome([], params), null);
    assert.equal(broome(series(...repeat(MISSING, 5)), params), null);
  });

  it("データはあるが濡れが無ければ -100（該当なし相当）", () => {
    assert.equal(broome(series(...repeat(DRY, 24)), params), -100);
  });

  it("20℃で10時間濡れたときの logit", () => {
    close(broome(series(...repeat(WET, 10)), params), -0.120936);
  });

  it("乾燥が dryResetHours までなら事象は続き、超えると切れる", () => {
    // 5h 濡れ + 4h 乾燥 + 5h 濡れ → 10h の1事象
    close(broome(series(...repeat(WET, 5), ...repeat(DRY, 4), ...repeat(WET, 5)), params), logitAt20(10));
    // 5h 濡れ + 5h 乾燥 + 5h 濡れ → 5h の事象が2つ
    close(broome(series(...repeat(WET, 5), ...repeat(DRY, 5), ...repeat(WET, 5)), params), logitAt20(5));
  });

  it("欠測の時間は乾燥として数える", () => {
    close(broome(series(...repeat(WET, 5), ...repeat(MISSING, 5), ...repeat(WET, 5)), params), logitAt20(5));
  });

  it("濡れ期間の平均気温が tHardMax を超える事象は無視する", () => {
    assert.equal(broome(series(...repeat({ tempC: 41, rhPercent: 97 }, 10)), params), -100);
  });

  it("平均気温は tMin〜tMax に丸める", () => {
    const at = (t: number) => broome(series(...repeat({ tempC: t, rhPercent: 97 }, 10)), params);
    assert.equal(at(5), at(12));
    assert.equal(at(35), at(32));
  });
});
