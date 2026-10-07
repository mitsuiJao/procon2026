import { getSensorHourlyByRange, type SensorHourly } from "../db/measure";
import { getLatestSensitivity } from "../db/sensitivity";
import { getPlace } from "../db/settings";
import { getStageTransitions } from "../db/stage";
import { getForecastByRange } from "../db/weather";
import { applyRepeat, evaluateRules, groupByDisease, resolveRules } from "../evalute";
import type { DiseaseResult, EvalInput, HourlyPoint, Rule } from "../evalute";
import { getRuleDefs, getStagesVocab } from "./vocab";
import { jstDate } from "./weather-daily";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Broome（灰色かび病）に渡す直近の濡れイベント判定用の遡り日数。季節全体を渡すと季節最悪値に張り付くため短くする */
const BROOME_LOOKBACK_DAYS = 2;

export type StageSource = "recorded" | "estimated" | "unknown";

/** 1日分の判定の入力。ルール（感度の段階）を変えて何度でも評価できる */
export type DayInput = {
  date: string;
  stage: number | null;
  stageSource: StageSource;
  scalars: EvalInput["scalars"];
  /** そのルールに渡す時別の系列（Broome は直近だけ、ほかは季節の初めから） */
  hourlyFor: (rule: Rule) => HourlyPoint[];
};

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
 * その日のシーズン（getSeasonStart 以降）の記録（stage_transitions）があればそれを採用する（recorded）。
 * 前のシーズンの記録は引き継がない（去年の「収穫後」が今年の春まで続いてしまうため）。
 * 無ければ stages.yaml の typicalMonth から近似する（estimated）。
 * typicalMonth は隣接ステージ間で重なりがあるため、「その月を含むうち最も進んだステージ」を採る
 * 単純なルールで決める。精度は低いので stageSource で必ず区別すること。
 */
export function getStageForDate(
  date: string,
  transitions: { stage: number; effectiveFrom: string }[],
): { stage: number | null; source: StageSource } {
  const seasonStart = getSeasonStart(date);
  let recorded: number | null = null;
  for (const t of transitions) {
    if (t.effectiveFrom > date) break;
    if (t.effectiveFrom >= seasonStart) recorded = t.stage;
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
export function mergeHourly(
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
 * JST日付ごとの雨量合計。1時間ごとにセンサーの雨量を優先し、無ければ予報の降水量で補う。
 * その日のうち1時間でも値があれば合計を返し、1つも無ければ null にする
 * （0mmと「データが無い」を混同しない）。
 */
export function dailyRainfall(
  hours: Date[],
  sensor: Record<string, SensorHourly>,
  forecast: { observed_at: Date; precipitation: number | null }[],
): Map<string, number | null> {
  const forecastByHour = new Map(forecast.map((r) => [r.observed_at.toISOString(), r.precipitation]));
  const byDate = new Map<string, { sum: number; hasData: boolean }>();
  for (const time of hours) {
    const key = time.toISOString();
    const mm = sensor[key]?.rainfallMm ?? forecastByHour.get(key) ?? null;
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
export function rainyDayStreak(date: string, rainByDate: Map<string, number | null>): number | null {
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
 * 指定期間の判定の入力を日ごとに作る。データの取得は期間全体で1回だけ行う。
 * @param start 開始日 (YYYY-MM-DD, 含む, JST)
 * @param end   終了日 (YYYY-MM-DD, 含む, JST)
 */
export async function buildDayInputs(start: string, end: string): Promise<DayInput[]> {
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
  const rainByDate = dailyRainfall(hours, sensorHourly, forecastRows);
  // allHourly は fetchFrom から1時間刻みなので、時刻は添字に直せる
  const indexOf = (t: number) => Math.max(0, Math.round((t - fetchFrom.getTime()) / HOUR_MS));

  const days: DayInput[] = [];
  for (let t = rangeStart.getTime(); t < rangeEnd.getTime(); t += DAY_MS) {
    const date = jstDate(new Date(t));
    const dayEndIndex = indexOf(t + DAY_MS);
    const dayHours = allHourly.slice(indexOf(t), dayEndIndex);
    const temps = dayHours.map((h) => h.tempC).filter((v): v is number => v !== null);
    const rhs = dayHours.map((h) => h.rhPercent).filter((v): v is number => v !== null);

    const { stage, source } = getStageForDate(date, transitions);
    days.push({
      date,
      stage,
      stageSource: source,
      scalars: {
        stage,
        tempMeanC: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
        rhPercent: rhs.length ? Math.max(...rhs) : null,
        rain24hMm: rainByDate.get(date) ?? null,
        rainyDayStreak: rainyDayStreak(date, rainByDate),
      },
      // 系列は日数ぶん持つと大きいので、評価のときに切り出す
      hourlyFor: (rule) =>
        allHourly.slice(
          rule.evaluator?.name === "broome" ? indexOf(t - BROOME_LOOKBACK_DAYS * DAY_MS) : 0,
          dayEndIndex,
        ),
    });
  }
  return days;
}

/**
 * 日ごとにルールで評価して、警告の出し直しを間引き（repeatDays）、病害ごとにまとめる
 * @param days 1日ずつ連続した日。間引きは渡した最初の日から数える
 * @returns days と同じ並びの、日ごとの結果
 */
export function evaluateDays(rules: Rule[], days: DayInput[]): DiseaseResult[][] {
  const perDay = days.map((day) => evaluateRules(rules, { scalars: day.scalars, hourly: [] }, { hourlyFor: day.hourlyFor }));
  applyRepeat(rules, days.map((d) => d.date), perDay);
  return perDay.map(groupByDisease);
}

/**
 * 指定期間の病害リスクを日ごとに評価
 * ルールは、病害ごとの感度の段階（今シーズンの発生記録から選んだもの）で確定させて使う。
 * 警告が続き始めた日はシーズンの初めまでさかのぼり得るので、評価は start のシーズン開始から行い、返すのは指定期間だけ。
 * @param start 開始日 (YYYY-MM-DD, 含む, JST)
 * @param end   終了日 (YYYY-MM-DD, 含む, JST)
 * @returns { "YYYY-MM-DD": { stage, stageSource, diseases } }
 */
export async function getCalendarRisks(start: string, end: string): Promise<Record<string, DayRisk>> {
  const [days, sensitivity] = await Promise.all([
    buildDayInputs(getSeasonStart(start), end),
    getLatestSensitivity(getSeasonStart(jstDate(new Date()))),
  ]);
  const rules = resolveRules(getRuleDefs(), Object.fromEntries(sensitivity.map((r) => [r.diseaseId, r.level])));
  const diseasesByDay = evaluateDays(rules, days);

  const result: Record<string, DayRisk> = {};
  days.forEach((day, i) => {
    if (day.date < start) return;
    result[day.date] = { stage: day.stage, stageSource: day.stageSource, diseases: diseasesByDay[i] };
  });
  return result;
}
