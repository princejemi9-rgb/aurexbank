-- Server-authoritative internal virtual transfers. This migration deliberately
-- does not model an external settlement rail: external payments remain pending
-- until a regulated provider confirms settlement.
begin;

-- Super Admin lifecycle and capability controls. Status is enforced by every
-- Personal Admin server route via approvedPersonalAdmin, not merely hidden UI.
alter table public.personal_admin_profiles add column if not exists approval_limit numeric(18,2) not null default 0 check (approval_limit >= 0);
alter table public.personal_admin_profiles add column if not exists operational_settings jsonb not null default '{}'::jsonb;
alter table public.personal_admin_profiles drop constraint if exists personal_admin_profiles_status_check;
alter table public.personal_admin_profiles add constraint personal_admin_profiles_status_check check (status in ('pending_approval','approved','rejected','suspended','blocked','archived'));

create table if not exists public.transfer_authorization_challenges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  memo text not null default '' check (char_length(memo) <= 280),
  idempotency_key uuid not null,
  code_salt text not null,
  code_hash text not null,
  status text not null default 'open' check (status in ('open','verified','expired','cancelled','consumed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts between 1 and 5),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists transfer_challenge_sender_idempotency_idx on public.transfer_authorization_challenges(sender_id, idempotency_key);
create index if not exists transfer_challenge_recipient_idx on public.transfer_authorization_challenges(recipient_id, created_at desc);

create table if not exists public.virtual_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  challenge_id uuid not null unique references public.transfer_authorization_challenges(id) on delete restrict,
  idempotency_key uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  memo text not null default '',
  status text not null default 'completed' check (status = 'completed'),
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  unique(sender_id, idempotency_key)
);
create table if not exists public.virtual_transfer_ledger (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.virtual_transfers(id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete restrict,
  direction text not null check (direction in ('debit','credit')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique(transfer_id, account_id, direction)
);
alter table public.transfer_authorization_challenges enable row level security;
alter table public.virtual_transfers enable row level security;
alter table public.virtual_transfer_ledger enable row level security;
create policy "customers read own transfer challenges" on public.transfer_authorization_challenges for select to authenticated using (sender_id = auth.uid());
create policy "customers read own virtual transfers" on public.virtual_transfers for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "customers read own virtual ledger" on public.virtual_transfer_ledger for select to authenticated using (account_id = auth.uid());
grant select, insert, update on public.transfer_authorization_challenges, public.virtual_transfers, public.virtual_transfer_ledger to service_role;

create or replace function public.verify_transfer_authorization_challenge(p_sender_id uuid, p_challenge_id uuid, p_code_hash text)
returns public.transfer_authorization_challenges language plpgsql security definer set search_path = public, auth as $$
declare v public.transfer_authorization_challenges;
begin
  select * into v from public.transfer_authorization_challenges where id = p_challenge_id and sender_id = p_sender_id for update;
  if not found then raise exception 'Transfer authorization was not found' using errcode = 'P0002'; end if;
  if v.status <> 'open' then raise exception 'Transfer authorization is no longer active' using errcode = 'P0001'; end if;
  if v.expires_at <= now() then update public.transfer_authorization_challenges set status = 'expired' where id = v.id; raise exception 'Transfer authorization has expired' using errcode = 'P0001'; end if;
  if v.code_hash <> p_code_hash then
    update public.transfer_authorization_challenges set attempts = attempts + 1, status = case when attempts + 1 >= max_attempts then 'cancelled' else 'open' end where id = v.id;
    raise exception 'Invalid OTP code' using errcode = '28000';
  end if;
  update public.transfer_authorization_challenges set status = 'verified', verified_at = now() where id = v.id returning * into v;
  return v;
end; $$;

create or replace function public.process_verified_virtual_transfer(p_sender_id uuid, p_challenge_id uuid, p_idempotency_key uuid)
returns public.virtual_transfers language plpgsql security definer set search_path = public, auth as $$
declare c public.transfer_authorization_challenges; s public.profiles; r public.profiles; t public.virtual_transfers;
begin
  select * into t from public.virtual_transfers where sender_id = p_sender_id and idempotency_key = p_idempotency_key;
  if found then return t; end if;
  select * into c from public.transfer_authorization_challenges where id = p_challenge_id and sender_id = p_sender_id for update;
  if not found or c.idempotency_key <> p_idempotency_key then raise exception 'Transfer authorization was not found' using errcode = 'P0002'; end if;
  if c.status <> 'verified' or c.expires_at <= now() then raise exception 'A current verified OTP is required' using errcode = '42501'; end if;
  select * into s from public.profiles where id = c.sender_id for update;
  select * into r from public.profiles where id = c.recipient_id for update;
  if not found or s.account_status <> 'active' or r.account_status <> 'active' then raise exception 'Both accounts must be active' using errcode = '42501'; end if;
  if s.currency <> c.currency or r.currency <> c.currency then raise exception 'Currency mismatch' using errcode = '22023'; end if;
  if s.balance < c.amount then raise exception 'Insufficient available balance' using errcode = 'P0001'; end if;
  update public.profiles set balance = balance - c.amount, updated_at = now() where id = s.id;
  update public.profiles set balance = balance + c.amount, updated_at = now() where id = r.id;
  insert into public.virtual_transfers(sender_id,recipient_id,challenge_id,idempotency_key,amount,currency,memo) values(c.sender_id,c.recipient_id,c.id,c.idempotency_key,c.amount,c.currency,c.memo) returning * into t;
  insert into public.virtual_transfer_ledger(transfer_id,account_id,direction,amount,currency) values(t.id,c.sender_id,'debit',c.amount,c.currency),(t.id,c.recipient_id,'credit',c.amount,c.currency);
  update public.transfer_authorization_challenges set status = 'consumed', consumed_at = now() where id = c.id;
  insert into public.personal_admin_audit_log(actor_id,target_user_id,action,metadata) values (c.sender_id,c.recipient_id,'virtual_transfer_completed',jsonb_build_object('transfer_id',t.id,'amount',t.amount,'currency',t.currency));
  return t;
end; $$;
revoke all on function public.verify_transfer_authorization_challenge(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.verify_transfer_authorization_challenge(uuid,uuid,text) to service_role;
revoke all on function public.process_verified_virtual_transfer(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.process_verified_virtual_transfer(uuid,uuid,uuid) to service_role;
commit;
