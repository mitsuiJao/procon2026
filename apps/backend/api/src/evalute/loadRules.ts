import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { collectVars } from "./cond";
import { evaluators } from "./evaluate";
import type { Cond, RuleDef } from "./types";

const ops = new Set([">=", ">", "<=", "<", "==", "!="]);

function readYaml(file: string): any[] {
  const doc = parse(readFileSync(file, "utf8"));
  if (!Array.isArray(doc)) throw new Error(`${file}: 配列ではありません`);
  return doc;
}

const isNumberMap = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "number");

/** 条件の形を検証する。value は数値か、params にある名前を指す "$名前"（stage の条件では数値のみ） */
function checkCond(ruleId: string, c: any, params: Record<string, number>): void {
  if (c && Array.isArray(c.all)) return c.all.forEach((x: any) => checkCond(ruleId, x, params));
  if (c && Array.isArray(c.any)) return c.any.forEach((x: any) => checkCond(ruleId, x, params));
  if (c && c.not) return checkCond(ruleId, c.not, params);
  if (c && typeof c.var === "string" && ops.has(c.op)) {
    if (typeof c.value === "number") return;
    if (typeof c.value === "string" && c.value.startsWith("$")) {
      if (c.var === "stage") throw new Error(`${ruleId}: stage の条件では "$名前" を使えません`);
      if (!(c.value.slice(1) in params)) throw new Error(`${ruleId}: params に無い参照 ${c.value}`);
      return;
    }
  }
  throw new Error(`${ruleId}: 不正な条件 ${JSON.stringify(c)}`);
}

/** levels（段階ごとの上書き）を検証する。キーは enabled か、params / evaluator.params のどちらか一方にある名前 */
function checkLevels(r: any, params: Record<string, number>): void {
  if (r.levels === undefined) return;
  if (!Array.isArray(r.levels) || r.levels.length === 0) throw new Error(`${r.id}: levels は1件以上の配列にしてください`);
  const evalParams: Record<string, number> = r.evaluator?.params ?? {};
  for (const o of r.levels) {
    if (!o || typeof o !== "object" || Array.isArray(o) || Object.keys(o).length === 0) {
      throw new Error(`${r.id}: levels の各段階は、上書きを1つ以上持つマップにしてください`);
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === "enabled") {
        if (typeof v !== "boolean") throw new Error(`${r.id}: levels の enabled は true / false にしてください`);
        continue;
      }
      if (k in params === k in evalParams) {
        throw new Error(`${r.id}: levels のキー ${k} は params か evaluator.params のどちらか一方に必要です`);
      }
      if (typeof v !== "number") throw new Error(`${r.id}: levels の ${k} は数値にしてください`);
    }
  }
}

/**
 * rules.yaml を読み、vocab（diseases / variables / stages）と突き合わせて検証する。
 * 変数名や evaluator 名の打ち間違いを「永遠に判定不能」にしないため、不整合は例外にする。
 * 返すのは YAML に書いたままの形（RuleDef）。評価する前に resolveRules で段階を決めて Rule にする。
 * @param rulesFile rules.yaml のパス
 * @param vocabDir data/vocab のパス
 */
export function loadRules(rulesFile: string, vocabDir: string): RuleDef[] {
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
    if (r.params !== undefined && !isNumberMap(r.params)) {
      throw new Error(`${r.id}: params は名前と数値のマップにしてください`);
    }
    const params: Record<string, number> = r.params ?? {};
    if (r.when) {
      checkCond(r.id, r.when, params);
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
    checkLevels(r, params);
  }
  return rules as RuleDef[];
}

function collectStageValues(cond: Cond, out: number[] = []): number[] {
  if ("all" in cond) cond.all.forEach((c) => collectStageValues(c, out));
  else if ("any" in cond) cond.any.forEach((c) => collectStageValues(c, out));
  else if ("not" in cond) collectStageValues(cond.not, out);
  else if (cond.var === "stage") out.push(cond.value);
  return out;
}
