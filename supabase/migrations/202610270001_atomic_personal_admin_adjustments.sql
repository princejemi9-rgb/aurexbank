-- Atomic simulated balance adjustment. Invoked only by the server service role.
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
