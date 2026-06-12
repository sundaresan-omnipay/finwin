-- FinWin v3 Migrations — SIP Savings & Loan EMI Tracking
-- Run this in your Supabase SQL editor AFTER supabase-migrations-v2.sql

-- ─────────────────────────────────────────────────────────────
-- 1. SIPs — Systematic Investment Plans
-- ─────────────────────────────────────────────────────────────
create table if not exists sips (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  fund_name      text not null,
  monthly_amount decimal(12, 2) not null check (monthly_amount > 0),
  sip_day        integer not null default 1 check (sip_day between 1 and 28),
  start_date     date not null,
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz default now() not null
);

alter table sips enable row level security;

create policy "Users can view own sips"   on sips for select using (auth.uid() = user_id);
create policy "Users can insert own sips" on sips for insert with check (auth.uid() = user_id);
create policy "Users can update own sips" on sips for update using (auth.uid() = user_id);
create policy "Users can delete own sips" on sips for delete using (auth.uid() = user_id);

create index if not exists sips_user_id_idx on sips(user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Loans — EMI tracking with amortization computed client-side
-- ─────────────────────────────────────────────────────────────
create table if not exists loans (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references auth.users(id) on delete cascade not null,
  loan_name            text not null,
  principal_amount     decimal(14, 2) not null check (principal_amount > 0),
  emi_amount           decimal(12, 2) not null check (emi_amount > 0),
  annual_interest_rate decimal(5, 2) not null check (annual_interest_rate >= 0),
  tenure_months        integer not null check (tenure_months > 0),
  start_date           date not null,   -- date of first EMI
  is_active            boolean not null default true,
  notes                text,
  created_at           timestamptz default now() not null
);

alter table loans enable row level security;

create policy "Users can view own loans"   on loans for select using (auth.uid() = user_id);
create policy "Users can insert own loans" on loans for insert with check (auth.uid() = user_id);
create policy "Users can update own loans" on loans for update using (auth.uid() = user_id);
create policy "Users can delete own loans" on loans for delete using (auth.uid() = user_id);

create index if not exists loans_user_id_idx on loans(user_id);
