import { Hono } from "hono";
import { deleteDiaryEntry, getDiaryEntriesByRange, writeDiaryEntry } from "../db/diary";
import { isValidDate, parseRange, readBody } from "./helpers";

export const diary = new Hono();

/**
 * 期間の日誌
 * GET /diary?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { entry_date, memo }[] 昇順
 */
diary.get("/", async (c) => {
  const range = parseRange(c.req.query("start"), c.req.query("end"));
  if ("error" in range) return c.json(range, 400);
  return c.json(await getDiaryEntriesByRange(range.start, range.end));
});

/**
 * 日誌を保存する。同じ日があれば上書き、メモが空（空白のみ）なら削除
 * PUT /diary/:date  body { memo }
 */
diary.put("/:date", async (c) => {
  const date = c.req.param("date");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  const body = await readBody(c);
  if (typeof body?.memo !== "string") return c.json({ error: "memo must be a string" }, 400);
  if (body.memo.trim() === "") {
    await deleteDiaryEntry(date);
    return c.body(null, 204);
  }
  await writeDiaryEntry(date, body.memo);
  return c.json({ entry_date: date, memo: body.memo });
});

/**
 * 日誌を削除する
 * DELETE /diary/:date
 */
diary.delete("/:date", async (c) => {
  const date = c.req.param("date");
  if (!isValidDate(date)) return c.json({ error: "date must be a valid YYYY-MM-DD date" }, 400);
  if (!(await deleteDiaryEntry(date))) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
