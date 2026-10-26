-- Required when 202610260002 was already applied before service-role grants
-- were included. This affects only server-side routes; browser RLS is unchanged.
grant select, insert, update, delete on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to service_role;
