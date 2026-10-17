-- Browser reads use the authenticated server endpoint, but retain an explicit
-- customer-only table grant for direct RLS reads and realtime subscriptions.
grant select on public.simulated_historical_transactions to authenticated;
