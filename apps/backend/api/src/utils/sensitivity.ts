import { getObservationsByRange } from "../db/observation";
import { getLatestSensitivity, writeSensitivity, type SensitivityRow } from "../db/sensitivity";
import { maxLevelOf, resolveRules } from "../evalute";
import type { Rule } from "../evalute";
import { buildDayInputs, evaluateDays, getSeasonStart, type DayInput } from "./calendarRisk";
import { getDiseasesVocab, getRuleDefs } from "./vocab";
import { jstDate } from "./weather-daily";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 警告が出た日数の上限（シーズン開始から今日までの日数に対する割合）。これを超える段階は選ばない。
 * 根拠のない設計値。警告だらけになるのを止めるためのもの。
 */
export const MAX_ALERT_RATIO = 0.25;

/** YYYY-MM-DD の日付に n 日足す */
function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * その病害に警告（条件に近い・該当）が出た日。判定不能の日と、警告が続いていて出し直さなかった日は含めない
 * @param days 1日ずつ連続した日
 */
export function firedDates(rules: Rule[], diseaseId: string, days: DayInput[]): Set<string> {
  const own = rules.filter((r) => r.diseaseId === diseaseId);
  const fired = new Set<string>();
  evaluateDays(own, days).forEach((diseases, i) => {
    const d = diseases[0];
    if (d && !d.ongoingSince && (d.level === "near_threshold" || d.level === "conditions_met")) fired.add(days[i].date);
  });
  return fired;
}

export type LevelChoice = Omit<SensitivityRow, "diseaseId">;

/**
 * 発生記録から感度の段階を選ぶ。
 * 警告日数が上限以内の段階のうち、発生を事前に警告できた件数が最も多いものを選ぶ。同数なら鈍い（小さい）段階。
 * 発生を「事前に警告できた」とは、発見日 D に対して D−最長 〜 D−最短 の間に警告が出ていたこと。
 * 段階 0（標準）は、警告日数が上限を超えていても候補に残す。
 * @param firedByLevel 段階ごとの、警告が出た日（添字が段階）
 * @param observations 発生を見つけた日 (YYYY-MM-DD)
 * @param latentDays 感染から発見までの日数 [最短, 最長]
 * @param totalDays 警告日数の割合の分母にする日数
 */
export function chooseLevel(args: {
  firedByLevel: Set<string>[];
  observations: string[];
  latentDays: [number, number];
  totalDays: number;
  maxAlertRatio?: number;
}): LevelChoice {
  const { firedByLevel, observations, latentDays, totalDays, maxAlertRatio = MAX_ALERT_RATIO } = args;
  const [minLag, maxLag] = latentDays;

  const stats = firedByLevel.map((fired, level) => {
    const caught = observations.filter((date) => {
      for (let lag = minLag; lag <= maxLag; lag++) if (fired.has(addDays(date, -lag))) return true;
      return false;
    }).length;
    return { level, observed: observations.length, caught, alertDays: fired.size, totalDays };
  });

  let best = stats[0];
  for (const s of stats.slice(1)) {
    if (totalDays > 0 && s.alertDays / totalDays > maxAlertRatio) continue;
    if (s.caught > best.caught) best = s;
  }
  return best;
}

/**
 * 今シーズンの発生記録と気象から、病害ごとの感度の段階を選び直して保存する。
 * 呼ぶのは発生記録を変えたときと、POST /sensitivity/recompute だけ（気象や生育ステージが後から変わっても自動では選び直さない）。
 * @param diseaseIds 対象の病害。省略時は全病害
 */
export async function recomputeSensitivity(diseaseIds?: string[]): Promise<void> {
  const today = jstDate(new Date());
  const season = getSeasonStart(today);
  const [days, observations] = await Promise.all([
    buildDayInputs(season, today),
    getObservationsByRange(season, today),
  ]);
  const defs = getRuleDefs();

  for (const disease of getDiseasesVocab()) {
    if (diseaseIds && !diseaseIds.includes(disease.id)) continue;
    const firedByLevel: Set<string>[] = [];
    for (let level = 0; level <= maxLevelOf(defs, disease.id); level++) {
      firedByLevel.push(firedDates(resolveRules(defs, { [disease.id]: level }), disease.id, days));
    }
    const choice = chooseLevel({
      firedByLevel,
      observations: observations.filter((o) => o.disease_id === disease.id).map((o) => o.observed_on),
      latentDays: disease.latentDays,
      totalDays: days.length,
    });
    await writeSensitivity(season, { diseaseId: disease.id, ...choice });
  }
}

/** 全病害の今シーズンの段階。まだ選んでいない病害は段階 0 */
export async function getSensitivity(): Promise<(SensitivityRow & { maxLevel: number })[]> {
  const rows = await getLatestSensitivity(getSeasonStart(jstDate(new Date())));
  const byDisease = new Map(rows.map((r) => [r.diseaseId, r]));
  const defs = getRuleDefs();
  return getDiseasesVocab().map((d) => ({
    ...(byDisease.get(d.id) ?? { diseaseId: d.id, level: 0, observed: 0, caught: 0, alertDays: 0, totalDays: 0 }),
    maxLevel: maxLevelOf(defs, d.id),
  }));
}
