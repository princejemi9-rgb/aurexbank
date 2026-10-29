-- Tenant-scoped customer records for Personal Admin operations. Apply to staging first.
begin;

create table if not exists public.personal_admin_customer_notes (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists personal_admin_customer_notes_customer_idx on public.personal_admin_customer_notes(customer_id, created_at desc);

create table if not exists public.personal_admin_customer_verifications (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_admin_customer_documents (
  id uuid primary key default gen_random_uuid(),
  personal_admin_id uuid not null references public.personal_admin_profiles(user_id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('identity', 'address', 'transaction_support', 'account_other')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);
create index if not exists personal_admin_customer_documents_customer_idx on public.personal_admin_customer_documents(customer_id, created_at desc);

alter table public.personal_admin_customer_notes enable row level security;
alter table public.personal_admin_customer_verifications enable row level security;
alter table public.personal_admin_customer_documents enable row level security;
create policy "customers read own verification" on public.personal_admin_customer_verifications for select to authenticated using (customer_id = auth.uid());
create policy "customers read own document metadata" on public.personal_admin_customer_documents for select to authenticated using (customer_id = auth.uid());
grant select, insert, update, delete on public.personal_admin_customer_notes, public.personal_admin_customer_verifications, public.personal_admin_customer_documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-documents', 'customer-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.add_personal_admin_customer_note(p_personal_admin_id uuid, p_customer_id uuid, p_note text)
returns public.personal_admin_customer_notes language plpgsql security definer set search_path = public, auth as $$
declare v_admin public.personal_admin_profiles; v_note public.personal_admin_customer_notes;
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_personal_admin_assignments where customer_id = p_customer_id and personal_admin_id = p_personal_admin_id) then raise exception 'Customer is outside this Personal Admin portfolio' using errcode = '42501'; end if;
  insert into public.personal_admin_customer_notes(personal_admin_id, customer_id, note) values (p_personal_admin_id, p_customer_id, trim(p_note)) returning * into v_note;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata) values (p_personal_admin_id, p_customer_id, p_personal_admin_id, 'customer_note_added', jsonb_build_object('note_id', v_note.id));
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata) values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_note_added', jsonb_build_object('note_id', v_note.id));
  return v_note;
end;
$$;

create or replace function public.update_personal_admin_customer_verification(p_personal_admin_id uuid, p_customer_id uuid, p_status text, p_review_note text)
returns public.personal_admin_customer_verifications language plpgsql security definer set search_path = public, auth as $$
declare v_admin public.personal_admin_profiles; v_record public.personal_admin_customer_verifications; v_status text := lower(trim(p_status));
begin
  select * into v_admin from public.personal_admin_profiles where user_id = p_personal_admin_id for update;
  if not found or v_admin.status <> 'approved' or coalesce((v_admin.permissions ->> 'manage_customers')::boolean, false) is not true then raise exception 'Customer-management permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_personal_admin_assignments where customer_id = p_customer_id and personal_admin_id = p_personal_admin_id) then raise exception 'Customer is outside this Personal Admin portfolio' using errcode = '42501'; end if;
  if v_status not in ('pending', 'verified', 'rejected') or char_length(trim(coalesce(p_review_note, ''))) > 1000 then raise exception 'Invalid verification update' using errcode = '22023'; end if;
  insert into public.personal_admin_customer_verifications(customer_id, personal_admin_id, status, review_note, reviewed_by, reviewed_at) values (p_customer_id, p_personal_admin_id, v_status, trim(coalesce(p_review_note, '')), p_personal_admin_id, now()) on conflict (customer_id) do update set personal_admin_id = excluded.personal_admin_id, status = excluded.status, review_note = excluded.review_note, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, updated_at = now() returning * into v_record;
  insert into public.personal_admin_customer_activity(personal_admin_id, customer_id, actor_id, action, metadata) values (p_personal_admin_id, p_customer_id, p_personal_admin_id, 'customer_verification_updated', jsonb_build_object('status', v_status));
  insert into public.personal_admin_audit_log(actor_id, personal_admin_id, target_user_id, action, metadata) values (p_personal_admin_id, p_personal_admin_id, p_customer_id, 'personal_admin_customer_verification_updated', jsonb_build_object('status', v_status));
  return v_record;
end;
$$;

revoke all on function public.add_personal_admin_customer_note(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.add_personal_admin_customer_note(uuid, uuid, text) to service_role;
revoke all on function public.update_personal_admin_customer_verification(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_personal_admin_customer_verification(uuid, uuid, text, text) to service_role;
commit;
