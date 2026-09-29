CREATE TABLE measure (
  id          BIGSERIAL PRIMARY KEY,
  device      TEXT NOT NULL,
  metric      TEXT NOT NULL CHECK (metric IN ('temp', 'humidity', 'rainfall')),
  value       DOUBLE PRECISION NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX measure_device_received_at_idx ON measure (device, metric, received_at DESC);
