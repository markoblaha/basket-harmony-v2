-- =============================================================================
-- Uloženie výsledku čítania bločku. Volá ho iba server (Edge Function
-- extract-receipt, rola service_role) – nie aplikácia v prehliadači.
-- Databáza sama rozhodne, či je bloček "v poriadku": súčet položiek musí
-- sedieť s celkovou sumou, dátum musí byť rozumný a bloček nesmie byť duplicitný.
-- =============================================================================
create function public.save_receipt_extraction(p_receipt_id uuid, p_payload jsonb)
returns public.receipts
language plpgsql security definer set search_path = '' as $$
declare
  r public.receipts;
  it jsonb;
  pos int := 0;
  n_items int;
  v_sum numeric(10, 2);
  v_total numeric(10, 2) := nullif(p_payload ->> 'total', '')::numeric;
  v_date date := nullif(p_payload ->> 'purchased_on', '')::date;
  v_time time := nullif(p_payload ->> 'purchased_time', '')::time;
  v_store text := left(nullif(trim(p_payload ->> 'store_name'), ''), 120);
  v_key text;
  v_cat text;
  v_reason text;
  v_dup uuid;
begin
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  delete from public.receipt_items where receipt_id = p_receipt_id;

  for it in select * from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    continue when nullif(trim(it ->> 'name'), '') is null or (it ->> 'line_total') is null;
    pos := pos + 1;
    v_cat := coalesce(it ->> 'category_id', 'other');
    if not exists (select 1 from public.categories where id = v_cat) then v_cat := 'other'; end if;
    insert into public.receipt_items
      (receipt_id, household_id, position, raw_name, name_key, quantity, unit,
       unit_price, line_total, discount, category_id)
    values
      (p_receipt_id, r.household_id, pos,
       left(trim(it ->> 'name'), 200), public.name_key(left(trim(it ->> 'name'), 200)),
       coalesce(nullif(it ->> 'quantity', '')::numeric, 1),
       left(nullif(trim(it ->> 'unit'), ''), 20),
       nullif(it ->> 'unit_price', '')::numeric,
       (it ->> 'line_total')::numeric,
       coalesce(nullif(it ->> 'discount', '')::numeric, 0),
       v_cat);
  end loop;

  select count(*), coalesce(sum(line_total), 0) into n_items, v_sum
    from public.receipt_items where receipt_id = p_receipt_id;
  v_key := case when v_store is null then null else public.name_key(v_store) end;

  if n_items = 0 then
    v_reason := 'NO_ITEMS';
  elsif v_total is null or abs(v_sum - v_total) > 0.05 then
    v_reason := 'TOTAL_MISMATCH';
  elsif v_date is null or v_date > current_date + 1 or v_date < date '2020-01-01' then
    v_reason := 'DATE_SUSPECT';
  else
    select id into v_dup from public.receipts
     where household_id = r.household_id and id <> r.id and status in ('OK', 'NEEDS_REVIEW')
       and store_key is not distinct from v_key and purchased_on = v_date and total = v_total
       and (purchased_time is null or v_time is null or purchased_time = v_time)
     order by created_at limit 1;
    if v_dup is not null then v_reason := 'POSSIBLE_DUPLICATE'; end if;
  end if;

  update public.receipts set
    store_name = v_store, store_key = v_key, purchased_on = v_date, purchased_time = v_time,
    total = v_total, items_sum = v_sum,
    discount_total = nullif(p_payload ->> 'discount_total', '')::numeric,
    currency = coalesce(nullif(upper(p_payload ->> 'currency'), ''), 'EUR'),
    status = case when v_reason is null then 'OK'::public.receipt_status
                  else 'NEEDS_REVIEW'::public.receipt_status end,
    review_reason = v_reason,
    duplicate_of = v_dup,
    error_text = null
  where id = p_receipt_id
  returning * into r;
  return r;
end $$;

revoke execute on function public.save_receipt_extraction(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_receipt_extraction(uuid, jsonb) to service_role;

-- Mazanie bločku (riadok aj fotka): smie ktorýkoľvek člen domácnosti.
grant delete on public.receipts to authenticated;
create policy receipts_delete on public.receipts for delete to authenticated
  using (public.is_member(household_id));
create policy receipts_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
