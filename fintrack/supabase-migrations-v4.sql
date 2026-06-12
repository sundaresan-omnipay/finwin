-- FinWin v4 Migrations — Schema Fix + Savings Goals
-- Run this in your Supabase SQL editor AFTER supabase-migrations-v3.sql

-- ─────────────────────────────────────────────────────────────
-- 0. Fix: update transactions category CHECK constraint to include savings + emi
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%category%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_category_check
  CHECK (category IN ('food','transport','shopping','bills','health','entertainment','travel','education','savings','emi','other'));

-- ─────────────────────────────────────────────────────────────
-- 1. Fix: add missing column to loans table
--    (run this even if the column already exists — IF NOT EXISTS is safe)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS annual_interest_rate decimal(5,2) NOT NULL DEFAULT 0
    CHECK (annual_interest_rate >= 0);

-- ─────────────────────────────────────────────────────────────
-- 2. Savings Goals
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_name       text NOT NULL,
  target_amount   decimal(14, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  decimal(14, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date     date,
  notes           text,
  is_completed    boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"   ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id);
