-- Amounts above the configured server-side authorization limit are retained
-- for review. They never create an OTP challenge or move money automatically.
begin;
create table if not exists public.transfer_review_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  memo text not null default '' check (char_length(memo) <= 280),
  idempotency_key uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(sender_id, idempotency_key)
);
alter table public.transfer_review_requests enable row level security;
create policy "customers read own transfer reviews" on public.transfer_review_requests for select to authenticated using (sender_id = auth.uid());
grant select, insert, update on public.transfer_review_requests to service_role;
commit;
