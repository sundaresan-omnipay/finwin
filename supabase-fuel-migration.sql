-- Fuel / Petrol Log
-- Tracks each fill-up: liters, total cost, odometer reading
-- From these three values we derive: cost/liter, km since last fill, mileage (km/L), cost/km

CREATE TABLE IF NOT EXISTS fuel_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  liters      NUMERIC(8, 2) NOT NULL CHECK (liters > 0),
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount > 0),  -- total ₹ paid
  odometer    INTEGER NOT NULL CHECK (odometer >= 0),       -- km at fill-up
  fuel_type   TEXT NOT NULL DEFAULT 'petrol'
                CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'ev')),
  vehicle     TEXT,          -- optional label if user has multiple vehicles
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fuel logs"
  ON fuel_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fuel_logs_user_date ON fuel_logs (user_id, date DESC);
