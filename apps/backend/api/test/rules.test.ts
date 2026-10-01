import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRule, maxLevelOf, resolveRules } from "../src/evalute";
import { getDiseasesVocab, getRuleDefs, getRules } from "../src/utils/vocab";

describe("rules.yaml", () => {
  it("vocab との突き合わせを通る", () => {
    assert.ok(getRules().length > 0);
  });

  it("DM-1: 展葉期以降・平均10℃以上・雨10mm以上で該当", () => {
    const dm1 = getRules().find((r) => r.id === "DM-1")!;
    const level = (rain24hMm: number | null) =>
      evaluateRule(dm1, { scalars: { stage: 2, tempMeanC: 12, rain24hMm }, hourly: [] }).level;
    assert.equal(level(10), "conditions_met");
    assert.equal(level(9.9), "none");
    assert.equal(level(null), "undetermined");
    // 展葉期より前なら雨量があっても該当しない
    assert.equal(
      evaluateRule(dm1, { scalars: { stage: 1, tempMeanC: 12, rain24hMm: 20 }, hourly: [] }).level,
      "none",
    );
  });

  it("ANT-1: 萌芽期〜肥大期の1mm以上の雨で「条件に近い」", () => {
    const ant1 = getRules().find((r) => r.id === "ANT-1")!;
    assert.equal(ant1.enabled, true);
    const level = (stage: number, rain24hMm: number) =>
      evaluateRule(ant1, { scalars: { stage, rain24hMm }, hourly: [] }).level;
    assert.equal(level(1, 1), "near_threshold");
    assert.equal(level(7, 1), "near_threshold");
    assert.equal(level(8, 20), "none");
    assert.equal(level(3, 0.9), "none");
  });

  it("DM-1: 感度の段階を上げると、少ない雨でも該当する（10 → 8 → 6mm）", () => {
    const level = (sensitivity: number, rain24hMm: number) => {
      const dm1 = resolveRules(getRuleDefs(), { downy_mildew: sensitivity }).find((r) => r.id === "DM-1")!;
      return evaluateRule(dm1, { scalars: { stage: 2, tempMeanC: 12, rain24hMm }, hourly: [] }).level;
    };
    assert.equal(level(0, 8), "none");
    assert.equal(level(1, 8), "conditions_met");
    assert.equal(level(1, 7.9), "none");
    assert.equal(level(2, 6), "conditions_met");
  });

  it("晩腐病・さび病のルールは段階 1 で有効になる", () => {
    const enabled = (levels: Record<string, number>) =>
      resolveRules(getRuleDefs(), levels)
        .filter((r) => r.enabled)
        .map((r) => r.id);
    assert.ok(!enabled({}).some((id) => ["RR-1", "RR-2", "RUST-1"].includes(id)));
    const on = enabled({ ripe_rot: 1, rust: 1 });
    for (const id of ["RR-1", "RR-2", "RUST-1"]) assert.ok(on.includes(id), id);
  });

  it("病害ごとの最大の段階と、潜伏期間", () => {
    const defs = getRuleDefs();
    assert.equal(maxLevelOf(defs, "downy_mildew"), 2);
    assert.equal(maxLevelOf(defs, "ripe_rot"), 1);
    assert.equal(maxLevelOf(defs, "anthracnose"), 0);
    assert.deepEqual(getDiseasesVocab().find((d) => d.id === "downy_mildew")?.latentDays, [4, 7]);
  });
});
