import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRule, maxLevelOf, resolveRules } from "../src/evalute";
import { getDiseasesVocab, getRuleDefs, getRules } from "../src/utils/vocab";

describe("rules.yaml", () => {
  it("vocab との突き合わせを通る", () => {
    assert.ok(getRules().length > 0);
  });

  it("DM-1: 展葉期〜収穫期・平均10℃以上・雨10mm以上で該当", () => {
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
    // 収穫後は該当しない
    assert.equal(
      evaluateRule(dm1, { scalars: { stage: 10, tempMeanC: 12, rain24hMm: 20 }, hourly: [] }).level,
      "none",
    );
  });

  it("ANT-1: 萌芽期〜肥大期の5mm以上の雨で「条件に近い」。段階で 3 → 1mm", () => {
    const level = (sensitivity: number, stage: number, rain24hMm: number) => {
      const ant1 = resolveRules(getRuleDefs(), { anthracnose: sensitivity }).find((r) => r.id === "ANT-1")!;
      assert.equal(ant1.enabled, true);
      return evaluateRule(ant1, { scalars: { stage, rain24hMm }, hourly: [] }).level;
    };
    assert.equal(level(0, 1, 5), "near_threshold");
    assert.equal(level(0, 7, 5), "near_threshold");
    assert.equal(level(0, 8, 20), "none");
    assert.equal(level(0, 3, 4.9), "none");
    assert.equal(level(1, 3, 3), "near_threshold");
    assert.equal(level(2, 3, 1), "near_threshold");
    assert.equal(level(2, 3, 0.9), "none");
  });

  it("PM-1: 着色期まで。収穫期以降は指数を計算せず none", () => {
    const pm1 = getRules().find((r) => r.id === "PM-1")!;
    const hourly = Array.from({ length: 24 * 10 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 6, 1, i)),
      tempC: 25,
      rhPercent: 60,
    }));
    assert.equal(evaluateRule(pm1, { scalars: { stage: 8 }, hourly }).level, "conditions_met");
    assert.equal(evaluateRule(pm1, { scalars: { stage: 9 }, hourly }).level, "none");
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
    assert.equal(maxLevelOf(defs, "anthracnose"), 2);
    assert.deepEqual(getDiseasesVocab().find((d) => d.id === "downy_mildew")?.latentDays, [4, 7]);
  });

  it("repeatDays は latentDays の幅以下（出し直しの間に、事前に警告できたかの期間が収まる）", () => {
    for (const r of getRuleDefs()) {
      if (!r.repeatDays) continue;
      const [min, max] = getDiseasesVocab().find((d) => d.id === r.diseaseId)!.latentDays;
      assert.ok(r.repeatDays <= max - min + 1, r.id);
    }
    assert.equal(getRuleDefs().find((r) => r.id === "PM-1")?.repeatDays, 7);
    for (const r of getRuleDefs()) if (r.id !== "PM-1") assert.equal(r.repeatDays, 3, r.id);
  });
});
