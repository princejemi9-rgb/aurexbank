-- Compatibility migration for established deployments that predate the
-- account lifecycle state used by Personal Admin customer management.
begin;

alter table public.profiles
  add column if not exists account_status text not null default 'active';

update public.profiles
  set account_status = 'active'
  where account_status is null or account_status not in ('active', 'suspended', 'closed');

do $$
begin
  alter table public.profiles
    add constraint profiles_account_status_check check (account_status in ('active', 'suspended', 'closed'));
exception when duplicate_object then null;
end;
$$;

commit;
