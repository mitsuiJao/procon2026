import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRisks, evaluateRule } from "../src/evalute";
import { evaluators } from "../src/evalute/evaluate";
import type { HourlyPoint, Rule } from "../src/evalute";

const base = { enabled: true, candidateFrac: [], confidence: "A" as const, sourceIds: [] };

const whenRule: Rule = {
  ...base,
  id: "W",
  diseaseId: "d1",
  when: { var: "x", op: ">=", value: 10 },
  level: "conditions_met",
};

/** 渡された系列の長さを値として返す、テスト用の evaluator を使うルール */
const evalRule = (overrides: Partial<Rule> = {}): Rule => ({
  ...base,
  id: "E",
  diseaseId: "d1",
  evaluator: { name: "hoursForTest", params: { mid: 5, high: 10 } },
  ...overrides,
});

const hours = (n: number): HourlyPoint[] =>
  Array.from({ length: n }, (_, i) => ({ time: new Date(Date.UTC(2026, 5, 1, i)), tempC: 20, rhPercent: 80 }));

let calls = 0;
evaluators.hoursForTest = (hourly) => {
  calls += 1;
  return hourly.length === 0 ? null : hourly.length;
};

describe("evaluateRule", () => {
  it("when だけのルール: 真なら level、偽なら none、判定不能なら undetermined", () => {
    assert.equal(evaluateRule(whenRule, { scalars: { x: 10 }, hourly: [] }).level, "conditions_met");
    assert.equal(evaluateRule(whenRule, { scalars: { x: 9 }, hourly: [] }).level, "none");
    assert.equal(evaluateRule(whenRule, { scalars: {}, hourly: [] }).level, "undetermined");
  });

  it("evaluator の値を mid / high で分ける。null なら undetermined", () => {
    const r = evalRule();
    assert.equal(evaluateRule(r, { scalars: {}, hourly: hours(4) }).level, "none");
    assert.equal(evaluateRule(r, { scalars: {}, hourly: hours(5) }).level, "near_threshold");
    assert.equal(evaluateRule(r, { scalars: {}, hourly: hours(10) }).level, "conditions_met");
    assert.equal(evaluateRule(r, { scalars: {}, hourly: hours(10) }).value, 10);
    assert.equal(evaluateRule(r, { scalars: {}, hourly: [] }).level, "undetermined");
  });

  it("when がゲートのとき、偽・判定不能なら evaluator を呼ばない", () => {
    const r = evalRule({ when: { var: "x", op: ">=", value: 1 } });
    calls = 0;
    assert.equal(evaluateRule(r, { scalars: { x: 0 }, hourly: hours(10) }).level, "none");
    assert.equal(evaluateRule(r, { scalars: {}, hourly: hours(10) }).level, "undetermined");
    assert.equal(calls, 0);
    assert.equal(evaluateRule(r, { scalars: { x: 1 }, hourly: hours(10) }).level, "conditions_met");
    assert.equal(calls, 1);
  });
});

describe("evaluateRisks", () => {
  const rule = (id: string, diseaseId: string, value: number, level: "near_threshold" | "conditions_met", enabled = true): Rule => ({
    ...base,
    id,
    diseaseId,
    enabled,
    when: { var: "x", op: ">=", value },
    level,
  });

  it("病害ごとに 該当 > 近い > 判定不能 > 該当なし でまとめる", () => {
    const rules = [
      rule("A1", "a", 0, "near_threshold"),
      rule("A2", "a", 0, "conditions_met"),
      rule("B1", "b", 100, "conditions_met"),
      { ...rule("B2", "b", 0, "near_threshold"), when: { var: "missing", op: ">=" as const, value: 0 } },
      rule("C1", "c", 100, "conditions_met"),
    ];
    const result = evaluateRisks(rules, { scalars: { x: 1 }, hourly: [] });
    const level = (id: string) => result.find((d) => d.diseaseId === id)?.level;
    assert.equal(level("a"), "conditions_met");
    assert.equal(level("b"), "undetermined");
    assert.equal(level("c"), "none");
    assert.equal(result.find((d) => d.diseaseId === "a")?.rules.length, 2);
  });

  it("enabled: false のルールは includeDisabled のときだけ評価する", () => {
    const rules = [rule("D1", "d", 0, "conditions_met", false)];
    assert.deepEqual(evaluateRisks(rules, { scalars: { x: 1 }, hourly: [] }), []);
    assert.equal(evaluateRisks(rules, { scalars: { x: 1 }, hourly: [] }, { includeDisabled: true })[0].level, "conditions_met");
  });
});
