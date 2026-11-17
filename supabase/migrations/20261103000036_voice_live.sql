-- =============================================================================
-- Hlas 2.0 – živý prepis (Gemini Live, gemini-3.5-transcribe-live).
-- Edge funkcia voice-live-token vydá krátkodobý token (6 min, jednorazový) až po ai_allow:
-- člen domácnosti, najviac 30 relácií za hodinu a 120 za deň, a mesačný strop nákladov AI.
-- Jedna relácia = jedno otvorenie hlasu (pri dlhom diktovaní sa obnoví po ~6 min).
-- =============================================================================
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
  if public._ai_month_cost(p_household_id) >= public._ai_month_cap() then
    raise exception 'AI_LIMIT';
  end if;
end $$;
