export type PesticideEntry = {
  name: string;
  dilution: string;
  amount: string;
  target: string;
  note: string;
};

export type DayEntry = {
  pesticide: PesticideEntry;
  memo: string;
};

export type MonthData = Record<string, DayEntry>;

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

export type HistoryItem = {
  date: string;
  name: string;
  dilution: string;
};

export type FormState = {
  pestName: string;
  pestDilution: string;
  pestAmount: string;
  pestTarget: string;
  pestNote: string;
  memo: string;
};

export type PesticideMasterItem = {
  name: string;
  frac: string;
  dilution: string;
  max: string;
  note: string;
};

export type PesticidesById = Record<string, PesticideMasterItem>;

export type DiseaseRisk = {
  id: string;
  name: string;
  season: number[];
  checkRisk: (temp: number, humidity: number, code: number) => boolean;
  triggerText: string;
  symptom: string;
  pesticides: string[];
};
