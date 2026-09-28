import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { loadRules } from "../evalute";
import type { Rule } from "../evalute";

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

export type DiseaseVocab = { id: string; nameJa: string; priority: number };
export type StageVocab = { value: number; id: string; nameJa: string; typicalMonth: string };
export type ActiveIngredientVocab = { id: string; nameJa?: string; fracCode: string };
export type PesticideVocab = {
  id: string;
  nameJa: string;
  activeIngredients: string[];
  dilution?: string;
  maxUsesPerYear?: number;
  preHarvestDays?: number;
  registrationNo?: string;
  source: string;
  checkedAt: string;
};

export const getRules = cached<Rule[]>(() =>
  loadRules(path.join(DATA_DIR, "rules/rules.yaml"), path.join(DATA_DIR, "vocab")),
);
export const getDiseasesVocab = cached(() => readYamlArray("vocab/diseases.yaml") as DiseaseVocab[]);
export const getStagesVocab = cached(() => readYamlArray("vocab/stages.yaml") as StageVocab[]);
export const getActiveIngredientsVocab = cached(
  () => readYamlArray("vocab/activeIngredients.yaml") as ActiveIngredientVocab[],
);

/**
 * pesticides.yaml を読み、activeIngredients.yaml と突き合わせて検証する。
 * 打ち間違いで FRAC がたどれなくなるのを防ぐため、不整合は例外にする。
 */
export const getPesticidesVocab = cached<PesticideVocab[]>(() => {
  const ingredientIds = new Set(getActiveIngredientsVocab().map((a) => a.id));
  const seen = new Set<string>();
  const list = readYamlArray("vocab/pesticides.yaml") as PesticideVocab[];
  for (const p of list) {
    if (typeof p.id !== "string" || typeof p.nameJa !== "string") {
      throw new Error(`pesticides.yaml: id と nameJa は必須です ${JSON.stringify(p)}`);
    }
    if (seen.has(p.id)) throw new Error(`pesticides.yaml: id が重複しています ${p.id}`);
    seen.add(p.id);
    if (!Array.isArray(p.activeIngredients) || p.activeIngredients.length === 0) {
      throw new Error(`pesticides.yaml: ${p.id} の activeIngredients を1つ以上書いてください`);
    }
    for (const a of p.activeIngredients) {
      if (!ingredientIds.has(a)) throw new Error(`pesticides.yaml: ${p.id} の有効成分 ${a} が activeIngredients.yaml にありません`);
    }
    if (typeof p.source !== "string" || typeof p.checkedAt !== "string") {
      throw new Error(`pesticides.yaml: ${p.id} の source と checkedAt は必須です`);
    }
  }
  return list;
});

/** 農薬の FRAC コード（有効成分からたどる。重複なし） */
export function fracCodesOf(p: PesticideVocab): string[] {
  const byId = new Map(getActiveIngredientsVocab().map((a) => [a.id, a.fracCode]));
  return [...new Set(p.activeIngredients.map((a) => byId.get(a)!))];
}
