-- Personal Admin OTP management. Codes are generated server-side, stored only
-- as a digest, expire quickly, and are never written to an audit payload.
begin;

create table if not exists public.personal_admin_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('account_recovery', 'transfer_confirmation')),
  code_salt text not null,
  code_hash text not null,
  status text not null default 'open' check (status in ('open', 'verified', 'expired', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint otp_verified_consistency check ((status = 'verified') = (verified_at is not null))
);
create index if not exists personal_admin_otp_customer_idx on public.personal_admin_otp_challenges(customer_id, created_at desc);
alter table public.personal_admin_otp_challenges enable row level security;
drop policy if exists "customers read own personal admin otp challenges" on public.personal_admin_otp_challenges;
create policy "customers read own personal admin otp challenges" on public.personal_admin_otp_challenges for select to authenticated using (customer_id = auth.uid());
grant select, insert, update on public.personal_admin_otp_challenges to service_role;

create or replace function public.issue_personal_admin_otp(
  p_personal_admin_id uuid, p_customer_id uuid, p_purpose text, p_code_salt text, p_code_hash text
) returns public.personal_admin_otp_challenges
language plpgsql security definer set search_path = public, auth as $$
declare v_admin public.personal_admin_profiles; v_challenge public.personal_admin_otp_challenges; v_purpose text := lower(trim(p_purpose));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_personal_admin_assignments where customer_id = p_customer_id and personal_admin_id = p_personal_admin_id) then raise exception 'Customer is outside this Personal Admin portfolio' using errcode = '42501'; end if;
  if v_purpose not in ('account_recovery', 'transfer_confirmation') or char_length(p_code_salt) < 16 or char_length(p_code_hash) <> 64 then raise exception 'Invalid OTP challenge' using errcode = '22023'; end if;
  update public.personal_admin_otp_challenges set status = 'cancelled' where customer_id = p_customer_id and purpose = v_purpose and status = 'open';
  insert into public.personal_admin_otp_challenges(personal_admin_id, customer_id, purpose, code_salt, code_hash, expires_at) values (p_personal_admin_id, p_customer_id, v_purpose, p_code_salt, p_code_hash, now() + interval '10 minutes') returning * into v_challenge;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata) values (p_personal_admin_id,p_customer_id,p_personal_admin_id,'customer_otp_issued',jsonb_build_object('challenge_id',v_challenge.id,'purpose',v_purpose));
  insert into public.personal_admin_audit_log(actor_id,personal_admin_id,target_user_id,action,metadata) values (p_personal_admin_id,p_personal_admin_id,p_customer_id,'personal_admin_otp_issued',jsonb_build_object('challenge_id',v_challenge.id,'purpose',v_purpose));
  return v_challenge;
end;
$$;

create or replace function public.verify_customer_personal_admin_otp(p_customer_id uuid, p_challenge_id uuid, p_code_hash text)
returns public.personal_admin_otp_challenges language plpgsql security definer set search_path = public, auth as $$
declare v_challenge public.personal_admin_otp_challenges;
begin
  select * into v_challenge from public.personal_admin_otp_challenges where id = p_challenge_id and customer_id = p_customer_id for update;
  if not found then raise exception 'OTP challenge not found' using errcode = 'P0002'; end if;
  if v_challenge.status <> 'open' then raise exception 'OTP challenge is no longer active' using errcode = 'P0001'; end if;
  if v_challenge.expires_at <= now() then update public.personal_admin_otp_challenges set status = 'expired' where id = p_challenge_id; raise exception 'OTP challenge has expired' using errcode = 'P0001'; end if;
  if v_challenge.code_hash <> p_code_hash then
    update public.personal_admin_otp_challenges set attempts = attempts + 1, status = case when attempts + 1 >= max_attempts then 'cancelled' else 'open' end where id = p_challenge_id returning * into v_challenge;
    raise exception 'Invalid OTP code' using errcode = '28000';
  end if;
  update public.personal_admin_otp_challenges set status = 'verified', verified_at = now() where id = p_challenge_id returning * into v_challenge;
  insert into public.personal_admin_customer_activity(personal_admin_id,customer_id,actor_id,action,metadata) values (v_challenge.personal_admin_id,p_customer_id,p_customer_id,'customer_otp_verified',jsonb_build_object('challenge_id',p_challenge_id,'purpose',v_challenge.purpose));
  insert into public.personal_admin_audit_log(actor_id,personal_admin_id,target_user_id,action,metadata) values (p_customer_id,v_challenge.personal_admin_id,p_customer_id,'customer_otp_verified',jsonb_build_object('challenge_id',p_challenge_id,'purpose',v_challenge.purpose));
  return v_challenge;
end;
$$;

revoke all on function public.issue_personal_admin_otp(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.issue_personal_admin_otp(uuid,uuid,text,text,text) to service_role;
revoke all on function public.verify_customer_personal_admin_otp(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.verify_customer_personal_admin_otp(uuid,uuid,text) to service_role;
commit;
