-- Preserve cents for Personal Admin opening balances and adjustments.
-- Existing integer balances retain their exact whole-dollar value.
begin;

alter table public.profiles
  alter column balance type numeric(18,2) using balance::numeric(18,2),
  alter column balance set default 0;

commit;
