-- =============================================================================
-- Katalóg položiek domácnosti pre pridávanie do zoznamu a odhad ceny (Fáza 3 prestavby).
--
-- Appka podľa neho rozpozná napísaný text na troch úrovniach (pravidlo majiteľa „appka nič
-- nedomýšľa“): všeobecná položka („pivo“ = všetky pivá), druh („pivo 12°“) a značka („radegast“).
-- Vráti zjednotené produkty domácnosti (názov, druh, značka, kategória) a ich nákupy z bločkov
-- za posledných 180 dní (deň, obchod, suma riadku, množstvo, jednotka). Ceny sa z nich rátajú v appke
-- rovnako v zozname, v Nákupoch aj na Domove. Len pre člena domácnosti.
-- =============================================================================
create function public.item_catalog(p_household_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  return coalesce((
    with buys as (
      select i.product_id, r.purchased_on, coalesce(r.store_name, '') as store, i.line_total, i.quantity, coalesce(i.unit, '') as unit
        from public.receipt_items i
        join public.receipts r on r.id = i.receipt_id
       where i.household_id = p_household_id
         and i.product_id is not null
         and i.line_total > 0
         and r.status in ('OK', 'NEEDS_REVIEW')
         and r.purchased_on is not null
         and r.purchased_on > current_date - 180
         and not (r.status = 'NEEDS_REVIEW' and r.review_reason = 'DATE_SUSPECT')
    ),
    root as (
      -- riadky zlúčených produktov patria koreňovému produktu
      select b.*, coalesce(p.merged_into, p.id) as pid
        from buys b join public.products p on p.id = b.product_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'kind', p.kind, 'brand', p.brand, 'category_id', p.category_id,
      'size_value', p.size_value, 'size_unit', p.size_unit,
      'buys', coalesce((
        select jsonb_agg(jsonb_build_object('d', r.purchased_on, 's', r.store, 't', r.line_total, 'q', r.quantity, 'u', r.unit)
                         order by r.purchased_on)
          from root r where r.pid = p.id
      ), '[]'::jsonb)
    ) order by p.name)
      from public.products p
     where p.household_id = p_household_id and p.merged_into is null
  ), '[]'::jsonb);
end $$;

revoke execute on function public.item_catalog(uuid) from public, anon;
grant execute on function public.item_catalog(uuid) to authenticated;
