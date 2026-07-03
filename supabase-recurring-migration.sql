-- FinWin: Recurring/fixed expense flag on transactions
-- Run this in Supabase SQL editor (Dashboard → SQL editor → New query)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
