import { getSensorHourlyByRange, type SensorHourly } from "../db/measure";
import { getPlace } from "../db/settings";
import { getStageTransitions } from "../db/stage";
import { getForecastByRange } from "../db/weather";
import { evaluateRisks } from "../evalute";
import type { DiseaseResult, HourlyPoint } from "../evalute";
import { getRules, getStagesVocab } from "./vocab";
import { jstDate } from "./weather-daily";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Broome（灰色かび病）に渡す直近の濡れイベント判定用の遡り日数。季節全体を渡すと季節最悪値に張り付くため短くする */
const BROOME_LOOKBACK_DAYS = 2;

export type StageSource = "recorded" | "estimated" | "unknown";

export type DayRisk = {
  stage: number | null;
  /** recorded = stage_transitions の記録から, estimated = typicalMonth からの近似, unknown = どちらも無い */
  stageSource: StageSource;
  diseases: DiseaseResult[];
};

/** JST の月が typicalMonth の範囲に含まれるか（"12-3" のような年またぎに対応） */
function monthInRange(month: number, range: string): boolean {
  if (!range.includes("-")) return month === Number(range);
  const [a, b] = range.split("-").map(Number);
  return a <= b ? month >= a && month <= b : month >= a || month <= b;
}

/**
 * 指定日の生育ステージを求める。
 * 記録（stage_transitions）があればそれを採用する（recorded）。
 * 無ければ stages.yaml の typicalMonth から近似する（estimated）。
 * typicalMonth は隣接ステージ間で重なりがあるため、「その月を含むうち最も進んだステージ」を採る
 * 単純なルールで決める。精度は低いので stageSource で必ず区別すること。
 */
export function getStageForDate(
  date: string,
  transitions: { stage: number; effectiveFrom: string }[],
): { stage: number | null; source: StageSource } {
  let recorded: number | null = null;
  for (const t of transitions) {
    if (t.effectiveFrom > date) break;
    recorded = t.stage;
  }
  if (recorded !== null) return { stage: recorded, source: "recorded" };

  const month = Number(date.slice(5, 7));
  const candidates = getStagesVocab().filter((s) => monthInRange(month, s.typicalMonth));
  if (candidates.length === 0) return { stage: null, source: "unknown" };
  const best = candidates.reduce((a, b) => (b.value > a.value ? b : a));
  return { stage: best.value, source: "estimated" };
}

/**
 * その年（1〜3月は前年）の4月1日 JST を季節開始の目安とする設計値。
 * Gubler-Thomas 指数の積算開始点に使う。実際の萌芽日とはずれ得る（既知の制約）。
 */
export function getSeasonStart(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const year = m >= 4 ? y : y - 1;
  return `${year}-04-01`;
}

function jstDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

/** 時別の気温・湿度を、項目ごとにセンサー優先（欠けていれば予報で補う）でマージする */
function mergeHourly(
  hours: Date[],
  sensor: Record<string, SensorHourly>,
  forecast: { observed_at: Date; temperature: number; humidity: number }[],
): HourlyPoint[] {
  const forecastByHour = new Map(forecast.map((r) => [r.observed_at.toISOString(), r]));
  return hours.map((time) => {
    const key = time.toISOString();
    const s = sensor[key];
    const f = forecastByHour.get(key);
    return {
      time,
      tempC: s?.tempC ?? f?.temperature ?? null,
      rhPercent: s?.rhPercent ?? f?.humidity ?? null,
    };
  });
}

/**
 * JST日付ごとの雨量合計。センサー実測のみを使う（weather_forecasts に降水量が無いため、
 * センサーデータの無い未来日は必ず null＝判定不能になる）。
 * その日のうち1時間でも雨量の受信があれば合計を返し、1件も無ければ null にする
 * （0mmと「データが無い」を混同しない）。
 */
function dailyRainfall(
  hours: Date[],
  sensor: Record<string, SensorHourly>,
): Map<string, number | null> {
  const byDate = new Map<string, { sum: number; hasData: boolean }>();
  for (const time of hours) {
    const mm = sensor[time.toISOString()]?.rainfallMm;
    const date = jstDate(time);
    const entry = byDate.get(date) ?? { sum: 0, hasData: false };
    if (mm !== null && mm !== undefined) {
      entry.sum += mm;
      entry.hasData = true;
    }
    byDate.set(date, entry);
  }
  return new Map([...byDate].map(([d, e]) => [d, e.hasData ? e.sum : null]));
}

/** 日降水量1mm以上の日が何日連続したか。当日のデータが無ければ null（判定不能） */
function rainyDayStreak(date: string, rainByDate: Map<string, number | null>): number | null {
  let d = date;
  let streak = 0;
  for (;;) {
    const rain = rainByDate.get(d) ?? null;
    if (streak === 0 && rain === null) return null;
    if (rain === null || rain < 1) break;
    streak += 1;
    d = jstDate(new Date(jstDayStart(d).getTime() - DAY_MS));
  }
  return streak;
}

/**
 * 指定期間の病害リスクを日ごとに評価
 * データの取得は期間全体で1回だけ行い、日ごとにevaluateRisksを呼ぶ。
 * @param start 開始日 (YYYY-MM-DD, 含む, JST)
 * @param end   終了日 (YYYY-MM-DD, 含む, JST)
 * @returns { "YYYY-MM-DD": { stage, stageSource, diseases } }
 */
export async function getCalendarRisks(start: string, end: string): Promise<Record<string, DayRisk>> {
  const fetchFrom = jstDayStart(getSeasonStart(start));
  const rangeStart = jstDayStart(start);
  const rangeEnd = new Date(jstDayStart(end).getTime() + DAY_MS);

  const place = await getPlace();
  const [transitions, sensorHourly, forecastRows] = await Promise.all([
    getStageTransitions(),
    getSensorHourlyByRange(fetchFrom, rangeEnd),
    getForecastByRange(fetchFrom, rangeEnd, place.latitude, place.longitude),
  ]);

  const hours: Date[] = [];
  for (let t = fetchFrom.getTime(); t < rangeEnd.getTime(); t += HOUR_MS) hours.push(new Date(t));
  const allHourly = mergeHourly(hours, sensorHourly, forecastRows);
  const rainByDate = dailyRainfall(hours, sensorHourly);
  const rules = getRules();

  const result: Record<string, DayRisk> = {};
  for (let t = rangeStart.getTime(); t < rangeEnd.getTime(); t += DAY_MS) {
    const date = jstDate(new Date(t));
    const dayEnd = new Date(t + DAY_MS);
    const seasonToDate = allHourly.filter((h) => h.time < dayEnd);
    const recentForBroome = allHourly.filter(
      (h) => h.time >= new Date(t - BROOME_LOOKBACK_DAYS * DAY_MS) && h.time < dayEnd,
    );
    const dayHours = allHourly.filter((h) => h.time >= new Date(t) && h.time < dayEnd);
    const temps = dayHours.map((h) => h.tempC).filter((v): v is number => v !== null);
    const rhs = dayHours.map((h) => h.rhPercent).filter((v): v is number => v !== null);

    const { stage, source } = getStageForDate(date, transitions);
    const scalars = {
      stage,
      tempMeanC: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
      rhPercent: rhs.length ? Math.max(...rhs) : null,
      rain24hMm: rainByDate.get(date) ?? null,
      rainyDayStreak: rainyDayStreak(date, rainByDate),
    };

    const diseases = evaluateRisks(
      rules,
      { scalars, hourly: seasonToDate },
      { hourlyFor: (rule) => (rule.evaluator?.name === "broome" ? recentForBroome : seasonToDate) },
    );
    result[date] = { stage, stageSource: source, diseases };
  }
  return result;
}
