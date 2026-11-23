-- 病害の発生記録。行がある = その日にその病害を見つけた（「発生なし」は記録しない）
CREATE TABLE disease_observations (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  observed_on DATE NOT NULL,
  -- 病害マスター（data/vocab/diseases.yaml）の id。マスターが yaml なので外部キーは張らない
  disease_id  TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (observed_on, disease_id)
);
