-- Customer notifications recorded in the same transaction as virtual settlement.
begin;
create or replace function public.process_verified_virtual_transfer(p_sender_id uuid, p_challenge_id uuid, p_idempotency_key uuid)
returns public.virtual_transfers language plpgsql security definer set search_path = public, auth as $$
declare c public.transfer_authorization_challenges; s public.profiles; r public.profiles; t public.virtual_transfers; first_account uuid; second_account uuid;
begin
  select * into t from public.virtual_transfers where sender_id = p_sender_id and idempotency_key = p_idempotency_key; if found then return t; end if;
  select * into c from public.transfer_authorization_challenges where id = p_challenge_id and sender_id = p_sender_id for update;
  if not found or c.idempotency_key <> p_idempotency_key then raise exception 'Transfer authorization was not found' using errcode = 'P0002'; end if;
  select * into t from public.virtual_transfers where sender_id = p_sender_id and idempotency_key = p_idempotency_key; if found then return t; end if;
  if c.status <> 'verified' or c.expires_at <= now() then raise exception 'A current verified OTP is required' using errcode = '42501'; end if;
  first_account := least(c.sender_id, c.recipient_id); second_account := greatest(c.sender_id, c.recipient_id);
  perform 1 from public.profiles where id = first_account for update; if not found then raise exception 'Sender or recipient profile was not found' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = second_account for update; if not found then raise exception 'Sender or recipient profile was not found' using errcode = 'P0002'; end if;
  select * into s from public.profiles where id = c.sender_id; select * into r from public.profiles where id = c.recipient_id;
  if s.account_status <> 'active' or r.account_status <> 'active' then raise exception 'Both accounts must be active' using errcode = '42501'; end if;
  if s.currency <> c.currency or r.currency <> c.currency then raise exception 'Currency mismatch' using errcode = '22023'; end if;
  if s.balance < c.amount then raise exception 'Insufficient available balance' using errcode = 'P0001'; end if;
  update public.profiles set balance = balance - c.amount, updated_at = now() where id = s.id; update public.profiles set balance = balance + c.amount, updated_at = now() where id = r.id;
  insert into public.virtual_transfers(sender_id,recipient_id,challenge_id,idempotency_key,amount,currency,memo) values(c.sender_id,c.recipient_id,c.id,c.idempotency_key,c.amount,c.currency,c.memo) returning * into t;
  insert into public.virtual_transfer_ledger(transfer_id,account_id,direction,amount,currency) values(t.id,c.sender_id,'debit',c.amount,c.currency),(t.id,c.recipient_id,'credit',c.amount,c.currency);
  update public.transfer_authorization_challenges set status = 'consumed', consumed_at = now() where id = c.id;
  insert into public.notifications(username,message) values (s.username, format('Internal transfer of %s %s completed. Receipt %s.', t.currency, t.amount, t.id)), (r.username, format('Internal transfer of %s %s received. Receipt %s.', t.currency, t.amount, t.id));
  insert into public.personal_admin_audit_log(actor_id,target_user_id,action,metadata) values (c.sender_id,c.recipient_id,'virtual_transfer_completed',jsonb_build_object('transfer_id',t.id,'amount',t.amount,'currency',t.currency));
  return t;
end; $$;
commit;
