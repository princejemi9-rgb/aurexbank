-- Tenant-scoped customer operational requests. This workflow records and
-- reviews requests; it does not execute a financial transfer or change a
-- balance. Apply to staging before deploying the related UI and API routes.
begin;

create table if not exists public.personal_admin_transaction_requests (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('transfer_review', 'balance_inquiry', 'account_service')),
  amount numeric(18,2) check (amount is null or (amount > 0 and amount <= 100000)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(description) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'escalated')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_review_consistency check ((status = 'pending' and reviewed_by is null and reviewed_at is null) or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists personal_admin_transaction_requests_admin_status_idx on public.personal_admin_transaction_requests(personal_admin_id, status, created_at desc);
create index if not exists personal_admin_transaction_requests_customer_idx on public.personal_admin_transaction_requests(customer_id, created_at desc);
alter table public.personal_admin_transaction_requests enable row level security;
drop policy if exists "customers read own personal admin requests" on public.personal_admin_transaction_requests;
create policy "customers read own personal admin requests" on public.personal_admin_transaction_requests for select to authenticated using (customer_id = auth.uid());
grant select, insert, update on public.personal_admin_transaction_requests to service_role;

create or replace function public.submit_customer_personal_admin_request(
  p_customer_id uuid, p_request_type text, p_amount numeric, p_currency text, p_description text
) returns public.personal_admin_transaction_requests
language plpgsql security definer set search_path = public, auth as $$
declare
  v_assignment public.customer_personal_admin_assignments;
  v_profile public.profiles;
  v_request public.personal_admin_transaction_requests;
  v_type text := lower(trim(p_request_type));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_description text := trim(p_description);
begin
  select * into v_profile from public.profiles where id = p_customer_id for update;
  if not found or v_profile.account_status <> 'active' then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;
  select * into v_assignment from public.customer_personal_admin_assignments where customer_id = p_customer_id;
  if not found then
    raise exception 'No Personal Admin is assigned to this account' using errcode = 'P0002';
  end if;
  if v_type not in ('transfer_review', 'balance_inquiry', 'account_service') or char_length(v_description) not between 3 and 1000 then
    raise exception 'Invalid request details' using errcode = '22023';
  end if;
  if v_type = 'transfer_review' and (p_amount is null or p_amount <= 0 or p_amount > 100000 or v_currency !~ '^[A-Z]{3}$') then
    raise exception 'A valid requested amount and currency are required for transfer review' using errcode = '22023';
  end if;
  if v_type <> 'transfer_review' and p_amount is not null then
    raise exception 'Only transfer reviews may include an amount' using errcode = '22023';
  end if;
  insert into public.personal_admin_transaction_requests(personal_admin_id, customer_id, request_type, amount, currency, description)
    values (v_assignment.personal_admin_id, p_customer_id, v_type, p_amount, nullif(v_currency, ''), v_description)
    returning * into v_request;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata)
    values (v_assignment.personal_admin_id, p_customer_id, p_customer_id, 'customer_transaction_request_submitted', jsonb_build_object('request_id', v_request.id, 'request_type', v_type));
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_customer_id, v_assignment.personal_admin_id, p_customer_id, 'customer_transaction_request_submitted', jsonb_build_object('request_id', v_request.id, 'request_type', v_type));
  return v_request;
end;
$$;

create or replace function public.review_personal_admin_transaction_request(
  p_personal_admin_id uuid, p_request_id uuid, p_status text, p_review_note text
) returns public.personal_admin_transaction_requests
language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin public.personal_admin_profiles;
  v_request public.personal_admin_transaction_requests;
  v_status text := lower(trim(p_status));
  v_note text := trim(coalesce(p_review_note, ''));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then
    raise exception 'Customer-management permission required' using errcode = '42501';
  end if;
  select * into v_request from public.personal_admin_transaction_requests where id = p_request_id for update;
  if not found or v_request.personal_admin_id <> p_personal_admin_id then
    raise exception 'Request is outside this Personal Admin portfolio' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Only pending requests can be reviewed' using errcode = 'P0001';
  end if;
  if v_status not in ('approved', 'rejected', 'escalated') or char_length(v_note) > 1000 then
    raise exception 'Invalid request review' using errcode = '22023';
  end if;
  update public.personal_admin_transaction_requests
    set status = v_status, review_note = v_note, reviewed_by = p_personal_admin_id, reviewed_at = now(), updated_at = now()
    where id = p_request_id returning * into v_request;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata)
    values (p_personal_admin_id, v_request.customer_id, p_personal_admin_id, 'customer_transaction_request_reviewed', jsonb_build_object('request_id', v_request.id, 'status', v_status));
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata)
    values (p_personal_admin_id, p_personal_admin_id, v_request.customer_id, 'personal_admin_transaction_request_reviewed', jsonb_build_object('request_id', v_request.id, 'status', v_status));
  return v_request;
end;
$$;

revoke all on function public.submit_customer_personal_admin_request(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.submit_customer_personal_admin_request(uuid, text, numeric, text, text) to service_role;
revoke all on function public.review_personal_admin_transaction_request(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_personal_admin_transaction_request(uuid, uuid, text, text) to service_role;

commit;
