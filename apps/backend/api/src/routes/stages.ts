import { Hono } from "hono";
import { deleteStageTransition, getStageTransitions, writeStageTransition } from "../db/stage";
import { getStagesVocab } from "../utils/vocab";
import { isValidDate, readBody } from "./helpers";

export const stages = new Hono();

/**
 * 生育ステージの一覧と、記録された切り替わり
 * GET /stages
 * @returns { vocab: { value, id, name_ja }[], transitions: { stage, effective_from }[] }
 */
stages.get("/", async (c) => {
  const transitions = await getStageTransitions();
  return c.json({
    vocab: getStagesVocab().map((s) => ({ value: s.value, id: s.id, name_ja: s.nameJa })),
    transitions: transitions.map((t) => ({ stage: t.stage, effective_from: t.effectiveFrom })),
  });
});

/**
 * その日から生育ステージが切り替わったことを記録、同じ日があれば上書き
 * PUT /stages/:date  body { stage }
 */
stages.put("/:date", async (c) => {
  const date = c.req.param("date");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  const body = await readBody(c);
  const stage = body?.stage;
  if (typeof stage !== "number" || !getStagesVocab().some((s) => s.value === stage)) {
    return c.json({ error: "stage must be one of the stage values" }, 400);
  }
  await writeStageTransition(stage, date);
  return c.json({ stage, effective_from: date });
});

/**
 * 生育ステージの切り替わりを削除
 * DELETE /stages/:date
 */
stages.delete("/:date", async (c) => {
  const date = c.req.param("date");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  if (!(await deleteStageTransition(date))) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
