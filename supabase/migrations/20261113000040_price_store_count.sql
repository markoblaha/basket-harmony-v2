-- Obchod vo Výdavkoch: pri každom druhu aj počet obchodov, v ktorých sa kupoval (3 mesiace).
-- „Najlacnejší pri X z Y“ porovnáva len produkty, ktoré sa kupujú aj inde.
create or replace function public._price_store(p_household_id uuid, p_store_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with o as (select * from public._price_offers(p_household_id) where unit is not null),
  st as (select distinct on (kind_key, store_key) * from o order by kind_key, store_key, promo, unit),
  here as (select * from st where store_key = p_store_key),
  best as (select distinct on (kind_key) * from st where not promo order by kind_key, unit),
  cnt as (select kind_key, count(*) as n from st group by kind_key)
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind_key', h.kind_key, 'name', coalesce(p.kind, p.name), 'category_id', p.category_id, 'basis', h.basis,
           'unit', round(h.unit, 2), 'promo', h.promo, 'date', h.purchased_on,
           'best_key', b.store_key, 'best_store', b.store_name, 'best_unit', round(b.unit, 2), 'stores', c.n
         ) order by c.n desc, coalesce(p.kind, p.name)), '[]'::jsonb)
    from here h join public.products p on p.id = h.product_id
    left join best b on b.kind_key = h.kind_key
    join cnt c on c.kind_key = h.kind_key
$$;
