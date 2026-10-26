-- Explicit, simulated-only financial authority. Disabled by default.
alter table public.personal_admin_profiles
  alter column permissions set default '{"manage_customers":true,"manage_support":true,"manage_reports":true,"manage_financial_adjustments":false}'::jsonb;

create table if not exists public.personal_admin_financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null unique,
  amount numeric(18,2) not null check (amount <> 0 and abs(amount) <= 100000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'posted' check (status = 'posted'),
  created_at timestamptz not null default now(),
  constraint adjustment_tenant_customer_unique unique (id, personal_admin_id, customer_id)
);
alter table public.personal_admin_financial_adjustments enable row level security;
grant select, insert on public.personal_admin_financial_adjustments to service_role;
