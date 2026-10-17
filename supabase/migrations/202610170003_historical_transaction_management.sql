-- Historical scenario administration. This migration is additive: it never
-- inserts, changes, or deletes a financial record.

alter table public.simulated_historical_transactions
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);

-- The application server is responsible for admin authorization. Explicit
-- service-role grants fix access for the server-side historical manager while
-- customer reads remain protected by the existing auth.uid() RLS policy.
grant select, insert, update on public.simulated_historical_transactions to service_role;
grant insert on public.admin_audit_log to service_role;

create or replace function public.touch_simulated_historical_transaction()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists simulated_historical_transactions_touch_updated_at
  on public.simulated_historical_transactions;
create trigger simulated_historical_transactions_touch_updated_at
  before update on public.simulated_historical_transactions
  for each row execute function public.touch_simulated_historical_transaction();
