import { Hono } from "hono";
import { getHiddenPesticideIds, setPesticideHidden } from "../db/pesticide";
import { readBody } from "./helpers";
import { fracCodesOf, getDiseasesVocab, getPesticidesSource, getPesticidesVocab, type PesticideVocab } from "../utils/vocab";

export const pesticides = new Hono();

const toPesticideJson = (p: PesticideVocab, hidden: Set<string>) => ({
  id: p.id,
  name_ja: p.nameJa,
  kind: p.kind,
  use: p.use,
  registered_on: p.registeredOn,
  active_ingredients: p.activeIngredients,
  frac_codes: fracCodesOf(p),
  frac_note: p.fracNote ?? null,
  total_use_limits: p.totalUseLimits,
  hidden: hidden.has(p.id),
  applications: p.applications.map((a) => ({
    crop: a.crop,
    target: a.target,
    disease_id: a.diseaseId,
    method: a.method,
    dilution: a.dilution,
    dilution_min: a.dilutionMin,
    dilution_max: a.dilutionMax,
    timing: a.timing,
    pre_harvest_days: a.preHarvestDays,
    spray_volume: a.sprayVolume,
    uses: a.uses,
    max_uses: a.maxUses,
  })),
});

/**
 * 農薬マスター（散布記録のプルダウン用）。推奨ではなく選択肢の一覧
 * GET /pesticides?disease=<diseaseId>
 *   disease を指定すると、その病害に登録（適用）がある農薬に絞る
 * @returns { source, retrieved_at, pesticides: { id(登録番号), name_ja, ..., frac_codes, hidden, applications[] }[] }
 *   hidden は散布記録のプルダウンに出さない設定
 */
pesticides.get("/", async (c) => {
  const disease = c.req.query("disease");
  let list = getPesticidesVocab();
  if (disease !== undefined) {
    if (!getDiseasesVocab().some((d) => d.id === disease)) return c.json({ error: `unknown disease: ${disease}` }, 400);
    list = list.filter((p) => p.applications.some((a) => a.diseaseId === disease));
  }
  const { source, retrievedAt } = getPesticidesSource();
  const hidden = await getHiddenPesticideIds();
  return c.json({ source, retrieved_at: retrievedAt, pesticides: list.map((p) => toPesticideJson(p, hidden)) });
});

/**
 * 散布記録のプルダウンに出す・出さないを切り替える。既定は出す
 * PUT /pesticides/:id/hidden  body { hidden }
 */
pesticides.put("/:id/hidden", async (c) => {
  const id = c.req.param("id");
  if (!getPesticidesVocab().some((p) => p.id === id)) return c.json({ error: "not found" }, 404);
  const body = await readBody(c);
  if (typeof body?.hidden !== "boolean") return c.json({ error: "hidden must be a boolean" }, 400);
  await setPesticideHidden(id, body.hidden);
  return c.body(null, 204);
});
