-- Additive audit trail for the global presentation layer. Financial and customer tables are untouched.
create table if not exists public.branding_revisions (
  id bigint generated always as identity primary key,
  version integer not null unique,
  status text not null check (status in ('draft', 'published', 'restored')),
  configuration jsonb not null,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.branding_revisions enable row level security;

-- There is deliberately no client write policy: publication is authorized server-side
-- with the service role and the configured Super Admin allow-list.
drop policy if exists "branding revisions are readable by authenticated users" on public.branding_revisions;
create policy "branding revisions are readable by authenticated users"
  on public.branding_revisions for select to authenticated using (true);

grant select on public.branding_revisions to authenticated;
