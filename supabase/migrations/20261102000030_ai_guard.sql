-- =============================================================================
-- Poistky pred prestavbou (Fáza 0).
--
-- 1) AI funkcie (parse-voice, recipe-ai) doteraz overili len prihlásenie. Ktokoľvek
--    s účtom ich mohol volať bez obmedzenia na náš účet Gemini. Teraz sa pred každým
--    volaním spýtajú databázy ai_allow(): volajúci musí byť členom domácnosti a
--    domácnosť nesmie prekročiť limit volaní za hodinu a za deň (počíta sa z ai_usage).
-- 2) Vnútorné pomocné funkcie párovania dokladov boli volateľné priamo z prehliadača
--    (prezradili by skóre cudzieho dokladu). Volajú ich len iné funkcie databázy.
-- =============================================================================

-- Limity na domácnosť. Hlas posiela každú vetu zvlášť, preto má vyšší limit.
create function public.ai_allow(p_household_id uuid, p_fn text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hour int;
  v_day  int;
  v_max_hour int;
  v_max_day  int;
begin
  perform public._require_uid();
  if p_household_id is null or not public.is_member(p_household_id) then
    raise exception 'NOT_FOUND';
  end if;
  case p_fn
    when 'parse-voice' then v_max_hour := 300; v_max_day := 1500;
    when 'recipe-ai'   then v_max_hour := 40;  v_max_day := 200;
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
end $$;

revoke execute on function public.ai_allow(uuid, text) from public, anon;
grant execute on function public.ai_allow(uuid, text) to authenticated;

-- Vnútorné funkcie: len pre iné funkcie databázy (tie bežia ako vlastník).
revoke execute on function public._auto_match_receipt(uuid) from public, anon, authenticated;
revoke execute on function public._receipt_list_score(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.receipts_auto_match() from public, anon, authenticated;
revoke execute on function public.receipts_sync_store_key() from public, anon, authenticated;
