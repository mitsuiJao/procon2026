export type Sample = {
  date: string; // JST
  temperature?: number | null;
  humidity?: number | null;
  code?: number | null;
};

export type DailyWeather = {
  tmax: number | null;
  tmin: number | null;
  humidity: number | null;
  code: number | null;
};

const nonNull = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null);

export const jstDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

export function summarizeDaily(samples: Sample[]): Record<string, DailyWeather> {
  const byDate: Record<string, Sample[]> = {};
  for (const s of samples) (byDate[s.date] ??= []).push(s);

  const result: Record<string, DailyWeather> = {};
  for (const [date, list] of Object.entries(byDate)) {
    const temps = nonNull(list.map((s) => s.temperature));
    const hums = nonNull(list.map((s) => s.humidity));
    const codes = nonNull(list.map((s) => s.code));

    const counts = new Map<number, number>();
    for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
    const topCode = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];

    result[date] = {
      tmax: temps.length ? Math.max(...temps) : null,
      tmin: temps.length ? Math.min(...temps) : null,
      humidity: hums.length
        ? Math.round((hums.reduce((a, b) => a + b, 0) / hums.length) * 10) / 10
        : null,
      code: topCode ? topCode[0] : null,
    };
  }
  return result;
}

export function pointsFromForecast(
  rows: { observed_at: Date; temperature: number; humidity: number; weather_code: number }[],
): Sample[] {
  return rows.map((r) => ({
    date: jstDate(r.observed_at),
    temperature: r.temperature,
    humidity: r.humidity,
    code: r.weather_code,
  }));
}

export function pointsFromMeasures(
  rows: { metric: string; value: number; received_at: Date }[],
): Sample[] {
  return rows.flatMap((r): Sample[] => {
    const date = jstDate(r.received_at);
    if (r.metric === "temp") return [{ date, temperature: r.value }];
    if (r.metric === "humidity") return [{ date, humidity: r.value }];
    return [];
  });
}

export function mergeDaily(
  sensor: Record<string, DailyWeather>,
  forecast: Record<string, DailyWeather>,
  today: string,
): Record<string, DailyWeather> {
  const result: Record<string, DailyWeather> = {};
  for (const date of new Set([...Object.keys(sensor), ...Object.keys(forecast)])) {
    const s = sensor[date];
    const f = forecast[date];
    if (s && date < today) {
      result[date] = {
        tmax: s.tmax ?? f?.tmax ?? null,
        tmin: s.tmin ?? f?.tmin ?? null,
        humidity: s.humidity ?? f?.humidity ?? null,
        code: f?.code ?? null,
      };
    } else {
      result[date] = f ?? s;
    }
  }
  return result;
}
