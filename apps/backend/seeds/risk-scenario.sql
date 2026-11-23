-- 開発 DB 専用のシード。今季・去年・一昨年の3シーズン分の気象と記録を入れる。
--   今日（JST）を D、1年前の同じ日を D' とする。シーズンは 4/1〜11/30（今季は D+6 まで）。
--   「今ごろ」（今年 D-30〜D+6、去年 D'-30〜D'+14）は、日付を D・D' からの日数で決めた細かい筋書き。
--   それ以外のシーズンの日は「背景」で、日付を月日で固定した気象と記録を入れる。
-- 用途: 病害リスク判定（GET /calendar/risk）、発生記録のフィードバック（GET /sensitivity）、
--       日の画面の「去年の今ごろ」、記録タブ（シーズンのまとめ・去年との比較）の確認。
--
-- 消すもの: measure, weather_forecasts, diary_entries, spray_records, disease_observations,
--           stage_transitions, disease_sensitivity を全部消してから入れる（手で入れた記録も消える）。
--           settings と hidden_pesticides は消さない。何度実行しても同じ状態になる。
--
-- 実行: docker exec -i backend-db-1 psql -U myuser -d mydb -v ON_ERROR_STOP=1 < seeds/risk-scenario.sql
--       入れた後に POST /sensitivity/recompute を呼ぶ（シードは感度の段階を消すだけで、選び直さない）。
-- 天気の cron（毎時7分・API 起動時）が今日以降の予報を上書きするので、未来日は入れた同じ時間帯のうちに確認する。
--
-- 内容は秋（D が 9月半ば〜11月）に入れる前提。ほかの季節に入れると、ステージや文面が時期に合わず、
-- 背景と「今ごろ」の記録の順序も崩れる。
--
-- ===== 今ごろ（これまでと同じ） =====
-- 気象の組み立て（o = D または D' からの日数、h = JST の時、昼 = 8〜19時）
--   予報は全時間、センサー（device = seed01）は今の時刻より前の時間だけ入れる（値は同じ）。背景も同じ。
--   冷涼  昼 19℃/60%  夜 14℃/75%      温暖  昼 26℃/55%  夜 19℃/80%
--   雨の時間は RH 90%。濡れの時間は 19℃/97%。
--  今年
--   冷涼  o <= -4        温暖  o >= -3
--   雨    o = -20 の 6〜13時  1.5mm/h（計12mm）
--   小雨  o = -14 の 9〜12時  1mm/h（計4mm）
--   小雨  o = -7  の 6〜13時  1mm/h（計8mm）。標準の段階ではべと病の条件（10mm）に届かない
--   雨    o = -5  の 6〜15時  1.5mm/h（計15mm）
--   濡れA o=-4 20時〜o=-3 8時（13h）   濡れB o=-2 20時〜o=-1 11時（16h）
--   判定になる日は過去に置く（今日以降の予報は、天気の cron が本物の予報で上書きするため。過去の時間はセンサーの値が優先される）
--  去年
--   温暖  o <= -10       冷涼  o >= -9
--   雨    o = -22 の 5〜14時  2mm/h（計20mm）
--   雨    o = -8  の 6〜17時  1mm/h（計12mm）
--   小雨  o = -7  の 6〜11時  1mm/h（計6mm）
--   小雨  o = 6   の 8〜12時  1mm/h（計5mm）
--
-- 記録
--            今年                                       去年
--   ステージ D-18 収穫期, D-3 収穫後                    D'-20 収穫期, D'-4 収穫後
--   散布     D-27 フルーツセイバー                      D'-26 オンリーワンフロアブル
--            D-1  日曹ムッシュボルドーＤＦ              D'-2  日曹ムッシュボルドーＤＦ, D'+6 ＩＣボルドー６６Ｄ
--   発生     D-16 べと病, D-12 灰色かび病               D'-15 灰色かび病, D'-6 べと病
--   日誌     D-18, D-16, D-12, D-3                      D'-20, D'-6, D'-4, D'+3, D'+9
--
-- 期待される結果（感度の段階が標準のとき。POST /sensitivity/recompute の後も全病害が標準のまま）
--   「画面」は警告として出す日。警告が続く日は repeatDays（灰色かび病 3 日）おきにだけ出し、間の日は ongoingSince が付いて出ない
--   日        べと病(DM-1)              灰色かび病(BOT-1, logit)                 画面
--   D-20      conditions_met            none                                     べと病
--   D-5       conditions_met            none                                     べと病
--   D-3       none（D-3 から収穫後）     near_threshold (0.60, 濡れA)             灰色かび病（近い）
--   D-2       none                      near_threshold (0.60)  続いている         なし
--   D-1       none                      conditions_met (1.35, 濡れB) 続いている   なし（上がっても出し直さない）
--   D         none                      conditions_met (1.35)                    灰色かび病（該当。D-3 から3日）
--   D+1〜D+6  none                      none                                     なし（今日以降は本物の予報で変わり得る）
--   ほかの日  none                      none                                     なし
--   うどんこ病（PM-1）は着色期まで（stage <= 8）なので、収穫期以降の「今ごろ」は全部 none（指数は計算しない）。
--   0時台に実行すると今日の実測雨量がまだ無いが、予報の雨量で補うので結果は変わらない。
--
-- 発生記録のフィードバックの確認（感度の段階）
--   今季のべと病（背景の 6/19・7/13 と D-16）は、照らす期間（発見の7〜4日前）に10mm以上の雨があり、標準のまま拾える。
--   灰色かび病（D-12）は、照らす期間に濡れが無く、どの段階でも拾えない。どちらも段階は標準のまま。
--   D-2 にべと病の発生を記録する（PUT /observations/<D-2>/downy_mildew）と、照らす期間は D-9〜D-6。
--   標準（雨10mm以上）ではこの期間に警告が無く、段階1（8mm以上）なら D-7 の小雨で警告が出るので、段階1が選ばれる。
--   → GET /sensitivity のべと病が level 1（4件中4件）になり、/calendar/risk の D-7 が conditions_met に変わる。
--   記録を消すと標準に戻る。
--
-- ===== 背景（シーズン全体） =====
-- yr = 0 今季、1 去年、2 一昨年。日付は月日で固定し、「今ごろ」の期間（今季 D-30〜D+6、去年 D'-30〜D'+14）には入れない。
-- 気温は月ごとに 夜（0〜6時・18〜23時）/ 朝夕（7〜9時・16〜17時）/ 日中（10〜15時）の3段。湿度は 夜 / それ以外。
--   今季  猛暑で夜は涼しい。うどんこ病の指数が「今ごろ」より前に始まらないよう、21〜30℃の時間を1日5時間以下にしている
--         （日中は30℃超か21℃未満、夜は21℃未満）。始まると上の表のうどんこ病の値が変わる。
--   去年  梅雨が長い（6〜7月に雨が多い）。8月は猛暑（日中35℃で、うどんこ病の指数が下がる）。
--   一昨年 空梅雨で、秋雨が多い。
-- 雨の日は 5〜20時の16時間、同じ強さで降らせる（1日の雨量 = 強さ × 16）。雨の前の日は12時から曇り。
--   べと病（DM-1）は 10mm 以上で該当、段階1は 8mm、段階2は 6mm。今季は 8mm 以上の日がシーズンの25%を大きく下回るようにしている。
-- 記録（月/日）
--            今季                             去年                                一昨年
--   ステージ 萌芽〜着色期（収穫期以降は今ごろ） 萌芽〜着色期（収穫期以降は今ごろ）    萌芽〜収穫後
--   散布     9回                              11回                                11回
--   発生     黒とう 5/14, べと 6/19・7/13      黒とう 5/26, べと 6/16・6/25・7/10,  黒とう 4/30, うどんこ 7/16・8/6,
--                                             うどんこ 8/4, 晩腐 8/22, さび 10/28   べと 9/10, 灰色かび 9/15, 晩腐 9/20, さび 10/1
--   日誌     8件                              10件                                10件
--   今季の発生は、標準の段階で拾えるもの（黒とう病は段階が無い）だけにしている。
--   晩腐病・さび病（段階1で B のルールが有効になる）とうどんこ病の発生は去年・一昨年だけ（感度の段階は今季の発生だけで選ぶ）。

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

-- 「今ごろ」の基準日。yr = 0 が今年（D）、1 が去年（D'）
CREATE TEMP TABLE seed_anchor ON COMMIT DROP AS
WITH d AS (
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
)
SELECT 0 AS yr, today AS anchor, -30 AS o_from, 6 AS o_to FROM d
UNION ALL
SELECT 1, (today - interval '1 year')::date, -30, 14 FROM d;

-- シーズン（4/1〜11/30）と、その中の「今ごろ」の期間。一昨年は「今ごろ」が無い
CREATE TEMP TABLE seed_season ON COMMIT DROP AS
WITH d AS (
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
), y AS (
  SELECT today,
         CASE WHEN extract(month FROM today) >= 4 THEN extract(year FROM today)::int
              ELSE extract(year FROM today)::int - 1 END AS season_year
    FROM d
)
SELECT s.yr,
       y.season_year - s.yr AS year,
       make_date(y.season_year - s.yr, 4, 1) AS season_start,
       CASE WHEN s.yr = 0 THEN least(make_date(y.season_year, 11, 30), y.today + 6)
            ELSE make_date(y.season_year - s.yr, 11, 30) END AS season_end,
       a.anchor + a.o_from AS near_from,
       a.anchor + a.o_to AS near_to
  FROM y
 CROSS JOIN (VALUES (0), (1), (2)) AS s(yr)
  LEFT JOIN seed_anchor a USING (yr);

-- 背景の月ごとの気温（夜 / 朝夕 / 日中）と湿度（夜 / それ以外）
CREATE TEMP TABLE seed_climate ON COMMIT DROP AS
SELECT * FROM (VALUES
  (0,  4,  7, 13, 18, 75, 55), (0,  5, 12, 17, 20, 78, 58), (0,  6, 17, 24, 31, 85, 68),
  (0,  7, 20, 27, 33, 85, 65), (0,  8, 20, 28, 34, 83, 62), (0,  9, 18, 24, 31, 82, 62),
  (0, 10, 12, 17, 20, 80, 60), (0, 11,  6, 11, 15, 78, 58),
  (1,  4,  6, 12, 17, 75, 55), (1,  5, 11, 17, 22, 78, 58), (1,  6, 17, 22, 26, 88, 72),
  (1,  7, 22, 27, 30, 87, 70), (1,  8, 24, 29, 35, 80, 60), (1,  9, 19, 24, 28, 82, 62),
  (1, 10, 12, 17, 21, 80, 60), (1, 11,  6, 11, 15, 78, 58),
  (2,  4,  8, 14, 19, 72, 52), (2,  5, 13, 19, 24, 74, 54), (2,  6, 18, 24, 29, 78, 58),
  (2,  7, 23, 29, 33, 80, 60), (2,  8, 24, 29, 33, 82, 62), (2,  9, 20, 25, 29, 86, 68),
  (2, 10, 13, 18, 22, 84, 64), (2, 11,  7, 12, 16, 80, 60)
) AS v(yr, month, t_night, t_shoulder, t_day, rh_night, rh_day);

-- 背景の雨の日（月, 日, 1時間の雨量 mm/h）。1日の雨量はその16倍
CREATE TEMP TABLE seed_rain ON COMMIT DROP AS
SELECT v.yr, make_date(s.year, v.month, v.day) AS rain_on, v.mmh
  FROM seed_season s
  JOIN (VALUES
    -- 今季
    (0, 4,  8, 0.5), (0, 4, 18, 0.9), (0, 4, 29, 0.4), (0, 5,  9, 0.8), (0, 5, 21, 0.3),
    (0, 6,  5, 0.6), (0, 6, 14, 1.2), (0, 6, 22, 0.7), (0, 6, 30, 0.4), (0, 7,  8, 1.4),
    (0, 7, 16, 0.4), (0, 8,  2, 0.3), (0, 8, 19, 0.8), (0, 8, 29, 0.3),
    -- 去年（梅雨が長い）
    (1, 4, 12, 0.7), (1, 4, 25, 0.3), (1, 5,  7, 0.6), (1, 5, 19, 0.8), (1, 6,  3, 0.4),
    (1, 6, 10, 0.9), (1, 6, 13, 0.5), (1, 6, 17, 1.3), (1, 6, 21, 0.8), (1, 6, 26, 1.0),
    (1, 7,  1, 0.7), (1, 7,  6, 0.9), (1, 7, 12, 0.6), (1, 7, 18, 1.1), (1, 7, 29, 0.3),
    (1, 8, 14, 0.4), (1, 8, 25, 0.8), (1, 10, 30, 0.6), (1, 11, 12, 0.4),
    -- 一昨年（空梅雨・秋雨）
    (2, 4, 10, 0.4), (2, 4, 22, 0.8), (2, 5,  3, 0.3), (2, 5, 16, 0.5), (2, 6,  8, 0.3),
    (2, 6, 24, 0.4), (2, 7,  9, 0.7), (2, 7, 25, 0.3), (2, 8, 16, 0.6), (2, 8, 31, 0.9),
    (2, 9,  5, 1.3), (2, 9, 11, 0.8), (2, 9, 17, 1.1), (2, 9, 22, 0.7), (2, 9, 28, 0.9),
    (2, 10, 4, 0.6), (2, 10, 15, 0.4), (2, 11, 6, 0.3)
  ) AS v(yr, month, day, mmh) USING (yr);

-- 「今ごろ」の時別の気象（これまでと同じ式）
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
         yr = 0 AND ((o = -4 AND h >= 20) OR (o = -3 AND h <= 8) OR (o = -2 AND h >= 20) OR (o = -1 AND h <= 11)) AS wet,
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

-- 背景の時別の気象。「今ごろ」の期間の日は入れない
INSERT INTO seed_timeline (ts, temp, humidity, rainfall, code)
WITH hours AS (
  SELECT s.yr, ts,
         (ts AT TIME ZONE 'Asia/Tokyo')::date AS d,
         extract(hour FROM ts AT TIME ZONE 'Asia/Tokyo')::int AS h
    FROM seed_season s,
         generate_series(s.season_start::timestamp AT TIME ZONE 'Asia/Tokyo',
                         (s.season_end + 1)::timestamp AT TIME ZONE 'Asia/Tokyo' - interval '1 hour',
                         interval '1 hour') AS ts
   WHERE s.near_from IS NULL
      OR (ts AT TIME ZONE 'Asia/Tokyo')::date NOT BETWEEN s.near_from AND s.near_to
), flags AS (
  SELECT hr.ts, hr.h, c.*,
         CASE WHEN hr.h BETWEEN 5 AND 20 THEN coalesce(r.mmh, 0) ELSE 0 END AS rainfall,
         r.mmh IS NOT NULL AS rain_day,
         EXISTS (SELECT 1 FROM seed_rain n WHERE n.yr = hr.yr AND n.rain_on = hr.d + 1) AS before_rain
    FROM hours hr
    JOIN seed_climate c ON c.yr = hr.yr AND c.month = extract(month FROM hr.d)
    LEFT JOIN seed_rain r ON r.yr = hr.yr AND r.rain_on = hr.d
)
SELECT ts,
       CASE WHEN h BETWEEN 10 AND 15 THEN t_day
            WHEN h BETWEEN 7 AND 9 OR h BETWEEN 16 AND 17 THEN t_shoulder
            ELSE t_night END,
       CASE WHEN rainfall > 0 THEN 90
            WHEN h BETWEEN 7 AND 17 THEN rh_day
            ELSE rh_night END,
       rainfall,
       CASE WHEN rainfall >= 1 THEN 63
            WHEN rainfall > 0 THEN 61
            WHEN rain_day OR (before_rain AND h >= 12) THEN 3
            ELSE 1 END
  FROM flags;

INSERT INTO weather_forecasts (observed_at, temperature, humidity, latitude, longitude, weather_code, precipitation)
SELECT t.ts, t.temp, t.humidity, p.latitude, p.longitude, t.code, t.rainfall
  FROM seed_timeline t, seed_place p;

INSERT INTO measure (device, metric, value, received_at)
SELECT 'seed01', m.metric, m.value, t.ts + interval '30 minutes'
  FROM seed_timeline t
 CROSS JOIN LATERAL (VALUES ('temp', t.temp), ('humidity', t.humidity), ('rainfall', t.rainfall)) AS m(metric, value)
 WHERE t.ts < date_trunc('hour', now());

-- 「今ごろ」の記録。日付は基準日（今年 D / 去年 D'）からの日数 o で決める
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

-- 背景の記録。日付は月日で固定し、シーズンの外と「今ごろ」の期間に当たるものは入れない
CREATE OR REPLACE FUNCTION pg_temp.seed_bg_date(p_yr int, p_month int, p_day int) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT d
    FROM seed_season s, make_date(s.year, p_month, p_day) AS d
   WHERE s.yr = p_yr
     AND d BETWEEN s.season_start AND s.season_end
     AND (s.near_from IS NULL OR d NOT BETWEEN s.near_from AND s.near_to)
$$;

INSERT INTO stage_transitions (stage, effective_from)
SELECT v.stage, pg_temp.seed_bg_date(v.yr, v.month, v.day)
  FROM (VALUES
    (0, 4, 14, 1), (0, 4, 24, 2), (0, 5, 26, 3), (0, 6,  3, 4), (0, 6, 12, 5), (0, 6, 20, 6),
    (0, 7,  8, 7), (0, 8,  7, 8),
    (1, 4, 16, 1), (1, 4, 27, 2), (1, 5, 29, 3), (1, 6,  6, 4), (1, 6, 15, 5), (1, 6, 23, 6),
    (1, 7, 12, 7), (1, 8, 10, 8),
    (2, 4, 11, 1), (2, 4, 21, 2), (2, 5, 24, 3), (2, 6,  1, 4), (2, 6,  9, 5), (2, 6, 17, 6),
    (2, 7,  5, 7), (2, 8,  3, 8), (2, 9, 14, 9), (2, 10, 2, 10)
  ) AS v(yr, month, day, stage)
 WHERE pg_temp.seed_bg_date(v.yr, v.month, v.day) IS NOT NULL;

INSERT INTO spray_records (sprayed_on, pesticide_id, pesticide, target, note)
SELECT pg_temp.seed_bg_date(v.yr, v.month, v.day), v.pesticide_id, v.pesticide, v.target, v.note
  FROM (VALUES
    (0, 4,  5, '142',   'サンケイ石灰硫黄合剤',         '黒とう病',           '萌芽前'),
    (0, 4, 28, '22345', 'ジマンダイセン水和剤',         '黒とう病・べと病',   '展葉期'),
    (0, 5, 20, '21292', 'オーソサイド水和剤８０',       '黒とう病',           '黒とう病が出たので'),
    (0, 6,  1, '22379', 'レーバスフロアブル',           'べと病',             '開花直前'),
    (0, 6, 16, '21795', 'ナリアＷＤＧ',                 '灰色かび病・晩腐病', '落花後'),
    (0, 6, 20, '20624', 'ランマンフロアブル',           'べと病',             'べと病が出たので'),
    (0, 7, 10, '22155', 'ライメイフロアブル',           'べと病',             '袋かけの後'),
    (0, 7, 28, '16300', 'トリフミン水和剤',             'うどんこ病',         '予防'),
    (0, 8, 20, '22015', 'ストロビードライフロアブル',   '晩腐病・べと病',     '着色期'),
    (1, 4,  8, '142',   'サンケイ石灰硫黄合剤',         '黒とう病',           '萌芽前'),
    (1, 4, 30, '22345', 'ジマンダイセン水和剤',         '黒とう病・べと病',   '展葉期'),
    (1, 5, 22, '22379', 'レーバスフロアブル',           'べと病',             ''),
    (1, 6,  4, '20624', 'ランマンフロアブル',           'べと病',             '開花直前'),
    (1, 6, 14, '21795', 'ナリアＷＤＧ',                 '灰色かび病・晩腐病', '落花後'),
    (1, 6, 19, '22155', 'ライメイフロアブル',           'べと病',             '長雨の合間に'),
    (1, 6, 28, '21292', 'オーソサイド水和剤８０',       'べと病・晩腐病',     ''),
    (1, 7,  8, '20624', 'ランマンフロアブル',           'べと病',             '梅雨明けがまだ'),
    (1, 7, 20, '22015', 'ストロビードライフロアブル',   'べと病・うどんこ病', ''),
    (1, 8,  5, '16300', 'トリフミン水和剤',             'うどんこ病',         'うどんこ病が出たので'),
    (1, 8, 18, '20577', 'アミスター１０フロアブル',     '晩腐病',             '着色期'),
    (2, 4,  6, '142',   'サンケイ石灰硫黄合剤',         '黒とう病',           '萌芽前'),
    (2, 5,  1, '22345', 'ジマンダイセン水和剤',         '黒とう病・べと病',   '黒とう病が出たので'),
    (2, 5, 28, '22379', 'レーバスフロアブル',           'べと病',             '開花直前'),
    (2, 6, 18, '21795', 'ナリアＷＤＧ',                 '灰色かび病・晩腐病', '落花後'),
    (2, 7, 12, '16300', 'トリフミン水和剤',             'うどんこ病',         '予防'),
    (2, 7, 24, '22015', 'ストロビードライフロアブル',   'うどんこ病',         'うどんこ病が出たので'),
    (2, 8,  8, '20577', 'アミスター１０フロアブル',     'うどんこ病・晩腐病', ''),
    (2, 8, 26, '21292', 'オーソサイド水和剤８０',       '晩腐病',             '着色期'),
    (2, 9,  8, '22155', 'ライメイフロアブル',           'べと病',             '秋雨が続く'),
    (2, 9, 24, '20211', 'パスワード顆粒水和剤',         '灰色かび病',         '収穫中。灰色かび病が出たので'),
    (2, 10, 10, '24417', '日曹ムッシュボルドーＤＦ',    'べと病',             '収穫後')
  ) AS v(yr, month, day, pesticide_id, pesticide, target, note)
 WHERE pg_temp.seed_bg_date(v.yr, v.month, v.day) IS NOT NULL;

INSERT INTO disease_observations (observed_on, disease_id, note)
SELECT pg_temp.seed_bg_date(v.yr, v.month, v.day), v.disease_id, v.note
  FROM (VALUES
    (0, 5, 14, 'anthracnose',    '新梢に黒い小さな斑点'),
    (0, 6, 19, 'downy_mildew',   '下の段の葉の裏に白いかび'),
    (0, 7, 13, 'downy_mildew',   '副梢の葉に病斑が広がる'),
    (1, 5, 26, 'anthracnose',    '若い葉に斑点'),
    (1, 6, 16, 'downy_mildew',   '葉に黄色い病斑'),
    (1, 6, 25, 'downy_mildew',   '花穂の近くの葉にも'),
    (1, 7, 10, 'downy_mildew',   '病斑が広がる'),
    (1, 8,  4, 'powdery_mildew', '果房に白い粉'),
    (1, 8, 22, 'ripe_rot',       '着色した房に褐色の病斑'),
    (1, 10, 28, 'rust',          '葉の裏に橙色の粉'),
    (2, 4, 30, 'anthracnose',    '新梢に数か所'),
    (2, 7, 16, 'powdery_mildew', '葉の表に白い粉'),
    (2, 8,  6, 'powdery_mildew', '果房にも'),
    (2, 9, 10, 'downy_mildew',   '秋雨の後、上の葉に病斑'),
    (2, 9, 15, 'botrytis',       '裂果した房に灰色のかび'),
    (2, 9, 20, 'ripe_rot',       '収穫前の房に褐色の病斑'),
    (2, 10, 1, 'rust',           '葉の裏に橙色の粉')
  ) AS v(yr, month, day, disease_id, note)
 WHERE pg_temp.seed_bg_date(v.yr, v.month, v.day) IS NOT NULL;

INSERT INTO diary_entries (entry_date, memo)
SELECT pg_temp.seed_bg_date(v.yr, v.month, v.day), v.memo
  FROM (VALUES
    (0, 4, 14, '萌芽を確認。去年より2日早い。'),
    (0, 5, 14, E'新梢に黒とう病。5日前の雨の後。\n病斑のある枝を切った。'),
    (0, 6,  3, '開花が始まった。'),
    (0, 6, 19, E'べと病が出た。6/14の大雨から5日。\n下の段の葉に多い。'),
    (0, 7,  8, '袋かけを終えた。夕方から大雨。'),
    (0, 7, 13, 'べと病が副梢に広がる。7/8の大雨の後。'),
    (0, 8,  7, '着色が始まった。今年は暑い。'),
    (0, 8, 20, E'暑さで日焼け果が少し出た。\n夜は涼しく、うどんこ病は見えない。'),
    (1, 4, 16, '萌芽。'),
    (1, 5, 26, '黒とう病を見つけた。1週間前の雨の後。'),
    (1, 6,  6, '開花。雨が続く。'),
    (1, 6, 16, E'べと病が出た。梅雨が長い。\n雨の合間にライメイを撒く。'),
    (1, 6, 25, 'べと病がまた出た。花穂の近く。'),
    (1, 7, 10, '梅雨明けが遅い。べと病の葉を落とした。'),
    (1, 8,  4, 'うどんこ病が果房に出た。'),
    (1, 8, 22, '晩腐病の房を取り除いた。'),
    (1, 10, 28, 'さび病で落葉が進む。'),
    (1, 11, 15, E'来年の計画。\n梅雨の前に薬を切らさない。'),
    (2, 4, 11, '萌芽。暖かい春。'),
    (2, 4, 30, '黒とう病が少し。'),
    (2, 6,  1, '開花。雨が少ない。'),
    (2, 7, 16, 'うどんこ病が葉に出た。空梅雨で乾いている。'),
    (2, 8,  6, 'うどんこ病が果房にも。'),
    (2, 9, 14, '収穫を始めた。'),
    (2, 9, 15, '秋雨で灰色かび病。'),
    (2, 9, 20, '晩腐病の房が出た。雨が続く。'),
    (2, 10, 2, '収穫を終えた。'),
    (2, 10, 15, '落葉。さび病の葉が多かった。')
  ) AS v(yr, month, day, memo)
 WHERE pg_temp.seed_bg_date(v.yr, v.month, v.day) IS NOT NULL;

COMMIT;
