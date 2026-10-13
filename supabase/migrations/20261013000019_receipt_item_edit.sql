-- =============================================================================
-- Ručná oprava položiek dokladu + automatické uzavretie kontroly.
--
-- 1) save_receipt_item: zmení alebo pridá položku (názov, cena, množstvo, zľava,
--    kategória). remove_receipt_item: zmaže položku. Obe prepočítajú items_sum.
-- 2) Keď doklad čaká na kontrolu a človek opraví to, čo kontrola vytkla
--    (sumu, dátum, obchod alebo položky), databáza ho sama uzavrie, ak už
--    nič nevytýka. Tlačidlo "Je to v poriadku" tak treba len pri skutočnom
--    zaokrúhlení alebo nečitateľnej položke.
-- POZOR: obsahuje príkaz `delete` (zmazanie jednej položky dokladu).
-- =============================================================================

-- Prečo by doklad mal čakať na kontrolu (bez hľadania duplicít, ktoré robí čítanie).
create or replace function public._receipt_problem(r public.receipts, n_items int)
returns text language sql immutable set search_path = '' as $$
  select case
    when n_items = 0 then 'NO_ITEMS'
    when r.total is null or r.items_sum is null or abs(r.items_sum - r.total) > 0.05 then 'TOTAL_MISMATCH'
    when r.purchased_on is null or r.purchased_on > current_date + 1 or r.purchased_on < current_date - 548 then 'DATE_SUSPECT'
    when r.store_name is null then 'STORE_MISSING'
    else null
  end
$$;
revoke execute on function public._receipt_problem(public.receipts, int) from public, anon, authenticated;

-- Pri každej zmene dokladu: (a) ručne zmenený obchod prepočíta store_key,
-- (b) čakajúci doklad sa po oprave sám uzavrie alebo ukáže ďalší problém.
create or replace function public.receipts_sync_store_key() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  problem text;
begin
  if new.store_name is distinct from old.store_name then
    new.store_key := case when nullif(trim(new.store_name), '') is null then null
                          else public.name_key(new.store_name) end;
  end if;

  if old.status = 'NEEDS_REVIEW' and new.status = 'NEEDS_REVIEW'
     and new.review_reason in ('NO_ITEMS', 'TOTAL_MISMATCH', 'DATE_SUSPECT', 'STORE_MISSING')
     and (new.store_name, new.purchased_on, new.total, new.items_sum)
         is distinct from (old.store_name, old.purchased_on, old.total, old.items_sum) then
    select count(*) into n from public.receipt_items where receipt_id = new.id;
    problem := public._receipt_problem(new, n);
    if problem is null then
      new.status := 'OK';
      new.review_reason := null;
    else
      new.review_reason := problem;
    end if;
  end if;
  return new;
end $$;

-- Pridá (p_item_id je null) alebo zmení položku. Vráti aktualizovaný doklad.
create or replace function public.save_receipt_item(
  p_receipt_id  uuid,
  p_item_id     uuid,
  p_name        text,
  p_line_total  numeric,
  p_quantity    numeric default 1,
  p_discount    numeric default 0,
  p_category_id text default 'other'
) returns public.receipts
language plpgsql security definer set search_path = '' as $$
declare
  r public.receipts;
  v_name text := left(nullif(trim(p_name), ''), 200);
  v_qty numeric := coalesce(p_quantity, 1);
  v_disc numeric := coalesce(p_discount, 0);
  v_cat text := coalesce(p_category_id, 'other');
  v_pos int;
  v_sum numeric(10, 2);
  v_unit_price numeric;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('OK', 'NEEDS_REVIEW') then raise exception 'VALIDATION'; end if;
  if v_name is null or p_line_total is null or abs(p_line_total) >= 100000
     or v_qty <= 0 or v_qty >= 100000 or v_disc < 0 or v_disc >= 100000 then
    raise exception 'VALIDATION';
  end if;
  if not exists (select 1 from public.categories where id = v_cat) then v_cat := 'other'; end if;
  v_unit_price := case when v_qty <> 1 then round((p_line_total + v_disc) / v_qty, 3) else null end;

  if p_item_id is null then
    select coalesce(max(position), 0) + 1 into v_pos from public.receipt_items where receipt_id = p_receipt_id;
    insert into public.receipt_items
      (receipt_id, household_id, position, raw_name, name_key, quantity, unit_price, line_total, discount, category_id)
    values
      (p_receipt_id, r.household_id, v_pos, v_name, public.name_key(v_name), v_qty, v_unit_price,
       p_line_total, v_disc, v_cat);
  else
    update public.receipt_items set
      raw_name = v_name, name_key = public.name_key(v_name), quantity = v_qty, unit_price = v_unit_price,
      line_total = p_line_total, discount = v_disc, category_id = v_cat
    where id = p_item_id and receipt_id = p_receipt_id;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;

  select coalesce(sum(line_total), 0) into v_sum from public.receipt_items where receipt_id = p_receipt_id;
  update public.receipts set items_sum = v_sum where id = p_receipt_id returning * into r;
  return r;
end $$;

-- Zmaže jednu položku. Vráti aktualizovaný doklad.
create or replace function public.remove_receipt_item(p_item_id uuid)
returns public.receipts
language plpgsql security definer set search_path = '' as $$
declare
  it public.receipt_items;
  r public.receipts;
  v_sum numeric(10, 2);
begin
  perform public._require_uid();
  select * into it from public.receipt_items where id = p_item_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into r from public.receipts where id = it.receipt_id for update;
  if not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('OK', 'NEEDS_REVIEW') then raise exception 'VALIDATION'; end if;

  delete from public.receipt_items where id = p_item_id;

  select coalesce(sum(line_total), 0) into v_sum from public.receipt_items where receipt_id = r.id;
  update public.receipts set items_sum = v_sum where id = r.id returning * into r;
  return r;
end $$;

revoke execute on function public.save_receipt_item(uuid, uuid, text, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.save_receipt_item(uuid, uuid, text, numeric, numeric, numeric, text) to authenticated;
revoke execute on function public.remove_receipt_item(uuid) from public, anon;
grant execute on function public.remove_receipt_item(uuid) to authenticated;
