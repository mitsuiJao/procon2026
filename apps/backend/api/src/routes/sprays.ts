import { Hono } from "hono";
import {
  deleteSprayRecord,
  getRecentSprayRecords,
  getSprayRecordsByRange,
  updateSprayRecord,
  writeSprayRecord,
  type sprayRecord,
} from "../db/spray";
import { fracCodesOf, getPesticidesVocab } from "../utils/vocab";
import { isValidDate, jstToday, parseId, parseRange, readBody } from "./helpers";

export const sprays = new Hono();

const optionalText = (v: unknown) => v === undefined || v === null || typeof v === "string";

/**
 * 散布記録の body を検証
 * pesticide_id があればマスターの商品名を pesticide に入れ、無ければ自由入力の pesticide を必須にする
 */
function parseSprayBody(body: Record<string, unknown> | null): sprayRecord | { error: string } {
  if (!body) return { error: "body must be a JSON object" };
  const { sprayed_on, pesticide_id, pesticide, dilution, amount, target, note } = body;
  if (typeof sprayed_on !== "string" || !isValidDate(sprayed_on)) {
    return { error: "sprayed_on must be a valid YYYY-MM-DD date" };
  }
  if (![pesticide_id, pesticide, dilution, amount, target, note].every(optionalText)) {
    return { error: "pesticide_id, pesticide, dilution, amount, target and note must be strings" };
  }
  // GET の一覧と同じ形で返せるよう、未指定は null（note は ""）にそろえる
  const text = {
    dilution: (dilution as string | null | undefined) ?? null,
    amount: (amount as string | null | undefined) ?? null,
    target: (target as string | null | undefined) ?? null,
    note: (note as string | null | undefined) ?? "",
  };

  if (typeof pesticide_id === "string") {
    const master = getPesticidesVocab().find((p) => p.id === pesticide_id);
    if (!master) return { error: `unknown pesticide_id: ${pesticide_id}` };
    return { sprayed_on, pesticide_id, pesticide: master.nameJa, ...text };
  }
  if (typeof pesticide !== "string" || pesticide.trim() === "") {
    return { error: "pesticide_id or pesticide is required" };
  }
  return { sprayed_on, pesticide_id: null, pesticide: pesticide.trim(), ...text };
}

/**
 * 期間の散布記録
 * GET /sprays?start=YYYY-MM-DD&end=YYYY-MM-DD 含む
 * @returns { id, sprayed_on, pesticide_id, pesticide, dilution, amount, target, note }[] 日付, id昇順
 */
sprays.get("/", async (c) => {
  const range = parseRange(c.req.query("start"), c.req.query("end"));
  if ("error" in range) return c.json(range, 400);
  return c.json(await getSprayRecordsByRange(range.start, range.end));
});

/**
 * 最近の散布記録
 * GET /sprays/recent?limit=8  limit は 1〜50
 * @returns /sprays と同じ形。新しい順
 */
sprays.get("/recent", async (c) => {
  const limit = Number(c.req.query("limit") ?? 8);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return c.json({ error: "limit must be an integer from 1 to 50" }, 400);
  }
  return c.json(await getRecentSprayRecords(limit));
});

/**
 * その年の使用回数（上限回数の表示と FRAC ローテーションの確認用）
 * GET /sprays/usage?year=YYYY  省略時は今年（JST）。年は 1/1〜12/31
 * マスターから選んだ散布だけを数える。自由入力の散布は FRAC がわからないので含まない
 * @returns { by_pesticide: { [pesticide_id]: 回数 }, by_frac: { [code]: { count, last_sprayed_on } } }
 */
sprays.get("/usage", async (c) => {
  const year = c.req.query("year") ?? jstToday().slice(0, 4);
  if (!/^\d{4}$/.test(year)) return c.json({ error: "year must be YYYY" }, 400);

  const records = await getSprayRecordsByRange(`${year}-01-01`, `${year}-12-31`);
  const masters = new Map(getPesticidesVocab().map((p) => [p.id, p]));
  const byPesticide: Record<string, number> = {};
  const byFrac: Record<string, { count: number; last_sprayed_on: string }> = {};

  for (const r of records) {
    if (!r.pesticide_id) continue;
    byPesticide[r.pesticide_id] = (byPesticide[r.pesticide_id] ?? 0) + 1;
    const master = masters.get(r.pesticide_id);
    if (!master) continue;
    for (const code of fracCodesOf(master)) {
      const f = (byFrac[code] ??= { count: 0, last_sprayed_on: r.sprayed_on });
      f.count += 1;
      // records は日付昇順なので、後から来たものが最新
      f.last_sprayed_on = r.sprayed_on;
    }
  }
  return c.json({ year: Number(year), by_pesticide: byPesticide, by_frac: byFrac });
});

/**
 * 散布記録を追加する
 * POST /sprays  body { sprayed_on, pesticide_id?, pesticide?, dilution?, amount?, target?, note? }
 * @returns 保存した記録（id 付き）
 */
sprays.post("/", async (c) => {
  const record = parseSprayBody(await readBody(c));
  if ("error" in record) return c.json(record, 400);
  const id = await writeSprayRecord(record);
  return c.json({ id, ...record }, 201);
});

/**
 * 散布記録を上書きする
 * PUT /sprays/:id  body は POST と同じ
 */
sprays.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "id must be a number" }, 400);
  const record = parseSprayBody(await readBody(c));
  if ("error" in record) return c.json(record, 400);
  if (!(await updateSprayRecord(id, record))) return c.json({ error: "not found" }, 404);
  return c.json({ id, ...record });
});

/**
 * 散布記録を削除する
 * DELETE /sprays/:id
 */
sprays.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return c.json({ error: "id must be a number" }, 400);
  if (!(await deleteSprayRecord(id))) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
