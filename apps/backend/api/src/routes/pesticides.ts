import { Hono } from "hono";
import { fracCodesOf, getDiseasesVocab, getPesticidesSource, getPesticidesVocab, type PesticideVocab } from "../utils/vocab";

export const pesticides = new Hono();

const toPesticideJson = (p: PesticideVocab) => ({
  id: p.id,
  name_ja: p.nameJa,
  kind: p.kind,
  use: p.use,
  registered_on: p.registeredOn,
  active_ingredients: p.activeIngredients,
  frac_codes: fracCodesOf(p),
  frac_note: p.fracNote ?? null,
  total_use_limits: p.totalUseLimits,
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
 * @returns { source, retrieved_at, pesticides: { id(登録番号), name_ja, ..., frac_codes, applications[] }[] }
 */
pesticides.get("/", (c) => {
  const disease = c.req.query("disease");
  let list = getPesticidesVocab();
  if (disease !== undefined) {
    if (!getDiseasesVocab().some((d) => d.id === disease)) return c.json({ error: `unknown disease: ${disease}` }, 400);
    list = list.filter((p) => p.applications.some((a) => a.diseaseId === disease));
  }
  const { source, retrievedAt } = getPesticidesSource();
  return c.json({ source, retrieved_at: retrievedAt, pesticides: list.map(toPesticideJson) });
});
