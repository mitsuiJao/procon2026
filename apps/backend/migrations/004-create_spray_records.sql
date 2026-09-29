CREATE TABLE spray_records (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprayed_on DATE NOT NULL,
  -- 農薬マスター（data/vocab/pesticides.yaml）の id。自由入力のときは NULL。マスターが yaml なので外部キーは張らない
  pesticide_id TEXT,
  -- 表示用の農薬名。マスターから選んだときもその時点の商品名を保存する
  pesticide  TEXT NOT NULL,
  dilution   TEXT,
  amount     TEXT,
  target     TEXT,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX spray_records_pesticide_date_idx ON spray_records (pesticide, sprayed_on);
CREATE INDEX spray_records_pesticide_id_date_idx ON spray_records (pesticide_id, sprayed_on);

-- 散布記録のプルダウンに出さない農薬。pesticide_id は pesticides.yaml の id（マスターが yaml なので外部キーは張らない）
CREATE TABLE hidden_pesticides (
  pesticide_id TEXT PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
