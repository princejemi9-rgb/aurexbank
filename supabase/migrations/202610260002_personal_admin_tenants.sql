-- Additive personal-admin tenancy. Existing customers retain the default brand.
create table if not exists public.personal_admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, email text not null unique, phone text not null default '',
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','suspended')),
  referral_code text not null unique,
  permissions jsonb not null default '{"manage_customers":true,"manage_support":true,"manage_reports":true}'::jsonb,
  approved_by uuid references auth.users(id), approved_at timestamptz, last_login_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.customer_personal_admin_assignments (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  referral_code text, assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(), reassigned_at timestamptz,
  constraint customer_assignment_not_self check (customer_id <> personal_admin_id)
);
create table if not exists public.personal_admin_branding (
  personal_admin_id uuid primary key references public.personal_admin_profiles(user_id) on delete cascade,
  configuration jsonb not null, version integer not null default 1, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.personal_admin_referrals (
  id uuid primary key default gen_random_uuid(), personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete cascade,
  customer_id uuid not null unique references auth.users(id) on delete cascade, referral_code text not null, registered_at timestamptz not null default now()
);
create table if not exists public.personal_admin_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), personal_admin_id uuid references public.personal_admin_profiles(user_id) on delete set null,
  action text not null, target_user_id uuid references auth.users(id) on delete set null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists customer_personal_admin_assignments_admin_idx on public.customer_personal_admin_assignments(personal_admin_id);
alter table public.personal_admin_profiles enable row level security;
alter table public.customer_personal_admin_assignments enable row level security;
alter table public.personal_admin_branding enable row level security;
alter table public.personal_admin_referrals enable row level security;
alter table public.personal_admin_audit_log enable row level security;
create policy "personal admins read own profile" on public.personal_admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "customers read own assignment" on public.customer_personal_admin_assignments for select to authenticated using (customer_id = auth.uid());
create policy "personal admins read own brand" on public.personal_admin_branding for select to authenticated using (personal_admin_id = auth.uid());
create policy "customers read assigned brand" on public.personal_admin_branding for select to authenticated using (personal_admin_id in (select personal_admin_id from public.customer_personal_admin_assignments where customer_id = auth.uid()));
create policy "personal admins read own referrals" on public.personal_admin_referrals for select to authenticated using (personal_admin_id = auth.uid());
create policy "personal admins read own audit" on public.personal_admin_audit_log for select to authenticated using (personal_admin_id = auth.uid());
grant select on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to authenticated;
-- Server-side management routes use the service role. RLS is still enforced
-- for browser clients; these grants do not expose privileged writes publicly.
grant select, insert, update, delete on public.personal_admin_profiles, public.customer_personal_admin_assignments, public.personal_admin_branding, public.personal_admin_referrals, public.personal_admin_audit_log to service_role;
