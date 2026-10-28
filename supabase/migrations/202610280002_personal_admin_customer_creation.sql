-- Personal Admin customer invitations. This is additive and is intended for
-- staging first. Authentication is created by the server route; this function
-- atomically creates the associated tenant-scoped banking records.
begin;

create table if not exists public.personal_admin_customer_details (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  country text not null default '' check (char_length(country) <= 80),
  account_type text not null default 'personal' check (account_type in ('personal', 'business')),
  address text not null default '' check (char_length(address) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_admin_customer_details enable row level security;
drop policy if exists "customers read own personal-admin details" on public.personal_admin_customer_details;
create policy "customers read own personal-admin details"
  on public.personal_admin_customer_details for select to authenticated
  using (customer_id = auth.uid());
grant select, insert, update, delete on public.personal_admin_customer_details to service_role;

create or replace function public.create_personal_admin_customer_account(
  p_personal_admin_id uuid,
  p_customer_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_country text,
  p_account_type text,
  p_address text
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin public.personal_admin_profiles;
  v_email text := lower(trim(p_email));
  v_full_name text := trim(p_full_name);
  v_phone text := trim(coalesce(p_phone, ''));
  v_country text := trim(coalesce(p_country, ''));
  v_account_type text := lower(trim(coalesce(p_account_type, 'personal')));
  v_address text := trim(coalesce(p_address, ''));
begin
  select * into v_admin from public.personal_admin_profiles
    where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved'
    or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then
    raise exception 'Customer-management permission required' using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or char_length(v_full_name) not between 2 and 120
    or char_length(v_phone) > 40 or char_length(v_country) > 80
    or char_length(v_address) > 500 or v_account_type not in ('personal', 'business') then
    raise exception 'Invalid customer account details' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_customer_id and lower(coalesce(email, '')) = v_email) then
    raise exception 'Invited customer authentication record was not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = p_customer_id or lower(username) = v_email) then
    raise exception 'A customer account already exists for this email address' using errcode = '23505';
  end if;

  insert into public.profiles (id, username, balance, currency, account_status)
    values (p_customer_id, v_email, 0, 'USD', 'active');
  insert into public.personal_admin_customer_details (
    customer_id, personal_admin_id, full_name, phone, country, account_type, address
  ) values (
    p_customer_id, p_personal_admin_id, v_full_name, v_phone, v_country, v_account_type, v_address
  );
  insert into public.customer_personal_admin_assignments (
    customer_id, personal_admin_id, referral_code, assigned_by
  ) values (p_customer_id, p_personal_admin_id, v_admin.referral_code, p_personal_admin_id);
  insert into public.personal_admin_referrals (personal_admin_id, customer_id, referral_code)
    values (p_personal_admin_id, p_customer_id, v_admin.referral_code);
  insert into public.personal_admin_audit_log (
    actor_id, personal_admin_id, target_user_id, action, metadata
  ) values (
    p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_invited',
    jsonb_build_object('account_type', v_account_type, 'country', v_country, 'referral_code', v_admin.referral_code)
  );
  return jsonb_build_object('customer_id', p_customer_id, 'email', v_email, 'referral_code', v_admin.referral_code);
end;
$$;

revoke all on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) to service_role;

commit;
