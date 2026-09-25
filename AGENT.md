# AGENT.md

**Always reply to the user in Japanese.**

## Workflow
- For design and DB changes, propose a plan in plan mode first and implement only after approval.
- Commit via the `/commit` skill: split into logical units and push.

## Data decisions (settled)
- The calendar's "measured values" come only from the own sensors (`measure`). Forecasts live in `weather_forecasts` (forecast-only). Never store the same data in two tables.
- Manual temperature/humidity input is not needed (the diary holds only memo and spray records).
- Past days prefer sensor values; only the weather code is filled in from the forecast. Multiple sensor devices are not distinguished and are pooled together.
- The daily representative weather code is the most frequent one; ties go to the larger code (the worse weather).
- While the DB is being recreated and no data is accumulating, edit existing migration files (e.g. `001`) directly instead of adding new ones (approved by the user).

## Time handling
- The DB stores UTC. Always convert to JST (`Asia/Tokyo`) before grouping by date. `pg` turns DATE into a JS `Date` and shifts it, so return dates as strings.
- Open-Meteo returns JST time strings when called with `timezone=Asia/Tokyo`. Append `+09:00` before writing to the DB.

## MQTT
- Topic is `sensor/{device}/{metric}`; the payload is a numeric string only (not JSON). `received_at` is the receive time and is not sent by the sensor.
- To add a `metric`, change both `metrics` in `mqtt/src/sub.ts` and the CHECK constraint in `migrations/000`.

## Implementation notes
- Do not start cron as an import side effect. Call `startWeatherCron()` from `index.ts`. Assumes a single `api` container (scaling it would run the cron twice).
- The number of `measure` rows depends on the sensor send interval, so the monthly view may become slow (not measured yet). If it does, cache past days per day.
- No route calls `getCalendarWeather` yet. The diary and spray DB functions (`db/diary.ts`, `db/spray.ts`) are not connected to the frontend yet.
