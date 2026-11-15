-- =============================================================================
-- Mesačný rozpočet AI na domácnosť. Predplatné je 4 €/mes. za celú rodinu a hlas môžu používať 3–4 ľudia,
-- preto rozpočet patrí domácnosti (nie osobe) a náklady musia byť pod kontrolou aj pri najhoršom používaní.
--  - Hlas a recepty (voice-live, voice-live-audio, parse-voice, recipe-ai): najviac 1,20 $ mesačne. Po vyčerpaní
--    ai_allow hlási AI_MONTH_LIMIT – appka prepne na písanie (funguje bez AI), obnoví sa 1. dňa mesiaca.
--    Čítanie bločkov tým nie je dotknuté.
--  - Všetka AI spolu (aj bločky): najviac 2 $ mesačne (predtým 5 $).
--  - Živý prepis: Google účtuje skutočné sekundy reči. Token (voice-live-token) započíta 15 s, appka po relácii
--    nahlási skutočnú dĺžku (log_voice_live) a doplní sa zvyšok. Predtým sa každé otvorenie hlasu rátalo ako minúta.
-- Bežná rodina (aj 4 ľudia) minie 0,30–0,80 $ mesačne, takže sa k stropom nepriblíži.
-- =============================================================================

create or replace function public._ai_month_cap() returns numeric
language sql immutable set search_path = '' as $$ select 2.0::numeric $$;
revoke execute on function public._ai_month_cap() from public, anon, authenticated;

create or replace function public._ai_voice_month_cap() returns numeric
language sql immutable set search_path = '' as $$ select 1.2::numeric $$;
revoke execute on function public._ai_voice_month_cap() from public, anon, authenticated;

create or replace function public._ai_voice_month_cost(p_household_id uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage
   where household_id = p_household_id and created_at >= date_trunc('month', now())
     and fn in ('voice-live', 'voice-live-audio', 'parse-voice', 'recipe-ai');
$$;
revoke execute on function public._ai_voice_month_cost(uuid) from public, anon, authenticated;

create or replace function public.ai_allow(p_household_id uuid, p_fn text) returns void
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
  if public._ai_voice_month_cost(p_household_id) >= public._ai_voice_month_cap()
     or public._ai_month_cost(p_household_id) >= public._ai_month_cap() then
    raise exception 'AI_MONTH_LIMIT';
  end if;
end $$;

-- Skutočná dĺžka reči v jednej relácii živého prepisu (nahlási appka). Prvých 15 s už započítal token,
-- relácia trvá najviac 6 minút. Cena ako u Google: 25 zvukových tokenov/s (3,50 $/M) + 175 tokenov textu/min (21 $/M).
create or replace function public.log_voice_live(p_household_id uuid, p_seconds numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_extra numeric;
begin
  perform public._require_uid();
  if p_household_id is null or not public.is_member(p_household_id) then
    raise exception 'NOT_FOUND';
  end if;
  if p_seconds is null or p_seconds < 0 then
    raise exception 'VALIDATION';
  end if;
  v_extra := least(p_seconds, 360) - 15;
  if v_extra <= 0 then
    return;
  end if;
  insert into public.ai_usage (household_id, fn, model, input_tokens, output_tokens, cost_usd)
  values (p_household_id, 'voice-live-audio', 'gemini-3.5-transcribe-live',
          round(v_extra * 25)::int, round(v_extra / 60 * 175)::int,
          round(v_extra * 25 * 3.5 / 1e6 + v_extra / 60 * 175 * 21 / 1e6, 6));
end $$;
revoke execute on function public.log_voice_live(uuid, numeric) from public, anon;
grant execute on function public.log_voice_live(uuid, numeric) to authenticated;
