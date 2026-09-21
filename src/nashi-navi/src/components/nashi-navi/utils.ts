import type { FormState } from "@/components/nashi-navi/types";

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
