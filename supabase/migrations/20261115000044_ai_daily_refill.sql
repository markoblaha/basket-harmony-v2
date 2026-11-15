-- =============================================================================
-- Rozpočet AI domácnosti sa dopĺňa každý deň (ako dáta v mobile s prenosom do ďalšieho dňa).
-- Predtým: mesačný strop naraz – keby ho niekto (napr. dieťa) minul v prvý týždeň, rodina by bola
-- bez hlasu do konca mesiaca. Teraz: k danému dňu smie domácnosť minúť len pomernú časť stropu
-- s rezervou 4 dní, čo nevyužije, ostáva jej. Posledný deň mesiaca je k dispozícii celý strop,
-- takže mesačný maximálny náklad (a zisk z predplatného) sa nemení.
--   1. deň (30-dňový mesiac): 5/30 stropu = 0,20 $ na hlas ≈ 20 nákupov hlasom
--   každý ďalší deň: +0,04 $ ≈ 4 nákupy (bežná rodina minie ~1 nákup denne)
-- Po vyčerpaní ai_allow hlási AI_MONTH_LIMIT ako doteraz (appka: „zajtra sa doplní“) – edge funkcie sa nemenia.
-- =============================================================================

-- Podiel mesačného stropu, ktorý smie byť minutý k dnešnému dňu (0–1). Rovnaké hranice mesiaca ako _ai_month_cost (UTC).
create or replace function public._ai_month_share() returns numeric
language sql stable set search_path = '' as $$
  select least(1, (extract(day from now()) + 4)
                  / extract(day from date_trunc('month', now()) + interval '1 month' - interval '1 day'))::numeric
$$;
revoke execute on function public._ai_month_share() from public, anon, authenticated;

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
    when 'parse-voice' then v_max_hour := 120; v_max_day := 400;
    when 'recipe-ai'   then v_max_hour := 20;  v_max_day := 60;
    when 'voice-live'  then v_max_hour := 30;  v_max_day := 120;
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
  v_share := public._ai_month_share();
  if public._ai_voice_month_cost(p_household_id) >= public._ai_voice_month_cap() * v_share
     or public._ai_month_cost(p_household_id) >= public._ai_month_cap() * v_share then
    raise exception 'AI_MONTH_LIMIT';
  end if;
end $$;
