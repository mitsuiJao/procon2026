import type { Cond, CondDef, Rule, RuleDef } from "./types";

/** 条件の "$名前" を params の値に置き換える */
function resolveCond(cond: CondDef, params: Record<string, number>, ruleId: string): Cond {
  if ("all" in cond) return { all: cond.all.map((c) => resolveCond(c, params, ruleId)) };
  if ("any" in cond) return { any: cond.any.map((c) => resolveCond(c, params, ruleId)) };
  if ("not" in cond) return { not: resolveCond(cond.not, params, ruleId) };
  if (typeof cond.value === "number") return { var: cond.var, op: cond.op, value: cond.value };
  const value = params[cond.value.slice(1)];
  if (typeof value !== "number") throw new Error(`${ruleId}: params に無い参照 ${cond.value}`);
  return { var: cond.var, op: cond.op, value };
}

/**
 * 感度の段階を決めて、値が確定したルールにする。
 * 段階 1 から level までの上書き（levels）を順に重ねる。level が levels の件数を超えたら、最後の段階までを使う。
 * @param level 感度の段階。0 は本体の値のまま
 */
export function resolveRule(def: RuleDef, level = 0): Rule {
  const { params: baseParams, levels, when, evaluator, ...rest } = def;
  const params = { ...baseParams };
  const evalParams = { ...evaluator?.params };
  let enabled = def.enabled;
  for (const override of (levels ?? []).slice(0, Math.max(level, 0))) {
    for (const [key, value] of Object.entries(override)) {
      if (key === "enabled") enabled = value as boolean;
      else if (key in params) params[key] = value as number;
      else evalParams[key] = value as number;
    }
  }
  return {
    ...rest,
    enabled,
    ...(when && { when: resolveCond(when, params, def.id) }),
    ...(evaluator && { evaluator: { name: evaluator.name, params: evalParams } }),
  };
}

/**
 * 病害ごとの感度の段階で、全ルールを確定させる
 * @param levelByDisease { diseaseId: 段階 }。無い病害は段階 0
 */
export function resolveRules(defs: RuleDef[], levelByDisease: Record<string, number> = {}): Rule[] {
  return defs.map((def) => resolveRule(def, levelByDisease[def.diseaseId] ?? 0));
}

/** その病害で選べる最大の段階（levels が最も長いルールの件数）。段階を持つルールが無ければ 0 */
export function maxLevelOf(defs: RuleDef[], diseaseId: string): number {
  return defs
    .filter((d) => d.diseaseId === diseaseId)
    .reduce((max, d) => Math.max(max, d.levels?.length ?? 0), 0);
}
