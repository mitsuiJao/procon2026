-- 病害リスク判定（GET /calendar/risk）のテスト用シード。開発 DB 専用
-- measure と weather_forecasts を全部消してから、今日（JST）を D として D-7〜D+6 を1時間ごとに入れる。
-- 予報は全時間、センサー（device = seed01）は今の時刻より前の時間だけ入れる（値は同じ）。日誌・散布記録は消さない。
--
-- 実行: docker exec -i backend-db-1 psql -U myuser -d mydb -v ON_ERROR_STOP=1 < seeds/risk-scenario.sql
-- 天気の cron（毎時7分・API 起動時）が今日以降の予報を上書きするので、入れたら同じ時間帯のうちに確認する。
--
-- 気象の組み立て（o = D からの日数、h = JST の時、昼 = 8〜19時）
--   冷涼  o <= -4        昼 19℃/60%  夜 14℃/75%
--   雨    o = -5 の 6〜15時  RH 90%, 1.5mm/h（計15mm）
--   温暖  o >= -3        昼 26℃/55%  夜 19℃/80%
--   濡れA o=2 20時〜o=3 8時（13h）  19℃/97%
--   濡れB o=4 20時〜o=5 11時（16h） 19℃/97%
--
-- 期待される結果（ステージは記録が無ければ月からの推定）
--   日        べと病(DM-1)      灰色かび病(BOT-1)        うどんこ病(PM-1, GT指数)
--   D-7,-6,-4 none              none                     none (0)
--   D-5       conditions_met    none                     none (0)
--   D-3〜D-1  none              none                     none (0, D-1 で開始)
--   D         none              none                     none (20)
--   D+1       undetermined      none                     near_threshold (40)
--   D+2       undetermined      none (濡れA 4h分のみ)     conditions_met (60)
--   D+3       undetermined      near_threshold (0.60)    conditions_met (80)
--   D+4       undetermined      near_threshold (0.60)    conditions_met (100)
--   D+5,D+6   undetermined      conditions_met (1.35)    conditions_met (100)
--   べと病の未来日は、雨量がセンサーにしか無いので必ず undetermined（仕様）。
--   0時台に実行すると今日の実測雨量がまだ無く、D のべと病は undetermined になる。

BEGIN;

-- 地点は API（getPlace）と同じく settings の最新行。無ければ既存の予報の地点（消す前に控える）
CREATE TEMP TABLE seed_place ON COMMIT DROP AS
SELECT latitude, longitude
  FROM (
    (SELECT latitude, longitude, 1 AS pri, created_at FROM settings ORDER BY created_at DESC, id DESC LIMIT 1)
    UNION ALL
    (SELECT latitude, longitude, 2 AS pri, created_at FROM weather_forecasts ORDER BY created_at DESC LIMIT 1)
  ) p
 ORDER BY pri
 LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seed_place) THEN
    RAISE EXCEPTION '地点が分かりません。settings に行を入れるか、API を起動して予報を1回取得してから実行してください';
  END IF;
END $$;

TRUNCATE measure, weather_forecasts;

CREATE TEMP TABLE seed_timeline ON COMMIT DROP AS
WITH d AS (
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
), hours AS (
  SELECT ts,
         (ts AT TIME ZONE 'Asia/Tokyo')::date - d.today AS o,
         extract(hour FROM ts AT TIME ZONE 'Asia/Tokyo')::int AS h
    FROM d,
         generate_series((d.today - 7)::timestamp AT TIME ZONE 'Asia/Tokyo',
                         (d.today + 7)::timestamp AT TIME ZONE 'Asia/Tokyo' - interval '1 hour',
                         interval '1 hour') AS ts
), flags AS (
  SELECT ts, o, h,
         (o = 2 AND h >= 20) OR (o = 3 AND h <= 8) OR (o = 4 AND h >= 20) OR (o = 5 AND h <= 11) AS wet,
         o = -5 AND h BETWEEN 6 AND 15 AS rain,
         h BETWEEN 8 AND 19 AS day
    FROM hours
)
SELECT ts,
       CASE WHEN wet THEN 19
            WHEN o <= -4 THEN CASE WHEN day THEN 19 ELSE 14 END
            ELSE CASE WHEN day THEN 26 ELSE 19 END END AS temp,
       CASE WHEN wet THEN 97
            WHEN rain THEN 90
            WHEN o <= -4 THEN CASE WHEN day THEN 60 ELSE 75 END
            ELSE CASE WHEN day THEN 55 ELSE 80 END END AS humidity,
       CASE WHEN rain THEN 1.5 ELSE 0 END AS rainfall,
       CASE WHEN wet THEN 3 WHEN rain THEN 63 ELSE 1 END AS code
  FROM flags;

INSERT INTO weather_forecasts (observed_at, temperature, humidity, latitude, longitude, weather_code)
SELECT t.ts, t.temp, t.humidity, p.latitude, p.longitude, t.code
  FROM seed_timeline t, seed_place p;

INSERT INTO measure (device, metric, value, received_at)
SELECT 'seed01', m.metric, m.value, t.ts + interval '30 minutes'
  FROM seed_timeline t
 CROSS JOIN LATERAL (VALUES ('temp', t.temp), ('humidity', t.humidity), ('rainfall', t.rainfall)) AS m(metric, value)
 WHERE t.ts < date_trunc('hour', now());

COMMIT;
