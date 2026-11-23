-- 病害ごとの感度の段階（rules.yaml の levels のどこまでを使うか）。発生記録から選ぶ。
-- 追記のみで、病害ごとに最新の行が現在値（それより前は履歴）。
CREATE TABLE disease_sensitivity (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 病害マスター（data/vocab/diseases.yaml）の id。マスターが yaml なので外部キーは張らない
  disease_id TEXT NOT NULL,
  -- シーズン開始日。今シーズン以外の行は使わない
  season     DATE NOT NULL,
  level      SMALLINT NOT NULL CHECK (level >= 0),
  observed   INT NOT NULL,   -- 今シーズンの発生記録の件数
  caught     INT NOT NULL,   -- そのうち、選んだ段階で事前に警告が出ていた件数
  alert_days INT NOT NULL,   -- 選んだ段階で警告が出た日数
  total_days INT NOT NULL,   -- シーズン開始から計算した日までの日数
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX disease_sensitivity_latest_idx ON disease_sensitivity (disease_id, created_at DESC);
