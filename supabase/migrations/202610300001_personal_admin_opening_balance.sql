-- Opening balance support for Personal Admin-created customer accounts.
-- Apply after 202610280003_personal_admin_initial_password.sql.
begin;

create or replace function public.create_personal_admin_customer_account(
  p_personal_admin_id uuid,
  p_customer_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_country text,
  p_account_type text,
  p_address text,
  p_opening_balance numeric default 0
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
  v_opening_balance numeric := coalesce(p_opening_balance, 0);
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then
    raise exception 'Customer-management permission required' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_full_name) not between 2 and 120 or char_length(v_phone) > 40 or char_length(v_country) > 80 or char_length(v_address) > 500 or v_account_type not in ('personal', 'business') or v_opening_balance < 0 or v_opening_balance > 100000 then
    raise exception 'Invalid customer account details' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_customer_id and lower(coalesce(email, '')) = v_email) then
    raise exception 'Created customer authentication record was not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = p_customer_id or lower(username) = v_email) then
    raise exception 'A customer account already exists for this email address' using errcode = '23505';
  end if;

  insert into public.profiles (id, username, balance, currency, account_status) values (p_customer_id, v_email, v_opening_balance, 'USD', 'active');
  insert into public.personal_admin_customer_details (customer_id, personal_admin_id, full_name, phone, country, account_type, address) values (p_customer_id, p_personal_admin_id, v_full_name, v_phone, v_country, v_account_type, v_address);
  insert into public.customer_personal_admin_assignments (customer_id, personal_admin_id, referral_code, assigned_by) values (p_customer_id, p_personal_admin_id, v_admin.referral_code, p_personal_admin_id);
  insert into public.personal_admin_referrals (personal_admin_id, customer_id, referral_code) values (p_personal_admin_id, p_customer_id, v_admin.referral_code);
  insert into public.customer_initial_password_requirements (customer_id) values (p_customer_id);
  if to_regclass('public.customer_financial_profiles') is not null then
    execute 'insert into public.customer_financial_profiles (customer_id, currency) values ($1, $2) on conflict (customer_id) do nothing' using p_customer_id, 'USD';
  end if;
  insert into public.personal_admin_customer_activity (personal_admin_id, customer_id, actor_id, action, metadata)
    values (p_personal_admin_id, p_customer_id, p_personal_admin_id, 'customer_account_created', jsonb_build_object('opening_balance', v_opening_balance, 'currency', 'USD'));
  insert into public.personal_admin_audit_log (actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_created', jsonb_build_object('account_type', v_account_type, 'country', v_country, 'referral_code', v_admin.referral_code, 'opening_balance', v_opening_balance, 'currency', 'USD', 'email_verification', 'administratively_confirmed_not_proof_of_ownership', 'initial_password_change_required', true));
  return jsonb_build_object('customer_id', p_customer_id, 'email', v_email, 'referral_code', v_admin.referral_code, 'opening_balance', v_opening_balance, 'currency', 'USD');
end;
$$;

revoke all on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.create_personal_admin_customer_account(uuid, uuid, text, text, text, text, text, text, numeric) to service_role;
commit;
