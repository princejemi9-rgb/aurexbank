-- Additive simulated financial-profile and historical-record foundation.
-- This migration creates no balances or transactions for any customer.
create table if not exists public.customer_financial_profiles (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  savings_reserve numeric(18,2) not null default 0 check (savings_reserve >= 0),
  investment_holdings numeric(18,2) not null default 0 check (investment_holdings >= 0),
  accrued_income numeric(18,2) not null default 0 check (accrued_income >= 0),
  rewards_balance numeric(18,2) not null default 0 check (rewards_balance >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.simulated_historical_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('credit', 'debit', 'reversal')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  category text not null,
  description text not null,
  counterparty_label text not null default 'Internal simulated counterparty',
  reference text not null unique,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  reversal_of uuid references public.simulated_historical_transactions(id),
  metadata jsonb not null default '{"simulated": true}'::jsonb,
  constraint simulated_historical_transactions_are_simulated check ((metadata ->> 'simulated') = 'true')
);

create index if not exists simulated_historical_customer_effective_idx on public.simulated_historical_transactions (customer_id, effective_at desc);
create index if not exists simulated_historical_customer_created_idx on public.simulated_historical_transactions (customer_id, created_at desc);

alter table public.customer_financial_profiles enable row level security;
alter table public.simulated_historical_transactions enable row level security;
drop policy if exists "Customers read own financial profile" on public.customer_financial_profiles;
create policy "Customers read own financial profile" on public.customer_financial_profiles for select to authenticated using (customer_id = auth.uid());
drop policy if exists "Customers read own simulated historical transactions" on public.simulated_historical_transactions;
create policy "Customers read own simulated historical transactions" on public.simulated_historical_transactions for select to authenticated using (customer_id = auth.uid());

-- Browser clients have no insert/update/delete policies. Server-side admin routes
-- must authorize each operation, preserve creation timestamps, and record audit rows.
alter publication supabase_realtime add table public.customer_financial_profiles;
alter publication supabase_realtime add table public.simulated_historical_transactions;
