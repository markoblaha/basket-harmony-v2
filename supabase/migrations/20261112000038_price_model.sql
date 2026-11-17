-- =============================================================================
-- Model cien (Výdavky 2.0, krok 1): jedna vrstva faktov z bločkov pre Výdavky aj pre odhad v zozname.
--
-- Pravidlá:
--  * fakt = riadok bločku priradený výrobku; záloha za obal nikdy nie je tovar;
--  * množstvo = počet balení × veľkosť balenia (násobok z názvu „6x“ sa neráta dvakrát), vážené priamo z bločku;
--  * jednotku porovnania (kg / l / ks) určuje druh; nákup bez veľkosti balenia sa do ceny za kg/l nepočíta;
--  * „priemerne platíš“ = peniaze ÷ množstvo za 90 dní; „cena teraz“ = posledný nákup výrobku v obchode bez akcie;
--  * akcia = zľava aspoň 15 % z ceny pred zľavou;
--  * obchod má jeden kľúč (Lidl = LIDL = lidl.sk).
-- =============================================================================

-- ------------------------------------------------------------------ obchod: jeden kľúč
create function public._store_key(p_name text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(trim(regexp_replace(regexp_replace(public.name_key(p_name),
           '\.(sk|cz|com|eu)$', ''),
           '(,| -) .*$|\s+(s\.? ?r\.? ?o\.?|a\.? ?s\.?|v\.? ?o\.? ?s\.?|spol\.?.*|slovenska republika.*)$', '')), '')
$$;

create function public._receipt_store_key() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.store_key := public._store_key(new.store_name);
  return new;
end $$;
-- beží po staršom spúšťači receipts_store_key (ten kľúč nastaví len pri zmene názvu)
create trigger receipts_store_key_norm before insert or update of store_name, store_key on public.receipts
  for each row execute function public._receipt_store_key();
revoke execute on function public._receipt_store_key() from public, anon, authenticated;

-- staré bločky (aj kópie bez kľúča) dostanú kľúč z názvu
update public.receipts set store_key = public._store_key(store_name)
 where store_key is distinct from public._store_key(store_name);

-- ------------------------------------------------------------------ fakty: riadky bločkov s množstvom a cenou
create function public._price_facts(p_household_id uuid)
returns table (
  item_id uuid, receipt_id uuid, product_id uuid, kind_key text, kind_name text, category_id text,
  purchased_on date, store_key text, store_name text,
  packs numeric,        -- počet balení (pri váženom tovare null)
  basis text,           -- kg | l | ks – v čom je units
  units numeric,        -- množstvo v basis
  sized boolean,        -- množstvo je známe (vážené alebo výrobok má veľkosť balenia)
  line_total numeric,   -- zaplatené
  price numeric,        -- zaplatené za 1 balenie (pri váženom za 1 kg/l)
  promo boolean,
  product_name text, brand text, size_value numeric, size_unit text
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select i.id, i.receipt_id, coalesce(p0.merged_into, p0.id) as pid, i.quantity, lower(coalesce(i.unit, '')) as u,
           i.line_total, i.discount, i.raw_name, r.purchased_on,
           coalesce(r.store_key, '_none') as store_key, coalesce(r.store_name, 'Neznámy obchod') as store_name
      from public.receipt_items i
      join public.receipts r on r.id = i.receipt_id
      join public.products p0 on p0.id = i.product_id
     where i.household_id = p_household_id
       and i.line_total > 0 and i.quantity > 0
       and i.category_id <> 'deposit'
       -- záloha za obal priradená k nápoju (0,15 € za kus)
       and not (i.category_id in ('alcohol', 'beverages') and round(i.line_total / i.quantity, 2) = 0.15)
       and r.status in ('OK', 'NEEDS_REVIEW')
       and r.purchased_on is not null
       and not (r.status = 'NEEDS_REVIEW' and r.review_reason = 'DATE_SUSPECT')
  )
  select b.id, b.receipt_id, p.id, public.kind_key(p.kind, p.name), coalesce(p.kind, p.name), p.category_id,
         b.purchased_on, b.store_key, b.store_name,
         case when x.weighed then null else b.quantity end,
         x.basis, x.units, (x.weighed or p.size_value is not null),
         b.line_total,
         round(case when x.weighed then b.line_total / nullif(x.units, 0) else b.line_total / b.quantity end, 4),
         (b.discount > 0 and b.discount >= 0.15 * (b.line_total + b.discount)),
         p.name, p.brand, p.size_value, p.size_unit
    from base b
    join public.products p on p.id = b.pid
    cross join lateral (
      select b.u in ('kg', 'g', 'l', 'ml') as weighed,
             case when b.u in ('kg', 'g') or (b.u not in ('l', 'ml') and p.size_unit = 'g') then 'kg'
                  when b.u in ('l', 'ml') or p.size_unit = 'ml' then 'l'
                  else 'ks' end as basis,
             case when b.u in ('kg', 'l') then b.quantity
                  when b.u in ('g', 'ml') then b.quantity / 1000
                  when p.size_unit in ('g', 'ml') then b.quantity * p.size_value / 1000
                  -- balenie po N kusov: ak bloček už ráta kusy („PLZ 6x“, množstvo 6), nenásobí sa znova
                  when p.size_unit = 'ks' then
                    case when b.quantity >= p.size_value and mod(b.quantity, p.size_value) = 0
                              and b.raw_name ~* ('(^|[^0-9])' || p.size_value::int::text || '\s*(x|ks)')
                         then b.quantity else b.quantity * p.size_value end
                  else b.quantity end as units
    ) x
$$;
revoke execute on function public._price_facts(uuid) from public, anon, authenticated;

-- Jednotka porovnania druhu: najčastejšia medzi nákupmi so známym množstvom (inak kusy).
create function public._kind_basis(p_household_id uuid)
returns table (kind_key text, basis text)
language sql stable security definer set search_path = '' as $$
  select kind_key, basis from (
    select f.kind_key, f.basis,
           row_number() over (partition by f.kind_key order by (count(*) filter (where f.sized)) desc, count(*) desc, f.basis) as rn
      from public._price_facts(p_household_id) f group by f.kind_key, f.basis
  ) t where rn = 1
$$;
revoke execute on function public._kind_basis(uuid) from public, anon, authenticated;

-- Ponuky: „cena teraz“ výrobku v obchode = posledný nákup bez akcie za 90 dní (ak je len akcia, tá).
create function public._price_offers(p_household_id uuid)
returns table (
  product_id uuid, kind_key text, store_key text, store_name text, price numeric, unit numeric, basis text,
  purchased_on date, promo boolean, fresh boolean, buys int, min_price numeric
)
language sql stable security definer set search_path = '' as $$
  with f as (
    select pf.*, kb.basis as kbasis,
           -- cena za jednotku druhu; null, keď množstvo nepoznáme alebo je v inej jednotke
           case when pf.basis = kb.basis and (pf.sized or kb.basis = 'ks') and pf.units > 0
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
revoke execute on function public._price_offers(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ ceny druhu (Maslo, Pivo…)
create function public._price_kind(p_household_id uuid, p_kind_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_key text := public.name_key(p_kind_key);
  v_basis text;
  result jsonb;
begin
  select basis into v_basis from public._kind_basis(p_household_id) where kind_key = v_key;
  if v_basis is null then return null; end if;

  with f as (
    select pf.*, case when pf.basis = v_basis and (pf.sized or v_basis = 'ks') and pf.units > 0 then pf.units end as q
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
    'unknown', (select count(*) from f where q is null),
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
                        (o.unit is null and v_basis <> 'ks') as size_missing
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
revoke execute on function public._price_kind(uuid, text) from public, anon, authenticated;

create function public.analytics_price_kind(p_household_id uuid, p_kind_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  result := public._price_kind(p_household_id, p_kind_key);
  if result is null then raise exception 'NOT_FOUND'; end if;
  return result;
end $$;
revoke execute on function public.analytics_price_kind(uuid, text) from public, anon;
grant execute on function public.analytics_price_kind(uuid, text) to authenticated;

-- ------------------------------------------------------------------ ceny výrobku (značka + balenie)
create function public._price_product(p_product_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.products where id = p_product_id),
  f as (select pf.* from p, public._price_facts(p.household_id) pf where pf.product_id = p.id),
  kb as (select kb.basis from p, public._kind_basis(p.household_id) kb where kb.kind_key = public.kind_key(p.kind, p.name)),
  w as (select * from f where purchased_on > current_date - 90),
  now_ as (select * from f order by promo, purchased_on desc, item_id limit 1),
  same as (select f.* from f, now_ n where f.store_key = n.store_key and not f.promo),
  base as (select percentile_cont(0.5) within group (order by same.price) as price from same, now_ n where same.item_id <> n.item_id),
  off as (
    select distinct on (f.store_key) f.store_key, f.store_name, f.price, f.purchased_on, f.promo,
           (select min(f2.price) from f f2 where f2.store_key = f.store_key) as minp,
           (select count(*) from f f2 where f2.store_key = f.store_key) as n
      from f order by f.store_key, f.promo, f.purchased_on desc, f.item_id
  )
  select jsonb_build_object(
    'basis', (select basis from kb),
    'weighed', (select bool_or(packs is null) from f),
    'count', (select count(*) from f),
    'now', (select jsonb_build_object('price', round(n.price, 2), 'store_key', n.store_key, 'store', n.store_name,
                     'date', n.purchased_on, 'promo', n.promo,
                     'unit', case when n.sized and n.units > 0 then round(n.line_total / n.units, 2) end) from now_ n),
    'avg', (select round(sum(line_total) / nullif(sum(coalesce(packs, units)), 0), 2) from w),
    'avg_count', (select count(*) from w),
    'min', (select jsonb_build_object('price', round(price, 2), 'store', store_name, 'date', purchased_on, 'promo', promo)
              from f order by price, purchased_on desc limit 1),
    'change', (select case when b.price > 0 and abs(n.price / b.price - 1) >= 0.03 then jsonb_build_object(
                        'pct', round((n.price / b.price - 1)::numeric, 4),
                        'since', (select min(s.purchased_on) from same s where round(s.price, 2) = round(n.price, 2)
                                    and s.purchased_on > coalesce((select max(s2.purchased_on) from same s2
                                                                    where round(s2.price, 2) <> round(n.price, 2)), '1900-01-01'))) end
                 from now_ n, base b),
    'stores', coalesce((select jsonb_agg(jsonb_build_object('key', store_key, 'name', store_name, 'price', round(price, 2),
                 'date', purchased_on, 'promo', promo, 'min', round(minp, 2), 'buys', n,
                 'fresh', purchased_on > current_date - 45) order by promo, price) from off), '[]'),
    'series', coalesce((select jsonb_agg(jsonb_build_object('store_key', store_key, 'store', store_name, 'd', purchased_on,
                 'v', round(price, 2), 'promo', promo) order by purchased_on) from f), '[]'),
    'purchases', coalesce((select jsonb_agg(x order by x.date desc) from (
                 select item_id, receipt_id, purchased_on as date, store_key, store_name as store, packs, basis,
                        round(units, 3) as units, round(price, 2) as price, line_total, promo
                   from f order by purchased_on desc, item_id limit 20) x), '[]')
  )
$$;
revoke execute on function public._price_product(uuid) from public, anon, authenticated;

create function public.analytics_price_product(p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_h uuid;
begin
  perform public._require_uid();
  select household_id into v_h from public.products where id = p_product_id and merged_into is null;
  if v_h is null or not public.is_member(v_h) then raise exception 'NOT_FOUND'; end if;
  return public._price_product(p_product_id);
end $$;
revoke execute on function public.analytics_price_product(uuid) from public, anon;
grant execute on function public.analytics_price_product(uuid) to authenticated;

-- ------------------------------------------------------------------ obchod: produkty tu a inde
-- Pre každý druh kupovaný v obchode: cena tu a najlacnejší obchod (bez akcií).
create function public._price_store(p_household_id uuid, p_store_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with o as (select * from public._price_offers(p_household_id) where unit is not null),
  st as (select distinct on (kind_key, store_key) * from o order by kind_key, store_key, promo, unit),
  here as (select * from st where store_key = p_store_key),
  best as (select distinct on (kind_key) * from st where not promo order by kind_key, unit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind_key', h.kind_key, 'name', coalesce(p.kind, p.name), 'category_id', p.category_id, 'basis', h.basis,
           'unit', round(h.unit, 2), 'promo', h.promo, 'date', h.purchased_on,
           'best_key', b.store_key, 'best_store', b.store_name, 'best_unit', round(b.unit, 2)
         ) order by coalesce(p.kind, p.name)), '[]'::jsonb)
    from here h join public.products p on p.id = h.product_id
    left join best b on b.kind_key = h.kind_key
$$;
revoke execute on function public._price_store(uuid, text) from public, anon, authenticated;

create function public.analytics_price_store(p_household_id uuid, p_store_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  return public._price_store(p_household_id, p_store_key);
end $$;
revoke execute on function public.analytics_price_store(uuid, text) from public, anon;
grant execute on function public.analytics_price_store(uuid, text) to authenticated;

-- ------------------------------------------------------------------ veľkosť balenia jedným ťuknutím
-- Výrobky bez veľkosti, ktorých druh sa porovnáva na kg / l (bez nej nie sú v cene za jednotku).
create function public.analytics_missing_sizes(p_household_id uuid) returns jsonb
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
       where not f.sized and kb.basis in ('kg', 'l') and f.purchased_on > current_date - 180
       group by f.product_id, f.kind_key, kb.basis
    ) x), '[]'::jsonb);
end $$;
revoke execute on function public.analytics_missing_sizes(uuid) from public, anon;
grant execute on function public.analytics_missing_sizes(uuid) to authenticated;

create function public.set_product_size(p_product_id uuid, p_size_value numeric, p_size_unit text) returns public.products
language plpgsql security definer set search_path = '' as $$
declare p public.products;
begin
  perform public._require_uid();
  if p_size_value is null or p_size_value <= 0 or p_size_unit not in ('g', 'ml', 'ks') then raise exception 'INVALID_INPUT'; end if;
  select * into p from public.products where id = p_product_id and merged_into is null for update;
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;
  update public.products set size_value = p_size_value, size_unit = p_size_unit where id = p.id returning * into p;
  return p;
end $$;
revoke execute on function public.set_product_size(uuid, numeric, text) from public, anon;
grant execute on function public.set_product_size(uuid, numeric, text) to authenticated;

-- ------------------------------------------------------------------ katalóg pre zoznam: nákupy z rovnakých faktov
-- Nákupy idú z _price_facts (bez záloh, zlúčené výrobky pri koreni) a nesú kľúč obchodu (k), akciu (a)
-- a cenu za balenie (p) – odhad v zozname tak počíta z tých istých čísel ako Výdavky.
create or replace function public.item_catalog(p_household_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  return coalesce((
    with buys as (
      select f.* from public._price_facts(p_household_id) f where f.purchased_on > current_date - 180
    )
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'kind', p.kind, 'brand', p.brand, 'category_id', p.category_id,
      'size_value', p.size_value, 'size_unit', p.size_unit,
      'buys', coalesce((
        select jsonb_agg(jsonb_build_object('d', b.purchased_on, 's', b.store_name, 'k', b.store_key, 't', b.line_total,
                           'q', coalesce(b.packs, b.units), 'u', case when b.packs is null then b.basis else 'ks' end,
                           'p', b.price, 'a', b.promo)
                         order by b.purchased_on)
          from buys b where b.product_id = p.id
      ), '[]'::jsonb)
    ) order by p.name)
      from public.products p
     where p.household_id = p_household_id and p.merged_into is null
  ), '[]'::jsonb);
end $$;
