-- =============================================================================
-- Denné súčty pre časovú os Výdavkov (stĺpec = týždeň / mesiac) a pre priebeh mesiaca.
-- Bez filtra rovnako ako veľká suma prehľadu (bločky bez záloh); s kategóriou = riadky tej kategórie;
-- s obchodom = bločky z obchodu. „first“ = deň prvého bločku – porovnanie s obdobím pred ním sa neukazuje.
-- =============================================================================
create function public.analytics_daily(
  p_household_id uuid, p_from date, p_to date, p_category_id text default null, p_store_key text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_from > p_to or p_to - p_from > 800 then raise exception 'VALIDATION'; end if;
  return jsonb_build_object(
    'first', (select min(purchased_on) from public.receipts
               where household_id = p_household_id and status in ('OK', 'NEEDS_REVIEW') and purchased_on is not null),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('d', d, 'a', round(a, 2)) order by d) from (
        select s.purchased_on as d, sum(s.total - s.deposits) as a
          from public._spend_receipts(p_household_id, p_from, p_to) s
         where p_category_id is null and (p_store_key is null or s.store_key = p_store_key)
         group by 1
        union all
        select s.purchased_on, sum(i.line_total)
          from public._spend_receipts(p_household_id, p_from, p_to) s
          join public.receipt_items i on i.receipt_id = s.receipt_id
         where p_category_id is not null and i.category_id = p_category_id
           and (p_store_key is null or s.store_key = p_store_key)
         group by 1
      ) x where a <> 0), '[]'::jsonb)
  );
end $$;
revoke execute on function public.analytics_daily(uuid, date, date, text, text) from public, anon;
grant execute on function public.analytics_daily(uuid, date, date, text, text) to authenticated;
