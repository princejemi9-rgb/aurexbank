-- Tenant-scoped customer lifecycle foundation. Apply to staging only.
begin;

alter table public.personal_admin_customer_details
  add column if not exists avatar_url text;

create table if not exists public.personal_admin_customer_activity (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists personal_admin_customer_activity_customer_idx on public.personal_admin_customer_activity(customer_id, created_at desc);
alter table public.personal_admin_customer_activity enable row level security;
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
