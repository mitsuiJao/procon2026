import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gublerThomas } from "../src/evalute";
import type { HourlyPoint } from "../src/evalute";

// rules.yaml の PM-1 と同じ値
const params = {
  startTempMin: 21,
  startTempMax: 30,
  startHours: 6,
  startDays: 3,
  goodTempMin: 21.1,
  goodTempMax: 29.4,
  goodHours: 6,
  gain: 20,
  loss: 10,
  hotDayMaxC: 35,
  indexMax: 100,
};

type Day = "good" | "cool" | "hot";

/** 1日24時間の気温。good = 25℃が8時間、cool = 終日15℃、hot = good に36℃の1時間を足す */
const dayTemps = (kind: Day): number[] => {
  const temps: number[] = Array.from({ length: 24 }, (_, h) => (kind !== "cool" && h >= 10 && h < 18 ? 25 : 15));
  if (kind === "hot") temps[13] = 36;
  return temps;
};

/** JST の 2026-06-01 から、日ごとの系列を作る。null の日は飛ばす（データ無し） */
const days = (...kinds: (Day | null)[]): HourlyPoint[] =>
  kinds.flatMap((kind, d) =>
    kind === null
      ? []
      : dayTemps(kind).map((tempC, h) => ({
          // JST 0時 = 前日の UTC 15時
          time: new Date(Date.UTC(2026, 5, 1 + d, h - 9)),
          tempC,
          rhPercent: 60,
        })),
  );
const repeat = <T>(x: T, n: number): T[] => Array.from({ length: n }, () => x);

describe("gublerThomas", () => {
  it("気温が1日分も無ければ null", () => {
    assert.equal(gublerThomas([], params), null);
  });

  it("開始条件（3日連続）に届かなければ 0", () => {
    assert.equal(gublerThomas(days("good", "good", "cool", "good", "good"), params), 0);
  });

  it("開始の翌日から加減算する", () => {
    // 3日で開始 → 翌日から +20 ×2
    assert.equal(gublerThomas(days("good", "good", "good", "good", "good"), params), 40);
    // +20 +20 -10
    assert.equal(gublerThomas(days("good", "good", "good", "good", "good", "cool"), params), 30);
  });

  it("上限 indexMax、下限 0 に収める", () => {
    assert.equal(gublerThomas(days(...repeat<Day>("good", 3 + 7)), params), 100);
    assert.equal(gublerThomas(days("good", "good", "good", "cool", "cool"), params), 0);
  });

  it("最高気温が hotDayMaxC 以上の日は減らす", () => {
    assert.equal(gublerThomas(days("good", "good", "good", "good", "good", "hot"), params), 30);
  });

  it("日付が飛ぶと開始条件の連続が切れる", () => {
    assert.equal(gublerThomas(days("good", "good", null, "good", "good"), params), 0);
  });
});
