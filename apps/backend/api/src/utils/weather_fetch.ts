import fs from "fs";
import path from "path";
import cron from "node-cron";
import * as db from "./db"

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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weather_code&models=jma_seamless&timezone=Asia%2FTokyo&forecast_days=11`
  try {
    const data = await fetchData(url, headers);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("save done");
  } catch (error) {
    console.error("error:", error);
  }
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