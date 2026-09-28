import { Hono } from "hono";
import { fracCodesOf, getDiseasesVocab, getPesticidesVocab, getRules, type PesticideVocab } from "../utils/vocab";

export const pesticides = new Hono();

const toPesticideJson = (p: PesticideVocab) => ({
  id: p.id,
  name_ja: p.nameJa,
  active_ingredients: p.activeIngredients,
  frac_codes: fracCodesOf(p),
  dilution: p.dilution ?? null,
  max_uses_per_year: p.maxUsesPerYear ?? null,
  pre_harvest_days: p.preHarvestDays ?? null,
  registration_no: p.registrationNo ?? null,
  source: p.source,
  checked_at: p.checkedAt,
});

/**
 * 農薬マスター（散布記録のプルダウン用）。推奨ではなく選択肢の一覧
 * GET /pesticides?disease=<diseaseId>
 *   disease を指定すると、rules.yaml でその病害の candidateFrac に含まれる FRAC を持つ農薬に絞る
 * @returns { id, name_ja, active_ingredients, frac_codes, dilution, max_uses_per_year, pre_harvest_days, registration_no, source, checked_at }[]
 */
pesticides.get("/", (c) => {
  const disease = c.req.query("disease");
  let list = getPesticidesVocab();
  if (disease !== undefined) {
    if (!getDiseasesVocab().some((d) => d.id === disease)) return c.json({ error: `unknown disease: ${disease}` }, 400);
    const candidate = new Set(
      getRules()
        .filter((r) => r.enabled && r.diseaseId === disease)
        .flatMap((r) => r.candidateFrac),
    );
    list = list.filter((p) => fracCodesOf(p).some((code) => candidate.has(code)));
  }
  return c.json(list.map(toPesticideJson));
});
