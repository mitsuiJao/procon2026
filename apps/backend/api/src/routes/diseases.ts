import { Hono } from "hono";
import { getDiseasesVocab } from "../utils/vocab";

export const diseases = new Hono();

/**
 * 病害の一覧（/calendar/risk の diseaseId を病名にするため）
 * GET /diseases
 * @returns { id, name_ja, priority }[]
 */
diseases.get("/", (c) =>
  c.json(getDiseasesVocab().map((d) => ({ id: d.id, name_ja: d.nameJa, priority: d.priority }))),
);
