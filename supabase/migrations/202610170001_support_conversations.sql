-- Aurex Bank support conversations. Additive, private, and safe for existing accounts.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Support request',
  customer_language text not null default 'en' check (customer_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_role text not null check (sender_role in ('customer', 'admin')),
  original_text text not null default '',
  original_language text not null default 'en' check (original_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now()
);

create table if not exists public.support_message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages(id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  translated_text text,
  provider text not null default 'deepl',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, target_language)
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_customer_updated_idx on public.support_conversations (customer_id, updated_at desc);
create index if not exists support_messages_conversation_created_idx on public.support_messages (conversation_id, created_at asc);
create index if not exists support_translations_message_target_idx on public.support_message_translations (message_id, target_language);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_message_translations enable row level security;
alter table public.support_attachments enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Browser clients can only read their own conversation graph. All writes and
-- administrator access are authenticated and authorized in server route handlers.
drop policy if exists "Customers read own support conversations" on public.support_conversations;
create policy "Customers read own support conversations" on public.support_conversations for select to authenticated using (customer_id = auth.uid());
drop policy if exists "Customers read own support messages" on public.support_messages;
create policy "Customers read own support messages" on public.support_messages for select to authenticated using (exists (select 1 from public.support_conversations c where c.id = conversation_id and c.customer_id = auth.uid()));
drop policy if exists "Customers read own support translations" on public.support_message_translations;
create policy "Customers read own support translations" on public.support_message_translations for select to authenticated using (exists (select 1 from public.support_messages m join public.support_conversations c on c.id = m.conversation_id where m.id = message_id and c.customer_id = auth.uid()));
drop policy if exists "Customers read own support attachments" on public.support_attachments;
create policy "Customers read own support attachments" on public.support_attachments for select to authenticated using (exists (select 1 from public.support_messages m join public.support_conversations c on c.id = m.conversation_id where m.id = support_attachments.message_id and c.customer_id = auth.uid()));

-- Enable realtime after applying this migration in Supabase.
alter publication supabase_realtime add table public.support_conversations;
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_message_translations;
