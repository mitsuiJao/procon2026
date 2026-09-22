import type { DiseaseRisk, FormState, PesticidesById } from "@/components/nashi-navi/types";

const WMO: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

export const wIcon = (code: number) => WMO[code] || "🌡️";

export const pad = (n: number) => String(n).padStart(2, "0");
export const monthKeyOf = (y: number, m: number) => `month:${y}-${pad(m + 1)}`;
export const dateKeyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const emptyForm: FormState = {
  tempActual: "",
  humidityActual: "",
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
