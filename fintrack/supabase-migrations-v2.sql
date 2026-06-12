-- FinWin v2 Migrations
-- Run this in your Supabase SQL editor AFTER the original supabase-schema.sql
-- Each block is idempotent (safe to re-run)

-- ─────────────────────────────────────────────────────────────
-- 1. Transactions: add is_cash flag (Feature 2 – cash wallet)
-- ─────────────────────────────────────────────────────────────
alter table transactions
  add column if not exists is_cash boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- 2. Cash withdrawals (Feature 2 – cash wallet)
-- ─────────────────────────────────────────────────────────────
create table if not exists cash_withdrawals (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  amount       decimal(12, 2) not null check (amount > 0),
  date         date not null default current_date,
  notes        text,
  created_at   timestamptz default now() not null
);

alter table cash_withdrawals enable row level security;

create policy "Users can view own cash_withdrawals"
  on cash_withdrawals for select
  using (auth.uid() = user_id);

create policy "Users can insert own cash_withdrawals"
  on cash_withdrawals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cash_withdrawals"
  on cash_withdrawals for update
  using (auth.uid() = user_id);

create policy "Users can delete own cash_withdrawals"
  on cash_withdrawals for delete
  using (auth.uid() = user_id);

create index if not exists cash_withdrawals_user_id_idx on cash_withdrawals(user_id);
create index if not exists cash_withdrawals_date_idx    on cash_withdrawals(date);

-- ─────────────────────────────────────────────────────────────
-- 3. User settings (Features 1, 6, 8 – salary cycle, work hours, WhatsApp)
-- ─────────────────────────────────────────────────────────────
create table if not exists user_settings (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null unique,
  salary_day       integer not null default 1 check (salary_day between 1 and 28),
  monthly_salary   decimal(12, 2),                        -- for work-hours feature; null = disabled
  whatsapp_phone   text,                                  -- e.g. "+919876543210"
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

alter table user_settings enable row level security;

create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own settings"
  on user_settings for delete
  using (auth.uid() = user_id);

create index if not exists user_settings_user_id_idx on user_settings(user_id);

-- Index on whatsapp_phone for fast lookup in the WhatsApp webhook route
create index if not exists user_settings_whatsapp_idx on user_settings(whatsapp_phone)
  where whatsapp_phone is not null;

-- ─────────────────────────────────────────────────────────────
-- 4. Service-role read on user_settings for WhatsApp webhook
-- ─────────────────────────────────────────────────────────────
-- The /api/whatsapp route uses the service-role key to look up a user
-- by phone number (bypassing RLS). No extra grant needed since service_role
-- bypasses RLS by default in Supabase.

-- ─────────────────────────────────────────────────────────────
-- Notes on new env vars required:
--   SUPABASE_SERVICE_ROLE_KEY  — for the WhatsApp webhook route (server-only)
--   (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY already exist)
-- ─────────────────────────────────────────────────────────────
