import type { DiseaseRisk, FormState, PesticidesById, WeatherEntry } from "@/components/nashi-navi/types";

type WeatherKind = { icon: "sun" | "cloud" | "cloud-rain"; label: string };

/** WMO 天気コードを晴れ・曇り・雨の3種類に丸める（霧は曇り、雪・雷雨は雨） */
export const wIcon = (code: number | null): WeatherKind | null => {
  if (code == null) return null;
  if (code <= 1) return { icon: "sun", label: "晴れ" };
  if (code <= 48) return { icon: "cloud", label: "曇り" };
  return { icon: "cloud-rain", label: "雨" };
};

export const pad = (n: number) => String(n).padStart(2, "0");
export const monthKeyOf = (y: number, m: number) => `month:${y}-${pad(m + 1)}`;
export const dateKeyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const emptyForm: FormState = {
  pestName: "",
  pestDilution: "",
  pestAmount: "",
  pestTarget: "",
  pestNote: "",
  memo: "",
};

export const PESTICIDES: PesticidesById = {
  P001: { name: "ICボルドー66D水和剤", frac: "M01", dilution: "500倍", max: "制限なし", note: "収穫前日まで使用可能。散布後の果実の汚れに注意。" },
  P002: { name: "アミスター10フロアブル", frac: "11", dilution: "2000倍", max: "年3回まで", note: "耐性菌が発生しやすいため連続使用を避ける。" },
  P003: { name: "オーソサイド水和剤80", frac: "M04", dilution: "800倍", max: "年5回まで", note: "発病前の予防散布が基本。" },
  P004: { name: "ベンレート水和剤", frac: "1", dilution: "2000倍", max: "年3回まで", note: "予防と治療の両方に効果あり。他剤とローテーションする。" },
  P005: { name: "セイビアーフロアブル20", frac: "12", dilution: "1000倍", max: "年2回まで", note: "開花直前〜落花期の予防散布が特に有効。" },
};

export const DISEASES: DiseaseRisk[] = [
  {
    id: "D001",
    name: "べと病",
    season: [5, 6, 7],
    checkRisk: (temp, _humidity, code) => temp >= 20 && code >= 50,
    triggerText: "平均気温20℃以上＋降雨継続",
    symptom: "葉に黄白色の病斑が出現し、裏面に白いカビが生えます。",
    pesticides: ["P001", "P002"],
  },
  {
    id: "D002",
    name: "晩腐病",
    season: [7, 8, 9],
    checkRisk: (temp, humidity) => temp >= 25 && humidity >= 75,
    triggerText: "気温25℃前後＋多湿",
    symptom: "着色期以降に果実が褐色になり腐敗します。",
    pesticides: ["P003", "P004"],
  },
  {
    id: "D003",
    name: "灰色かび病",
    season: [5, 6, 8, 9, 10],
    checkRisk: (temp, humidity) => temp >= 15 && temp <= 22 && humidity >= 70,
    triggerText: "気温15〜20℃＋多湿",
    symptom: "開花期や成熟期に花カスや果実に灰色のカビが生えます。",
    pesticides: ["P005"],
  },
];

/** 気象が発病条件に当てはまる病害（month は 1〜12） */
export const matchRisks = (temp: number, humidity: number, code: number, month: number) =>
  DISEASES.filter((d) => d.season.includes(month) && d.checkRisk(temp, humidity, code));

/** 日ごとの判定。気温は最高・最低の平均を使い、欠けている日は判定しない */
export const risksForDay = (w: WeatherEntry | undefined, month: number) => {
  if (!w || w.tmax == null || w.tmin == null || w.humidity == null || w.code == null) return [];
  return matchRisks((w.tmax + w.tmin) / 2, w.humidity, w.code, month);
};
