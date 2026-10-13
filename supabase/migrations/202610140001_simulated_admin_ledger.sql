-- Aurex Bank: additive simulated-ledger foundation.
-- Apply in Supabase SQL editor after reviewing existing RLS policies. This does
-- not alter or delete profiles, transfers, cards, notifications, or auth users.

create table if not exists public.simulated_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_username text not null,
  direction text not null check (direction in ('credit', 'debit', 'reversal')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  category text not null default 'balance_adjustment',
  description text not null,
  reference text not null unique,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  reversal_of uuid references public.simulated_ledger_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  constraint simulated_ledger_entries_simulated check ((metadata ->> 'simulated') = 'true')
);

create index if not exists simulated_ledger_entries_account_effective_idx
  on public.simulated_ledger_entries (account_username, effective_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_username text,
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.simulated_ledger_entries enable row level security;
alter table public.admin_audit_log enable row level security;

-- The application server uses the service-role key for privileged operations.
-- There are deliberately no browser-client write policies for either table.
drop policy if exists "Users can view their own simulated ledger" on public.simulated_ledger_entries;
create policy "Users can view their own simulated ledger"
  on public.simulated_ledger_entries for select to authenticated
  using (account_username = coalesce(auth.jwt() -> 'user_metadata' ->> 'username', auth.jwt() ->> 'email'));

-- Keep audit records immutable to ordinary clients.
drop policy if exists "Admins can view audit records" on public.admin_audit_log;
create policy "Admins can view audit records"
  on public.admin_audit_log for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = any (string_to_array(lower(coalesce(current_setting('app.aurex_admin_emails', true), '')), ',')));
