-- Reversible document lifecycle controls. Apply after customer-records migration.
begin;

alter table public.personal_admin_customer_documents
  add column if not exists expires_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists personal_admin_customer_documents_active_customer_idx
  on public.personal_admin_customer_documents(customer_id, created_at desc)
  where deleted_at is null;

commit;
