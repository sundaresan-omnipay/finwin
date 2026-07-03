-- FinWin: Credits table migration
-- Run this in Supabase SQL editor (Dashboard → SQL editor → New query)

CREATE TABLE IF NOT EXISTS credits (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL CHECK (amount > 0),
  source       TEXT NOT NULL,
  credit_type  TEXT NOT NULL DEFAULT 'other',
  date         DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own credits" ON credits;
CREATE POLICY "Users manage own credits" ON credits
  FOR ALL USING (auth.uid() = user_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
