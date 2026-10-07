# API

- ベース: `http://localhost:3000/api`
- 日付はすべて JST の `YYYY-MM-DD`。期間指定（`start` / `end`）は両端を含み、400 日未満。
- JSON のキーは snake_case（`/calendar/risk` の中身だけは評価エンジンの型のまま camelCase）。
- エラー: 入力が不正なら `400 { error }`、対象が無ければ `404 { error: "not found" }`。削除の成功は `204`（本文なし）。
- 実装: `apps/backend/api/src/routes/`

## 天気・センサー

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/current` | 現在の天気 |
| GET | `/sensors` | デバイスごとのセンサー状態 |
| GET | `/calendar?start=&end=` | 日ごとの天気（カレンダー用） |
| GET | `/calendar/risk?start=&end=` | 日ごとの生育ステージと病害リスク |

- **`/current`**
  - 返り値: `{ temp, humidity, rainfall, code, updated_at, stale }`
  - 値が無い項目は null。
- **`/sensors`**
  - 返り値: `{ device, temp, humidity, rainfall_24h, updated_at, stale }[]`（device の昇順）
  - `temp` と `humidity` は `{ value, received_at }`。無ければ null。
  - `rainfall_24h` は、直近 24 時間に受信が無ければ null。
- **`/calendar`**
  - 返り値: `{ "YYYY-MM-DD": { tmax, tmin, humidity, code } }`
  - 過去の日はセンサーの値を優先し、天気コードだけ予報から補う。
- **`/calendar/risk`**
  - 返り値: `{ "YYYY-MM-DD": { stage, stageSource, diseases: [{ diseaseId, level, rules }] } }`
  - `stageSource`: `recorded`（記録から）、`estimated`（月からの近似）、`unknown`（どちらも無い）。
  - `level`: `conditions_met`、`near_threshold`、`none`、`undetermined`（入力不足で判定できない）。
  - `ongoingSince`: 警告が続いていて、その日は出し直さないときだけ付く（続き始めた日）。`level` は計算どおりのまま。画面には出さない。
    - rules.yaml の `repeatDays`（今は全ルール。うどんこ病 7 日、ほか 3 日）で決まる。出すのは続き始めた日と、前に出してから `repeatDays` 日経った日だけ。
    - 病害ごとの値と、`rules` の各ルールの値の両方に付く。
    - 続き始めた日はシーズンの初めまでさかのぼり得るので、`start` のシーズン開始（4/1）から計算し、返すのは指定期間だけ。
  - ルールは、病害ごとの感度の段階（`/sensitivity`）で確定させたものを使う。

## マスター

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/diseases` | 病害の一覧 |
| GET | `/pesticides?disease=` | 農薬の一覧（散布記録のプルダウン用） |
| PUT | `/pesticides/:id/hidden` | 散布記録のプルダウンに出す・出さないを切り替え（`204`） |

- **`/diseases`**
  - 返り値: `{ id, name_ja, priority }[]`
  - `/calendar/risk` の `diseaseId` を病名に直すときに使う。
- **`/pesticides`**
  - 返り値: `{ source, retrieved_at, pesticides: [...] }`
  - 各農薬: `{ id, name_ja, kind, use, registered_on, active_ingredients, frac_codes, frac_note, total_use_limits, hidden, applications }`
    - `id` は農薬の登録番号（文字列）。
    - `hidden` が true なら、散布記録のプルダウンに出さない設定（既定は false）。
  - 各適用（`applications`）: `{ crop, target, disease_id, method, dilution, dilution_min, dilution_max, timing, pre_harvest_days, spray_volume, uses, max_uses }`
    - 数値の項目（`dilution_min`、`pre_harvest_days`、`max_uses` など）は、原文から取り出せたときだけ入る。それ以外は null。
  - `?disease=<diseaseId>` を付けると、その病害に登録のある農薬だけを返す。
  - 推奨ではなく、選べる農薬の一覧。元データは農薬登録情報（2026-09 時点）。
- **`PUT /pesticides/:id/hidden`**
  - body: `{ hidden }`（boolean）。マスターに無い id は `404`。

## 生育ステージ

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/stages` | ステージの一覧と、記録した切り替わり |
| PUT | `/stages/:date` | その日からステージが切り替わったことを記録（同じ日は上書き） |
| DELETE | `/stages/:date` | 切り替わりの記録を消す |

- GET の返り値: `{ vocab: { value, id, name_ja }[], transitions: { stage, effective_from }[] }`
- PUT の body: `{ stage }`（`vocab` の `value`、0〜10）

## 日誌

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/diary?start=&end=` | 期間の日誌（`{ entry_date, memo }[]`、日付の昇順） |
| PUT | `/diary/:date` | 日誌を保存（同じ日は上書き） |
| DELETE | `/diary/:date` | 日誌を消す |

- PUT の body: `{ memo }`
- メモが空（空白だけ）のときは、その日の日誌を消して `204` を返す。

## 病害の発生記録

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/observations?start=&end=` | 期間の発生記録（`{ observed_on, disease_id, note }[]`、日付・`disease_id` の昇順） |
| PUT | `/observations/:date/:diseaseId` | その日にその病害を見つけたと記録（同じ日・同じ病害は上書き） |
| DELETE | `/observations/:date/:diseaseId` | 発生記録を消す |

- 記録があれば「その日にその病害を見つけた」。「発生なし」は記録しない。
- `diseaseId` は `/diseases` の `id`。一覧に無ければ `400`。
- 未来の日には記録できない（`400`）。
- PUT の body: `{ note? }`（body ごと省略できる。省くと `note` は空になる）
- 記録・削除のたびに、その病害の感度の段階を選び直す（下の「感度の段階」）。

## 感度の段階

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/sensitivity` | 病害ごとの感度の段階 |
| POST | `/sensitivity/recompute` | 全病害の段階を選び直す（返り値は GET と同じ） |

- 返り値: `{ disease_id, level, max_level, observed, caught, alert_days, total_days }[]`（全病害）
  - `level`: 今の段階。0 が標準で、大きいほど早めに知らせる。`/calendar/risk` はこの段階のルールで判定する。
  - `max_level`: その病害で選べる最大の段階（`rules.yaml` の `levels` の件数）。0 なら段階を持たない。
  - `observed`: 今シーズンの発生記録の件数。`caught`: そのうち、発見の前（病害ごとの `latentDays` の範囲）に警告が出ていた件数。
  - `alert_days` / `total_days`: 今の段階で警告が出た日数と、シーズン開始（4/1）から計算した日までの日数。
- 選び方: 警告日数が全体の 25% 以内の段階のうち、`caught` が最も多いもの。同数なら小さい段階。発生記録が無ければ 0。
- 段階を選び直すのは、発生記録を変えたときと `recompute` を呼んだときだけ。気象や生育ステージが後から変わっても自動では変わらない。
- 一度も選んでいない病害は `level` 0 で、件数はすべて 0。

## 散布記録

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/sprays?start=&end=` | 期間の散布記録（日付・id の昇順） |
| GET | `/sprays/recent?limit=8` | 最近の散布記録（新しい順。limit は 1〜50） |
| GET | `/sprays/usage?year=YYYY` | その年の使用回数（year を省くと今年） |
| POST | `/sprays` | 散布記録を追加（`201`、id 付きで返る） |
| PUT | `/sprays/:id` | 散布記録を上書き |
| DELETE | `/sprays/:id` | 散布記録を消す |

- **記録の形**: `{ id, sprayed_on, pesticide_id, pesticide, dilution, amount, target, note }`
- **POST / PUT の body**: `{ sprayed_on, pesticide_id?, pesticide?, dilution?, amount?, target?, note? }`
  - 1 日に何件でも記録できる。
  - マスターから選んだとき: `pesticide_id` に登録番号を入れる。`pesticide` にはマスターの名称が自動で入る。
  - 「その他」（自由入力）のとき: `pesticide_id` は付けずに、`pesticide` に名前を入れる（必須）。
- **usage の返り値**: `{ year, by_pesticide: { [pesticide_id]: 回数 }, by_frac: { [code]: { count, last_sprayed_on } } }`
  - 年は JST の 1/1〜12/31。
  - マスターから選んだ散布だけを数える。自由入力の散布と、FRAC コードがわからない有効成分は数えない。

## TEST

```sh
API=http://localhost:3000/api
curl "$API/current"
curl "$API/calendar/risk?start=2026-09-01&end=2026-09-30"
curl "$API/pesticides?disease=downy_mildew"
curl -X PUT "$API/pesticides/142/hidden" -H 'Content-Type: application/json' -d '{"hidden":true}'
curl -X PUT "$API/diary/2026-09-28" -H 'Content-Type: application/json' -d '{"memo":"べと病の病斑を確認"}'
curl -X POST "$API/sprays" -H 'Content-Type: application/json' -d '{"sprayed_on":"2026-09-28","pesticide_id":"142","dilution":"1000倍"}'
curl -X POST "$API/sprays" -H 'Content-Type: application/json' -d '{"sprayed_on":"2026-09-28","pesticide":"自家製の資材"}'
curl "$API/sprays/usage?year=2026"
curl -X PUT "$API/stages/2026-05-20" -H 'Content-Type: application/json' -d '{"stage":4}'
curl -X PUT "$API/observations/2026-09-28/downy_mildew" -H 'Content-Type: application/json' -d '{"note":"葉裏に白いかび"}'
curl "$API/observations?start=2026-09-01&end=2026-09-30"
curl "$API/sensitivity"
curl -X POST "$API/sensitivity/recompute"
```
