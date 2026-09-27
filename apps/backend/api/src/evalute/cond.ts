import type { Cond, Op } from "./types";

function compare(a: number, op: Op, b: number): boolean {
  switch (op) {
    case ">=": return a >= b;
    case ">": return a > b;
    case "<=": return a <= b;
    case "<": return a < b;
    case "==": return a === b;
    case "!=": return a !== b;
  }
}

/**
 * 条件を三値論理で評価する。変数が取れないときは false ではなく null（判定不能）
 * - all: 確実な false が1つでもあれば false。なければ null があれば null
 * - any: 確実な true が1つでもあれば true。なければ null があれば null
 * - not: null は null のまま
 */
export function evalCond(
  cond: Cond,
  scalars: Partial<Record<string, number | null>>,
): boolean | null {
  if ("all" in cond) {
    let unknown = false;
    for (const c of cond.all) {
      const r = evalCond(c, scalars);
      if (r === false) return false;
      if (r === null) unknown = true;
    }
    return unknown ? null : true;
  }
  if ("any" in cond) {
    let unknown = false;
    for (const c of cond.any) {
      const r = evalCond(c, scalars);
      if (r === true) return true;
      if (r === null) unknown = true;
    }
    return unknown ? null : false;
  }
  if ("not" in cond) {
    const r = evalCond(cond.not, scalars);
    return r === null ? null : !r;
  }
  const v = scalars[cond.var];
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return compare(v, cond.op, cond.value);
}

/** 条件内で使われている変数名を集める（loadRules の検証用） */
export function collectVars(cond: Cond, out = new Set<string>()): Set<string> {
  if ("all" in cond) cond.all.forEach((c) => collectVars(c, out));
  else if ("any" in cond) cond.any.forEach((c) => collectVars(c, out));
  else if ("not" in cond) collectVars(cond.not, out);
  else out.add(cond.var);
  return out;
}
