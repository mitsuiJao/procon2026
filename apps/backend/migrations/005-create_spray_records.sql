CREATE TABLE spray_records (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprayed_on DATE NOT NULL,
  pesticide  TEXT NOT NULL,
  dilution   TEXT,
  amount     TEXT,
  target     TEXT,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX spray_records_pesticide_date_idx ON spray_records (pesticide, sprayed_on);
