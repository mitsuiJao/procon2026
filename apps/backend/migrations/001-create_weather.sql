CREATE TABLE weather_observations (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    observed_at   TIMESTAMPTZ      NOT NULL,
    temperature   NUMERIC(4,1)     NOT NULL,
    humidity      NUMERIC(4,1)     NOT NULL CHECK (humidity BETWEEN 0 AND 100),
    latitude      DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude     DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    weather_code  SMALLINT         NOT NULL,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    UNIQUE (observed_at, latitude, longitude)
);

CREATE INDEX idx_weather_observations_observed_at
    ON weather_observations (observed_at);