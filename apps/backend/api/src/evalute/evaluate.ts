import { broome } from "./broome";
import { evalCond } from "./cond";
import { gublerThomas } from "./gublerThomas";
import type {
  DiseaseResult,
  EvalInput,
  HourlyPoint,
  ResultLevel,
  Rule,
  RuleResult,
} from "./types";

/** rules.yaml の evaluator.name に対応する式モデル。値が取れないときは null */
export const evaluators: Record<
  string,
  (hourly: HourlyPoint[], params: Record<string, number>) => number | null
> = {
  broome,
  gublerThomas,
};

/** 病害ごとの集約優先順位（大きいほど優先） */
const priority: Record<ResultLevel, number> = {
  conditions_met: 3,
  near_threshold: 2,
  undetermined: 1,
  none: 0,
};

export function evaluateRule(rule: Rule, input: EvalInput): RuleResult {
  const base = { ruleId: rule.id, diseaseId: rule.diseaseId, candidateFrac: rule.candidateFrac };

  // when は閾値ルールの本体、evaluator があるときはゲート
  if (rule.when) {
    const gate = evalCond(rule.when, input.scalars);
    if (gate === null) return { ...base, level: "undetermined" };
    if (gate === false) return { ...base, level: "none" };
    if (!rule.evaluator) return { ...base, level: rule.level ?? "none" };
  }

  if (rule.evaluator) {
    const fn = evaluators[rule.evaluator.name];
    if (!fn) throw new Error(`${rule.id}: 未登録の evaluator: ${rule.evaluator.name}`);
    const params = rule.evaluator.params;
    const value = fn(input.hourly, params);
    if (value === null) return { ...base, level: "undetermined" };
    const level: ResultLevel =
      value >= params.high ? "conditions_met" : value >= params.mid ? "near_threshold" : "none";
    return { ...base, level, value };
  }
  return { ...base, level: "none" };
}

/**
 * 全ルールを評価して病害ごとにまとめる
 * 優先順位は conditions_met > near_threshold > undetermined > none
 * 他ルールが none でも、判定不能が1つあれば undetermined を返す
 * @param opts.includeDisabled true なら enabled: false のルールも評価する
 * @param opts.hourlyFor ルールごとに hourly を差し替える。省略時は input.hourly をそのまま使う
 */
export function evaluateRisks(
  rules: Rule[],
  input: EvalInput,
  opts: { includeDisabled?: boolean; hourlyFor?: (rule: Rule) => HourlyPoint[] } = {},
): DiseaseResult[] {
  const byDisease = new Map<string, RuleResult[]>();
  for (const rule of rules) {
    if (!rule.enabled && !opts.includeDisabled) continue;
    const ruleInput = opts.hourlyFor ? { ...input, hourly: opts.hourlyFor(rule) } : input;
    const r = evaluateRule(rule, ruleInput);
    const list = byDisease.get(rule.diseaseId);
    if (list) list.push(r);
    else byDisease.set(rule.diseaseId, [r]);
  }
  return [...byDisease].map(([diseaseId, results]) => ({
    diseaseId,
    level: results.reduce<ResultLevel>(
      (top, r) => (priority[r.level] > priority[top] ? r.level : top),
      "none",
    ),
    rules: results,
  }));
}
