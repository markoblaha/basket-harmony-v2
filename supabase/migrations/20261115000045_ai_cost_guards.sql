-- =============================================================================
-- Kontrola backendu 15. 11. 2026: tri cesty, ktorými sa dala míňať AI bez limitu, a sprísnenie práv.
--  1. queue_receipt („Prečítať znova“, pridanie strany, spojenie bločkov) spúšťala čítanie bločku cez AI
--     bez akéhokoľvek limitu. Teraz rovnaký strop ako pri nahratí (mesačný rozpočet domácnosti) a najviac
--     80 čítaní za 24 h, inak RECEIPT_LIMIT.
--  2. Bločky: člen mohol priamo meniť všetky stĺpce (stav, počet pokusov, cestu k fotke…). Zmenou stavu sa dalo
--     prinútiť plánovač čítať bloček znova (AI bez limitu) a zmenou cesty k fotke by AI prečítala súbor inej
--     domácnosti. Appka priamo mení len obchod, dátum, sumu a kategóriu – ostatné ide cez funkcie databázy.
--  3. Import bankového výpisu (read-statement) posielal celé PDF do AI bez limitu: ai_allow pozná 'read-statement'
--     (10 za hodinu, 30 za deň, celkový rozpočet AI). Hlasový rozpočet výpis neblokuje.
--  4. Neprihlásený návštevník (anon) nepotrebuje žiadnu tabuľku – práva odobraté (dáta chránili už pravidlá RLS).
-- =============================================================================

create or replace function public.queue_receipt(p_receipt_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.receipts;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  -- Každé čítanie je volanie AI: strop ako pri nahratí bločku (register_receipt).
  if (select count(*) from public.ai_usage
       where household_id = r.household_id and fn = 'extract-receipt' and created_at > now() - interval '1 day') >= 80
     or public._ai_month_cost(r.household_id) >= public._ai_month_cap() then
    raise exception 'RECEIPT_LIMIT';
  end if;
  update public.receipts
     set status = 'PROCESSING', review_reason = null, error_text = null,
         queued_at = now(), read_started_at = null, read_attempts = 0
   where id = p_receipt_id;
  perform public._dispatch_receipt(p_receipt_id);
end $$;

-- Bločky: priamo len polia, ktoré človek opravuje v detaile bločku (useUpdateReceipt).
revoke insert, update on public.receipts from authenticated;
grant update (store_name, purchased_on, total, category_id) on public.receipts to authenticated;

create or replace function public.ai_allow(p_household_id uuid, p_fn text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hour int;
  v_day  int;
  v_max_hour int;
  v_max_day  int;
  v_share numeric;
begin
  perform public._require_uid();
  if p_household_id is null or not public.is_member(p_household_id) then
    raise exception 'NOT_FOUND';
  end if;
  case p_fn
    when 'parse-voice'    then v_max_hour := 120; v_max_day := 400;
    when 'recipe-ai'      then v_max_hour := 20;  v_max_day := 60;
    when 'voice-live'     then v_max_hour := 30;  v_max_day := 120;
    when 'read-statement' then v_max_hour := 10;  v_max_day := 30;
    else raise exception 'INVALID_INPUT';
  end case;
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*)
    into v_hour, v_day
    from public.ai_usage
   where household_id = p_household_id and fn = p_fn
     and created_at > now() - interval '1 day';
  if v_hour >= v_max_hour or v_day >= v_max_day then
    raise exception 'AI_LIMIT';
  end if;
  -- Rozpočet sa dopĺňa denne (migrácia 044). Hlasový strop sa týka len hlasu a receptov.
  v_share := public._ai_month_share();
  if (p_fn <> 'read-statement' and public._ai_voice_month_cost(p_household_id) >= public._ai_voice_month_cap() * v_share)
     or public._ai_month_cost(p_household_id) >= public._ai_month_cap() * v_share then
    raise exception 'AI_MONTH_LIMIT';
  end if;
end $$;

revoke all on all tables in schema public from anon;
