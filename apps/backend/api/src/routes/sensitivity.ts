import { Hono } from "hono";
import { getSensitivity, recomputeSensitivity } from "../utils/sensitivity";

export const sensitivity = new Hono();

const toJson = async () =>
  (await getSensitivity()).map((s) => ({
    disease_id: s.diseaseId,
    level: s.level,
    max_level: s.maxLevel,
    observed: s.observed,
    caught: s.caught,
    alert_days: s.alertDays,
    total_days: s.totalDays,
  }));

/**
 * 病害ごとの感度の段階（今シーズンの発生記録から選んだもの）
 * GET /sensitivity
 * @returns { disease_id, level, max_level, observed, caught, alert_days, total_days }[]
 */
sensitivity.get("/", async (c) => c.json(await toJson()));

/**
 * 全病害の段階を選び直す（シードを入れた後や、ルールを変えた後に使う）
 * POST /sensitivity/recompute
 */
sensitivity.post("/recompute", async (c) => {
  await recomputeSensitivity();
  return c.json(await toJson());
});
