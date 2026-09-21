CREATE TABLE measure (
  id          BIGSERIAL PRIMARY KEY,
  topic       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);