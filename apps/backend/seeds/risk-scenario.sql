-- 開発 DB 専用のシード。今年と去年の「今ごろ」約1か月分の気象と記録を入れる。
--   今日（JST）を D、1年前の同じ日を D' として、
--   今年 D-30〜D+6、去年 D'-30〜D'+14 を1時間ごとに入れる。
-- 用途: 病害リスク判定（GET /calendar/risk）、発生記録のフィードバック（GET /sensitivity）、
--       日の画面の「去年の今ごろ」の確認。
--
-- 消すもの: measure, weather_forecasts, diary_entries, spray_records, disease_observations,
--           stage_transitions, disease_sensitivity を全部消してから入れる（手で入れた記録も消える）。
--           settings と hidden_pesticides は消さない。何度実行しても同じ状態になる。
--
-- 実行: docker exec -i backend-db-1 psql -U myuser -d mydb -v ON_ERROR_STOP=1 < seeds/risk-scenario.sql
--       入れた後に POST /sensitivity/recompute を呼ぶ（シードは感度の段階を消すだけで、選び直さない）。
-- 天気の cron（毎時7分・API 起動時）が今日以降の予報を上書きするので、未来日は入れた同じ時間帯のうちに確認する。
--
-- 気象の組み立て（o = D または D' からの日数、h = JST の時、昼 = 8〜19時）
--   予報は全時間、センサー（device = seed01）は今の時刻より前の時間だけ入れる（値は同じ）。
--   冷涼  昼 19℃/60%  夜 14℃/75%      温暖  昼 26℃/55%  夜 19℃/80%
--   雨の時間は RH 90%。濡れの時間は 19℃/97%。
--  今年
--   冷涼  o <= -4        温暖  o >= -3
--   雨    o = -20 の 6〜13時  1.5mm/h（計12mm）
--   小雨  o = -14 の 9〜12時  1mm/h（計4mm）
--   小雨  o = -7  の 6〜13時  1mm/h（計8mm）。標準の段階ではべと病の条件（10mm）に届かない
--   雨    o = -5  の 6〜15時  1.5mm/h（計15mm）
--   濡れA o=2 20時〜o=3 8時（13h）     濡れB o=4 20時〜o=5 11時（16h）
--  去年
--   温暖  o <= -10       冷涼  o >= -9
--   雨    o = -22 の 5〜14時  2mm/h（計20mm）
--   雨    o = -8  の 6〜17時  1mm/h（計12mm）
--   小雨  o = -7  の 6〜11時  1mm/h（計6mm）
--   小雨  o = 6   の 8〜12時  1mm/h（計5mm）
--
-- 記録（内容は秋を想定している。ほかの季節に入れると、ステージや文面が時期に合わない）
--            今年                                       去年
--   ステージ D-18 収穫期, D-3 収穫後                    D'-20 収穫期, D'-4 収穫後
--   散布     D-27 フルーツセイバー                      D'-26 オンリーワンフロアブル
--            D-1  日曹ムッシュボルドーＤＦ              D'-2  日曹ムッシュボルドーＤＦ, D'+6 ＩＣボルドー６６Ｄ
--   発生     D-16 べと病, D-12 灰色かび病               D'-15 灰色かび病, D'-6 べと病
--   日誌     D-18, D-16, D-12, D-3                      D'-20, D'-6, D'-4, D'+3, D'+9
--
-- 期待される結果（感度の段階が標準のとき。POST /sensitivity/recompute の後も全病害が標準のまま）
--   日        べと病(DM-1)      灰色かび病(BOT-1)        うどんこ病(PM-1, GT指数)
--   D-20      conditions_met    none                     none (0)
--   D-5       conditions_met    none                     none (0)
--   D-30〜D-1 のほかの日  none   none                     none (0, D-1 で開始)
--   D         none              none                     none (20)
--   D+1       none              none                     near_threshold (40)
--   D+2       none              none (濡れA 4h分のみ)     conditions_met (60)
--   D+3       none              near_threshold (0.60)    conditions_met (80)
--   D+4       none              near_threshold (0.60)    conditions_met (100)
--   D+5,D+6   none              conditions_met (1.35)    conditions_met (100)
--   0時台に実行すると今日の実測雨量がまだ無いが、予報の雨量で補うので結果は変わらない。
--
-- 発生記録のフィードバックの確認（感度の段階）
--   シードのべと病（D-16）は、照らす期間 D-23〜D-20 に 12mm の雨（D-20）があり、標準のまま拾える。
--   灰色かび病（D-12）は、照らす期間に濡れが無く、どの段階でも拾えない。どちらも段階は標準のまま。
--   D-2 にべと病の発生を記録する（PUT /observations/<D-2>/downy_mildew）と、照らす期間は D-9〜D-6。
--   標準（雨10mm以上）ではこの期間に警告が無く、段階1（8mm以上）なら D-7 の小雨で警告が出るので、段階1が選ばれる。
--   → GET /sensitivity のべと病が level 1（2件中2件）になり、/calendar/risk の D-7 が conditions_met に変わる。
--   記録を消すと標準に戻る。

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

TRUNCATE measure, weather_forecasts, diary_entries, spray_records, disease_observations,
         stage_transitions, disease_sensitivity;

-- 基準日。yr = 0 が今年（D）、1 が去年（D'）
CREATE TEMP TABLE seed_anchor ON COMMIT DROP AS
WITH d AS (
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
)
SELECT 0 AS yr, today AS anchor, -30 AS o_from, 6 AS o_to FROM d
UNION ALL
SELECT 1, (today - interval '1 year')::date, -30, 14 FROM d;

CREATE TEMP TABLE seed_timeline ON COMMIT DROP AS
WITH hours AS (
  SELECT a.yr, ts,
         (ts AT TIME ZONE 'Asia/Tokyo')::date - a.anchor AS o,
         extract(hour FROM ts AT TIME ZONE 'Asia/Tokyo')::int AS h
    FROM seed_anchor a,
         generate_series((a.anchor + a.o_from)::timestamp AT TIME ZONE 'Asia/Tokyo',
                         (a.anchor + a.o_to + 1)::timestamp AT TIME ZONE 'Asia/Tokyo' - interval '1 hour',
                         interval '1 hour') AS ts
), flags AS (
  SELECT ts,
         yr = 0 AND ((o = 2 AND h >= 20) OR (o = 3 AND h <= 8) OR (o = 4 AND h >= 20) OR (o = 5 AND h <= 11)) AS wet,
         CASE WHEN yr = 0 AND o = -20 AND h BETWEEN 6 AND 13 THEN 1.5
              WHEN yr = 0 AND o = -14 AND h BETWEEN 9 AND 12 THEN 1
              WHEN yr = 0 AND o = -7  AND h BETWEEN 6 AND 13 THEN 1
              WHEN yr = 0 AND o = -5  AND h BETWEEN 6 AND 15 THEN 1.5
              WHEN yr = 1 AND o = -22 AND h BETWEEN 5 AND 14 THEN 2
              WHEN yr = 1 AND o = -8  AND h BETWEEN 6 AND 17 THEN 1
              WHEN yr = 1 AND o = -7  AND h BETWEEN 6 AND 11 THEN 1
              WHEN yr = 1 AND o = 6   AND h BETWEEN 8 AND 12 THEN 1
              ELSE 0 END AS rainfall,
         (yr = 0 AND o >= -3) OR (yr = 1 AND o <= -10) AS warm,
         h BETWEEN 8 AND 19 AS day
    FROM hours
)
SELECT ts,
       CASE WHEN wet THEN 19
            WHEN warm THEN CASE WHEN day THEN 26 ELSE 19 END
            ELSE CASE WHEN day THEN 19 ELSE 14 END END AS temp,
       CASE WHEN wet THEN 97
            WHEN rainfall > 0 THEN 90
            WHEN warm THEN CASE WHEN day THEN 55 ELSE 80 END
            ELSE CASE WHEN day THEN 60 ELSE 75 END END AS humidity,
       rainfall,
       CASE WHEN wet THEN 3 WHEN rainfall >= 1.5 THEN 63 WHEN rainfall > 0 THEN 61 ELSE 1 END AS code
  FROM flags;

INSERT INTO weather_forecasts (observed_at, temperature, humidity, latitude, longitude, weather_code, precipitation)
SELECT t.ts, t.temp, t.humidity, p.latitude, p.longitude, t.code, t.rainfall
  FROM seed_timeline t, seed_place p;

INSERT INTO measure (device, metric, value, received_at)
SELECT 'seed01', m.metric, m.value, t.ts + interval '30 minutes'
  FROM seed_timeline t
 CROSS JOIN LATERAL (VALUES ('temp', t.temp), ('humidity', t.humidity), ('rainfall', t.rainfall)) AS m(metric, value)
 WHERE t.ts < date_trunc('hour', now());

-- 記録。日付は基準日（今年 D / 去年 D'）からの日数 o で決める
INSERT INTO stage_transitions (stage, effective_from)
SELECT v.stage, a.anchor + v.o
  FROM seed_anchor a
  JOIN (VALUES (0, -18, 9), (0, -3, 10),
               (1, -20, 9), (1, -4, 10)) AS v(yr, o, stage) USING (yr);

-- pesticide_id は data/vocab/pesticides.yaml の id（登録番号）。pesticide はその商品名
INSERT INTO spray_records (sprayed_on, pesticide_id, pesticide, target, note)
SELECT a.anchor + v.o, v.pesticide_id, v.pesticide, v.target, v.note
  FROM seed_anchor a
  JOIN (VALUES
    (0, -27, '23006', 'フルーツセイバー',         '灰色かび病・晩腐病', '収穫前の最後の散布'),
    (0,  -1, '24417', '日曹ムッシュボルドーＤＦ', 'べと病',             '収穫後。葉を落とさないため'),
    (1, -26, '20873', 'オンリーワンフロアブル',   '灰色かび病・晩腐病', '収穫前の最後の散布'),
    (1,  -2, '24417', '日曹ムッシュボルドーＤＦ', 'べと病',             '収穫後の1回目'),
    (1,   6, '18645', 'ＩＣボルドー６６Ｄ',       'べと病',             '収穫後の2回目。雨の前に')
  ) AS v(yr, o, pesticide_id, pesticide, target, note) USING (yr);

INSERT INTO disease_observations (observed_on, disease_id, note)
SELECT a.anchor + v.o, v.disease_id, v.note
  FROM seed_anchor a
  JOIN (VALUES
    (0, -16, 'downy_mildew', '上位葉の葉裏に白いかび'),
    (0, -12, 'botrytis',     '裂果した房に灰色のかび'),
    (1, -15, 'botrytis',     '収穫中の房に数房'),
    (1,  -6, 'downy_mildew', '雨の後、副梢の葉に病斑')
  ) AS v(yr, o, disease_id, note) USING (yr);

INSERT INTO diary_entries (entry_date, memo)
SELECT a.anchor + v.o, v.memo
  FROM seed_anchor a
  JOIN (VALUES
    (0, -18, E'収穫を始めた。糖度は十分。\n東側の列から順に進める。'),
    (0, -16, '上位葉にべと病。4日前の雨の後に出た。'),
    (0, -12, E'裂果した房に灰色かび病。見つけた房は取り除いた。\n雨よけの端の列が多い。'),
    (0,  -3, '収穫を終えた。今年は去年より2日遅い。'),
    (1, -20, '収穫を始めた。'),
    (1,  -6, E'副梢の葉にべと病。2日続けて雨が降った後。\n収穫が済んだらボルドーを撒く。'),
    (1,  -4, '収穫を終えた。棚下の片付け。'),
    (1,   3, '落葉が早い列がある。べと病の出た列と重なる。'),
    (1,   9, E'礼肥を施した。\n来年は雨よけの端の列を重点的に見回る。')
  ) AS v(yr, o, memo) USING (yr);

COMMIT;
