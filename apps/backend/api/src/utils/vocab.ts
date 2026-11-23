import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { loadRules, resolveRules } from "../evalute";
import type { Rule, RuleDef } from "../evalute";

// data/ は api のビルドコンテキスト外なので、Docker では docker-compose.yml のボリュームマウント（DATA_DIR=/app/data）で渡す。
// ローカル実行では src/dist からの相対パスで data/ に届く。
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "../../../data");

function readYamlArray(file: string): any[] {
  const full = path.join(DATA_DIR, file);
  const doc = parse(readFileSync(full, "utf8"));
  if (!Array.isArray(doc)) throw new Error(`${full}: 配列ではありません`);
  return doc;
}

/** 初回だけ読み込んで、以降はキャッシュを返す関数を作る */
function cached<T>(load: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= load());
}

/** latentDays は感染から発見までの日数 [最短, 最長] */
export type DiseaseVocab = { id: string; nameJa: string; priority: number; latentDays: [number, number] };
export type StageVocab = { value: number; id: string; nameJa: string; typicalMonth: string };
export type ActiveIngredientVocab = { id: string; nameJa?: string; fracCode: string };
export type PesticideApplication = {
  crop: string;
  target: string | null;
  diseaseId: string | null;
  method: string;
  dilution: string | null;
  dilutionMin: number | null;
  dilutionMax: number | null;
  timing: string | null;
  preHarvestDays: number | null;
  sprayVolume: string | null;
  uses: string | null;
  maxUses: number | null;
};
export type PesticideVocab = {
  id: string;
  nameJa: string;
  kind: string;
  use: string;
  registeredOn: string;
  activeIngredients: string[];
  totalUseLimits: string[];
  fracNote?: string;
  applications: PesticideApplication[];
};
type PesticidesDoc = { source: string; retrievedAt: string; pesticides: PesticideVocab[] };

/** rules.yaml に書いたままのルール。評価するときは resolveRules で感度の段階を決める */
export const getRuleDefs = cached<RuleDef[]>(() =>
  loadRules(path.join(DATA_DIR, "rules/rules.yaml"), path.join(DATA_DIR, "vocab")),
);
/** 全病害を段階 0（標準）で確定させたルール */
export const getRules = cached<Rule[]>(() => resolveRules(getRuleDefs()));
export const getDiseasesVocab = cached(() => {
  const diseases = readYamlArray("vocab/diseases.yaml") as DiseaseVocab[];
  for (const d of diseases) {
    const [min, max]: unknown[] = Array.isArray(d.latentDays) ? d.latentDays : [];
    if (typeof min !== "number" || typeof max !== "number" || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max) {
      throw new Error(`diseases.yaml: ${d.id} の latentDays は [最短, 最長] の日数にしてください`);
    }
  }
  return diseases;
});
export const getStagesVocab = cached(() => readYamlArray("vocab/stages.yaml") as StageVocab[]);
export const getActiveIngredientsVocab = cached(
  () => readYamlArray("vocab/activeIngredients.yaml") as ActiveIngredientVocab[],
);

/**
 * pesticides.yaml（scripts/buildPesticides.ts の生成物）を読んで検証する。
 * 有効成分が activeIngredients.yaml に無いのは FRAC 不明の成分として許す（石灰硫黄合剤・微生物剤など）。
 */
const getPesticidesDoc = cached<PesticidesDoc>(() => {
  const full = path.join(DATA_DIR, "vocab/pesticides.yaml");
  const doc = parse(readFileSync(full, "utf8")) as PesticidesDoc;
  if (typeof doc?.source !== "string" || typeof doc.retrievedAt !== "string" || !Array.isArray(doc.pesticides)) {
    throw new Error(`${full}: source, retrievedAt, pesticides が必要です`);
  }
  const seen = new Set<string>();
  for (const p of doc.pesticides) {
    if (typeof p.id !== "string" || typeof p.nameJa !== "string") {
      throw new Error(`pesticides.yaml: id と nameJa は必須です ${JSON.stringify(p)}`);
    }
    if (seen.has(p.id)) throw new Error(`pesticides.yaml: id が重複しています ${p.id}`);
    seen.add(p.id);
    if (!Array.isArray(p.activeIngredients) || !Array.isArray(p.applications)) {
      throw new Error(`pesticides.yaml: ${p.id} の activeIngredients と applications は配列にしてください`);
    }
  }
  return doc;
});

export const getPesticidesVocab = () => getPesticidesDoc().pesticides;
export const getPesticidesSource = () => {
  const { source, retrievedAt } = getPesticidesDoc();
  return { source, retrievedAt };
};

/** 農薬の FRAC コード（有効成分からたどる。重複なし。たどれない成分は飛ばす） */
export function fracCodesOf(p: PesticideVocab): string[] {
  const byId = new Map(getActiveIngredientsVocab().map((a) => [a.id, a.fracCode]));
  return [...new Set(p.activeIngredients.flatMap((a) => byId.get(a) ?? []))];
}
