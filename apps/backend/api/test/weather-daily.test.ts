import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeDaily, summarizeDaily } from "../src/utils/weather-daily";

describe("summarizeDaily", () => {
  it("最高・最低・平均湿度（小数1桁）・最も多い天気コード", () => {
    const d = summarizeDaily([
      { date: "2026-06-01", temperature: 20, humidity: 80, code: 1 },
      { date: "2026-06-01", temperature: 25, humidity: 81, code: 3 },
      { date: "2026-06-01", temperature: 18, humidity: 81, code: 3 },
    ])["2026-06-01"];
    assert.deepEqual(d, { tmax: 25, tmin: 18, humidity: 80.7, code: 3 });
  });

  it("天気コードが同数なら大きい方（悪い天気）", () => {
    const d = summarizeDaily([
      { date: "2026-06-01", code: 61 },
      { date: "2026-06-01", code: 1 },
    ])["2026-06-01"];
    assert.equal(d.code, 61);
  });

  it("値が無ければ null", () => {
    assert.deepEqual(summarizeDaily([{ date: "2026-06-01" }])["2026-06-01"], {
      tmax: null,
      tmin: null,
      humidity: null,
      code: null,
    });
  });
});

describe("mergeDaily", () => {
  const sensor = { "2026-06-01": { tmax: 20, tmin: null, humidity: 70, code: null } };
  const forecast = {
    "2026-06-01": { tmax: 30, tmin: 15, humidity: 50, code: 61 },
    "2026-06-02": { tmax: 31, tmin: 16, humidity: 51, code: 1 },
  };

  it("過去の日はセンサーを優先し、欠けた項目と天気コードは予報", () => {
    assert.deepEqual(mergeDaily(sensor, forecast, "2026-06-02")["2026-06-01"], {
      tmax: 20,
      tmin: 15,
      humidity: 70,
      code: 61,
    });
  });

  it("今日以降は予報", () => {
    assert.deepEqual(mergeDaily(sensor, forecast, "2026-06-01")["2026-06-01"], forecast["2026-06-01"]);
    assert.deepEqual(mergeDaily(sensor, forecast, "2026-06-01")["2026-06-02"], forecast["2026-06-02"]);
  });
});
