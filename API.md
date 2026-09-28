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

## マスター

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/diseases` | 病害の一覧 |
| GET | `/pesticides?disease=` | 農薬の一覧（散布記録のプルダウン用） |

- **`/diseases`**
  - 返り値: `{ id, name_ja, priority }[]`
  - `/calendar/risk` の `diseaseId` を病名に直すときに使う。
- **`/pesticides`**
  - 返り値: `{ source, retrieved_at, pesticides: [...] }`
  - 各農薬: `{ id, name_ja, kind, use, registered_on, active_ingredients, frac_codes, frac_note, total_use_limits, applications }`
    - `id` は農薬の登録番号（文字列）。
  - 各適用（`applications`）: `{ crop, target, disease_id, method, dilution, dilution_min, dilution_max, timing, pre_harvest_days, spray_volume, uses, max_uses }`
    - 数値の項目（`dilution_min`、`pre_harvest_days`、`max_uses` など）は、原文から取り出せたときだけ入る。それ以外は null。
  - `?disease=<diseaseId>` を付けると、その病害に登録のある農薬だけを返す。
  - 推奨ではなく、選べる農薬の一覧。元データは農薬登録情報（2026-09 時点）。

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
curl -X PUT "$API/diary/2026-09-28" -H 'Content-Type: application/json' -d '{"memo":"べと病の病斑を確認"}'
curl -X POST "$API/sprays" -H 'Content-Type: application/json' -d '{"sprayed_on":"2026-09-28","pesticide_id":"142","dilution":"1000倍"}'
curl -X POST "$API/sprays" -H 'Content-Type: application/json' -d '{"sprayed_on":"2026-09-28","pesticide":"自家製の資材"}'
curl "$API/sprays/usage?year=2026"
curl -X PUT "$API/stages/2026-05-20" -H 'Content-Type: application/json' -d '{"stage":4}'
```
