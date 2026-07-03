-- FinWin: New categories + partner sub-account migration
-- Run this in Supabase SQL editor (Dashboard → SQL editor → New query)

-- 1. Update category CHECK constraint to include new middle-class categories
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_category_check
  CHECK (category IN (
    'food', 'groceries', 'vegetables', 'milk', 'snacks',
    'transport', 'petrol',
    'shopping', 'clothing', 'bills', 'household',
    'health', 'entertainment', 'travel',
    'education', 'kids',
    'savings', 'emi', 'other'
  ));

-- 2. Add member column for partner/wife sub-account tracking
--    NULL = your own expense, 'partner' = partner's expense
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member TEXT DEFAULT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
