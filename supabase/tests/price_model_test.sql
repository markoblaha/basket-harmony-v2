-- Testy modelu cien (migrácie 038–041). Spúšťa sa celé naraz; vloží skúšobný bloček do testovacej domácnosti,
-- overí výpočty a skončí výnimkou TEST_REPORT, takže sa všetko vráti späť (nič sa nemaže). Hľadaj fails=0.
-- Pozor: riadky bločku dostanú výrobok spúšťačom podľa name_key, preto sa výrobky priraďujú až po vložení.
do $$
declare
  h uuid := (select id from public.households where name = 'Testovacia domácnosť (kópia)');
  r uuid := gen_random_uuid();
  pm uuid := gen_random_uuid(); pp uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); pj uuid := gen_random_uuid();
  ok int := 0; fails int := 0; msg text := '';
  f record;
begin
  if public._store_key('LIDL Slovenská republika, v.o.s.') = 'lidl' then ok := ok + 1; else fails := fails + 1; msg := msg || ' store1'; end if;
  if public._store_key('feedo.sk') = 'feedo' then ok := ok + 1; else fails := fails + 1; msg := msg || ' store2'; end if;
  if public._store_key('KRAJ') = public._store_key('Kraj') then ok := ok + 1; else fails := fails + 1; msg := msg || ' store3'; end if;

  insert into public.products (id, household_id, name, product_key, brand, size_value, size_unit, category_id, kind)
  values (pm, h, 'Test maslo', 'zz test maslo', 'ZZTest', 250, 'g', 'dairy_eggs', 'ZZ Maslo'),
         (pp, h, 'Test pivo 6x', 'zz test pivo', 'ZZTest', 6, 'ks', 'alcohol', 'ZZ Pivo'),
         (pb, h, 'Test banány', 'zz test banany', null, null, null, 'produce', 'ZZ Banány'),
         (pj, h, 'Test jogurt', 'zz test jogurt', 'ZZTest', 150, 'g', 'dairy_eggs', 'ZZ Jogurt');
  insert into public.receipts (id, household_id, status, store_name, purchased_on, total, image_path, image_checksum)
  values (r, h, 'OK', 'LIDL Slovenská republika', current_date - 1, 20, 'test/zz.jpg', repeat('a', 64));
  insert into public.receipt_items (receipt_id, household_id, position, raw_name, name_key, quantity, unit, line_total, discount, category_id) values
    (r, h, 1, 'TEST MASLO 250G', 'zz maslo', 2, 'ks', 4.78, 0, 'dairy_eggs'),
    (r, h, 2, 'PLZ 6x', 'zz plz', 6, 'ks', 7.74, 0, 'alcohol'),
    (r, h, 3, 'PLZ 6x', 'zz plz z', 6, 'ks', 0.90, 0, 'alcohol'),
    (r, h, 4, 'BANANY', 'zz banany', 1.236, 'kg', 1.47, 0, 'produce'),
    (r, h, 5, 'TEST JOGURT', 'zz jogurt', 1, 'ks', 0.35, 0.14, 'dairy_eggs'),
    (r, h, 6, 'ZALOHA', 'zz zaloha', 6, 'ks', 0.90, 0, 'deposit');
  update public.receipt_items set product_id = case position when 1 then pm when 2 then pp when 3 then pp when 4 then pb when 5 then pj else null end where receipt_id = r;

  -- kľúč obchodu doplní spúšťač
  if (select store_key from public.receipts where id = r) = 'lidl' then ok := ok + 1; else fails := fails + 1; msg := msg || ' trigger'; end if;
  -- maslo 2 × 250 g = 0,5 kg, 2,39 € za balenie
  select * into f from public._price_facts(h) where item_id = (select id from public.receipt_items where receipt_id = r and position = 1);
  if f.units = 0.5 and f.basis = 'kg' and round(f.price, 2) = 2.39 and f.sized then ok := ok + 1; else fails := fails + 1; msg := msg || ' maslo'; end if;
  -- „PLZ 6x“ s množstvom 6 a balením 6 ks = 6 kusov, nie 36
  select * into f from public._price_facts(h) where item_id = (select id from public.receipt_items where receipt_id = r and position = 2);
  if f.units = 6 then ok := ok + 1; else fails := fails + 1; msg := msg || ' pivo=' || f.units; end if;
  -- záloha pri pive (6 × 0,15) a riadok zálohy nie sú tovar
  if not exists (select 1 from public._price_facts(h) where item_id in (select id from public.receipt_items where receipt_id = r and position in (3, 6))) then ok := ok + 1; else fails := fails + 1; msg := msg || ' zalohy'; end if;
  -- vážené banány 1,236 kg po 1,19 €/kg
  select * into f from public._price_facts(h) where item_id = (select id from public.receipt_items where receipt_id = r and position = 4);
  if f.packs is null and f.units = 1.236 and round(f.price, 2) = 1.19 then ok := ok + 1; else fails := fails + 1; msg := msg || ' banany'; end if;
  -- zľava aspoň 15 % = akcia
  select * into f from public._price_facts(h) where item_id = (select id from public.receipt_items where receipt_id = r and position = 5);
  if f.promo then ok := ok + 1; else fails := fails + 1; msg := msg || ' akcia'; end if;
  if (public._price_kind(h, 'ZZ Maslo') ->> 'avg_unit')::numeric = 9.56 and public._price_kind(h, 'ZZ Maslo') -> 'stores' -> 0 ->> 'key' = 'lidl' then ok := ok + 1; else fails := fails + 1; msg := msg || ' kind'; end if;
  if (public._price_product(pm) -> 'now' ->> 'price')::numeric = 2.39 and (public._price_product(pm) -> 'now' ->> 'unit')::numeric = 9.56 then ok := ok + 1; else fails := fails + 1; msg := msg || ' product'; end if;
  if exists (select 1 from jsonb_array_elements(public._price_kind(h, 'ZZ Maslo') -> 'products') x where (x ->> 'price')::numeric = 2.39) then ok := ok + 1; else fails := fails + 1; msg := msg || ' products'; end if;
  if (public._price_store(h, 'lidl') @> '[{"name": "ZZ Maslo"}]') then ok := ok + 1; else fails := fails + 1; msg := msg || ' store'; end if;
  if (public._price_kind(h, 'ZZ Pivo') ->> 'basis') = 'ks' and (public._price_kind(h, 'ZZ Pivo') ->> 'avg_unit')::numeric = 1.29 then ok := ok + 1; else fails := fails + 1; msg := msg || ' pivokind'; end if;
  -- výrobok bez veľkosti balenia nie je v cene za kg
  update public.products set size_value = null, size_unit = null where id = pm;
  if (select bool_and(not sized) from public._price_facts(h) where product_id = pm) then ok := ok + 1; else fails := fails + 1; msg := msg || ' nosize'; end if;

  -- oblečenie sa za kus neporovnáva (len cena za kus, nie v porovnaní obchodov)
  update public.products set category_id = 'clothing' where id = pj;
  update public.receipt_items set category_id = 'clothing' where receipt_id = r and position = 5;
  if public._price_kind(h, 'ZZ Jogurt') ->> 'avg_unit' is null and not (public._price_store(h, 'lidl') @> '[{"name": "ZZ Jogurt"}]') then ok := ok + 1; else fails := fails + 1; msg := msg || ' comparable'; end if;

  raise exception 'TEST_REPORT ok=% fails=% %', ok, fails, msg;
end $$;
