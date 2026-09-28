import type { DayRisk, DiseaseInfo, Pesticide, RiskLevel, SprayForm } from "@/components/nashi-navi/types";

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

// 病害の表示用の文。キーは diseases.yaml の id。判定はバックエンド（rules.yaml）で行い、条件の文はそれに合わせる
export const DISEASE_TEXT: Record<string, { triggerText: string; symptom: string }> = {
  downy_mildew: {
    triggerText: "展葉期以降、平均気温10℃以上で1日の雨量が10mm以上",
    symptom: "葉に黄白色の病斑が出現し、裏面に白いカビが生えます。",
  },
  ripe_rot: {
    triggerText: "開花直前〜幼果期の降雨（1日10mm以上、または雨の日が2日続く）",
    symptom: "着色期以降に果実が褐色になり腐敗します。",
  },
  botrytis: {
    triggerText: "湿度95%以上の状態が長く続く（濡れ時間と気温から判定）",
    symptom: "開花期や成熟期に花カスや果実に灰色のカビが生えます。",
  },
  anthracnose: {
    triggerText: "萌芽〜肥大期の降雨。気温15〜20℃の冷たい雨で起こりやすい",
    symptom: "若い葉・新梢・果実に黒褐色の小さな斑点ができ、中央がくぼみます。",
  },
  powdery_mildew: {
    triggerText: "21〜30℃の時間が長い日が続く（Gubler-Thomas 指数で判定）",
    symptom: "葉や果実の表面に白い粉状のカビが生えます。",
  },
  rust: {
    triggerText: "肥大期以降、気温20〜25℃で湿度がほぼ飽和",
    symptom: "葉の裏に黄色〜橙色の粉状の斑点が出て、早く落葉します。",
  },
};

/** API の病害一覧に表示用の文を合わせる */
export const toDiseaseInfo = (d: { id: string; name: string; priority: number }): DiseaseInfo => ({
  ...d,
  triggerText: DISEASE_TEXT[d.id]?.triggerText ?? "",
  symptom: DISEASE_TEXT[d.id]?.symptom ?? "",
});

/** 画面に出すレベル。判定不能（undetermined）は none と同じく出さない */
export type AlertLevel = "conditions_met" | "near_threshold";

export const LEVEL_LABEL: Record<AlertLevel, string> = {
  conditions_met: "感染条件に該当",
  near_threshold: "条件に近い",
};

const LEVEL_RANK: Record<RiskLevel, number> = { conditions_met: 2, near_threshold: 1, undetermined: 0, none: 0 };

const isAlert = (level: RiskLevel): level is AlertLevel => LEVEL_RANK[level] > 0;

/** その日に出す病害。該当 → 近い の順、同じなら重要度の順。一覧に無い id は id を名前にする */
export const alertsOf = (day: DayRisk | undefined, diseases: DiseaseInfo[]) =>
  (day?.diseases ?? [])
    .filter((d): d is { diseaseId: string; level: AlertLevel } => isAlert(d.level))
    .map((d) => ({
      level: d.level,
      disease: diseases.find((x) => x.id === d.diseaseId) ?? toDiseaseInfo({ id: d.diseaseId, name: d.diseaseId, priority: 0 }),
    }))
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.disease.priority - a.disease.priority);

/** その日の最も高いレベル。出すものが無ければ null */
export const maxLevel = (day: DayRisk | undefined): AlertLevel | null =>
  alertsOf(day, [])[0]?.level ?? null;

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
