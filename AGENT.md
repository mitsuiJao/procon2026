# AGENT.md

**Always reply to the user in Japanese.**

## Workflow
- For design and DB changes, propose a plan in plan mode first and implement only after approval.
- Commit via the `/commit` skill: split into logical units and push.

## Data decisions (settled)
- The calendar's "measured values" come only from the own sensors (`measure`). Forecasts live in `weather_forecasts` (forecast-only). Never store the same data in two tables.
- Manual temperature/humidity input is not needed (the diary holds only memo and spray records).
- Past days prefer sensor values; only the weather code is filled in from the forecast. Multiple sensor devices are not distinguished and are pooled together.
- Only the sensor status view (`GET /sensors`) shows devices separately; calendar and risk evaluation keep pooling them.
- The pesticide master is `data/vocab/pesticides.yaml`, generated from the MAFF registration CSV (`data/pesticides_updated-utf8.csv`, retrieved 2026-09) by `npm run build:pesticides`; never edit it by hand. `id` is the registration number. FRAC codes come from active ingredients, not the CSV's FRAC column (Excel mangled some codes into dates). Spray records store both `pesticide_id` (null for free text) and the product name at the time.
- Which pesticides appear in the spray-record picker is stored in `hidden_pesticides` (only hidden ones are kept; the default is shown). It does not affect other pesticide lists.
- The daily representative weather code is the most frequent one; ties go to the larger code (the worse weather).
- While the DB is being recreated and no data is accumulating, edit existing migration files (e.g. `001`) directly instead of adding new ones (approved by the user).

## Time handling
- The DB stores UTC. Always convert to JST (`Asia/Tokyo`) before grouping by date. `pg` turns DATE into a JS `Date` and shifts it, so return dates as strings.
- Open-Meteo returns JST time strings when called with `timezone=Asia/Tokyo`. Append `+09:00` before writing to the DB.

## MQTT
- Topic is `sensor/{device}/data`; the payload is JSON like `{"temp":25.3,"humidity":82.1,"rainfall":0.5}`. Missing keys are skipped and each key becomes one `measure` row. `rainfall` is the increment since the previous send. `received_at` is the receive time and is not sent by the sensor.
- To add a `metric`, change both `metrics` in `mqtt/src/sub.ts` and the CHECK constraint in `migrations/000`.

## Implementation notes
- Do not start cron as an import side effect. Call `startWeatherCron()` from `index.ts`. Assumes a single `api` container (scaling it would run the cron twice).
- The number of `measure` rows depends on the sensor send interval, so the monthly view may become slow (not measured yet). If it does, cache past days per day.
- The frontend reads/writes diary and spray records and the pesticide master through the API (no AsyncStorage). Disease risk comes from `/calendar/risk` (shown only as calendar cell background colors and on the day screen whose disease rows open the disease screen; no warning banner or 7-day strip); the device keeps only display text (`DISEASE_TEXT` in `utils.ts`, keyed by `diseases.yaml` ids). `undetermined` is shown like `none`. Risk is shown only up to 7 days ahead (`RISK_DAYS_AHEAD`); later forecast days show neither cell colors nor the day screen's risk section. Stages are only displayed (recorded/estimated); there is no stage input UI yet. The pesticides tab (`src/app/pesticides.tsx`) searches the master and toggles `hidden`; hidden ones are left out only of the spray-record picker.
- `apps/backend/seeds/risk-scenario.sql` is a dev-only seed for checking `/calendar/risk` across past/today/forecast. It TRUNCATEs `measure` and `weather_forecasts`, and the weather cron overwrites its forecast rows at :07 every hour.
- `apps/backend/data` is mounted into the `api` container via `docker-compose.yml` (`./data:/app/data:ro` + `DATA_DIR=/app/data`), since it's outside the `api` build context.
