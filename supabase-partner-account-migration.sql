-- FinWin: Partner sub-account fields on user_settings
-- Run this in Supabase SQL editor (Dashboard → SQL editor → New query)

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS partner_name TEXT DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS partner_account_balance NUMERIC DEFAULT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
