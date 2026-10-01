export type SprayRecord = {
  id: number;
  sprayedOn: string;
  /** マスターの登録番号。自由入力のときは null */
  pesticideId: string | null;
  /** 散布したときの商品名 */
  pesticide: string;
  dilution: string;
  amount: string;
  target: string;
  note: string;
};

export type SprayInput = Omit<SprayRecord, "id">;

/** 日付ごとの記録。observed はその日に発生を記録した病害の id */
export type DayData = { memo: string; sprays: SprayRecord[]; observed: string[] };

/** 散布の入力フォーム。id が null なら新規 */
export type SprayForm = {
  id: number | null;
  pesticideId: string | null;
  /** 「その他」を選び、薬剤名を手入力している */
  freeText: boolean;
  pesticide: string;
  dilution: string;
  amount: string;
  target: string;
  note: string;
};

export type SprayUsage = {
  /** 登録番号ごとの今年の散布回数 */
  byPesticide: Record<string, number>;
  byFrac: Record<string, { count: number; lastSprayedOn: string }>;
};

export type PesticideApplication = {
  crop: string;
  target: string | null;
  diseaseId: string | null;
  method: string;
  dilution: string | null;
  timing: string | null;
  preHarvestDays: number | null;
  uses: string | null;
  maxUses: number | null;
};

export type Pesticide = {
  /** 登録番号 */
  id: string;
  name: string;
  /** 農薬の種類（例: 銅水和剤） */
  kind: string;
  fracCodes: string[];
  fracNote: string | null;
  totalUseLimits: string[];
  /** 散布記録の「薬剤を選ぶ」に出さない */
  hidden: boolean;
  applications: PesticideApplication[];
};

export type PesticideMaster = {
  source: string;
  retrievedAt: string;
  pesticides: Pesticide[];
};

export type WeatherEntry = {
  tmax: number | null;
  tmin: number | null;
  humidity: number | null;
  code: number | null;
};

export type WeatherByDate = Record<string, WeatherEntry>;

export type TodayWeather = {
  temp: number | null;
  humidity: number | null;
  code: number | null;
  /** センサーの最新値が古い（未受信） */
  stale: boolean;
  updatedAt: string | null;
};

export type SensorReading = {
  value: number;
  receivedAt: string;
};

export type SensorStatus = {
  device: string;
  temp: SensorReading | null;
  humidity: SensorReading | null;
  /** 直近24時間の雨量合計(mm)。受信が無ければ null */
  rainfall24h: number | null;
  updatedAt: string;
  /** temp か humidity が無い、または15分より古い */
  stale: boolean;
};

/** 病害の表示用の情報。判定はバックエンド（/calendar/risk）で行う */
export type DiseaseInfo = {
  /** diseases.yaml の id */
  id: string;
  name: string;
  /** 3 = ◎、2 = ○。同じレベルの並び順に使う */
  priority: number;
  triggerText: string;
  symptom: string;
};

/** undetermined は入力不足で判定不能 */
export type RiskLevel = "conditions_met" | "near_threshold" | "undetermined" | "none";

/** recorded = 記録から, estimated = 月からの推定, unknown = どちらも無い */
export type StageSource = "recorded" | "estimated" | "unknown";

export type DayRisk = {
  stage: number | null;
  stageSource: StageSource;
  diseases: { diseaseId: string; level: RiskLevel }[];
};

export type RiskByDate = Record<string, DayRisk>;

export type StageData = {
  /** { value: 名前 } */
  names: Record<number, string>;
  /** { 切り替わり日（YYYY-MM-DD）: value } */
  transitions: Record<string, number>;
};
