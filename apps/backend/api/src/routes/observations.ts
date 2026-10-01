import { Hono } from "hono";
import { deleteObservation, getObservationsByRange, writeObservation } from "../db/observation";
import { getDiseasesVocab } from "../utils/vocab";
import { isValidDate, jstToday, parseRange, readBody } from "./helpers";

export const observations = new Hono();

/**
 * 期間の病害の発生記録
 * GET /observations?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { observed_on, disease_id, note }[] 日付・disease_id の昇順
 */
observations.get("/", async (c) => {
  const range = parseRange(c.req.query("start"), c.req.query("end"));
  if ("error" in range) return c.json(range, 400);
  return c.json(await getObservationsByRange(range.start, range.end));
});

/**
 * その日にその病害を見つけたと記録する。同じ日・同じ病害があればメモを上書き
 * PUT /observations/:date/:diseaseId  body { note? }（body は省略可）
 */
observations.put("/:date/:diseaseId", async (c) => {
  const date = c.req.param("date");
  const diseaseId = c.req.param("diseaseId");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  if (date > jstToday()) return c.json({ error: "date must not be in the future" }, 400);
  if (!getDiseasesVocab().some((d) => d.id === diseaseId)) {
    return c.json({ error: "diseaseId must be one of the disease ids" }, 400);
  }
  const note = (await readBody(c))?.note ?? "";
  if (typeof note !== "string") return c.json({ error: "note must be a string" }, 400);
  await writeObservation(date, diseaseId, note);
  return c.json({ observed_on: date, disease_id: diseaseId, note });
});

/**
 * 病害の発生記録を削除する
 * DELETE /observations/:date/:diseaseId
 */
observations.delete("/:date/:diseaseId", async (c) => {
  const date = c.req.param("date");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  if (!(await deleteObservation(date, c.req.param("diseaseId")))) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
