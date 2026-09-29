import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evalCond } from "../src/evalute";
import type { Cond } from "../src/evalute";

const v = (op: ">=" | ">" | "<=" | "<" | "==" | "!=", value: number): Cond => ({ var: "x", op, value });

describe("evalCond", () => {
  it("比較演算子", () => {
    const s = { x: 10 };
    assert.equal(evalCond(v(">=", 10), s), true);
    assert.equal(evalCond(v(">", 10), s), false);
    assert.equal(evalCond(v("<=", 10), s), true);
    assert.equal(evalCond(v("<", 10), s), false);
    assert.equal(evalCond(v("==", 10), s), true);
    assert.equal(evalCond(v("!=", 10), s), false);
  });

  it("変数が無い・null・NaN なら判定不能（null）", () => {
    assert.equal(evalCond(v(">=", 1), {}), null);
    assert.equal(evalCond(v(">=", 1), { x: null }), null);
    assert.equal(evalCond(v(">=", 1), { x: NaN }), null);
  });

  it("all: 確実な false が1つあれば false、無ければ null があると null", () => {
    const f: Cond = { var: "a", op: ">=", value: 100 };
    const t: Cond = { var: "a", op: ">=", value: 0 };
    const u: Cond = { var: "missing", op: ">=", value: 0 };
    const s = { a: 1 };
    assert.equal(evalCond({ all: [t, t] }, s), true);
    assert.equal(evalCond({ all: [u, f] }, s), false);
    assert.equal(evalCond({ all: [t, u] }, s), null);
  });

  it("any: 確実な true が1つあれば true、無ければ null があると null", () => {
    const f: Cond = { var: "a", op: ">=", value: 100 };
    const t: Cond = { var: "a", op: ">=", value: 0 };
    const u: Cond = { var: "missing", op: ">=", value: 0 };
    const s = { a: 1 };
    assert.equal(evalCond({ any: [u, t] }, s), true);
    assert.equal(evalCond({ any: [f, f] }, s), false);
    assert.equal(evalCond({ any: [f, u] }, s), null);
  });

  it("not: 真偽は反転し、null は null のまま", () => {
    assert.equal(evalCond({ not: v(">=", 1) }, { x: 0 }), true);
    assert.equal(evalCond({ not: v(">=", 1) }, { x: 1 }), false);
    assert.equal(evalCond({ not: v(">=", 1) }, {}), null);
  });
});
