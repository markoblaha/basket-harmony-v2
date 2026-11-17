-- =============================================================================
-- Druh produktu: úroveň medzi kategóriou a výrobkom z bločku.
--   Kategória  Mäso a ryby
--   Druh       Kuracie prsia                          (to, čo píšeme do zoznamu)
--   Výrobok    Kuracie prsné rezne · Pikok · 500 g    (z bločku: značka, balenie)
-- Analytika ukazuje druhy s nakúpeným množstvom a priemernou cenou za kg/l/ks
-- a v detaile druhu výrobky (značky, balenia) a obchody podľa ceny za jednotku.
-- Druh navrhuje AI pri zjednotení produktov; človek ho môže zmeniť (kind_manual).
-- Bez druhu sa produkt správa, akoby jeho druh bol jeho názov. Nič sa nemaže.
-- =============================================================================

alter table public.products
  add column kind text check (char_length(kind) between 1 and 60),
  add column kind_manual boolean not null default false;
comment on column public.products.kind is 'Druh produktu ("Pivo", "Kuracie prsia") – spája rôzne značky a balenia. Null = podľa názvu.';
comment on column public.products.kind_manual is 'Druh nastavil človek: AI ho už nemení.';

-- Kľúč druhu (rovnaký zápis bez diakritiky a veľkosti písmen = ten istý druh).
create function public.kind_key(p_kind text, p_name text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select public.name_key(coalesce(nullif(trim(p_kind), ''), p_name))
$$;

-- ------------------------------------------------------------------ zjednotenie od AI: aj druh
create or replace function public.apply_product_normalization(p_household_id uuid, p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  p public.products;
  other uuid;
  v_name text;
  v_brand text;
  v_size numeric;
  v_unit text;
  v_cat text;
  v_key text;
  v_kind text;
  n int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into p from public.products
     where id = (it ->> 'product_id')::uuid and household_id = p_household_id and merged_into is null
     for update;
    continue when not found;

    v_name := left(nullif(trim(it ->> 'name'), ''), 200);
    continue when v_name is null;
    v_brand := left(nullif(trim(it ->> 'brand'), ''), 80);
    v_unit := nullif(it ->> 'size_unit', '');
    v_size := nullif(it ->> 'size_value', '')::numeric;
    if v_unit not in ('g', 'ml', 'ks') or v_size is null or v_size <= 0 or v_size > 1000000 then
      v_unit := null;
      v_size := null;
    end if;
    v_cat := it ->> 'category_id';
    if v_cat is null or not exists (select 1 from public.categories where id = v_cat) then v_cat := p.category_id; end if;
    if p.category_manual then v_cat := p.category_id; end if;
    v_kind := left(nullif(trim(it ->> 'kind'), ''), 60);
    v_key := public._product_key(v_name, v_brand, v_size, v_unit);

    select id into other from public.products
     where household_id = p_household_id and product_key = v_key and merged_into is null and id <> p.id;
    if other is not null then
      -- Rovnaký produkt už existuje: tento sa doň presunie.
      update public.products set normalized = true,
        category_id = case when category_manual then category_id else v_cat end,
        kind = case when kind_manual then kind else coalesce(v_kind, kind) end
       where id = other;
      perform public._merge_product(other, p.id);
    else
      update public.products set name = v_name, brand = v_brand, size_value = v_size, size_unit = v_unit,
        product_key = v_key, category_id = v_cat, normalized = true,
        kind = case when kind_manual then kind else coalesce(v_kind, kind) end
       where id = p.id;
      update public.receipt_items set category_id = v_cat where product_id = p.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Druhy od AI pre už zjednotené produkty bez druhu (volá len server). Ručne nastavený druh sa nemení.
create function public.apply_product_kinds(p_household_id uuid, p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  n int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.products
       set kind = coalesce(left(nullif(trim(it ->> 'kind'), ''), 60), left(name, 60))
     where id = (it ->> 'product_id')::uuid and household_id = p_household_id
       and merged_into is null and not kind_manual;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Človek zmení druh produktu. Prázdny druh = podľa názvu; AI ho potom už nemení.
create function public.set_product_kind(p_product_id uuid, p_kind text) returns public.products
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
  v_kind text := left(nullif(trim(p_kind), ''), 60);
begin
  perform public._require_uid();
  select * into p from public.products where id = p_product_id and merged_into is null for update;
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;
  update public.products set kind = coalesce(v_kind, left(name, 60)), kind_manual = true
   where id = p.id returning * into p;
  return p;
end $$;

-- ------------------------------------------------------------------ nákupy s druhom
-- Nákupy (ako _purchases) doplnené o druh, značku, balenie a nakúpené množstvo v základnej jednotke.
create function public._kind_purchases(p_household_id uuid)
returns table (
  product_id uuid, item_id uuid, receipt_id uuid, purchased_on date, store_key text, store_name text,
  quantity numeric, line_total numeric, discount numeric, paid_unit numeric, basis text, category_id text,
  units numeric, pieces numeric, kind_key text, kind_name text, product_name text, brand text,
  size_value numeric, size_unit text, shop_key text
)
language sql stable security definer set search_path = '' as $$
  select pp.product_id, pp.item_id, pp.receipt_id, pp.purchased_on, pp.store_key, pp.store_name,
         pp.quantity, pp.line_total, pp.discount, pp.paid_unit, pp.basis, pp.category_id,
         case when pp.paid_unit > 0 then round(pp.line_total / pp.paid_unit, 4) end,
         -- kusy: pri tovare v baleniach (0,5 l pivo) počet kusov z bločku, pri váženom nič
         case when pp.basis = 'ks' and pp.paid_unit > 0 then round(pp.line_total / pp.paid_unit, 4)
              when p.size_value is not null then pp.quantity end,
         public.kind_key(p.kind, p.name), coalesce(p.kind, p.name),
         p.name, p.brand, p.size_value, p.size_unit,
         -- obchod: kľúč, alebo jeho názov, keď kľúč chýba (staršie bločky)
         case when pp.store_key = '_none' then '_' || public.name_key(pp.store_name) else pp.store_key end
    from public._purchases(p_household_id) pp
    join public.products p on p.id = pp.product_id
$$;

-- Druhy v kategórii za obdobie: suma, počet nákupov a výrobkov, nakúpené množstvo a priemerná
-- cena za jednotku (v najčastejšej jednotke druhu – kg, l alebo ks).
create function public._category_kinds(p_household_id uuid, p_category_id text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = '' as $$
  with kp as (
    select * from public._kind_purchases(p_household_id)
     where category_id = p_category_id and purchased_on between p_from and p_to
  ), kb as (
    select kind_key, basis, row_number() over (partition by kind_key order by count(*) desc, sum(line_total) desc) as rn
      from kp group by kind_key, basis
  ), ku as (
    -- množstvo v jednotke druhu: kg/l z tých nákupov, kde sa dá; kusy aj z balení v l/kg
    select kp.kind_key, kb.basis, sum(q) as units, sum(kp.line_total) as paid
      from kp join kb on kb.kind_key = kp.kind_key and kb.rn = 1
      cross join lateral (select case when kb.basis = 'ks' then kp.pieces when kp.basis = kb.basis then kp.units end as q) x
     where x.q > 0 group by kp.kind_key, kb.basis
  ), k as (
    select kind_key, max(kind_name) as name, round(sum(line_total), 2) as amount, count(*) as count,
           count(distinct product_id) as products,
           (array_agg(distinct brand) filter (where brand is not null))[1:3] as brands
      from kp group by kind_key
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', k.kind_key, 'name', k.name, 'amount', k.amount, 'count', k.count, 'products', k.products,
           'brands', coalesce(to_jsonb(k.brands), '[]'::jsonb), 'basis', kb.basis, 'units', round(ku.units, 3),
           'avg_unit', case when ku.units > 0 then round(ku.paid / ku.units, 2) end
         ) order by k.amount desc), '[]'::jsonb)
    from k left join kb on kb.kind_key = k.kind_key and kb.rn = 1
    left join ku on ku.kind_key = k.kind_key
$$;

-- ------------------------------------------------------------------ detail druhu
-- p_kind_key: názov druhu alebo jeho kľúč (oboje sa porovná bez diakritiky a veľkosti písmen).
create function public.analytics_kind(
  p_household_id uuid, p_kind_key text, p_from date, p_to date, p_prev_from date, p_prev_to date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  prev_cut date := case when current_date between p_from and p_to
                        then least(p_prev_to, p_prev_from + (current_date - p_from)) else p_prev_to end;
  v_basis text;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;

  -- Jednotka druhu = najčastejšia (kg pri mäse, l pri pive, ks pri plienkach).
  select basis into v_basis from public._kind_purchases(p_household_id)
   where kind_key = public.name_key(p_kind_key) group by basis order by count(*) desc, sum(line_total) desc limit 1;
  if v_basis is null then raise exception 'NOT_FOUND'; end if;

  with kt as (select * from public._kind_purchases(p_household_id) where kind_key = public.name_key(p_kind_key)),
  cur as (select * from kt where purchased_on between p_from and p_to),
  -- nákupy s množstvom v jednotke druhu (q) a cenou za jednotku (uprice)
  cu as (select cur.*, x.q, round(cur.line_total / x.q, 4) as uprice from cur
           cross join lateral (select case when v_basis = 'ks' then cur.pieces when cur.basis = v_basis then cur.units end as q) x
          where x.q > 0)
  select jsonb_build_object(
    'name', (select kind_name from kt order by purchased_on desc limit 1),
    'category_id', (select category_id from kt group by category_id order by count(*) desc limit 1),
    'basis', v_basis,
    'amount', coalesce((select sum(line_total) from cur), 0),
    'count', (select count(*) from cur),
    'prev_amount', coalesce((select sum(line_total) from kt where purchased_on between p_prev_from and prev_cut), 0),
    'prev_cut', prev_cut,
    'units', (select round(sum(q), 3) from cu),
    'avg_unit', (select round(sum(line_total) / nullif(sum(q), 0), 2) from cu),
    'min_unit', (select jsonb_build_object('price', round(uprice, 2), 'store', store_name, 'date', purchased_on)
                   from cu order by uprice, purchased_on desc limit 1),
    'max_unit', (select jsonb_build_object('price', round(uprice, 2), 'store', store_name, 'date', purchased_on)
                   from cu order by uprice desc, purchased_on desc limit 1),
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'amount', coalesce((select sum(line_total) from kt where to_char(purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                 from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
    -- Výrobky (značky a balenia) v období; cena za jednotku = zaplatené / nakúpené množstvo.
    'products', coalesce((select jsonb_agg(x order by x.amount desc) from (
                   select product_id, max(product_name) as name, max(brand) as brand, max(size_value) as size_value,
                          max(size_unit) as size_unit, count(*) as count, round(sum(line_total), 2) as amount,
                          max(basis) as basis, round(sum(units), 3) as units,
                          round(sum(line_total) / nullif(sum(units), 0), 2) as avg_unit,
                          round(sum(pieces), 3) as pieces,
                          (array_agg(store_name order by purchased_on desc))[1] as last_store,
                          max(purchased_on) as last_date
                     from cur group by product_id) x), '[]'),
    -- Obchody podľa priemernej ceny za jednotku druhu (najlacnejší prvý).
    'stores', coalesce((select jsonb_agg(x order by x.avg_unit nulls last) from (
                 select max(store_key) as key, max(store_name) as name, count(*) as count, round(sum(line_total), 2) as amount,
                        round(sum(line_total) / nullif(sum(q), 0), 2) as avg_unit
                   from cu group by shop_key) x), '[]'),
    'purchases', coalesce((select jsonb_agg(x order by x.date desc) from (
                    select item_id, receipt_id, product_id, purchased_on as date, store_name as store, product_name as name,
                           brand, size_value, size_unit, quantity, line_total, discount,
                           round(paid_unit, 2) as paid_unit, basis
                      from cur order by purchased_on desc limit 80) x), '[]')
  ) into result;
  return result;
end $$;

-- ------------------------------------------------------------------ Prehľad: aj produkty bez druhu
create or replace function public.analytics_overview(
  p_household_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date, p_scope text default 'all'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_everyday boolean := p_scope = 'everyday';
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  span_from date := least(p_prev_from, months_from, p_from);
  span_to date := greatest(p_to, p_prev_to);
  offset_days int := case when current_date between p_from and p_to then current_date - p_from end;
  -- Pri prebiehajúcom období porovnávame s minulým obdobím k rovnakému dňu.
  prev_cut date := case when current_date between p_from and p_to
                        then least(p_prev_to, p_prev_from + (current_date - p_from)) else p_prev_to end;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_from > p_to or p_prev_from > p_prev_to or p_to - p_from > 3700 then raise exception 'VALIDATION'; end if;

  with base as (
    select s.*, r.category_id as rest_cat_raw, coalesce(rc.everyday, false) as rest_everyday,
           s.total - s.items_total as rest,
           case when s.purchased_on between p_from and p_to then 'cur'
                when s.purchased_on between p_prev_from and p_prev_to then 'prev' end as period
      from public._spend_receipts(p_household_id, span_from, span_to) s
      join public.receipts r on r.id = s.receipt_id
      left join public.categories rc on rc.id = r.category_id
  ), sr as (
    select base.*,
           case when v_everyday then base.everyday + case when rest_everyday then greatest(rest, 0) else 0 end
                else base.total - base.deposits end as amount,
           coalesce(rest_cat_raw, case when rest < 0 then '_receipt_discount' else '_unassigned' end) as rest_cat,
           (period = 'prev' and purchased_on <= prev_cut) as in_cut
      from base
  ), counted as (
    select * from sr where not v_everyday or sr.amount > 0
  ), cur as (select * from counted where period = 'cur'),
     prev as (select * from counted where period = 'prev'),
  items as (
    select i.*, c.everyday as cat_everyday, sr.period, sr.in_cut
      from public.receipt_items i
      join sr on sr.receipt_id = i.receipt_id
      join public.categories c on c.id = i.category_id
     where sr.period is not null and i.category_id <> 'deposit' and (not v_everyday or c.everyday)
  ), cats as (
    select id, sum(amount) as amount, sum(items) as items, sum(prev_amount) as prev_amount from (
      select category_id as id,
             sum(line_total) filter (where period = 'cur') as amount,
             count(*) filter (where period = 'cur') as items,
             coalesce(sum(line_total) filter (where in_cut), 0) as prev_amount
        from items group by category_id
      union all
      select rest_cat,
             sum(rest) filter (where period = 'cur'), 0,
             coalesce(sum(rest) filter (where in_cut), 0)
        from sr
       where period is not null and rest <> 0 and (not v_everyday or rest_everyday and rest > 0)
       group by rest_cat
    ) x group by id
  ), stores as (
    select store_key as key, max(store_name) as name,
           sum(amount) filter (where period = 'cur') as amount,
           count(*) filter (where period = 'cur') as receipts,
           coalesce(sum(amount) filter (where in_cut), 0) as prev_amount,
           max(purchased_on) filter (where period = 'cur') as last_date
      from counted where period is not null group by store_key
  ), months as (
    select to_char(m, 'YYYY-MM') as month,
           coalesce((select sum(amount) from counted c where to_char(c.purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0) as amount
      from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m
  )
  select jsonb_build_object(
    'total',          coalesce((select sum(amount) from cur), 0),
    'receipts',       (select count(*) from cur where amount <> 0),
    'days',           (select count(distinct purchased_on) from cur where amount <> 0),
    'items',          (select count(*) from items where period = 'cur'),
    'discounts',      coalesce((select sum(discount) from items where period = 'cur'), 0),
    'deposits',       coalesce((select sum(deposits) from cur), 0),
    'prev_total',     coalesce((select sum(amount) from prev), 0),
    'prev_receipts',  (select count(*) from prev where amount <> 0),
    'offset_days',    offset_days,
    'prev_cut',       prev_cut,
    'prev_to_date',   case when offset_days is null then null else
                        coalesce((select sum(amount) from prev where in_cut), 0) end,
    'daily',          coalesce((select jsonb_agg(jsonb_build_object('d', d, 'a', a) order by d)
                                  from (select purchased_on as d, sum(amount) as a from cur group by 1) x), '[]'),
    'prev_daily',     coalesce((select jsonb_agg(jsonb_build_object('d', d, 'a', a) order by d)
                                  from (select purchased_on as d, sum(amount) as a from prev group by 1) x), '[]'),
    'categories',     coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', round(coalesce(amount, 0), 2),
                                  'items', items, 'prev_amount', round(prev_amount, 2)) order by coalesce(amount, 0) desc)
                                  from cats where coalesce(amount, 0) <> 0 or prev_amount <> 0), '[]'),
    'stores',         coalesce((select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'amount', round(coalesce(amount, 0), 2),
                                  'receipts', receipts, 'prev_amount', round(prev_amount, 2), 'last_date', last_date)
                                  order by coalesce(amount, 0) desc)
                                  from stores where coalesce(amount, 0) <> 0), '[]'),
    'months',         (select jsonb_agg(jsonb_build_object('month', month, 'amount', round(amount, 2)) order by month) from months),
    'price_changes',  coalesce((select jsonb_agg(n) from public._price_news(p_household_id, p_from, p_to) n), '[]'),
    'restock',        coalesce((select jsonb_agg(to_jsonb(rs)) from public._restock(p_household_id) rs), '[]'),
    'budgets',        coalesce((select jsonb_agg(jsonb_build_object('category_id', b.category_id, 'amount', b.amount,
                                  'spent', case when b.category_id is null then coalesce((select sum(amount) from cur), 0)
                                                else coalesce((select amount from cats where id = b.category_id), 0) end))
                                  from public.budgets b where b.household_id = p_household_id and b.amount is not null), '[]'),
    'pending_review', (select count(*) from cur where status = 'NEEDS_REVIEW'),
    'suspect_dates',  (select count(*) from public.receipts r where r.household_id = p_household_id
                         and r.status = 'NEEDS_REVIEW' and r.review_reason = 'DATE_SUSPECT'),
    'uncategorized',  (select count(*) from items where period = 'cur' and category_id = 'other'),
    -- Produkty na spracovanie AI: nezjednotené alebo bez druhu (doplní sa pri otvorení Prehľadov).
    'unnormalized',   (select count(*) from public.products p where p.household_id = p_household_id
                         and p.merged_into is null and (not p.normalized or p.kind is null))
  ) into result;
  return result;
end $$;

-- ------------------------------------------------------------------ kategória: aj druhy
create or replace function public.analytics_category(
  p_household_id uuid, p_category_id text, p_from date, p_to date, p_prev_from date, p_prev_to date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  prev_cut date := case when current_date between p_from and p_to
                        then least(p_prev_to, p_prev_from + (current_date - p_from)) else p_prev_to end;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;

  with sr as (
    select s.*, s.total - s.items_total as rest, r.origin,
           coalesce(r.category_id, case when s.total - s.items_total < 0 then '_receipt_discount' else '_unassigned' end) as rest_cat
      from public._spend_receipts(p_household_id, least(p_prev_from, months_from), p_to) s
      join public.receipts r on r.id = s.receipt_id
  ), rest as (
    -- Časť sumy dokladov bez rozpisu, ktorá patrí do tejto kategórie (napr. platby z výpisu).
    select * from sr where rest_cat = p_category_id and rest <> 0
  ), it as (
    select i.*, sr.purchased_on, sr.store_key, sr.store_name
      from public.receipt_items i join sr on sr.receipt_id = i.receipt_id
     where i.category_id = p_category_id
  ), cur as (select * from it where purchased_on between p_from and p_to),
  amounts as (
    select purchased_on as d, line_total as a from it
    union all
    select purchased_on, rest from rest
  )
  select jsonb_build_object(
    'amount', coalesce((select sum(a) from amounts where d between p_from and p_to), 0),
    'prev_amount', coalesce((select sum(a) from amounts where d between p_prev_from and prev_cut), 0),
    'prev_cut', prev_cut,
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'amount', coalesce((select sum(a) from amounts where to_char(d, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                 from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
    'products', coalesce((select jsonb_agg(x order by x.amount desc) from (
                   select cur.product_id, max(p.name) as name, round(sum(cur.line_total), 2) as amount, count(*) as count
                     from cur left join public.products p on p.id = cur.product_id
                    group by cur.product_id order by sum(cur.line_total) desc limit 20) x), '[]'),
    'kinds', public._category_kinds(p_household_id, p_category_id, p_from, p_to),
    'stores', coalesce((select jsonb_agg(x order by x.amount desc) from (
                 select key, max(name) as name, round(sum(a), 2) as amount, count(*) as count from (
                   select store_key as key, store_name as name, line_total as a from cur
                   union all
                   select store_key, store_name, rest from rest where purchased_on between p_from and p_to
                 ) y group by key) x), '[]'),
    'items', coalesce((select jsonb_agg(x order by x.date desc) from (
                select cur.id as item_id, cur.receipt_id, cur.product_id, cur.purchased_on as date, cur.store_name as store,
                       cur.raw_name as name, cur.line_total, cur.discount
                  from cur order by cur.purchased_on desc limit 80) x), '[]'),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', receipt_id, 'date', purchased_on,
                   'store', store_name, 'amount', round(rest, 2), 'total', total, 'origin', origin) order by purchased_on desc)
                   from rest where purchased_on between p_from and p_to), '[]'),
    'liters', (select round(sum(quantity), 2) from cur where lower(coalesce(unit, '')) = 'l' and quantity > 0),
    'per_liter', (select round(sum(line_total) / nullif(sum(quantity), 0), 3) from cur
                   where lower(coalesce(unit, '')) = 'l' and quantity > 0)
  ) into result;
  return result;
end $$;

revoke execute on function public.apply_product_kinds(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_product_kinds(uuid, jsonb) to service_role;
revoke execute on function public._kind_purchases(uuid) from public, anon, authenticated;
revoke execute on function public._category_kinds(uuid, text, date, date) from public, anon, authenticated;
revoke execute on function public.analytics_kind(uuid, text, date, date, date, date) from public, anon;
grant execute on function public.analytics_kind(uuid, text, date, date, date, date) to authenticated;
revoke execute on function public.set_product_kind(uuid, text) from public, anon;
grant execute on function public.set_product_kind(uuid, text) to authenticated;
