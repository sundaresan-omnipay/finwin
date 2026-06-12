-- FinWin v4 Migrations — Complete Fix
-- Run this entire file in your Supabase SQL editor (safe to run multiple times)

-- ─────────────────────────────────────────────────────────────
-- 0. Fix transactions category constraint to include savings + emi
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
-- 1. Fix loans table — add ALL columns that may be missing
--    (IF NOT EXISTS means safe to run even if already present)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_name            text;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS principal_amount     decimal(14,2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS emi_amount           decimal(12,2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS annual_interest_rate decimal(5,2)  DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS tenure_months        integer;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_date           date;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_active            boolean       DEFAULT true;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS notes                text;

-- Fill in defaults for any rows that got saved with nulls
UPDATE loans SET loan_name            = 'My Loan'      WHERE loan_name IS NULL;
UPDATE loans SET principal_amount     = 0              WHERE principal_amount IS NULL;
UPDATE loans SET emi_amount           = 0              WHERE emi_amount IS NULL;
UPDATE loans SET annual_interest_rate = 0              WHERE annual_interest_rate IS NULL;
UPDATE loans SET tenure_months        = 12             WHERE tenure_months IS NULL;
UPDATE loans SET start_date           = CURRENT_DATE   WHERE start_date IS NULL;
UPDATE loans SET is_active            = true           WHERE is_active IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Savings Goals table
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

-- ─────────────────────────────────────────────────────────────
-- 3. IMPORTANT: refresh PostgREST schema cache
--    (fixes "column not found in schema cache" errors)
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
