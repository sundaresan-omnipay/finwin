-- Tier 1 feature additions: Net Worth, Bills, Income, Emergency Fund

-- 1. Net worth entries (assets and liabilities)
CREATE TABLE IF NOT EXISTS net_worth_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability')),
  category TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE net_worth_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='net_worth_entries' AND policyname='net_worth_entries_own') THEN
    CREATE POLICY "net_worth_entries_own" ON net_worth_entries FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Bills / recurring payment reminders
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  category TEXT NOT NULL DEFAULT 'bills',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bills' AND policyname='bills_own') THEN
    CREATE POLICY "bills_own" ON bills FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Additional income sources (freelance, rental, dividend, bonus)
CREATE TABLE IF NOT EXISTS income_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  income_type TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='income_entries' AND policyname='income_entries_own') THEN
    CREATE POLICY "income_entries_own" ON income_entries FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Emergency fund amount on user settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS emergency_fund_amount NUMERIC DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
