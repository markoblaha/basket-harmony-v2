-- Označenie bločku ako nečitateľného a potvrdenie po kontrole.
create function public.fail_receipt(p_receipt_id uuid, p_error text)
returns void language sql security definer set search_path = '' as $$
  update public.receipts
     set status = 'FAILED', error_text = left(p_error, 500), review_reason = null
   where id = p_receipt_id;
$$;

revoke execute on function public.fail_receipt(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_receipt(uuid, text) to service_role;

-- Člen domácnosti po kontrole potvrdí, že bloček je v poriadku (aj keď súčet
-- nesedí, napr. kvôli zaokrúhleniu alebo nečitateľnej položke).
create function public.confirm_receipt(p_receipt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.receipts;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.status = 'PROCESSING' then raise exception 'VALIDATION'; end if;
  update public.receipts set status = 'OK', review_reason = null, error_text = null
   where id = p_receipt_id;
end $$;
revoke execute on function public.confirm_receipt(uuid) from public, anon;
grant execute on function public.confirm_receipt(uuid) to authenticated;
