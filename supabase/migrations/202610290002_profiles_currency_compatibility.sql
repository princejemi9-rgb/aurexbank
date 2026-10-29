-- Compatibility migration for established Aurex deployments that predate the
-- currency column used by Personal Admin customer creation.
begin;

alter table public.profiles
  add column if not exists currency text not null default 'USD';

update public.profiles set currency = 'USD' where currency is null or currency !~ '^[A-Z]{3}$';

do $$
begin
  alter table public.profiles
    add constraint profiles_currency_format_check check (currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null;
end;
$$;

commit;
