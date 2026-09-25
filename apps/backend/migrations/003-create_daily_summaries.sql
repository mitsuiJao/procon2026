CREATE TABLE daily_summaries (
  summary_date DATE NOT NULL,
  device       TEXT NOT NULL,
  metric       TEXT NOT NULL CHECK (metric IN ('temp', 'humidity', 'rainfall')),
  min_value    DOUBLE PRECISION,
  max_value    DOUBLE PRECISION,
  avg_value    DOUBLE PRECISION,
  sum_value    DOUBLE PRECISION,
  sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (summary_date, device, metric)
);
