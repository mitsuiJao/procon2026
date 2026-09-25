import fs from "fs";
import path from "path";
import cron from "node-cron";
import * as db from "../db/settings"

const filePath = path.join(__dirname, "../weather_forcast.json")

const headers = {
  'Content-Type': 'application/json',
};

const fetchData = async (url: string, headers: HeadersInit) => {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error('response error');
  }
  const data = await response.json();
  return data
}

async function getWeatherForcast(latitude: number, longitude: number) {
  const url: string = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weather_code&models=jma_seamless&timezone=Asia%2FTokyo&forecast_days=11`
  try {
    const data = await fetchData(url, headers);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("save done");
  } catch (error) {
    console.error("error:", error);
  }
}

export type HourlyPoint = {
  date: string; // JST
  temperature: number;
  humidity?: number | null;
  code: number;
};

export type DailyWeather = {
  tmax: number;
  tmin: number;
  humidity: number | null;
  code: number;
};

export function summarizeDaily(points: HourlyPoint[]): Record<string, DailyWeather> {
  const byDate: Record<string, HourlyPoint[]> = {};
  for (const p of points) (byDate[p.date] ??= []).push(p);

  const result: Record<string, DailyWeather> = {};
  for (const [date, list] of Object.entries(byDate)) {
    const temps = list.map((p) => p.temperature);
    const hums = list.map((p) => p.humidity).filter((h): h is number => h != null);

    const counts = new Map<number, number>();
    for (const p of list) counts.set(p.code, (counts.get(p.code) ?? 0) + 1);
    const [code] = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];

    result[date] = {
      tmax: Math.max(...temps),
      tmin: Math.min(...temps),
      humidity: hums.length
        ? Math.round((hums.reduce((a, b) => a + b, 0) / hums.length) * 10) / 10
        : null,
      code,
    };
  }
  return result;
}

export function pointsFromForecast(json: {
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
}): HourlyPoint[] {
  const { time, temperature_2m, weather_code } = json.hourly;
  return time.map((t, i) => ({
    date: t.slice(0, 10),
    temperature: temperature_2m[i],
    code: weather_code[i],
  }));
}

export function pointsFromObservations(
  rows: { observed_at: Date; temperature: number; humidity: number; weather_code: number }[],
): HourlyPoint[] {
  return rows.map((r) => ({
    date: r.observed_at.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
    temperature: r.temperature,
    humidity: r.humidity,
    code: r.weather_code,
  }));
}

cron.schedule(
  "0 * * * *", async () => {
    console.log("job start", new Date().toISOString());
    const place = await db.getPlace()
    await getWeatherForcast(place.latitude, place.longitude);
  },
  { timezone: "Asia/Tokyo" }
);

console.log("scheduler started");