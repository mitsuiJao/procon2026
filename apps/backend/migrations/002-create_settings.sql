CREATE TABLE settings (
  id        serial PRIMARY KEY,
  latitude  double precision NOT NULL CHECK (latitude  BETWEEN  -90 AND  90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now()
);
