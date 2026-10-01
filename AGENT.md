# AGENT.md

**Always reply to the user in Japanese.**

## Workflow
- For design and DB changes, propose a plan in plan mode first and implement only after approval.
- Commit via the `/commit` skill: split into logical units and push.

## Data decisions (settled)
- The calendar's "measured values" come only from the own sensors (`measure`). Forecasts live in `weather_forecasts` (forecast-only). Never store the same data in two tables.
- Manual temperature/humidity input is not needed (the diary holds only memo and spray records).
- Past days prefer sensor values; only the weather code is filled in from the forecast. Multiple sensor devices are not distinguished and are pooled together.
- Rainfall for risk evaluation is taken per hour: sensor `rainfall` first, otherwise the forecast `precipitation` (`weather_forecasts`). Until a rain gauge is installed, both past and forecast days use the forecast.
- Only the sensor status view (`GET /sensors`) shows devices separately; calendar and risk evaluation keep pooling them.
- The pesticide master is `data/vocab/pesticides.yaml`, generated from the MAFF registration CSV (`data/pesticides_updated-utf8.csv`, retrieved 2026-09) by `npm run build:pesticides`; never edit it by hand. `id` is the registration number. FRAC codes come from active ingredients, not the CSV's FRAC column (Excel mangled some codes into dates). Spray records store both `pesticide_id` (null for free text) and the product name at the time. The UI no longer inputs or shows `dilution`/`amount`; the DB/API columns stay (new records save them empty).
- Which pesticides appear in the spray-record picker is stored in `hidden_pesticides` (only hidden ones are kept; the default is shown). It does not affect other pesticide lists.
- The daily representative weather code is the most frequent one; ties go to the larger code (the worse weather).
- Disease occurrences are stored in `disease_observations` (one row = that disease was found on that day; `disease_id` is a `diseases.yaml` id). Only occurrences are recorded — "no disease" is never entered.
- Feedback from occurrences is a per-disease sensitivity level, not threshold learning (one occurrence cannot tell whether weather caused it; what is tuned is "how early to warn in this field"). Level values are written in `rules.yaml` (`levels`), never computed at runtime. The chosen level is the one that catches the most occurrences (a warning within `latentDays` before the find) among levels whose alert days stay within 25% of the season (`MAX_ALERT_RATIO`); ties go to the lower level; level 0 is always a candidate. Only this season's occurrences count (season starts 4/1). Accuracy/precision is deliberately not computed. Ripe rot and rust have no enabled rule, so their level 1 enables the disabled B rules.
- Levels are stored append-only in `disease_sensitivity` (latest row per disease for the current season is the current value). They are recomputed only when an occurrence is written/deleted or `POST /sensitivity/recompute` is called — not when weather or stage data changes later.
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
- The frontend reads/writes diary, spray records, disease occurrences and the pesticide master through the API (no AsyncStorage). Disease risk comes from `/calendar/risk` (shown only as calendar cell background colors and on the day screen whose disease rows open the disease screen; no warning banner or 7-day strip); the device keeps only display text (`DISEASE_TEXT` in `utils.ts`, keyed by `diseases.yaml` ids). `undetermined` is shown like `none`. Risk is shown only up to 7 days ahead (`RISK_DAYS_AHEAD`); later forecast days show neither cell colors nor the day screen's risk section. The day screen has its own stage section (shown for every date, including beyond 7 days): for today and past days it records "this stage from this day" (`PUT /stages/:date`) and, on a transition day, can undo it (`DELETE /stages/:date`); future days are display-only. The day screen also has a disease-occurrence section (today and past days only): one chip per disease toggles the record (`PUT`/`DELETE /observations/:date/:diseaseId`), and days with a record get a dot on the calendar cell. The disease screen shows the sensitivity level from `/sensitivity` ("この圃場での知らせ方": 標準 / 敏感 / より敏感, with the reason line) only for diseases that have levels (`maxLevel > 0`); `DISEASE_TEXT` keeps describing the standard (level 0) condition. The pesticides tab (`src/app/pesticides.tsx`) searches the master and toggles `hidden`; hidden ones are left out only of the spray-record picker.
- `rules.yaml` is loaded as `RuleDef` (may hold `params`, `$name` references in `when`, and `levels`); `resolveRules(defs, levelByDisease)` turns it into the concrete `Rule` that the evaluators take. `getRules()` is level 0 for every disease. To make a threshold level-dependent, move it into `params`, reference it as `$name`, and list overrides in `levels` (`stage` conditions cannot use references). `buildDayInputs` builds per-day inputs once so the same days can be evaluated at several levels.
- Backend tests live in `apps/backend/api/test/` and run with `npm test` (`node:test` via `tsx`, no extra deps). They cover only pure functions (rule evaluation, rain/stage/weather aggregation) and never touch the DB; rules and stages are read from the real `data/`. They sit outside `tsconfig.json`'s `include`, so the production build skips them.
- `apps/backend/seeds/risk-scenario.sql` is a dev-only seed for checking `/calendar/risk` across past/today/forecast. It TRUNCATEs `measure` and `weather_forecasts`, and the weather cron overwrites its forecast rows at :07 every hour.
- `apps/backend/data` is mounted into the `api` container via `docker-compose.yml` (`./data:/app/data:ro` + `DATA_DIR=/app/data`), since it's outside the `api` build context.
