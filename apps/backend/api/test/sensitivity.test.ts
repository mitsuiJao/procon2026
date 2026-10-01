import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Rule } from "../src/evalute";
import type { DayInput } from "../src/utils/calendarRisk";
import { chooseLevel, firedDates } from "../src/utils/sensitivity";

const base = { enabled: true, candidateFrac: [], confidence: "B" as const, sourceIds: [] };

const day = (date: string, rain24hMm: number | null): DayInput => ({
  date,
  stage: 2,
  stageSource: "recorded",
  scalars: { rain24hMm },
  hourlyFor: () => [],
});

describe("firedDates", () => {
  const rule = (overrides: Partial<Rule>): Rule => ({
    ...base,
    id: "R",
    diseaseId: "d1",
    when: { var: "rain24hMm", op: ">=", value: 10 },
    level: "conditions_met",
    ...overrides,
  });
  const days = [day("2026-06-01", 12), day("2026-06-02", 5), day("2026-06-03", null)];

  it("該当・条件に近い日だけを数える。該当なし・判定不能の日は含めない", () => {
    assert.deepEqual([...firedDates([rule({})], "d1", days)], ["2026-06-01"]);
    assert.deepEqual([...firedDates([rule({ level: "near_threshold" })], "d1", days)], ["2026-06-01"]);
  });

  it("ほかの病害のルールと、無効のルールは数えない", () => {
    assert.equal(firedDates([rule({ diseaseId: "d2" })], "d1", days).size, 0);
    assert.equal(firedDates([rule({ enabled: false })], "d1", days).size, 0);
  });
});

describe("chooseLevel", () => {
  const latentDays: [number, number] = [4, 7];
  const choose = (firedByLevel: string[][], observations: string[], totalDays = 100) =>
    chooseLevel({ firedByLevel: firedByLevel.map((d) => new Set(d)), observations, latentDays, totalDays });

  it("発見日の 最長日前〜最短日前 に警告があれば、事前に警告できた発生として数える", () => {
    const caught = (firedOn: string) => choose([[firedOn]], ["2026-06-10"]).caught;
    assert.equal(caught("2026-06-03"), 1); // 7日前
    assert.equal(caught("2026-06-06"), 1); // 4日前
    assert.equal(caught("2026-06-02"), 0); // 8日前
    assert.equal(caught("2026-06-07"), 0); // 3日前
  });

  it("発生を最も多く拾える段階を選ぶ", () => {
    const c = choose([[], ["2026-06-05"], ["2026-06-05", "2026-06-20"]], ["2026-06-10", "2026-06-25"]);
    assert.deepEqual(c, { level: 2, observed: 2, caught: 2, alertDays: 2, totalDays: 100 });
  });

  it("拾える件数が同じなら鈍い段階", () => {
    const c = choose([[], ["2026-06-05"], ["2026-06-05", "2026-06-20"]], ["2026-06-10"]);
    assert.equal(c.level, 1);
  });

  it("発生記録が無ければ段階 0", () => {
    assert.equal(choose([[], ["2026-06-05"]], []).level, 0);
  });

  it("警告日数が上限（25%）を超える段階は、発生を拾えても選ばない", () => {
    const many = Array.from({ length: 6 }, (_, i) => `2026-06-0${i + 1}`);
    // 20日中 6日 = 30% > 25%
    assert.equal(choose([[], many], ["2026-06-10"], 20).level, 0);
    // 24日中 6日 = 25% は上限ちょうどなので選べる
    assert.equal(choose([[], many], ["2026-06-10"], 24).level, 1);
    // 上限を超える段階を飛ばして、その先の段階は選べない場合も段階 0 のまま
    assert.equal(choose([[], many, many], ["2026-06-10"], 20).level, 0);
  });

  it("段階 0 は警告日数が上限を超えていても候補に残る", () => {
    const many = Array.from({ length: 9 }, (_, i) => `2026-06-0${i + 1}`);
    const c = choose([many], ["2026-06-10"], 10);
    assert.deepEqual(c, { level: 0, observed: 1, caught: 1, alertDays: 9, totalDays: 10 });
  });
});
