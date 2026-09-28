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

/** 日付ごとの記録 */
export type DayData = { memo: string; sprays: SprayRecord[] };

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
  fracCodes: string[];
  fracNote: string | null;
  totalUseLimits: string[];
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

export type DiseaseRisk = {
  id: string;
  name: string;
  season: number[];
  checkRisk: (temp: number, humidity: number, code: number) => boolean;
  triggerText: string;
  symptom: string;
};
