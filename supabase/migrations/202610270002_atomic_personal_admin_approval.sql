-- The profile update and audit entry either both commit or neither does.
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
