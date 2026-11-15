-- Cena za jednotku sa porovnáva len pri tovare, kde to dáva zmysel (potraviny, drogéria, domácnosť, deti, zvieratá).
-- Oblečenie, elektronika, služby, lieky, poplatky… majú len cenu za kus a do porovnania obchodov nevstupujú.
create function public._comparable(p_category_id text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select p_category_id not in ('clothing', 'home', 'toys_hobby', 'electronics', 'fees', 'dining', 'transport', 'leisure',
                               'housing', 'telecom', 'insurance', 'other', 'health', 'fuel', 'deposit', 'groceries')
$$;

create or replace function public._price_offers(p_household_id uuid)
returns table (
  product_id uuid, kind_key text, store_key text, store_name text, price numeric, unit numeric, basis text,
  purchased_on date, promo boolean, fresh boolean, buys int, min_price numeric
)
language sql stable security definer set search_path = '' as $$
  with f as (
    select pf.*, kb.basis as kbasis,
           case when public._comparable(pf.category_id) and pf.basis = kb.basis and (pf.sized or kb.basis = 'ks') and pf.units > 0
                then pf.line_total / pf.units end as uprice
      from public._price_facts(p_household_id) pf
      join public._kind_basis(p_household_id) kb on kb.kind_key = pf.kind_key
     where pf.purchased_on > current_date - 90
  ), r as (
    select f.*, row_number() over (partition by f.product_id, f.store_key order by f.promo, f.purchased_on desc, f.item_id) as rn,
           count(*) over (partition by f.product_id, f.store_key) as n,
           min(f.price) over (partition by f.product_id, f.store_key) as minp
      from f
  )
  select product_id, kind_key, store_key, store_name, round(price, 2), round(uprice, 4), kbasis,
         purchased_on, promo, purchased_on > current_date - 45, n::int, round(minp, 2)
    from r where rn = 1
$$;

-- Druh: priemer za jednotku a „bez veľkosti“ len pri porovnateľnom tovare.
create or replace function public._price_kind(p_household_id uuid, p_kind_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_key text := public.name_key(p_kind_key);
  v_basis text;
  result jsonb;
begin
  select basis into v_basis from public._kind_basis(p_household_id) where kind_key = v_key;
  if v_basis is null then return null; end if;

  with f as (
    select pf.*, case when public._comparable(pf.category_id) and pf.basis = v_basis and (pf.sized or v_basis = 'ks') and pf.units > 0 then pf.units end as q
      from public._price_facts(p_household_id) pf
     where pf.kind_key = v_key and pf.purchased_on > current_date - 90
  ),
  kn as (select * from f where q is not null),
  o as (select * from public._price_offers(p_household_id) where kind_key = v_key),
  -- obchod = jeho najlacnejší výrobok druhu; cena známa len z akcie ide až za bežné ceny
  st as (
    select distinct on (o.store_key) o.* from o where o.unit is not null
     order by o.store_key, o.promo, o.unit
  ),
  -- trend: rovnaký výrobok v rovnakom obchode, posledných 45 dní oproti 45 dňom predtým
  tr as (
    select sum(b.paid * (b.paid / b.q) / (a.paid / a.q)) / nullif(sum(b.paid), 0) - 1 as trend
      from (select product_id, store_key, sum(line_total) paid, sum(q) q from kn
             where not promo and purchased_on <= current_date - 45 group by 1, 2) a
      join (select product_id, store_key, sum(line_total) paid, sum(q) q from kn
             where not promo and purchased_on > current_date - 45 group by 1, 2) b
        using (product_id, store_key)
  ),
  agg as (select sum(q) qty, sum(line_total) paid, count(*) n from kn),
  sv as (select * from st where fresh and not promo order by unit limit 1)
  select jsonb_build_object(
    'key', v_key,
    'name', (select kind_name from f order by purchased_on desc limit 1),
    'category_id', (select category_id from f group by category_id order by count(*) desc limit 1),
    'basis', v_basis,
    'count', (select count(*) from f),
    'spent', coalesce((select round(sum(line_total), 2) from f), 0),
    'sized_count', (select n from agg),
    'qty', (select round(qty, 3) from agg),
    'paid', (select round(paid, 2) from agg),
    'avg_unit', (select round(paid / nullif(qty, 0), 2) from agg),
    'trend', (select round(trend, 4) from tr),
    'unknown', (select count(*) from f where q is null and public._comparable(category_id)),
    'stores', coalesce((select jsonb_agg(jsonb_build_object(
                 'key', st.store_key, 'name', st.store_name, 'unit', round(st.unit, 2), 'price', st.price,
                 'product_id', st.product_id, 'product', p.name, 'brand', p.brand,
                 'size_value', p.size_value, 'size_unit', p.size_unit,
                 'date', st.purchased_on, 'promo', st.promo, 'fresh', st.fresh, 'buys', st.buys
               ) order by st.promo, st.unit)
               from st join public.products p on p.id = st.product_id), '[]'),
    'products', coalesce((select jsonb_agg(x order by x.unit nulls last, x.buys desc) from (
                 select distinct on (o.product_id) o.product_id, p.name, p.brand, p.size_value, p.size_unit,
                        o.price, round(o.unit, 2) as unit, o.store_key, o.store_name, o.purchased_on as date, o.promo,
                        (select sum(o2.buys) from o o2 where o2.product_id = o.product_id) as buys,
                        (select jsonb_agg(distinct o2.store_name) from o o2 where o2.product_id = o.product_id) as stores,
                        (o.unit is null and v_basis <> 'ks' and public._comparable(p.category_id)) as size_missing
                   from o join public.products p on p.id = o.product_id
                  order by o.product_id, o.promo, o.unit nulls last, o.price) x), '[]'),
    'save', (select case when a.qty > 0 and (a.paid / a.qty - sv.unit) * a.qty / 3 >= 0.5 then
                      jsonb_build_object('store_key', sv.store_key, 'store', sv.store_name,
                        'amount', round((a.paid / a.qty - sv.unit) * a.qty / 3, 2), 'monthly_qty', round(a.qty / 3, 2)) end
               from agg a, sv),
    'series', coalesce((select jsonb_agg(jsonb_build_object('store_key', kn.store_key, 'store', kn.store_name,
                 'd', kn.purchased_on, 'v', round(kn.line_total / kn.q, 2), 'promo', kn.promo) order by kn.purchased_on)
                 from kn join st on st.store_key = kn.store_key and st.product_id = kn.product_id), '[]'),
    'purchases', coalesce((select jsonb_agg(x order by x.date desc) from (
                 select f.item_id, f.receipt_id, f.product_id, f.purchased_on as date, f.store_key, f.store_name as store,
                        f.product_name as name, f.brand, f.size_value, f.size_unit, f.packs, f.basis,
                        round(f.units, 3) as units, f.line_total, f.promo,
                        case when f.q is not null then round(f.line_total / f.q, 2) end as unit
                   from f order by f.purchased_on desc, f.item_id limit 12) x), '[]')
  ) into result;
  return result;
end $$;

-- Doplniť veľkosť: len porovnateľný tovar.
create or replace function public.analytics_missing_sizes(p_household_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(x order by x.buys desc, x.name) from (
      select f.product_id, max(f.product_name) as name, max(f.brand) as brand, max(f.kind_name) as kind,
             max(f.category_id) as category_id, kb.basis, count(*) as buys,
             (array_agg(f.price order by f.purchased_on desc))[1] as price,
             jsonb_agg(distinct f.store_name) as stores,
             -- veľkosti iných výrobkov toho istého druhu ako návrh
             (select jsonb_agg(distinct p2.size_value) from public.products p2
               where p2.household_id = p_household_id and p2.merged_into is null and p2.size_value is not null
                 and p2.size_unit = case kb.basis when 'kg' then 'g' else 'ml' end
                 and public.kind_key(p2.kind, p2.name) = f.kind_key) as sizes
        from public._price_facts(p_household_id) f
        join public._kind_basis(p_household_id) kb on kb.kind_key = f.kind_key
       where not f.sized and kb.basis in ('kg', 'l') and public._comparable(f.category_id) and f.purchased_on > current_date - 180
       group by f.product_id, f.kind_key, kb.basis
    ) x), '[]'::jsonb);
end $$;
