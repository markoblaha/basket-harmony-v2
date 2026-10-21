-- =============================================================================
-- Test databázových pravidiel na skutočnej databáze.
--
-- Simuluje troch používateľov: Anna a Cyril sú v jednej domácnosti,
-- Boris (útočník) je v inej. Na konci blok VŽDY vyhodí výnimku TEST_REPORT,
-- čím sa celá transakcia vráti späť – v databáze nezostane nič.
-- Spustenie: vložiť celý súbor do SQL editora / execute_sql.
-- Výsledok: chybová správa obsahuje riadky "ok:" a prípadne "FAIL:".
-- =============================================================================
do $test$
declare
  a uuid := gen_random_uuid();  -- Anna  (vlastník domácnosti H)
  b uuid := gen_random_uuid();  -- Boris (iná domácnosť – útočník)
  c uuid := gen_random_uuid();  -- Cyril (pozvaný do H)
  h uuid; hb uuid; l uuid; lb uuid; acc uuid;
  res jsonb; res2 jsonb; inv jsonb; inv2 jsonb;
  s1 public.shopping_sessions; s2 public.shopping_sessions;
  item_id uuid; req_id uuid; n int; n2 int; txt text; err text;
  rc1 uuid; rc2 uuid; rg record; rrec public.receipts; lp uuid; ls uuid; t timestamptz;
  nl uuid; nl2 uuid; it2 uuid;
  report text := '';
  fails int := 0;
begin
  -- ---------------------------------------------------------------- príprava
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'anna@test.invalid',  'authenticated', 'authenticated', '{"display_name":"Anna"}'),
    (b, 'boris@test.invalid', 'authenticated', 'authenticated', '{"display_name":"Boris"}'),
    (c, 'cyril@test.invalid', 'authenticated', 'authenticated', '{}');

  select count(*) into n from public.profiles where id in (a, b, c);
  if n = 3 then report := report || E'ok: profil sa vytvorí pri registrácii\n';
  else report := report || E'FAIL: profily po registrácii\n'; fails := fails + 1; end if;
  select display_name into txt from public.profiles where id = c;
  if txt = 'cyril' then report := report || E'ok: meno z e-mailu, keď nie je zadané\n';
  else report := report || 'FAIL: meno z e-mailu = ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- Anna
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  h := public.create_household('Domácnosť Anny');
  select id into l from public.shopping_lists where household_id = h;
  if l is not null then report := report || E'ok: založenie domácnosti vytvorí aj zoznam\n';
  else report := report || E'FAIL: domácnosť bez zoznamu\n'; fails := fails + 1; end if;
  inv := public.create_invitation(h);
  inv2 := public.create_invitation(h);

  -- ---------------------------------------------------------------- Boris
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  hb := public.create_household('Borisova domácnosť');
  select id into lb from public.shopping_lists where household_id = hb;

  select count(*) into n from public.households where id = h;
  select count(*) into n2 from public.shopping_lists where id = l;
  if n = 0 and n2 = 0 then report := report || E'ok: cudzí nevidí domácnosť ani zoznam\n';
  else report := report || E'FAIL: cudzí vidí cudziu domácnosť\n'; fails := fails + 1; end if;

  select count(*) into n from public.profiles where id = a;
  if n = 0 then report := report || E'ok: cudzí nevidí profil (meno) človeka z inej domácnosti\n';
  else report := report || E'FAIL: profil viditeľný cudziemu\n'; fails := fails + 1; end if;

  err := null;
  begin perform public.add_item(l, 'Útočná položka'); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepridá položku podvrhnutím ID zoznamu\n';
  else report := report || 'FAIL: cudzí add_item -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  err := null;
  begin perform public.create_invitation(h); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: cudzí nevytvorí pozvánku do cudzej domácnosti\n';
  else report := report || 'FAIL: cudzia pozvánka -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  err := null;
  begin perform public.start_shopping(l); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nezačne nákup v cudzom zozname\n';
  else report := report || 'FAIL: cudzí start_shopping -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  err := null;
  begin
    insert into public.shopping_list_items (list_id, household_id, name) values (lb, hb, 'Obchádzka');
  exception when others then err := sqlerrm; end;
  if err like 'permission denied%' then report := report || E'ok: priamy INSERT položky je zakázaný (len cez add_item)\n';
  else report := report || 'FAIL: priamy insert -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  err := null;
  begin
    insert into public.shopping_lists (household_id, name) values (h, 'Podvrhnutý zoznam');
  exception when others then err := sqlerrm; end;
  if err like 'new row violates row-level security%' then report := report || E'ok: cudzí nevloží zoznam do cudzej domácnosti\n';
  else report := report || 'FAIL: cudzí zoznam -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- pozvánky
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.invitation_preview(inv ->> 'token');
  if res ->> 'state' = 'VALID' and res ->> 'invited_by' = 'Anna' then
    report := report || E'ok: náhľad pozvánky (od koho, kam)\n';
  else report := report || 'FAIL: náhľad -> ' || res::text || E'\n'; fails := fails + 1; end if;

  acc := public.accept_invitation(inv ->> 'token');
  select count(*) into n from public.household_members where household_id = h and user_id = c;
  if acc = h and n = 1 then
    report := report || E'ok: prijatie pozvánky\n';
  else report := report || E'FAIL: prijatie pozvánky\n'; fails := fails + 1; end if;
  if public.accept_invitation(inv ->> 'token') = h then
    report := report || E'ok: opakované prijatie tým istým členom nič nepokazí\n';
  else report := report || E'FAIL: opakované prijatie\n'; fails := fails + 1; end if;

  err := null;
  begin perform public.accept_invitation('neexistujuci-token'); exception when others then err := sqlerrm; end;
  if err = 'INVITATION_INVALID' then report := report || E'ok: neplatná pozvánka sa odmietne\n';
  else report := report || 'FAIL: neplatná pozvánka -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  select count(*) into n from public.profiles where id in (a, c);
  if n = 2 then report := report || E'ok: členovia vidia mená navzájom\n';
  else report := report || E'FAIL: členovia nevidia mená\n'; fails := fails + 1; end if;

  -- Boris skúsi použiť už použitú pozvánku a potom vypršanú
  execute 'reset role';
  update public.household_invitations set expires_at = now() - interval '1 minute'
   where token_hash = encode(sha256(convert_to(inv2 ->> 'token', 'UTF8')), 'hex');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.accept_invitation(inv ->> 'token'); exception when others then err := sqlerrm; end;
  if err = 'INVITATION_USED' then report := report || E'ok: použitá pozvánka nefunguje druhýkrát\n';
  else report := report || 'FAIL: použitá pozvánka -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.accept_invitation(inv2 ->> 'token'); exception when others then err := sqlerrm; end;
  if err = 'INVITATION_EXPIRED' then report := report || E'ok: vypršaná pozvánka sa odmietne\n';
  else report := report || 'FAIL: vypršaná pozvánka -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- pravidlo A
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.add_item(l, 'Mlieko', 2, 'ks', null, null, 'dairy_eggs');
  if res ->> 'kind' = 'ITEM' then report := report || E'ok: A) nikto nenakupuje -> položka ide rovno do zoznamu\n';
  else report := report || 'FAIL: pravidlo A -> ' || res::text || E'\n'; fails := fails + 1; end if;
  select category_id into txt from public.shopping_list_items where id = (res ->> 'id')::uuid;
  if txt = 'dairy_eggs' then report := report || E'ok: kategória z odhadu aplikácie\n';
  else report := report || 'FAIL: kategória = ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- nákup
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s1 := public.start_shopping(l);
  s2 := public.start_shopping(l);
  if s1.id = s2.id and s1.status = 'ACTIVE' then report := report || E'ok: opakovaný štart nákupu vráti ten istý nákup\n';
  else report := report || E'FAIL: opakovaný štart\n'; fails := fails + 1; end if;

  res := public.add_item(l, 'Chlieb');
  if res ->> 'kind' = 'ITEM' then report := report || E'ok: B) nakupujúci pridáva rovno, nič neschvaľuje sám sebe\n';
  else report := report || 'FAIL: pravidlo B -> ' || res::text || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.start_shopping(l); exception when others then err := sqlerrm; end;
  if err = 'SESSION_ALREADY_ACTIVE' then report := report || E'ok: dva súčasné nákupy jedného zoznamu sú nemožné\n';
  else report := report || 'FAIL: druhý nákup -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  res := public.add_item(l, 'Olivový olej', 1, 'ks', null, null, null, '11111111-1111-4111-8111-111111111111');
  res2 := public.add_item(l, 'Olivový olej', 1, 'ks', null, null, null, '11111111-1111-4111-8111-111111111111');
  req_id := (res ->> 'id')::uuid;
  select count(*) into n from public.addition_requests where client_op_id = '11111111-1111-4111-8111-111111111111';
  if res ->> 'kind' = 'REQUEST' and (res ->> 'shopper_id')::uuid = a then
    report := report || E'ok: C) iný člen počas nákupu -> vznikne žiadosť pre nakupujúceho\n';
  else report := report || 'FAIL: pravidlo C -> ' || res::text || E'\n'; fails := fails + 1; end if;
  if res2 ->> 'id' = res ->> 'id' and n = 1 then report := report || E'ok: dvojité odoslanie (zlý signál) vytvorí iba jednu žiadosť\n';
  else report := report || E'FAIL: idempotencia add_item\n'; fails := fails + 1; end if;

  err := null;
  begin perform public.accept_request(req_id); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: žiadosť nemôže schváliť niekto iný ako nakupujúci\n';
  else report := report || 'FAIL: cudzie schválenie -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- schválenie
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.shopping_list_items where list_id = l;
  res := public.accept_request(req_id);
  res2 := public.accept_request(req_id);
  select count(*) into n2 from public.shopping_list_items where list_id = l;
  if res ->> 'outcome' = 'ACCEPTED' and res2 ->> 'item_id' = res ->> 'item_id' and n2 = n + 1 then
    report := report || E'ok: schválenie vytvorí položku; dvojité schválenie nevytvorí duplikát\n';
  else report := report || 'FAIL: schválenie ' || res::text || ' / ' || res2::text || E'\n'; fails := fails + 1; end if;
  select added_by into item_id from public.shopping_list_items where id = (res ->> 'item_id')::uuid;
  if item_id = c then report := report || E'ok: pri schválenej položke je uvedené, kto ju chcel\n';
  else report := report || E'FAIL: added_by pri schválení\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- zamietnutie
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  req_id := (public.add_item(l, 'Čokoláda') ->> 'id')::uuid;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.shopping_list_items where list_id = l;
  res := public.reject_request(req_id);
  res2 := public.accept_request(req_id);
  select count(*) into n2 from public.shopping_list_items where list_id = l;
  if res ->> 'outcome' = 'REJECTED' and res2 ->> 'outcome' = 'REJECTED' and n2 = n then
    report := report || E'ok: zamietnutá žiadosť sa nedá dodatočne schváliť\n';
  else report := report || 'FAIL: zamietnutie ' || res::text || ' / ' || res2::text || E'\n'; fails := fails + 1; end if;
  select count(*) into n from public.addition_requests where id = req_id and status = 'REJECTED';
  if n = 1 then report := report || E'ok: zamietnutá žiadosť ostáva v histórii\n';
  else report := report || E'FAIL: história zamietnutia\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- nákupná položka
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select id into item_id from public.shopping_list_items where list_id = l and name = 'Mlieko';
  update public.shopping_list_items set status = 'PURCHASED' where id = item_id;
  select purchased_by::text into txt from public.shopping_list_items where id = item_id;
  if txt = c::text then report := report || E'ok: odškrtnutie zapíše, kto položku kúpil\n';
  else report := report || E'FAIL: purchased_by\n'; fails := fails + 1; end if;

  err := null;
  begin update public.shopping_list_items set household_id = hb where id = item_id;
  exception when others then err := sqlerrm; end;
  if err like 'permission denied%' then report := report || E'ok: položku nemožno presunúť do inej domácnosti\n';
  else report := report || 'FAIL: zmena household_id -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- pamäť kategórií
  update public.shopping_list_items set category_id = 'beverages' where id = item_id;
  res := public.add_item(l, '  MLIEKO ');
  -- (počas nákupu Anny je to žiadosť – kategória sa berie z pamäte aj tak)
  select category_id into txt from public.addition_requests where id = (res ->> 'id')::uuid;
  if txt = 'beverages' then report := report || E'ok: domácnosť si pamätá zmenenú kategóriu (aj bez diakritiky/veľkých písmen)\n';
  else report := report || 'FAIL: pamäť kategórií = ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;
  req_id := (res ->> 'id')::uuid;

  -- ---------------------------------------------------------------- koniec nákupu
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s2 := public.end_shopping(s1.id);
  select status::text into txt from public.addition_requests where id = req_id;
  res := public.accept_request(req_id);
  if s2.status = 'ENDED' and txt = 'EXPIRED' and res ->> 'outcome' = 'EXPIRED' then
    report := report || E'ok: po skončení nákupu nevybavené žiadosti prepadnú a nič nepridajú\n';
  else report := report || 'FAIL: koniec nákupu ' || txt || ' / ' || res::text || E'\n'; fails := fails + 1; end if;
  select count(*) into n from public.shopping_list_items where list_id = l and status = 'PURCHASED';
  select count(*) into n2 from public.shopping_list_items where list_id = l and status = 'OPEN';
  if n = 1 and n2 = 2 then report := report || E'ok: kúpené aj nekúpené položky ostanú zachované\n';
  else report := report || format(E'FAIL: po nákupe kúpené=%s otvorené=%s\n', n, n2); fails := fails + 1; end if;

  -- ---------------------------------------------------------------- vypršanie
  s1 := public.start_shopping(l);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  req_id := (public.add_item(l, 'Syr') ->> 'id')::uuid;
  execute 'reset role';
  update public.shopping_sessions set expires_at = now() - interval '1 second' where id = s1.id;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.accept_request(req_id);
  if res ->> 'outcome' = 'EXPIRED' then report := report || E'ok: žiadosť z vypršaného nákupu sa nedá schváliť\n';
  else report := report || 'FAIL: žiadosť po vypršaní -> ' || res::text || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.add_item(l, 'Maslo');
  select status::text into txt from public.shopping_sessions where id = s1.id;
  if res ->> 'kind' = 'ITEM' and txt = 'EXPIRED' then
    report := report || E'ok: po vypršaní nákupu sa položky znova pridávajú normálne\n';
  else report := report || 'FAIL: po vypršaní ' || res::text || ' ' || txt || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- bločky
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select * into rg from public.register_receipt(h, repeat('a', 64));
  rc1 := rg.receipt_id;
  if rc1 is not null and not rg.already_exists and rg.path like h::text || '/%' then
    report := report || E'ok: fotka bločku sa zaregistruje do priečinka domácnosti\n';
  else report := report || E'FAIL: register_receipt\n'; fails := fails + 1; end if;
  select * into rg from public.register_receipt(h, repeat('a', 64));
  if rg.already_exists and rg.receipt_id = rc1 then
    report := report || E'ok: tá istá fotka sa druhýkrát neprijme (duplicita)\n';
  else report := report || E'FAIL: duplicitná fotka prešla\n'; fails := fails + 1; end if;
  select * into rg from public.register_receipt(h, repeat('d', 64), 'pdf');
  if rg.path like h::text || '/%.pdf' and not rg.already_exists then
    report := report || E'ok: PDF doklad (faktúra) sa zaregistruje\n';
  else report := report || E'FAIL: PDF register_receipt\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.register_receipt(h, repeat('e', 64), 'exe'); exception when others then err := sqlerrm; end;
  if err = 'VALIDATION' then report := report || E'ok: iný typ súboru ako obrázok alebo PDF sa odmietne\n';
  else report := report || 'FAIL: register_receipt exe -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.save_receipt_extraction(rc1, '{}'::jsonb); exception when others then err := sqlerrm; end;
  if err like 'permission denied%' then report := report || E'ok: používateľ nemôže sám zapísať výsledok čítania\n';
  else report := report || 'FAIL: save_receipt_extraction z prehliadača -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.register_receipt(h, repeat('b', 64)); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: cudzí nenahrá bloček do cudzej domácnosti\n';
  else report := report || 'FAIL: cudzí register_receipt -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  select count(*) into n from public.receipts where id = rc1;
  if n = 0 then report := report || E'ok: cudzí nevidí bločky inej domácnosti\n';
  else report := report || E'FAIL: cudzí vidí bloček\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.confirm_receipt(rc1); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepotvrdí bloček\n';
  else report := report || 'FAIL: cudzí confirm_receipt -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- výsledok čítania (volá server) – kontrola súčtu, dátumu, duplicít
  execute 'reset role';
  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'Lidl', 'purchased_on', '2026-09-13', 'total', 3.50,
    'items', jsonb_build_array(
      jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'),
      jsonb_build_object('name', 'Chlieb', 'line_total', 2.30, 'category_id', 'neexistuje'))));
  select count(*) into n from public.receipt_items where receipt_id = rc1;
  if rrec.status = 'OK' and n = 2 and rrec.items_sum = 3.50 then
    report := report || E'ok: súčet sedí -> bloček je v poriadku\n';
  else report := report || 'FAIL: súčet sedí -> ' || rrec.status::text || E'\n'; fails := fails + 1; end if;
  select category_id into txt from public.receipt_items where receipt_id = rc1 and raw_name = 'Chlieb';
  if txt = 'other' then report := report || E'ok: neznáma kategória sa zmení na "other"\n';
  else report := report || 'FAIL: neznáma kategória -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;

  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'Lidl', 'purchased_on', '2026-09-13', 'total', 3.50,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  select count(*) into n from public.receipt_items where receipt_id = rc1;
  if rrec.status = 'NEEDS_REVIEW' and rrec.review_reason = 'TOTAL_MISMATCH' and n = 1 then
    report := report || E'ok: súčet nesedí -> kontrola; opakované čítanie nahradí položky\n';
  else report := report || 'FAIL: nezhoda súčtu -> ' || rrec.status::text || ' ' || coalesce(rrec.review_reason, '-') || ' ' || n || E'\n'; fails := fails + 1; end if;

  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'Lidl', 'purchased_on', '2031-01-01', 'total', 1.20,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  if rrec.review_reason = 'DATE_SUSPECT' then report := report || E'ok: dátum v budúcnosti -> kontrola\n';
  else report := report || 'FAIL: dátum v budúcnosti -> ' || coalesce(rrec.review_reason, 'OK') || E'\n'; fails := fails + 1; end if;

  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'Lidl', 'purchased_on', (current_date - 700)::text, 'total', 1.20,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  if rrec.review_reason = 'DATE_SUSPECT' then report := report || E'ok: dátum starší ako 18 mesiacov -> kontrola\n';
  else report := report || 'FAIL: starý dátum -> ' || coalesce(rrec.review_reason, 'OK') || E'\n'; fails := fails + 1; end if;

  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'Lidl', 'purchased_on', '2026-09-13', 'total', 1.20,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select * into rg from public.register_receipt(h, repeat('c', 64));
  rc2 := rg.receipt_id;
  execute 'reset role';
  rrec := public.save_receipt_extraction(rc2, jsonb_build_object(
    'store_name', 'LIDL', 'purchased_on', '2026-09-13', 'total', 1.20,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  if rrec.review_reason = 'POSSIBLE_DUPLICATE' and rrec.duplicate_of = rc1 then
    report := report || E'ok: rovnaký obchod, dátum a suma -> podozrenie na duplicitu\n';
  else report := report || 'FAIL: duplicita -> ' || coalesce(rrec.review_reason, 'OK') || E'\n'; fails := fails + 1; end if;

  -- člen potvrdí, cudzí nemôže upravovať ani mazať
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.confirm_receipt(rc2);
  select status::text into txt from public.receipts where id = rc2;
  if txt = 'OK' then report := report || E'ok: člen domácnosti potvrdí bloček po kontrole\n';
  else report := report || 'FAIL: confirm_receipt -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;
  update public.receipts set total = 9.99 where id = rc2;
  select * into rrec from public.receipts where id = rc2;
  if rrec.total = 9.99 then report := report || E'ok: člen opraví sumu bločku\n';
  else report := report || E'FAIL: oprava sumy\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.receipts set total = 0 where id = rc2;
  get diagnostics n = row_count;
  delete from public.receipts where id = rc2;
  get diagnostics n2 = row_count;
  if n = 0 and n2 = 0 then report := report || E'ok: cudzí nemôže upraviť ani zmazať cudzí bloček\n';
  else report := report || 'FAIL: cudzí upravil/zmazal ' || n || '/' || n2 || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  delete from public.receipts where id = rc2;
  get diagnostics n = row_count;
  select count(*) into n2 from public.receipt_items where receipt_id = rc2;
  if n = 1 and n2 = 0 then report := report || E'ok: člen zmaže bloček aj s položkami\n';
  else report := report || 'FAIL: mazanie bločku ' || n || '/' || n2 || E'\n'; fails := fails + 1; end if;

  -- ------------------------------------------------- viac strán, spájanie
  -- (vyžaduje migrácie 17 a 18; člen C je stále prihlásený)
  select * into rg from public.register_receipt_page(rc1, repeat('1', 64), 'png');
  select count(*) into n from public.receipt_pages where receipt_id = rc1;
  if not rg.already_exists and n = 2 and rg.path like h::text || '/%.png' then
    report := report || E'ok: k bločku sa dá pridať ďalšia strana\n';
  else report := report || 'FAIL: register_receipt_page ' || n || E'\n'; fails := fails + 1; end if;
  select * into rg from public.register_receipt_page(rc1, repeat('1', 64), 'png');
  if rg.already_exists and rg.owner_receipt_id = rc1 then
    report := report || E'ok: tá istá strana sa nepridá dvakrát\n';
  else report := report || E'FAIL: duplicitná strana prešla\n'; fails := fails + 1; end if;

  select * into rg from public.register_receipt(h, repeat('2', 64));
  rc2 := rg.receipt_id;
  select * into rg from public.register_receipt(h, repeat('3', 64));
  perform public.merge_receipts(array[rc2, rg.receipt_id]);
  select count(*) into n from public.receipt_pages where receipt_id = rc2;
  select count(*) into n2 from public.receipts where id = rg.receipt_id;
  select status::text into txt from public.receipts where id = rc2;
  if n = 2 and n2 = 0 and txt = 'PROCESSING' then
    report := report || E'ok: spojenie dvoch dokladov dá jeden s dvoma stranami\n';
  else report := report || 'FAIL: merge_receipts ' || n || '/' || n2 || '/' || coalesce(txt, '-') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.merge_receipts(array[rc2]); exception when others then err := sqlerrm; end;
  if err = 'VALIDATION' then report := report || E'ok: spojiť sa dá najmenej dva doklady\n';
  else report := report || 'FAIL: merge jeden doklad -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ručne zadaný obchod prepočíta store_key
  update public.receipts set store_name = 'Tesco' where id = rc2;
  select store_key into txt from public.receipts where id = rc2;
  if txt = public.name_key('Tesco') then report := report || E'ok: ručne zadaný obchod prepočíta store_key\n';
  else report := report || 'FAIL: store_key -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;

  -- doklad bez obchodu ide na kontrolu
  execute 'reset role';
  rrec := public.save_receipt_extraction(rc2, jsonb_build_object(
    'store_name', null, 'purchased_on', '2026-09-20', 'total', 1.20,
    'items', jsonb_build_array(jsonb_build_object('name', 'Mlieko', 'line_total', 1.20, 'category_id', 'dairy_eggs'))));
  if rrec.review_reason = 'STORE_MISSING' then report := report || E'ok: chýbajúci obchod -> kontrola\n';
  else report := report || 'FAIL: STORE_MISSING -> ' || coalesce(rrec.review_reason, 'OK') || E'\n'; fails := fails + 1; end if;

  -- ručné doplnenie obchodu uzavrie kontrolu; úprava a mazanie položiek (migrácia 19)
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.receipts set store_name = 'Tesco' where id = rc2;
  select status::text into txt from public.receipts where id = rc2;
  if txt = 'OK' then report := report || E'ok: doplnený obchod uzavrie kontrolu sám\n';
  else report := report || 'FAIL: auto-uzavretie -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;
  rrec := public.save_receipt_item(rc2, null, 'Chlieb', 2.00, 1, 0, 'bakery');
  select id into item_id from public.receipt_items where receipt_id = rc2 and raw_name = 'Chlieb';
  if rrec.items_sum = 3.20 and item_id is not null then report := report || E'ok: člen pridá položku, súčet sa prepočíta\n';
  else report := report || 'FAIL: save_receipt_item -> ' || coalesce(rrec.items_sum::text, 'null') || E'\n'; fails := fails + 1; end if;
  rrec := public.save_receipt_item(rc2, item_id, 'Chlieb celozrnný', 2.50, 1, 0, 'bakery');
  if rrec.items_sum = 3.70 then report := report || E'ok: člen zmení cenu položky\n';
  else report := report || 'FAIL: zmena položky -> ' || coalesce(rrec.items_sum::text, 'null') || E'\n'; fails := fails + 1; end if;
  rrec := public.remove_receipt_item(item_id);
  if rrec.items_sum = 1.20 then report := report || E'ok: člen zmaže položku, súčet sa prepočíta\n';
  else report := report || 'FAIL: remove_receipt_item -> ' || coalesce(rrec.items_sum::text, 'null') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.save_receipt_item(rc2, null, '  ', 1); exception when others then err := sqlerrm; end;
  if err = 'VALIDATION' then report := report || E'ok: položka bez názvu sa odmietne\n';
  else report := report || 'FAIL: prázdny názov -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';

  -- cudzí nespojí ani nepridá stranu
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.register_receipt_page(rc1, repeat('4', 64)); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepridá stranu k cudziemu bločku\n';
  else report := report || 'FAIL: cudzia strana -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.save_receipt_item(rc2, null, 'Cudzia', 1); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepridá položku k cudziemu dokladu\n';
  else report := report || 'FAIL: cudzia položka -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.merge_receipts(array[rc1, rc2]); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nespojí cudzie doklady\n';
  else report := report || 'FAIL: cudzí merge -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ------------------------------------------------- analytika (migrácia 20)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.receipt_items where household_id = h and product_id is null;
  if n = 0 then report := report || E'ok: každá položka bločku má produkt\n';
  else report := report || 'FAIL: položky bez produktu ' || n || E'\n'; fails := fails + 1; end if;
  res := public.analytics_overview(h, '2020-01-01', current_date, '2019-01-01', '2019-12-31', 'all');
  if (res ->> 'total')::numeric > 0
     and abs((select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(res -> 'categories') x)
             - (res ->> 'total')::numeric) < 0.01 then
    report := report || E'ok: prehľad – kategórie spolu dajú celkovú sumu\n';
  else report := report || 'FAIL: prehľad ' || left(res::text, 200) || E'\n'; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.analytics_overview(h, '2020-01-01', current_date, '2019-01-01', '2019-12-31'); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: cudzí nevidí prehľady inej domácnosti\n';
  else report := report || 'FAIL: cudzí prehľad -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  select count(*) into n from public.products where household_id = h;
  if n = 0 then report := report || E'ok: cudzí nevidí produkty inej domácnosti\n';
  else report := report || E'FAIL: cudzí vidí produkty\n'; fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------- rodinné financie (migrácia 21)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.add_manual_expense(h, 'Nájom', current_date, 650, 'housing');
  select count(*) into n from public.receipts where household_id = h and origin = 'MANUAL' and category_id = 'housing';
  if n = 1 then report := report || E'ok: ručný výdavok s kategóriou\n';
  else report := report || E'FAIL: ručný výdavok\n'; fails := fails + 1; end if;
  n := public.import_bank_payments(h, jsonb_build_array(jsonb_build_object(
    'date', current_date, 'amount', 45.5, 'merchant', 'OMV', 'category_id', 'fuel', 'ref', 'test:1')));
  n2 := public.import_bank_payments(h, jsonb_build_array(jsonb_build_object(
    'date', current_date, 'amount', 45.5, 'merchant', 'OMV', 'category_id', 'fuel', 'ref', 'test:1')));
  if n = 1 and n2 = 0 then report := report || E'ok: platba z výpisu sa pridá raz, opakovaný import ju nezdvojí\n';
  else report := report || 'FAIL: import výpisu ' || n || '/' || n2 || E'\n'; fails := fails + 1; end if;
  res := public.analytics_overview(h, '2020-01-01', current_date, '2019-01-01', '2019-12-31', 'all');
  if abs((select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(res -> 'categories') x)
         - (res ->> 'total')::numeric) < 0.01 then
    report := report || E'ok: aj s platbami bez bločku dajú kategórie celkovú sumu\n';
  else report := report || E'FAIL: súčet kategórií s platbami\n'; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.add_manual_expense(h, 'X', current_date, 1, 'housing'); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: cudzí nepridá výdavok do cudzej domácnosti\n';
  else report := report || 'FAIL: cudzí výdavok -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';

  -- ------------------------------------------------- nákup v3 (migrácia 22)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.shopping_lists (household_id, name) values (h, 'Test v3') returning id into lb;
  perform public.add_item(lb, 'Banány', 3);
  perform public.add_item(lb, 'banány', 1);
  perform public.add_item(lb, 'Rožok', 6);
  select times into n from public.frequent_items(h) where public.name_key(name) = 'banany';
  if n >= 2 then report := report || E'ok: najčastejšie položky zrátajú rovnaký produkt spolu\n';
  else report := report || 'FAIL: frequent_items banány = ' || coalesce(n::text, 'null') || E'\n'; fails := fails + 1; end if;
  insert into public.favorite_tiles (household_id, label, item_name) values (h, 'Banány pre malého', 'Banány');
  s1 := public.start_shopping(lb);

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.favorite_tiles;
  if n = 0 then report := report || E'ok: obľúbené dlaždice vidí iba ich majiteľ\n';
  else report := report || E'FAIL: cudzie dlaždice viditeľné\n'; fails := fails + 1; end if;
  res := public.add_item(lb, 'Kefír', 2, null, 'ten zelený');
  req_id := (res ->> 'id')::uuid;
  err := null;
  begin perform public.reply_request(req_id, 'ja odpovedám sám sebe'); exception when others then err := sqlerrm; end;
  if err = 'FORBIDDEN' then report := report || E'ok: na žiadosť odpovedá iba nakupujúci\n';
  else report := report || 'FAIL: žiadateľ odpovedal -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.reply_request(req_id, 'Beriem, ale iba jeden');
  select response_note into txt from public.addition_requests where id = req_id;
  if txt = 'Beriem, ale iba jeden' then report := report || E'ok: nakupujúci pošle odpoveď na žiadosť\n';
  else report := report || E'FAIL: odpoveď sa neuložila\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.reply_request(req_id, '   '); exception when others then err := sqlerrm; end;
  if err = 'INVALID_INPUT' then report := report || E'ok: prázdna odpoveď sa neuloží\n';
  else report := report || 'FAIL: prázdna odpoveď -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  perform public.end_shopping(s1.id);

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null;
  begin perform public.reply_request(req_id, 'cudzí'); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí neodpovie na cudziu žiadosť\n';
  else report := report || 'FAIL: cudzí reply -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin insert into public.favorite_tiles (household_id, label, item_name) values (h, 'X', 'X'); exception when others then err := sqlerrm; end;
  if err is not null then report := report || E'ok: cudzí nevloží dlaždicu do cudzej domácnosti\n';
  else report := report || E'FAIL: cudzia dlaždica prešla\n'; fails := fails + 1; end if;
  select count(*) into n from public.frequent_items(h);
  if n = 0 then report := report || E'ok: cudzí nevidí najčastejšie položky inej domácnosti\n';
  else report := report || E'FAIL: frequent_items cudzej domácnosti\n'; fails := fails + 1; end if;

  -- ------------------------------------------------- nákupy, súkromné zoznamy, doklad k nákupu (migrácia 23)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.shopping_lists (household_id, name, is_private) values (h, 'Darček', true) returning id into lp;
  perform public.add_item(lp, 'Prekvapenie');
  insert into public.shopping_lists (household_id, name, planned_for, note) values (h, 'Lidl test', current_date, 'po práci') returning id into ls;
  perform public.add_item(ls, 'Kaiserka natural', 4);
  perform public.add_item(ls, 'Bio jogurt', 2);
  perform public.add_item(ls, 'Banány', 3);

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.shopping_lists where id = lp;
  select count(*) into n2 from public.shopping_list_items where list_id = lp;
  if n = 0 and n2 = 0 then report := report || E'ok: súkromný zoznam ani jeho položky druhý člen nevidí\n';
  else report := report || E'FAIL: súkromný zoznam viditeľný\n'; fails := fails + 1; end if;
  err := null; begin perform public.add_item(lp, 'Vniknutie'); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: do súkromného zoznamu druhý člen nepridá\n';
  else report := report || 'FAIL: add_item súkromný -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null; begin perform public.start_shopping(lp); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: súkromný zoznam druhý člen nenakupuje\n';
  else report := report || 'FAIL: start súkromný -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  update public.shopping_list_items set status = 'PURCHASED' where list_id = lp;
  get diagnostics n = row_count;
  if n = 0 then report := report || E'ok: položky súkromného zoznamu druhý člen nezmení\n';
  else report := report || E'FAIL: zmena súkromných položiek\n'; fails := fails + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s1 := public.start_shopping(ls);
  update public.shopping_list_items set status = 'PURCHASED' where list_id = ls and name <> 'Banány';
  perform public.end_shopping(s1.id);
  select completed_at into t from public.shopping_lists where id = ls;
  if t is null then report := report || E'ok: s nekúpenou položkou nákup ostane rozpracovaný\n';
  else report := report || E'FAIL: predčasne v histórii\n'; fails := fails + 1; end if;
  s1 := public.start_shopping(ls);
  update public.shopping_list_items set status = 'PURCHASED' where list_id = ls;
  perform public.end_shopping(s1.id);
  select completed_at into t from public.shopping_lists where id = ls;
  if t is not null then report := report || E'ok: všetko kúpené -> nákup ide do histórie\n';
  else report := report || E'FAIL: neuložil sa do histórie\n'; fails := fails + 1; end if;
  perform public.set_receipt_later(ls);

  select * into rg from public.register_receipt(h, repeat('9', 64));
  rc1 := rg.receipt_id;
  execute 'reset role';
  rrec := public.save_receipt_extraction(rc1, jsonb_build_object(
    'store_name', 'LIDL Slovenská republika', 'purchased_on', current_date::text, 'total', 6.10,
    'items', jsonb_build_array(
      jsonb_build_object('name', 'KAISERKA NAT. 4X', 'line_total', 1.20, 'category_id', 'bakery'),
      jsonb_build_object('name', 'JOGURT BIO BIELY', 'line_total', 1.40, 'category_id', 'dairy_eggs'),
      jsonb_build_object('name', 'BANANY', 'line_total', 1.50, 'category_id', 'produce'),
      jsonb_build_object('name', 'PIVO', 'line_total', 2.00, 'category_id', 'alcohol'))));
  select list_id::text into txt from public.receipts where id = rc1;
  if txt = ls::text then report := report || E'ok: samostatne nahratý bloček sa sám priradí k nákupu bez dokladu\n';
  else report := report || 'FAIL: auto-match -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.add_item(ls, 'Zabudnuté mlieko');
  select completed_at into t from public.shopping_lists where id = ls;
  if t is null then report := report || E'ok: pridanie položky vráti nákup z histórie\n';
  else report := report || E'FAIL: ostal v histórii\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- Nemali, čas, koniec nákupu, kúpim inde
  update public.shopping_lists set planned_time = '17:30' where id = ls;
  select planned_time::text into txt from public.shopping_lists where id = ls;
  if txt = '17:30:00' then report := report || E'ok: čas nákupu sa dá uložiť\n';
  else report := report || 'FAIL: čas nákupu -> ' || coalesce(txt, 'null') || E'\n'; fails := fails + 1; end if;
  perform public.add_item(ls, 'Chlieb');
  perform public.add_item(ls, 'Maslo');
  s1 := public.start_shopping(ls);
  update public.shopping_list_items set status = 'UNAVAILABLE' where list_id = ls and name = 'Chlieb';
  select count(*) into n from public.shopping_list_items where list_id = ls and name = 'Chlieb' and purchased_by = a and purchased_at is not null;
  if n = 1 then report := report || E'ok: „Nemali“ zapamätá, kto a kedy položku vybavil\n';
  else report := report || E'FAIL: Nemali bez záznamu\n'; fails := fails + 1; end if;
  update public.shopping_list_items set status = 'PURCHASED' where list_id = ls and name = 'Zabudnuté mlieko';
  nl := public.finish_shopping(s1.id, 'MOVE');
  select count(*) into n from public.shopping_list_items where list_id = nl and name = 'Maslo' and status = 'OPEN';
  select completed_at into t from public.shopping_lists where id = ls;
  if nl is not null and n = 1 and t is not null then report := report || E'ok: koniec nákupu presunie nekúpené na zajtra a nákup ide do histórie\n';
  else report := report || E'FAIL: finish_shopping MOVE\n'; fails := fails + 1; end if;
  select count(*) into n from public.shopping_list_items where list_id = ls and name = 'Chlieb' and status = 'UNAVAILABLE';
  if n = 1 then report := report || E'ok: položka „Nemali“ ostane v histórii nákupu\n';
  else report := report || E'FAIL: Nemali sa stratilo\n'; fails := fails + 1; end if;
  select id into it2 from public.shopping_list_items where list_id = nl and name = 'Maslo';
  nl2 := public.move_item(it2, null, 'Na neskôr');
  select count(*) into n from public.shopping_list_items where id = it2 and list_id = nl2;
  if nl2 is not null and nl2 <> nl and n = 1 then report := report || E'ok: kúpim inde presunie položku do nového zoznamu\n';
  else report := report || E'FAIL: move_item nový zoznam\n'; fails := fails + 1; end if;
  perform public.move_item(it2, nl);
  select count(*) into n from public.shopping_list_items where id = it2 and list_id = nl;
  if n = 1 then report := report || E'ok: kúpim inde presunie položku do existujúceho zoznamu\n';
  else report := report || E'FAIL: move_item existujúci zoznam\n'; fails := fails + 1; end if;
  err := null; begin perform public.finish_shopping(s1.id, 'DROP'); exception when others then err := sqlerrm; end;
  if err = 'INVALID_INPUT' then report := report || E'ok: neznáma voľba pri konci nákupu sa odmietne\n';
  else report := report || 'FAIL: finish_shopping DROP -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';
  select id into lb from public.shopping_lists where household_id = hb limit 1;  -- zoznam Borisovej domácnosti
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null; begin perform public.move_item(it2, lb); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepresunie položku z cudzej domácnosti\n';
  else report := report || 'FAIL: cudzí move_item -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null; begin perform public.move_item(it2, lb); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: položku nejde presunúť do cudzej domácnosti\n';
  else report := report || 'FAIL: move_item do cudzej -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  err := null; begin perform public.attach_receipt_to_list(rc1, ls); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nepriradí doklad k cudziemu nákupu\n';
  else report := report || 'FAIL: cudzí attach -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- párovanie dokladu s nákupom
  err := null; begin perform public.receipt_match_candidates(rc1); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nevidí kandidátov na párovanie\n';
  else report := report || 'FAIL: cudzí receipt_match_candidates -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null; begin perform public.dismiss_receipt_match(rc1); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nezruší párovanie dokladu\n';
  else report := report || 'FAIL: cudzí dismiss_receipt_match -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null; begin perform public.receipt_match_suggestions(h); exception when others then err := sqlerrm; end;
  if err = 'NOT_FOUND' then report := report || E'ok: cudzí nevidí návrhy párovania\n';
  else report := report || 'FAIL: cudzí receipt_match_suggestions -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.receipt_match_candidates(rc1);
  if res @> jsonb_build_array(jsonb_build_object('list_id', ls, 'attached', true))
     and exists (select 1 from jsonb_array_elements(res) e where e->>'list_id' = ls::text and e->'hit' ? 'Banány' and e->'extra' @> '[{"name":"PIVO"}]')
  then report := report || E'ok: párovanie ukáže, čo sedí a čo je na doklade navyše\n';
  else report := report || 'FAIL: receipt_match_candidates -> ' || coalesce(res::text, 'null') || E'\n'; fails := fails + 1; end if;
  select * into rg from public.register_receipt(h, repeat('8', 64));
  rc2 := rg.receipt_id;
  perform public.dismiss_receipt_match(rc2);
  select count(*) into n from public.receipts where id = rc2 and match_score = 0;
  res := public.receipt_match_suggestions(h);
  if n = 1 and jsonb_typeof(res) = 'array' and not res @> jsonb_build_array(jsonb_build_object('receipt_id', rc2))
  then report := report || E'ok: „Bez nákupu“ doklad už nenavrhuje\n';
  else report := report || E'FAIL: dismiss_receipt_match\n'; fails := fails + 1; end if;
  perform public.dismiss_receipt_match(rc1);
  select list_id into nl from public.receipts where id = rc1;
  if nl = ls then report := report || E'ok: „Bez nákupu“ neodpojí už priradený doklad\n';
  else report := report || E'FAIL: dismiss odpojil doklad\n'; fails := fails + 1; end if;

  -- ---------------------------------------------------------------- anonym
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  err := null;
  begin select count(*) into n from public.households; exception when others then err := sqlerrm; end;
  if err like 'permission denied%' then report := report || E'ok: neprihlásený nevidí nič\n';
  else report := report || 'FAIL: anonym -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;
  err := null;
  begin perform public.create_household('x'); exception when others then err := sqlerrm; end;
  if err like 'permission denied%' then report := report || E'ok: neprihlásený nevolá funkcie\n';
  else report := report || 'FAIL: anonym funkcia -> ' || coalesce(err, 'prešlo') || E'\n'; fails := fails + 1; end if;

  execute 'reset role';
  raise exception E'TEST_REPORT fails=%\n%', fails, report;
end
$test$;
