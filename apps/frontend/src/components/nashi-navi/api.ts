import type {
  DayRisk,
  PesticideMaster,
  RiskByDate,
  RiskLevel,
  SensorReading,
  SensorStatus,
  SprayInput,
  SprayRecord,
  SprayUsage,
  StageData,
  TodayWeather,
  WeatherByDate,
} from "@/components/nashi-navi/types";

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

// /calendar/risk はバックエンドの型をそのまま返すので camelCase。ルールごとの内訳は使わない
type RiskResponse = Record<string, DayRisk & { diseases: { diseaseId: string; level: RiskLevel; rules: unknown[] }[] }>;

/** 日ごとの病害リスク。start, end は YYYY-MM-DD（JST, 両端含む） */
export async function fetchRisk(start: string, end: string): Promise<RiskByDate> {
  const data = await getJson<RiskResponse>(`/calendar/risk?start=${start}&end=${end}`);
  return Object.fromEntries(
    Object.entries(data).map(([date, d]) => [
      date,
      {
        stage: d.stage,
        stageSource: d.stageSource,
        diseases: d.diseases.map((x) => ({ diseaseId: x.diseaseId, level: x.level })),
      },
    ]),
  );
}

/** 病害の一覧（病名と重要度） */
export async function fetchDiseases(): Promise<{ id: string; name: string; priority: number }[]> {
  const data = await getJson<{ id: string; name_ja: string; priority: number }[]>("/diseases");
  return data.map((d) => ({ id: d.id, name: d.name_ja, priority: d.priority }));
}

type StagesResponse = {
  vocab: { value: number; name_ja: string }[];
  transitions: { stage: number; effective_from: string }[];
};

/** 生育ステージの名前（{ value: 名前 }）と、記録された切り替わり（{ 切り替わり日: value }） */
export async function fetchStages(): Promise<StageData> {
  const data = await getJson<StagesResponse>("/stages");
  return {
    names: Object.fromEntries(data.vocab.map((s) => [s.value, s.name_ja])),
    transitions: Object.fromEntries(data.transitions.map((t) => [t.effective_from, t.stage])),
  };
}

/** その日からこのステージになったと記録する。同じ日の記録は上書きされる */
export async function setStage(date: string, stage: number): Promise<void> {
  await send("PUT", `/stages/${date}`, { stage });
}

/** その日のステージの記録を消す */
export async function clearStage(date: string): Promise<void> {
  await send("DELETE", `/stages/${date}`);
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

async function send<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T | null> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path} failed: ${r.status}`);
  return r.status === 204 ? null : ((await r.json()) as T);
}

type DiaryResponse = { entry_date: string; memo: string };

/** 期間の日誌。{ 日付: メモ } */
export async function fetchDiary(start: string, end: string): Promise<Record<string, string>> {
  const data = await getJson<DiaryResponse[]>(`/diary?start=${start}&end=${end}`);
  return Object.fromEntries(data.map((d) => [d.entry_date, d.memo]));
}

/** 日誌を保存する。空なら API 側で削除される */
export async function saveDiary(date: string, memo: string): Promise<void> {
  await send("PUT", `/diary/${date}`, { memo });
}

type SprayResponse = {
  id: number;
  sprayed_on: string;
  pesticide_id: string | null;
  pesticide: string;
  dilution: string | null;
  amount: string | null;
  target: string | null;
  note: string;
};

const toSpray = (s: SprayResponse): SprayRecord => ({
  id: s.id,
  sprayedOn: s.sprayed_on,
  pesticideId: s.pesticide_id,
  pesticide: s.pesticide,
  dilution: s.dilution ?? "",
  amount: s.amount ?? "",
  target: s.target ?? "",
  note: s.note,
});

const toSprayBody = (s: SprayInput) => ({
  sprayed_on: s.sprayedOn,
  pesticide_id: s.pesticideId ?? undefined,
  pesticide: s.pesticideId ? undefined : s.pesticide,
  dilution: s.dilution || null,
  amount: s.amount || null,
  target: s.target || null,
  note: s.note,
});

/** 期間の散布記録（日付・id の昇順） */
export async function fetchSprays(start: string, end: string): Promise<SprayRecord[]> {
  return (await getJson<SprayResponse[]>(`/sprays?start=${start}&end=${end}`)).map(toSpray);
}

/** 最近の散布記録（新しい順） */
export async function fetchRecentSprays(limit: number): Promise<SprayRecord[]> {
  return (await getJson<SprayResponse[]>(`/sprays/recent?limit=${limit}`)).map(toSpray);
}

type UsageResponse = {
  year: number;
  by_pesticide: Record<string, number>;
  by_frac: Record<string, { count: number; last_sprayed_on: string }>;
};

/** その年の使用回数 */
export async function fetchUsage(year: number): Promise<SprayUsage> {
  const data = await getJson<UsageResponse>(`/sprays/usage?year=${year}`);
  return {
    byPesticide: data.by_pesticide,
    byFrac: Object.fromEntries(
      Object.entries(data.by_frac).map(([code, f]) => [code, { count: f.count, lastSprayedOn: f.last_sprayed_on }]),
    ),
  };
}

export async function createSpray(input: SprayInput): Promise<void> {
  await send("POST", "/sprays", toSprayBody(input));
}

export async function updateSpray(id: number, input: SprayInput): Promise<void> {
  await send("PUT", `/sprays/${id}`, toSprayBody(input));
}

export async function deleteSpray(id: number): Promise<void> {
  await send("DELETE", `/sprays/${id}`);
}

type ApplicationResponse = {
  crop: string;
  target: string | null;
  disease_id: string | null;
  method: string;
  dilution: string | null;
  timing: string | null;
  pre_harvest_days: number | null;
  uses: string | null;
  max_uses: number | null;
};

type PesticideResponse = {
  id: string;
  name_ja: string;
  kind: string;
  frac_codes: string[];
  frac_note: string | null;
  total_use_limits: string[];
  hidden: boolean;
  applications: ApplicationResponse[];
};

/** 農薬マスタ */
export async function fetchPesticides(): Promise<PesticideMaster> {
  const data = await getJson<{ source: string; retrieved_at: string; pesticides: PesticideResponse[] }>("/pesticides");
  return {
    source: data.source,
    retrievedAt: data.retrieved_at,
    pesticides: data.pesticides.map((p) => ({
      id: p.id,
      name: p.name_ja,
      kind: p.kind,
      fracCodes: p.frac_codes,
      fracNote: p.frac_note,
      totalUseLimits: p.total_use_limits,
      hidden: p.hidden,
      applications: p.applications.map((a) => ({
        crop: a.crop,
        target: a.target,
        diseaseId: a.disease_id,
        method: a.method,
        dilution: a.dilution,
        timing: a.timing,
        preHarvestDays: a.pre_harvest_days,
        uses: a.uses,
        maxUses: a.max_uses,
      })),
    })),
  };
}

/** 散布記録の「薬剤を選ぶ」に出す・出さないを切り替える */
export async function setPesticideHidden(id: string, hidden: boolean): Promise<void> {
  await send("PUT", `/pesticides/${encodeURIComponent(id)}/hidden`, { hidden });
}
