import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { loadRules, maxLevelOf, resolveRule, resolveRules } from "../src/evalute";
import type { RuleDef } from "../src/evalute";

const base = { enabled: true, candidateFrac: [], confidence: "B" as const, sourceIds: [] };

const whenDef: RuleDef = {
  ...base,
  id: "W",
  diseaseId: "d1",
  params: { rainMin: 10 },
  when: { all: [{ var: "stage", op: ">=", value: 2 }, { var: "rain24hMm", op: ">=", value: "$rainMin" }] },
  level: "conditions_met",
  levels: [{ rainMin: 8 }, { rainMin: 6 }],
};

const evalDef: RuleDef = {
  ...base,
  id: "E",
  diseaseId: "d2",
  enabled: false,
  evaluator: { name: "broome", params: { mid: 0.5, high: 1 } },
  levels: [{ enabled: true }, { mid: 0.3 }],
};

const plainDef: RuleDef = {
  ...base,
  id: "P",
  diseaseId: "d3",
  when: { var: "rain24hMm", op: ">=", value: 1 },
  level: "near_threshold",
};

describe("resolveRule", () => {
  it("段階 0 は本体の値のまま。参照は数値になり、params / levels は残らない", () => {
    assert.deepEqual(resolveRule(whenDef), {
      ...base,
      id: "W",
      diseaseId: "d1",
      when: { all: [{ var: "stage", op: ">=", value: 2 }, { var: "rain24hMm", op: ">=", value: 10 }] },
      level: "conditions_met",
    });
  });

  it("段階までの上書きを順に重ねる", () => {
    const rain = (level: number) => (resolveRule(whenDef, level).when as any).all[1].value;
    assert.equal(rain(1), 8);
    assert.equal(rain(2), 6);
    // 段階 2 は段階 1 の enabled を引き継ぎ、mid を足す
    assert.deepEqual(resolveRule(evalDef, 1).evaluator?.params, { mid: 0.5, high: 1 });
    assert.equal(resolveRule(evalDef, 1).enabled, true);
    assert.deepEqual(resolveRule(evalDef, 2).evaluator?.params, { mid: 0.3, high: 1 });
    assert.equal(resolveRule(evalDef, 2).enabled, true);
  });

  it("段階が levels の件数を超えたら、最後の段階までを使う", () => {
    assert.deepEqual(resolveRule(whenDef, 9), resolveRule(whenDef, 2));
  });

  it("levels の無いルールは段階で変わらない", () => {
    assert.deepEqual(resolveRule(plainDef, 2), resolveRule(plainDef, 0));
  });

  it("元の定義を書き換えない", () => {
    resolveRule(evalDef, 2);
    assert.deepEqual(evalDef.evaluator?.params, { mid: 0.5, high: 1 });
    assert.equal(evalDef.enabled, false);
  });
});

describe("resolveRules / maxLevelOf", () => {
  const defs = [whenDef, evalDef, plainDef];

  it("病害ごとの段階で確定させる。指定の無い病害は段階 0", () => {
    const [w, e] = resolveRules(defs, { d1: 1 });
    assert.equal((w.when as any).all[1].value, 8);
    assert.equal(e.enabled, false);
  });

  it("選べる最大の段階は、その病害で levels が最も長いルールの件数", () => {
    assert.equal(maxLevelOf(defs, "d1"), 2);
    assert.equal(maxLevelOf(defs, "d3"), 0);
    assert.equal(maxLevelOf(defs, "unknown"), 0);
  });
});

describe("loadRules の検証（params / levels）", () => {
  const vocabDir = path.join(__dirname, "../../data/vocab");
  const dir = mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
  const load = (yaml: string) => {
    const file = path.join(dir, "rules.yaml");
    writeFileSync(file, yaml);
    return loadRules(file, vocabDir);
  };
  const rule = (extra: string, value = "$rainMin") => `
- id: T-1
  diseaseId: downy_mildew
  enabled: true
  when: { var: rain24hMm, op: ">=", value: ${value} }
  level: conditions_met
  candidateFrac: []
  confidence: B
  sourceIds: []
${extra}`;

  it("参照と上書きが揃っていれば通る", () => {
    assert.equal(load(rule("  params: { rainMin: 10 }\n  levels: [{ rainMin: 8 }, { enabled: false }]")).length, 1);
  });

  it("params に無い参照は例外", () => {
    assert.throws(() => load(rule("")), /params に無い参照/);
    assert.throws(() => load(rule("  params: { other: 1 }")), /params に無い参照/);
  });

  it("stage の条件では参照を使えない", () => {
    const yaml = rule("  params: { s: 2 }").replace("var: rain24hMm", "var: stage").replace("$rainMin", "$s");
    assert.throws(() => load(yaml), /stage の条件/);
  });

  it("levels のキーが params にも evaluator.params にも無ければ例外", () => {
    assert.throws(() => load(rule("  params: { rainMin: 10 }\n  levels: [{ rainMax: 8 }]")), /levels のキー rainMax/);
  });

  it("levels の値の型が違えば例外", () => {
    assert.throws(() => load(rule("  params: { rainMin: 10 }\n  levels: [{ rainMin: low }]")), /数値にしてください/);
    assert.throws(() => load(rule("  params: { rainMin: 10 }\n  levels: [{ enabled: 1 }]")), /true \/ false/);
    assert.throws(() => load(rule("  params: { rainMin: 10 }\n  levels: []")), /1件以上/);
  });

  it("repeatDays は正の整数。levels では上書きできない", () => {
    assert.equal(load(rule("  params: { rainMin: 10 }\n  repeatDays: 7")).length, 1);
    for (const v of ["0", "1.5", "seven"]) {
      assert.throws(() => load(rule(`  params: { rainMin: 10 }\n  repeatDays: ${v}`)), /repeatDays は正の整数/);
    }
    assert.throws(() => load(rule("  params: { rainMin: 10 }\n  levels: [{ repeatDays: 3 }]")), /levels のキー repeatDays/);
  });
});
