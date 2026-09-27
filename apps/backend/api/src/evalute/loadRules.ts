import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { collectVars } from "./cond";
import { evaluators } from "./evaluate";
import type { Cond, Rule } from "./types";

const ops = new Set([">=", ">", "<=", "<", "==", "!="]);

function readYaml(file: string): any[] {
  const doc = parse(readFileSync(file, "utf8"));
  if (!Array.isArray(doc)) throw new Error(`${file}: 配列ではありません`);
  return doc;
}

function checkCond(ruleId: string, c: any): asserts c is Cond {
  if (c && Array.isArray(c.all)) return c.all.forEach((x: any) => checkCond(ruleId, x));
  if (c && Array.isArray(c.any)) return c.any.forEach((x: any) => checkCond(ruleId, x));
  if (c && c.not) return checkCond(ruleId, c.not);
  if (c && typeof c.var === "string" && ops.has(c.op) && typeof c.value === "number") return;
  throw new Error(`${ruleId}: 不正な条件 ${JSON.stringify(c)}`);
}

/**
 * rules.yaml を読み、vocab（diseases / variables / stages）と突き合わせて検証する。
 * 変数名や evaluator 名の打ち間違いを「永遠に判定不能」にしないため、不整合は例外にする。
 * @param rulesFile rules.yaml のパス
 * @param vocabDir data/vocab のパス
 */
export function loadRules(rulesFile: string, vocabDir: string): Rule[] {
  const diseases = new Set(readYaml(path.join(vocabDir, "diseases.yaml")).map((d) => d.id));
  const scalarVars = new Set(
    readYaml(path.join(vocabDir, "variables.yaml"))
      .filter((v) => v.kind === "scalar")
      .map((v) => v.id),
  );
  const stages = new Set(readYaml(path.join(vocabDir, "stages.yaml")).map((s) => s.value));

  const rules = readYaml(rulesFile);
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) throw new Error(`${r.id}: id が重複しています`);
    seen.add(r.id);
    if (!diseases.has(r.diseaseId)) throw new Error(`${r.id}: 未定義の diseaseId ${r.diseaseId}`);
    if (!r.when && !r.evaluator) throw new Error(`${r.id}: when も evaluator もありません`);
    if (r.when) {
      checkCond(r.id, r.when);
      for (const v of collectVars(r.when)) {
        if (!scalarVars.has(v)) throw new Error(`${r.id}: 未定義の変数 ${v}`);
      }
      collectStageValues(r.when).forEach((n) => {
        if (!stages.has(n)) throw new Error(`${r.id}: 未定義の stage 値 ${n}`);
      });
      if (!r.evaluator && !["near_threshold", "conditions_met"].includes(r.level)) {
        throw new Error(`${r.id}: when のみのルールには level が必要です`);
      }
    }
    if (r.evaluator) {
      if (!evaluators[r.evaluator.name]) {
        throw new Error(`${r.id}: 未登録の evaluator ${r.evaluator.name}`);
      }
      const { mid, high } = r.evaluator.params ?? {};
      if (typeof mid !== "number" || typeof high !== "number") {
        throw new Error(`${r.id}: evaluator.params に mid / high が必要です`);
      }
    }
    if (!Array.isArray(r.candidateFrac) || r.candidateFrac.some((f: unknown) => typeof f !== "string")) {
      throw new Error(`${r.id}: candidateFrac は文字列の配列にしてください（"21" は引用符付き）`);
    }
  }
  return rules as Rule[];
}

function collectStageValues(cond: Cond, out: number[] = []): number[] {
  if ("all" in cond) cond.all.forEach((c) => collectStageValues(c, out));
  else if ("any" in cond) cond.any.forEach((c) => collectStageValues(c, out));
  else if ("not" in cond) collectStageValues(cond.not, out);
  else if (cond.var === "stage") out.push(cond.value);
  return out;
}
