-- Personal Admin registrations are active immediately. Super Admins retain
-- suspension, permission, tenant-assignment, branding, and audit oversight.
begin;

alter table public.personal_admin_profiles
  alter column status set default 'approved';

create or replace function public.register_active_personal_admin_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_referral_code text
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

  insert into public.personal_admin_audit_log (
    actor_id, personal_admin_id, action, metadata
  ) values (
    p_user_id, p_user_id, 'personal_admin_auto_approved',
    jsonb_build_object('approval_mode', 'automatic')
  );

  return v_profile;
end;
$$;

revoke all on function public.register_active_personal_admin_profile(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_active_personal_admin_profile(uuid, text, text, text, text) to service_role;

-- Existing pending applications become active once. The audit record makes
-- the policy-driven activation visible to Super Admins without impersonating
-- a human approver.
with activated as (
  update public.personal_admin_profiles
    set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
    where status = 'pending_approval'
    returning user_id
)
insert into public.personal_admin_audit_log (
  actor_id, personal_admin_id, action, metadata
)
select user_id, user_id, 'personal_admin_auto_approved',
  jsonb_build_object('approval_mode', 'automatic', 'source', 'policy_migration')
from activated;

commit;
