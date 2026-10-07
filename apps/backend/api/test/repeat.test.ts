import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRepeat, groupByDisease } from "../src/evalute";
import type { ResultLevel, Rule, RuleResult } from "../src/evalute";

const base = { enabled: true, candidateFrac: [], confidence: "A" as const, sourceIds: [] };
const rule = (overrides: Partial<Rule> = {}): Rule => ({
  ...base,
  id: "R",
  diseaseId: "d1",
  evaluator: { name: "x", params: { mid: 40, high: 60 } },
  repeatDays: 7,
  ...overrides,
});

const short: Record<string, ResultLevel> = {
  n: "none",
  u: "undetermined",
  N: "near_threshold",
  M: "conditions_met",
};

/** "NMMM" のような1文字1日の並びから、6/1 始まりの日ごとの結果を作る */
const series = (pattern: string, ruleId = "R", diseaseId = "d1") => {
  const dates = [...pattern].map((_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`);
  const perDay: RuleResult[][] = [...pattern].map((c) => [
    { ruleId, diseaseId, level: short[c], candidateFrac: [] },
  ]);
  return { dates, perDay };
};

/** 警告を出した日を "!"、続いていて出さなかった日を "-"、警告でない日を "." にする */
const shown = (perDay: RuleResult[][], ruleId = "R") =>
  perDay
    .map((rs) => {
      const r = rs.find((x) => x.ruleId === ruleId)!;
      if (r.level !== "near_threshold" && r.level !== "conditions_met") return ".";
      return r.ongoingSince ? "-" : "!";
    })
    .join("");

describe("applyRepeat", () => {
  it("続き始めた日と、そこから repeatDays 日ごとに出す", () => {
    const { dates, perDay } = series("MMMMMMMMMMMMMMM");
    applyRepeat([rule()], dates, perDay);
    assert.equal(shown(perDay), "!------!------!");
    assert.equal(perDay[1][0].ongoingSince, "2026-06-01");
  });

  it("レベルが上がっても下がっても出し直さない", () => {
    const { dates, perDay } = series("NMMMMMMMNNM");
    applyRepeat([rule()], dates, perDay);
    assert.equal(shown(perDay), "!------!---");
    // 続き始めた日は最初の N の日のまま
    assert.equal(perDay[2][0].ongoingSince, "2026-06-01");
  });

  it("none / undetermined で途切れ、次の警告は新しく続き始めた日になる", () => {
    const { dates, perDay } = series("MMnMMuMM");
    applyRepeat([rule()], dates, perDay);
    assert.equal(shown(perDay), "!-.!-.!-");
    assert.equal(perDay[4][0].ongoingSince, "2026-06-04");
  });

  it("repeatDays の無いルールは変えない", () => {
    const { dates, perDay } = series("MMMM");
    applyRepeat([rule({ repeatDays: undefined })], dates, perDay);
    assert.equal(shown(perDay), "!!!!");
  });

  it("level と value は変えない", () => {
    const { dates, perDay } = series("MM");
    applyRepeat([rule()], dates, perDay);
    assert.equal(perDay[1][0].level, "conditions_met");
  });
});

describe("groupByDisease の ongoingSince", () => {
  const r = (ruleId: string, level: ResultLevel, ongoingSince?: string): RuleResult => ({
    ruleId,
    diseaseId: "d1",
    level,
    candidateFrac: [],
    ...(ongoingSince && { ongoingSince }),
  });

  it("警告レベルのルールが全部続いているときだけ付く（一番早い日）", () => {
    const [d] = groupByDisease([r("A", "conditions_met", "2026-06-03"), r("B", "near_threshold", "2026-06-01"), r("C", "none")]);
    assert.equal(d.level, "conditions_met");
    assert.equal(d.ongoingSince, "2026-06-01");
  });

  it("新しく出した警告が1つでもあれば付かない", () => {
    const [d] = groupByDisease([r("A", "conditions_met", "2026-06-03"), r("B", "near_threshold")]);
    assert.equal(d.level, "conditions_met");
    assert.equal(d.ongoingSince, undefined);
  });

  it("警告が無ければ付かない", () => {
    const [d] = groupByDisease([r("A", "none")]);
    assert.equal(d.ongoingSince, undefined);
  });
});
