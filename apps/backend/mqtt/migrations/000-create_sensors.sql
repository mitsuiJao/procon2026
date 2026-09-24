CREATE TABLE measure (
  id          BIGSERIAL PRIMARY KEY,
  device      TEXT NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX measure_device_received_at_idx ON measure (device, received_at DESC);
