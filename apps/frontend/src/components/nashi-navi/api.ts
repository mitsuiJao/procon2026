import type { SensorReading, SensorStatus, TodayWeather, WeatherByDate } from "@/components/nashi-navi/types";

// 実機で確認するときは .env.local に EXPO_PUBLIC_API_URL=http://<PCのIP>:3000/api を書く
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return (await r.json()) as T;
}

type CurrentResponse = {
  temp: number | null;
  humidity: number | null;
  rainfall: number | null;
  code: number | null;
  updated_at: string | null;
  stale: boolean;
};

/** 現在値（センサー最新値＋予報の天気コード） */
export async function fetchCurrent(): Promise<TodayWeather> {
  const data = await getJson<CurrentResponse>("/current");
  return {
    temp: data.temp,
    humidity: data.humidity,
    code: data.code,
    stale: data.stale,
    updatedAt: data.updated_at,
  };
}

/** 日次天気。start, end は YYYY-MM-DD（JST, 両端含む） */
export function fetchCalendar(start: string, end: string): Promise<WeatherByDate> {
  return getJson<WeatherByDate>(`/calendar?start=${start}&end=${end}`);
}

type ReadingResponse = { value: number; received_at: string } | null;

type SensorResponse = {
  device: string;
  temp: ReadingResponse;
  humidity: ReadingResponse;
  rainfall_24h: number | null;
  updated_at: string;
  stale: boolean;
};

const toReading = (r: ReadingResponse): SensorReading | null =>
  r ? { value: r.value, receivedAt: r.received_at } : null;

/** デバイスごとのセンサー状態 */
export async function fetchSensors(): Promise<SensorStatus[]> {
  const data = await getJson<SensorResponse[]>("/sensors");
  return data.map((s) => ({
    device: s.device,
    temp: toReading(s.temp),
    humidity: toReading(s.humidity),
    rainfall24h: s.rainfall_24h,
    updatedAt: s.updated_at,
    stale: s.stale,
  }));
}
