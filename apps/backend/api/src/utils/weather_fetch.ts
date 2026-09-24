import fs from "fs";
import path from "path";

const filePath = path.join(__dirname, "../weather_forcast.json")

const latitude = 35.42346
const longitude = 133.33679

const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weather_code&models=jma_seamless&timezone=Asia%2FTokyo&forecast_days=11`
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

fetchData(url, headers)
    .then(data => {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log("save done")
    })
    .catch(error => {
        console.error("error:", error)
    });