CREATE TABLE settings (
  id        serial PRIMARY KEY,
  latitude  double precision NOT NULL CHECK (latitude  BETWEEN  -90 AND  90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 生育ステージの切り替わり記録。生産者は「このステージに入った日」だけを記録する
-- （毎日の入力は不要）。ある日の生育ステージは effective_from が最も新しい行を採用する。
CREATE TABLE stage_transitions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stage          SMALLINT NOT NULL CHECK (stage BETWEEN 0 AND 10),
  effective_from DATE NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stage_transitions_effective_from_idx ON stage_transitions (effective_from DESC);
