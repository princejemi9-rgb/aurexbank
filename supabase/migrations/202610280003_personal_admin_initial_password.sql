-- Immediate Personal Admin-created accounts. Supabase Auth marks the email
-- confirmed to permit immediate sign-in, while this database record remains
-- authoritative that the address has not been independently verified and that
-- the administrator-provided initial password must be changed.
begin;

create table if not exists public.customer_initial_password_requirements (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  password_change_required boolean not null default true,
  required_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  constraint initial_password_completion_is_self check (completed_by is null or completed_by = customer_id)
);

alter table public.customer_initial_password_requirements enable row level security;
grant select, insert, update, delete on public.customer_initial_password_requirements to service_role;

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
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then
    raise exception 'Customer-management permission required' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_full_name) not between 2 and 120 or char_length(v_phone) > 40 or char_length(v_country) > 80 or char_length(v_address) > 500 or v_account_type not in ('personal', 'business') then
    raise exception 'Invalid customer account details' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_customer_id and lower(coalesce(email, '')) = v_email) then
    raise exception 'Created customer authentication record was not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = p_customer_id or lower(username) = v_email) then
    raise exception 'A customer account already exists for this email address' using errcode = '23505';
  end if;

  insert into public.profiles (id, username, balance, currency, account_status) values (p_customer_id, v_email, 0, 'USD', 'active');
  insert into public.personal_admin_customer_details (customer_id, personal_admin_id, full_name, phone, country, account_type, address) values (p_customer_id, p_personal_admin_id, v_full_name, v_phone, v_country, v_account_type, v_address);
  insert into public.customer_personal_admin_assignments (customer_id, personal_admin_id, referral_code, assigned_by) values (p_customer_id, p_personal_admin_id, v_admin.referral_code, p_personal_admin_id);
  insert into public.personal_admin_referrals (personal_admin_id, customer_id, referral_code) values (p_personal_admin_id, p_customer_id, v_admin.referral_code);
  insert into public.customer_initial_password_requirements (customer_id) values (p_customer_id);
  if to_regclass('public.customer_financial_profiles') is not null then
    execute 'insert into public.customer_financial_profiles (customer_id, currency) values ($1, $2) on conflict (customer_id) do nothing' using p_customer_id, 'USD';
  end if;
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_created', jsonb_build_object('account_type', v_account_type, 'country', v_country, 'referral_code', v_admin.referral_code, 'email_verification', 'administratively_confirmed_not_proof_of_ownership', 'initial_password_change_required', true));
  return jsonb_build_object('customer_id', p_customer_id, 'email', v_email, 'referral_code', v_admin.referral_code);
end;
$$;

create or replace function public.complete_customer_initial_password_change(p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_admin_id uuid;
begin
  select personal_admin_id into v_admin_id from public.personal_admin_customer_details where customer_id = p_customer_id;
  if not found then raise exception 'Customer account is not managed through Personal Admin creation' using errcode = 'P0002'; end if;
  update public.customer_initial_password_requirements set password_change_required = false, completed_at = now(), completed_by = p_customer_id
    where customer_id = p_customer_id and password_change_required is true;
  if not found then raise exception 'Initial password change is not required' using errcode = 'P0001'; end if;
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_customer_id, v_admin_id, p_customer_id, 'customer_initial_password_changed', jsonb_build_object('method', 'customer_self_service'));
  return jsonb_build_object('customer_id', p_customer_id, 'password_change_required', false);
end;
$$;

revoke all on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text) to service_role;
revoke all on function public.complete_customer_initial_password_change(uuid) from public, anon, authenticated;
grant execute on function public.complete_customer_initial_password_change(uuid) to service_role;

commit;
