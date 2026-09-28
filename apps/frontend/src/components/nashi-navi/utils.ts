import type { DiseaseRisk, Pesticide, SprayForm, WeatherEntry } from "@/components/nashi-navi/types";

type WeatherKind = { icon: "sun" | "cloud" | "cloud-rain"; label: string };

/** WMO 天気コードを晴れ・曇り・雨の3種類に丸める（霧は曇り、雪・雷雨は雨） */
export const wIcon = (code: number | null): WeatherKind | null => {
  if (code == null) return null;
  if (code <= 1) return { icon: "sun", label: "晴れ" };
  if (code <= 48) return { icon: "cloud", label: "曇り" };
  return { icon: "cloud-rain", label: "雨" };
};

export const pad = (n: number) => String(n).padStart(2, "0");
export const dateKeyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const emptySprayForm: SprayForm = {
  id: null,
  pesticideId: null,
  freeText: false,
  pesticide: "",
  dilution: "",
  amount: "",
  target: "",
  note: "",
};

// id はバックエンドの diseaseId（diseases.yaml）にそろえる
export const DISEASES: DiseaseRisk[] = [
  {
    id: "downy_mildew",
    name: "べと病",
    season: [5, 6, 7],
    checkRisk: (temp, _humidity, code) => temp >= 20 && code >= 50,
    triggerText: "平均気温20℃以上＋降雨継続",
    symptom: "葉に黄白色の病斑が出現し、裏面に白いカビが生えます。",
  },
  {
    id: "ripe_rot",
    name: "晩腐病",
    season: [7, 8, 9],
    checkRisk: (temp, humidity) => temp >= 25 && humidity >= 75,
    triggerText: "気温25℃前後＋多湿",
    symptom: "着色期以降に果実が褐色になり腐敗します。",
  },
  {
    id: "botrytis",
    name: "灰色かび病",
    season: [5, 6, 8, 9, 10],
    checkRisk: (temp, humidity) => temp >= 15 && temp <= 22 && humidity >= 70,
    triggerText: "気温15〜20℃＋多湿",
    symptom: "開花期や成熟期に花カスや果実に灰色のカビが生えます。",
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

/** その病害に登録（適用）のある農薬を名前順に。推奨ではなく、選べる一覧 */
export const pesticidesForDisease = (pesticides: Pesticide[], diseaseId: string) =>
  pesticides
    .filter((p) => p.applications.some((a) => a.diseaseId === diseaseId))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

/** 名前の部分一致で絞り込む。空なら全部 */
export const searchPesticides = (pesticides: Pesticide[], query: string) => {
  const q = query.trim();
  return q ? pesticides.filter((p) => p.name.includes(q)) : pesticides;
};
