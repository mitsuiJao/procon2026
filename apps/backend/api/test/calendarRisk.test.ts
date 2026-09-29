import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailyRainfall,
  getSeasonStart,
  getStageForDate,
  mergeHourly,
  rainyDayStreak,
} from "../src/utils/calendarRisk";

const HOUR_MS = 3600 * 1000;

/** JST の date の0時から n 時間分の時刻（UTC の Date） */
const jstHours = (date: string, n: number): Date[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${date}T00:00:00+09:00`) + i * HOUR_MS));

const sensorRow = (rainfallMm: number | null, tempC: number | null = null, rhPercent: number | null = null) => ({
  tempC,
  rhPercent,
  rainfallMm,
});

describe("getStageForDate", () => {
  const transitions = [
    { stage: 2, effectiveFrom: "2026-04-20" },
    { stage: 7, effectiveFrom: "2026-07-05" },
  ];

  it("記録があれば、その日以前で最後の記録（recorded）", () => {
    assert.deepEqual(getStageForDate("2026-04-20", transitions), { stage: 2, source: "recorded" });
    assert.deepEqual(getStageForDate("2026-07-04", transitions), { stage: 2, source: "recorded" });
    assert.deepEqual(getStageForDate("2026-09-01", transitions), { stage: 7, source: "recorded" });
  });

  it("記録が無ければ月から推定する。重なる月は最も進んだステージ", () => {
    assert.deepEqual(getStageForDate("2026-04-19", transitions), { stage: 2, source: "estimated" });
    assert.deepEqual(getStageForDate("2026-09-10", []), { stage: 9, source: "estimated" });
  });

  it("年をまたぐ範囲（12〜3月の休眠期）", () => {
    assert.deepEqual(getStageForDate("2026-12-15", []), { stage: 0, source: "estimated" });
    assert.deepEqual(getStageForDate("2027-02-01", []), { stage: 0, source: "estimated" });
  });
});

describe("getSeasonStart", () => {
  it("4月以降はその年、1〜3月は前年の4月1日", () => {
    assert.equal(getSeasonStart("2026-04-01"), "2026-04-01");
    assert.equal(getSeasonStart("2026-12-31"), "2026-04-01");
    assert.equal(getSeasonStart("2027-03-31"), "2026-04-01");
  });
});

describe("mergeHourly", () => {
  it("気温・湿度は項目ごとにセンサーを優先し、無ければ予報", () => {
    const [h0, h1, h2] = jstHours("2026-06-01", 3);
    const sensor = {
      [h0.toISOString()]: sensorRow(null, 20, 80),
      [h1.toISOString()]: sensorRow(null, 21, null),
    };
    const forecast = [h0, h1, h2].map((t) => ({ observed_at: t, temperature: 30, humidity: 50 }));
    assert.deepEqual(
      mergeHourly([h0, h1, h2], sensor, forecast).map((p) => [p.tempC, p.rhPercent]),
      [[20, 80], [21, 50], [30, 50]],
    );
  });
});

describe("dailyRainfall", () => {
  it("1時間ごとにセンサーを優先し、無い時間は予報で埋める", () => {
    const hours = jstHours("2026-06-01", 24);
    const sensor = { [hours[0].toISOString()]: sensorRow(3), [hours[1].toISOString()]: sensorRow(0) };
    // 予報は毎時 1mm。センサーのある2時間はセンサー（3mm と 0mm）
    const forecast = hours.map((t) => ({ observed_at: t, precipitation: 1 }));
    assert.equal(dailyRainfall(hours, sensor, forecast).get("2026-06-01"), 3 + 0 + 22);
  });

  it("センサーも予報も無い日は null。予報の null も無い扱い", () => {
    const hours = jstHours("2026-06-01", 48);
    const forecast = hours.slice(24).map((t) => ({ observed_at: t, precipitation: null }));
    const rain = dailyRainfall(hours, {}, forecast);
    assert.equal(rain.get("2026-06-01"), null);
    assert.equal(rain.get("2026-06-02"), null);
  });

  it("JST の日付で区切る（UTC 15時で日が変わる）", () => {
    const hours = jstHours("2026-06-01", 48);
    // JST 6/1 23時（UTC 14時）に 3mm、JST 6/2 0時（UTC 15時）に 5mm
    const mm = (t: Date) => (t.getTime() === hours[23].getTime() ? 3 : t.getTime() === hours[24].getTime() ? 5 : 0);
    assert.equal(hours[24].toISOString(), "2026-06-01T15:00:00.000Z");
    const rain = dailyRainfall(hours, {}, hours.map((t) => ({ observed_at: t, precipitation: mm(t) })));
    assert.equal(rain.get("2026-06-01"), 3);
    assert.equal(rain.get("2026-06-02"), 5);
  });
});

describe("rainyDayStreak", () => {
  const rain = new Map<string, number | null>([
    ["2026-06-01", null],
    ["2026-06-02", 0.5],
    ["2026-06-03", 1],
    ["2026-06-04", 12],
    ["2026-06-05", null],
  ]);

  it("日降水量1mm以上の日が何日続いたか", () => {
    assert.equal(rainyDayStreak("2026-06-04", rain), 2);
    assert.equal(rainyDayStreak("2026-06-03", rain), 1);
    assert.equal(rainyDayStreak("2026-06-02", rain), 0);
  });

  it("当日のデータが無ければ null、前の日が無ければそこで数えるのを止める", () => {
    assert.equal(rainyDayStreak("2026-06-05", rain), null);
    const gap = new Map<string, number | null>([["2026-06-01", 5], ["2026-06-02", null], ["2026-06-03", 5]]);
    assert.equal(rainyDayStreak("2026-06-03", gap), 1);
  });
});
