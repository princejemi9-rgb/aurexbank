-- Server support routes use the service role after authenticating and
-- authorizing the caller. These grants do not add browser access.
begin;

grant select, insert, update, delete on public.support_conversations to service_role;
grant select, insert, update, delete on public.support_messages to service_role;
grant select, insert, update, delete on public.support_message_translations to service_role;
grant select, insert, update, delete on public.support_attachments to service_role;

commit;
