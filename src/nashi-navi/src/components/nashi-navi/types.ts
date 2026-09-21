export type PesticideEntry = {
  name: string;
  dilution: string;
  amount: string;
  target: string;
  note: string;
};

export type DayEntry = {
  tempActual: string;
  humidityActual: string;
  pesticide: PesticideEntry;
  memo: string;
};

export type MonthData = Record<string, DayEntry>;

export type WeatherEntry = {
  tmax: number;
  tmin: number;
  humidity: number | null;
  code: number;
};

export type WeatherByDate = Record<string, WeatherEntry>;

export type TodayWeather = {
  temp: number;
  humidity: number;
  code: number;
};

export type HistoryItem = {
  date: string;
  name: string;
  dilution: string;
};

export type FormState = {
  tempActual: string;
  humidityActual: string;
  pestName: string;
  pestDilution: string;
  pestAmount: string;
  pestTarget: string;
  pestNote: string;
  memo: string;
};
