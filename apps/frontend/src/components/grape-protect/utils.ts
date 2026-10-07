import type {
  DayRisk,
  DiseaseInfo,
  LookbackItem,
  Pesticide,
  PesticideApplication,
  RiskLevel,
  Sensitivity,
  SprayForm,
  SprayRecord,
} from "@/components/grape-protect/types";

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

/** 病害リスクを出すのは今日から何日先まで。それより先の予報は当てにならないので出さない */
export const RISK_DAYS_AHEAD = 7;

/** 「去年の今ごろ」に出すのは、1年前の同じ日の前後何日か */
export const LOOKBACK_DAYS = 7;
const MEMO_MAX = 30;

/** 1年前の同じ日の前後 LOOKBACK_DAYS 日（両端含む）。2/29 は 2/28 にする */
export const lookbackRange = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.min(d, new Date(y - 1, m, 0).getDate());
  const at = (offset: number) => {
    const t = new Date(y - 1, m - 1, day + offset);
    return dateKeyOf(t.getFullYear(), t.getMonth(), t.getDate());
  };
  return { start: at(-LOOKBACK_DAYS), end: at(LOOKBACK_DAYS) };
};

/** 期間の見出し（例: 2025年 9/24〜10/8） */
export const fmtLookbackRange = ({ start, end }: { start: string; end: string }) => {
  const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8))}`;
  return `${start.slice(0, 4)}年 ${md(start)}〜${md(end)}`;
};

const LOOKBACK_ORDER: Record<LookbackItem["kind"], number> = { stage: 0, observation: 1, spray: 2, memo: 3 };

/**
 * 期間の記録を「去年の今ごろ」の行にまとめる（日付順。同じ日はステージ → 発生 → 散布 → メモ）
 * ステージ・発生・散布は名前だけを出す。メモは先頭の1行だけを出し、長ければ切る
 */
export const buildLookback = (args: {
  start: string;
  end: string;
  sprays: SprayRecord[];
  observations: { date: string; diseaseId: string }[];
  /** { 日付: メモ } */
  diary: Record<string, string>;
  /** { 切り替わり日: ステージの value }（全期間） */
  transitions: Record<string, number>;
  diseases: DiseaseInfo[];
  stageNames: Record<number, string>;
}): LookbackItem[] => {
  const { start, end, sprays, observations, diary, transitions, diseases, stageNames } = args;
  const items: LookbackItem[] = [];
  for (const [date, stage] of Object.entries(transitions)) {
    if (date >= start && date <= end) items.push({ date, kind: "stage", text: stageNames[stage] ?? `生育状態 ${stage}` });
  }
  for (const o of observations) {
    items.push({ date: o.date, kind: "observation", text: diseases.find((d) => d.id === o.diseaseId)?.name ?? o.diseaseId });
  }
  for (const s of sprays) items.push({ date: s.sprayedOn, kind: "spray", text: s.pesticide });
  for (const [date, memo] of Object.entries(diary)) {
    const line = memo.trim().split("\n")[0];
    if (line) items.push({ date, kind: "memo", text: line.length > MEMO_MAX ? `${line.slice(0, MEMO_MAX)}…` : line });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || LOOKBACK_ORDER[a.kind] - LOOKBACK_ORDER[b.kind]);
};

export const LOOKBACK_KIND_LABEL: Record<LookbackItem["kind"], string> = {
  stage: "生育",
  observation: "発生",
  spray: "散布",
  memo: "メモ",
};

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

const SENSITIVITY_LABEL = ["標準", "敏感", "より敏感"];

/** 感度の段階の名前。用意した名前より先の段階は、最後の名前にする */
export const sensitivityLabel = (level: number) =>
  SENSITIVITY_LABEL[Math.min(Math.max(level, 0), SENSITIVITY_LABEL.length - 1)];

/** 段階を選んだ理由の1行。発生記録が無ければ null */
export const sensitivityReason = (s: Sensitivity) =>
  s.observed === 0 ? null : `今季の発生 ${s.observed}件中 ${s.caught}件を事前に警告。警告は今季 ${s.alertDays}日`;

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

/** 全角・半角をそろえ、ひらがなをカタカナにし、英字を大文字にする */
const normalize = (s: string) =>
  s.normalize("NFKC").replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).toUpperCase();

// 正規化は重いので、同じ農薬オブジェクトなら作り直さない
const searchTextCache = new WeakMap<Pesticide, string>();

/** 検索の対象にする文字列（名前・種類・FRAC コード・適用の病害虫名） */
const searchTextOf = (p: Pesticide) => {
  let text = searchTextCache.get(p);
  if (text === undefined) {
    text = normalize([p.name, p.kind, ...p.fracCodes, ...p.applications.map((a) => a.target ?? "")].join(" "));
    searchTextCache.set(p, text);
  }
  return text;
};

/** 名前・種類・FRAC・病害虫名の部分一致で絞り込む。空白で区切った語はすべて含むもの。空なら全部 */
export const searchPesticides = (pesticides: Pesticide[], query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return pesticides;
  return pesticides.filter((p) => {
    const text = searchTextOf(p);
    return words.every((w) => text.includes(w));
  });
};

/** 登録内容の1行（対象・倍率・時期・回数の原文） */
export const fmtApplication = (a: PesticideApplication) =>
  [a.target, a.dilution, a.timing, a.uses && a.uses !== "-" ? `本剤 ${a.uses}` : null].filter(Boolean).join("　");
