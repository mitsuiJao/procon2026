import cron from "node-cron";
import * as settings from "../db/settings";
import { writeForecast } from "../db/weather";

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

type ForecastJson = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    weather_code: number[];
  };
};

async function getWeatherForcast(latitude: number, longitude: number) {
  const url: string = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,weather_code&models=jma_seamless&timezone=Asia%2FTokyo&forecast_days=11`
  try {
    const data: ForecastJson = await fetchData(url, headers);
    const { time, temperature_2m, relative_humidity_2m, weather_code } = data.hourly;
    for (let i = 0; i < time.length; i++) {
      if (temperature_2m[i] == null || relative_humidity_2m[i] == null || weather_code[i] == null) continue;
      await writeForecast({
        observed_at: `${time[i]}:00+09:00`,
        temperature: temperature_2m[i],
        humidity: relative_humidity_2m[i],
        latitude,
        longitude,
        weather_code: weather_code[i],
      });
    }
    console.log("save done");
  } catch (error) {
    console.error("error:", error);
  }
}

async function job() {
  console.log("job start", new Date().toISOString());
  try {
    const place = await settings.getPlace();
    await getWeatherForcast(place.latitude, place.longitude);
  } catch (error) {
    console.error("job error:", error);
  }
}

export function startWeatherCron() {
  cron.schedule("0 * * * *", job, { timezone: "Asia/Tokyo" });
  void job(); // 起動直後にも1回実行
  console.log("scheduler started");
}
