-- Aurex Bank staging bootstrap. Do not run against Production.
-- Supabase provides auth.users and pgcrypto (gen_random_uuid()).
begin;

-- Minimal prerequisite required by 202610270001 on a fresh project.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  balance numeric(18,2) not null default 0 check (balance >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
grant select, insert, update on public.profiles to service_role;

-- 202610260001_branding_revisions.sql
create table if not exists public.branding_revisions (
  id bigint generated always as identity primary key,
  version integer not null unique,
  status text not null check (status in ('draft', 'published', 'restored')),
  configuration jsonb not null,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.branding_revisions enable row level security;
drop policy if exists "branding revisions are readable by authenticated users" on public.branding_revisions;
create policy "branding revisions are readable by authenticated users" on public.branding_revisions for select to authenticated using (true);
grant select on public.branding_revisions to authenticated;

-- 202610260002_personal_admin_tenants.sql
create table if not exists public.personal_admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, email text not null unique, phone text not null default '',
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','suspended')),
  referral_code text not null unique,
  permissions jsonb not null default '{"manage_customers":true,"manage_support":true,"manage_reports":true}'::jsonb,
  approved_by uuid references auth.users(id), approved_at timestamptz, last_login_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.customer_personal_admin_assignments (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  referral_code text, assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(), reassigned_at timestamptz,
  constraint customer_assignment_not_self check (customer_id <> personal_admin_id)
);
create table if not exists public.personal_admin_branding (
  personal_admin_id uuid primary key references public.personal_admin_profiles(user_id) on delete cascade,
  configuration jsonb not null, version integer not null default 1, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.personal_admin_referrals (
  id uuid primary key default gen_random_uuid(), personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete cascade,
  customer_id uuid not null unique references auth.users(id) on delete cascade, referral_code text not null, registered_at timestamptz not null default now()
);
create table if not exists public.personal_admin_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), personal_admin_id uuid references public.personal_admin_profiles(user_id) on delete set null,
  action text not null, target_user_id uuid references auth.users(id) on delete set null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists customer_personal_admin_assignments_admin_idx on public.customer_personal_admin_assignments(personal_admin_id);
alter table public.personal_admin_profiles enable row level security;
alter table public.customer_personal_admin_assignments enable row level security;
alter table public.personal_admin_branding enable row level security;
alter table public.personal_admin_referrals enable row level security;
alter table public.personal_admin_audit_log enable row level security;
create policy "personal admins read own profile" on public.personal_admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "customers read own assignment" on public.customer_personal_admin_assignments for select to authenticated using (customer_id = auth.uid());
create policy "personal admins read own brand" on public.personal_admin_branding for select to authenticated using (personal_admin_id = auth.uid());
create policy "customers read assigned brand" on public.personal_admin_branding for select to authenticated using (personal_admin_id in (select personal_admin_id from public.customer_personal_admin_assignments where customer_id = auth.uid()));
create policy "personal admins read own referrals" on public.personal_admin_referrals for select to authenticated using (personal_admin_id = auth.uid());
create policy "personal admins read own audit" on public.personal_admin_audit_log for select to authenticated using (personal_admin_id = auth.uid());
grant select on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to authenticated;
grant select, insert, update, delete on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to service_role;

-- 202610260003_personal_admin_service_role_grants.sql
grant select, insert, update, delete on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to service_role;

-- 202610260004_personal_admin_financial_adjustments.sql
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

-- 202610270001_atomic_personal_admin_adjustments.sql
create or replace function public.apply_personal_admin_adjustment(
  p_personal_admin_id uuid,
  p_customer_id uuid,
  p_idempotency_key uuid,
  p_amount numeric,
  p_currency text,
  p_reason text
) returns public.personal_admin_financial_adjustments
language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin public.personal_admin_profiles;
  v_customer auth.users;
  v_profile public.profiles;
  v_existing public.personal_admin_financial_adjustments;
  v_adjustment public.personal_admin_financial_adjustments;
begin
  select * into v_existing from public.personal_admin_financial_adjustments where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_financial_adjustments')::boolean, false) is not true then
    raise exception 'Financial adjustment permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customer_personal_admin_assignments where customer_id = p_customer_id and personal_admin_id = p_personal_admin_id) then
    raise exception 'Customer is outside this Personal Admin portfolio' using errcode = '42501';
  end if;
  if p_amount = 0 or abs(p_amount) > 100000 or p_currency !~ '^[A-Z]{3}$' or char_length(trim(p_reason)) not between 3 and 500 then
    raise exception 'Invalid simulated adjustment input' using errcode = '22023';
  end if;
  select * into v_customer from auth.users where id = p_customer_id;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  select * into v_profile from public.profiles where lower(username) = lower(coalesce(v_customer.email, '')) for update;
  if not found or v_profile.account_status <> 'active' or coalesce(v_profile.currency, 'USD') <> p_currency then
    raise exception 'Customer account is not eligible for this adjustment' using errcode = '22023';
  end if;
  if coalesce(v_profile.balance, 0) + p_amount < 0 then raise exception 'Adjustment would create a negative balance' using errcode = '22003'; end if;
  update public.profiles set balance = coalesce(balance, 0) + p_amount where lower(username) = lower(v_customer.email);
  insert into public.personal_admin_financial_adjustments(personal_admin_id, customer_id, idempotency_key, amount, currency, reason)
    values (p_personal_admin_id, p_customer_id, p_idempotency_key, p_amount, p_currency, trim(p_reason)) returning * into v_adjustment;
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'simulated_balance_adjusted', jsonb_build_object('adjustment_id', v_adjustment.id, 'amount', p_amount, 'currency', p_currency, 'reason', trim(p_reason)));
  return v_adjustment;
end;
$$;
revoke all on function public.apply_personal_admin_adjustment(uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_personal_admin_adjustment(uuid, uuid, uuid, numeric, text, text) to service_role;

-- 202610270002_atomic_personal_admin_approval.sql
create or replace function public.approve_personal_admin_profile(
  p_personal_admin_id uuid,
  p_approved_by uuid
) returns public.personal_admin_profiles
language plpgsql security definer set search_path = public, auth as $$
declare
  v_profile public.personal_admin_profiles;
begin
  update public.personal_admin_profiles
    set status = 'approved', approved_by = p_approved_by, approved_at = now(), updated_at = now()
    where user_id = p_personal_admin_id and status = 'pending_approval'
    returning * into v_profile;
  if not found then
    raise exception 'Only a pending Personal Admin application can be approved. Use Reactivate for a suspended account.' using errcode = 'P0001';
  end if;
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, action)
    values (p_approved_by, p_personal_admin_id, 'personal_admin_approved');
  return v_profile;
end;
$$;
revoke all on function public.approve_personal_admin_profile(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_personal_admin_profile(uuid, uuid) to service_role;

-- 202610280001_automatic_personal_admin_activation.sql
alter table public.personal_admin_profiles
  alter column status set default 'approved';
create or replace function public.register_active_personal_admin_profile(
  p_user_id uuid, p_full_name text, p_email text, p_phone text, p_referral_code text
) returns public.personal_admin_profiles
language plpgsql security definer set search_path = public, auth as $$
declare
  v_profile public.personal_admin_profiles;
begin
  insert into public.personal_admin_profiles (
    user_id, full_name, email, phone, status, referral_code, approved_at
  ) values (
    p_user_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone),
    'approved', p_referral_code, now()
  ) returning * into v_profile;
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, action, metadata)
    values (p_user_id, p_user_id, 'personal_admin_auto_approved', jsonb_build_object('approval_mode', 'automatic'));
  return v_profile;
end;
$$;
revoke all on function public.register_active_personal_admin_profile(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_active_personal_admin_profile(uuid, text, text, text, text) to service_role;
with activated as (
  update public.personal_admin_profiles
    set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
    where status = 'pending_approval'
    returning user_id
)
insert into public.personal_admin_audit_log (actor_id, personal_admin_id, action, metadata)
select user_id, user_id, 'personal_admin_auto_approved',
  jsonb_build_object('approval_mode', 'automatic', 'source', 'policy_migration')
from activated;

-- 202610280002_personal_admin_customer_creation.sql
create table if not exists public.personal_admin_customer_details (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  country text not null default '' check (char_length(country) <= 80),
  account_type text not null default 'personal' check (account_type in ('personal', 'business')),
  address text not null default '' check (char_length(address) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.personal_admin_customer_details enable row level security;
drop policy if exists "customers read own personal-admin details" on public.personal_admin_customer_details;
create policy "customers read own personal-admin details" on public.personal_admin_customer_details for select to authenticated using (customer_id = auth.uid());
grant select, insert, update, delete on public.personal_admin_customer_details to service_role;
create or replace function public.create_personal_admin_customer_account(
  p_personal_admin_id uuid, p_customer_id uuid, p_email text, p_full_name text,
  p_phone text, p_country text, p_account_type text, p_address text
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin public.personal_admin_profiles; v_email text := lower(trim(p_email)); v_full_name text := trim(p_full_name);
  v_phone text := trim(coalesce(p_phone, '')); v_country text := trim(coalesce(p_country, ''));
  v_account_type text := lower(trim(coalesce(p_account_type, 'personal'))); v_address text := trim(coalesce(p_address, ''));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_full_name) not between 2 and 120 or char_length(v_phone) > 40 or char_length(v_country) > 80 or char_length(v_address) > 500 or v_account_type not in ('personal', 'business') then raise exception 'Invalid customer account details' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_customer_id and lower(coalesce(email, '')) = v_email) then raise exception 'Invited customer authentication record was not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = p_customer_id or lower(username) = v_email) then raise exception 'A customer account already exists for this email address' using errcode = '23505'; end if;
  insert into public.profiles (id, username, balance, currency, account_status) values (p_customer_id, v_email, 0, 'USD', 'active');
  insert into public.personal_admin_customer_details (customer_id, personal_admin_id, full_name, phone, country, account_type, address) values (p_customer_id, p_personal_admin_id, v_full_name, v_phone, v_country, v_account_type, v_address);
  insert into public.customer_personal_admin_assignments (customer_id, personal_admin_id, referral_code, assigned_by) values (p_customer_id, p_personal_admin_id, v_admin.referral_code, p_personal_admin_id);
  insert into public.personal_admin_referrals (personal_admin_id, customer_id, referral_code) values (p_personal_admin_id, p_customer_id, v_admin.referral_code);
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata) values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_invited', jsonb_build_object('account_type', v_account_type, 'country', v_country, 'referral_code', v_admin.referral_code));
  return jsonb_build_object('customer_id', p_customer_id, 'email', v_email, 'referral_code', v_admin.referral_code);
end;
$$;
revoke all on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) to service_role;

-- 202610280003_personal_admin_initial_password.sql
create table if not exists public.customer_initial_password_requirements (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  password_change_required boolean not null default true, required_at timestamptz not null default now(),
  completed_at timestamptz, completed_by uuid references auth.users(id),
  constraint initial_password_completion_is_self check (completed_by is null or completed_by = customer_id)
);
alter table public.customer_initial_password_requirements enable row level security;
grant select, insert, update, delete on public.customer_initial_password_requirements to service_role;
create or replace function public.create_personal_admin_customer_account(
  p_personal_admin_id uuid, p_customer_id uuid, p_email text, p_full_name text, p_phone text, p_country text, p_account_type text, p_address text
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin public.personal_admin_profiles; v_email text := lower(trim(p_email)); v_full_name text := trim(p_full_name); v_phone text := trim(coalesce(p_phone, '')); v_country text := trim(coalesce(p_country, '')); v_account_type text := lower(trim(coalesce(p_account_type, 'personal'))); v_address text := trim(coalesce(p_address, ''));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_full_name) not between 2 and 120 or char_length(v_phone) > 40 or char_length(v_country) > 80 or char_length(v_address) > 500 or v_account_type not in ('personal', 'business') then raise exception 'Invalid customer account details' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_customer_id and lower(coalesce(email, '')) = v_email) then raise exception 'Created customer authentication record was not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = p_customer_id or lower(username) = v_email) then raise exception 'A customer account already exists for this email address' using errcode = '23505'; end if;
  insert into public.profiles (id, username, balance, currency, account_status) values (p_customer_id, v_email, 0, 'USD', 'active');
  insert into public.personal_admin_customer_details (customer_id, personal_admin_id, full_name, phone, country, account_type, address) values (p_customer_id, p_personal_admin_id, v_full_name, v_phone, v_country, v_account_type, v_address);
  insert into public.customer_personal_admin_assignments (customer_id, personal_admin_id, referral_code, assigned_by) values (p_customer_id, p_personal_admin_id, v_admin.referral_code, p_personal_admin_id);
  insert into public.personal_admin_referrals (personal_admin_id, customer_id, referral_code) values (p_personal_admin_id, p_customer_id, v_admin.referral_code);
  insert into public.customer_initial_password_requirements (customer_id) values (p_customer_id);
  if to_regclass('public.customer_financial_profiles') is not null then execute 'insert into public.customer_financial_profiles (customer_id, currency) values ($1, $2) on conflict (customer_id) do nothing' using p_customer_id, 'USD'; end if;
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata) values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_created', jsonb_build_object('account_type', v_account_type, 'country', v_country, 'referral_code', v_admin.referral_code, 'email_verification', 'administratively_confirmed_not_proof_of_ownership', 'initial_password_change_required', true));
  return jsonb_build_object('customer_id', p_customer_id, 'email', v_email, 'referral_code', v_admin.referral_code);
end;
$$;
create or replace function public.complete_customer_initial_password_change(p_customer_id uuid) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_admin_id uuid;
begin
  select personal_admin_id into v_admin_id from public.personal_admin_customer_details where customer_id = p_customer_id;
  if not found then raise exception 'Customer account is not managed through Personal Admin creation' using errcode = 'P0002'; end if;
  update public.customer_initial_password_requirements set password_change_required = false, completed_at = now(), completed_by = p_customer_id where customer_id = p_customer_id and password_change_required is true;
  if not found then raise exception 'Initial password change is not required' using errcode = 'P0001'; end if;
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata) values (p_customer_id, v_admin_id, p_customer_id, 'customer_initial_password_changed', jsonb_build_object('method', 'customer_self_service'));
  return jsonb_build_object('customer_id', p_customer_id, 'password_change_required', false);
end;
$$;
revoke all on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) to service_role;
revoke all on function public.complete_customer_initial_password_change(uuid) from public, anon, authenticated;
grant execute on function public.complete_customer_initial_password_change(uuid) to service_role;

-- 202610280004_personal_admin_customer_lifecycle.sql
alter table public.personal_admin_customer_details add column if not exists avatar_url text;
create table if not exists public.personal_admin_customer_activity (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists personal_admin_customer_activity_customer_idx on public.personal_admin_customer_activity(customer_id, created_at desc);
alter table public.personal_admin_customer_activity enable row level security;
drop policy if exists "customers read own lifecycle activity" on public.personal_admin_customer_activity;
create policy "customers read own lifecycle activity" on public.personal_admin_customer_activity for select to authenticated using (customer_id = auth.uid());
grant select, insert on public.personal_admin_customer_activity to service_role;
create or replace function public.update_personal_admin_customer_lifecycle(
  p_personal_admin_id uuid, p_customer_id uuid, p_full_name text, p_phone text,
  p_country text, p_account_type text, p_address text, p_account_status text
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_admin public.personal_admin_profiles; v_email text; v_status text := lower(trim(p_account_status));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_personal_admin_assignments where customer_id = p_customer_id and personal_admin_id = p_personal_admin_id) then raise exception 'Customer is outside this Personal Admin portfolio' using errcode = '42501'; end if;
  if char_length(trim(p_full_name)) not between 2 and 120 or char_length(trim(coalesce(p_phone,''))) > 40 or char_length(trim(coalesce(p_country,''))) > 80 or char_length(trim(coalesce(p_address,''))) > 500 or lower(trim(p_account_type)) not in ('personal','business') or v_status not in ('active','suspended') then raise exception 'Invalid customer lifecycle input' using errcode = '22023'; end if;
  select username into v_email from public.profiles where id = p_customer_id for update;
  if not found then raise exception 'Customer profile not found' using errcode = 'P0002'; end if;
  update public.profiles set account_status = v_status where id = p_customer_id;
  update public.personal_admin_customer_details set full_name = trim(p_full_name), phone = trim(coalesce(p_phone,'')), country = trim(coalesce(p_country,'')), account_type = lower(trim(p_account_type)), address = trim(coalesce(p_address,'')), updated_at = now() where customer_id = p_customer_id;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata) values (p_personal_admin_id, p_customer_id, p_personal_admin_id, 'customer_lifecycle_updated', jsonb_build_object('account_status',v_status));
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata) values (p_personal_admin_id,p_personal_admin_id,p_customer_id,'personal_admin_customer_lifecycle_updated',jsonb_build_object('account_status',v_status));
  return jsonb_build_object('customer_id',p_customer_id,'email',v_email,'account_status',v_status);
end;
$$;
revoke all on function public.update_personal_admin_customer_lifecycle(uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_personal_admin_customer_lifecycle(uuid,uuid,text,text,text,text,text,text) to service_role;

commit;
