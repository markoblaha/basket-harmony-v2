-- =============================================================================
-- Rodinné financie a opravy analytiky.
--
-- 1) Porovnanie s minulým obdobím je pri prebiehajúcom období vždy "k rovnakému
--    dňu" – aj pri kategóriách a obchodoch (nie 13 dní októbra oproti celému septembru).
-- 2) Jednorazový pokles ceny je "akcia", nie zlacnenie. Zlacnenie/zdraženie je až
--    trvalá zmena oproti obvyklej (strednej) cene v tom istom obchode.
-- 3) Palivo: cena za liter (riadky v litroch) a natankované litre.
-- 4) Doklad môže mať vlastnú kategóriu (platba z bankového výpisu alebo ručne
--    zadaný výdavok bez položiek, napr. nájom). Bez položiek sa celá suma zaradí
--    do tejto kategórie namiesto "Nerozpísané".
-- 5) Import platieb z bankového výpisu a ručný výdavok.
-- Nič sa nemaže; existujúce funkcie sa nahrádzajú, nové pribúdajú.
-- =============================================================================

-- ------------------------------------------------------------------ kategórie pre rodinný rozpočet
insert into public.categories (id, name, emoji, sort_order, everyday) values
  ('groceries', 'Nákup potravín (bez rozpisu)', '🧺', 5,   true),
  ('transport', 'Auto a doprava',               '🚗', 195, false),
  ('leisure',   'Voľný čas',                    '🎟️', 205, false),
  ('housing',   'Bývanie a energie',            '🏠', 230, false),
  ('telecom',   'Telefón, internet a predplatné', '📱', 240, false),
  ('insurance', 'Poistenie a financie',         '🛡️', 250, false)
on conflict (id) do nothing;

-- ------------------------------------------------------------------ doklad: pôvod a kategória
alter table public.receipts add column origin text not null default 'RECEIPT'
  check (origin in ('RECEIPT', 'BANK', 'MANUAL'));
alter table public.receipts add column category_id text references public.categories (id);
comment on column public.receipts.origin is 'RECEIPT = bloček/faktúra, BANK = platba z výpisu, MANUAL = zadané ručne.';
comment on column public.receipts.category_id is 'Kategória časti sumy, ktorá nie je rozpísaná na položky (celá suma pri platbe bez položiek).';
grant update (category_id) on public.receipts to authenticated;

-- ------------------------------------------------------------------ nákupy: aj litre
create or replace function public._purchases(p_household_id uuid)
returns table (
  product_id uuid, item_id uuid, receipt_id uuid, purchased_on date, store_key text, store_name text,
  quantity numeric, line_total numeric, discount numeric, shelf_unit numeric, paid_unit numeric,
  basis text, category_id text
)
language sql stable security definer set search_path = '' as $$
  select i.product_id, i.id, r.id, r.purchased_on, coalesce(r.store_key, '_none'), coalesce(r.store_name, 'Neznámy obchod'),
         i.quantity, i.line_total, i.discount,
         case when b.units > 0 then round((i.line_total + i.discount) / b.units, 4) end,
         case when b.units > 0 then round(i.line_total / b.units, 4) end,
         b.basis, i.category_id
    from public.receipt_items i
    join public.receipts r on r.id = i.receipt_id
    left join public.products p on p.id = i.product_id
    cross join lateral (
      select
        case when lower(coalesce(i.unit, '')) = 'kg' then i.quantity
             when lower(coalesce(i.unit, '')) = 'g' then i.quantity / 1000
             when lower(coalesce(i.unit, '')) = 'l' then i.quantity
             when lower(coalesce(i.unit, '')) = 'ml' then i.quantity / 1000
             when p.size_unit in ('g', 'ml') then i.quantity * p.size_value / 1000
             when p.size_unit = 'ks' then i.quantity * p.size_value
             else i.quantity end as units,
        case when lower(coalesce(i.unit, '')) in ('kg', 'g') then 'kg'
             when lower(coalesce(i.unit, '')) in ('l', 'ml') then 'l'
             when p.size_unit = 'g' then 'kg'
             when p.size_unit = 'ml' then 'l'
             else 'ks' end as basis
    ) b
   where i.household_id = p_household_id
     and i.product_id is not null
     and i.line_total > 0
     and r.status in ('OK', 'NEEDS_REVIEW')
     and r.purchased_on is not null
     and not (r.status = 'NEEDS_REVIEW' and r.review_reason = 'DATE_SUSPECT')
$$;

-- ------------------------------------------------------------------ cena: zmena alebo akcia
-- Posledná cena na regáli oproti obvyklej (strednej) cene predchádzajúcich nákupov
-- v tom istom obchode za posledných 180 dní. Pokles, ktorý sa neopakoval (aj predchádzajúci
-- nákup bol za obvyklú cenu), je akcia ('PROMO'); inak trvalá zmena ('CHANGE').
create function public._price_status(p_household_id uuid)
returns table (product_id uuid, name text, basis text, store_key text, store_name text, purchased_on date,
               new_price numeric, old_price numeric, change numeric, kind text)
language sql stable security definer set search_path = '' as $$
  with pur as (
    select pp.*, row_number() over (partition by pp.product_id order by pp.purchased_on desc, pp.item_id) as rn
      from public._purchases(p_household_id) pp
     where pp.shelf_unit is not null
  ), last as (
    select * from pur where rn = 1
  ), prevs as (
    select pur.product_id, pur.shelf_unit,
           row_number() over (partition by pur.product_id order by pur.purchased_on desc, pur.item_id) as prn
      from pur join last l on l.product_id = pur.product_id and l.basis = pur.basis and l.store_key = pur.store_key
     where pur.rn > 1 and pur.purchased_on >= l.purchased_on - 180
  ), base as (
    select product_id,
           (percentile_cont(0.5) within group (order by shelf_unit))::numeric as baseline,
           max(shelf_unit) filter (where prn = 1) as prev1
      from prevs group by product_id
  )
  select l.product_id, p.name, l.basis, l.store_key, l.store_name, l.purchased_on,
         round(l.shelf_unit, 2), round(b.baseline, 2), round(l.shelf_unit / b.baseline - 1, 4),
         case when l.shelf_unit < b.baseline * 0.95 and b.prev1 >= b.baseline * 0.95 then 'PROMO' else 'CHANGE' end
    from last l
    join base b on b.product_id = l.product_id
    join public.products p on p.id = l.product_id
   where b.baseline > 0
$$;

-- Novinky v cenách za obdobie (pre Prehľad): najprv trvalé zmeny, potom akcie.
create function public._price_news(p_household_id uuid, p_from date, p_to date)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) from public._price_status(p_household_id) s
   where s.purchased_on between p_from and p_to
     and abs(s.change) >= 0.05 and abs(s.new_price - s.old_price) >= 0.05
   order by (s.kind = 'PROMO'), abs(s.change) desc
   limit 8
$$;

-- ------------------------------------------------------------------ Prehľad
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
    'unnormalized',   (select count(*) from public.products p where p.household_id = p_household_id
                         and p.merged_into is null and not p.normalized)
  ) into result;
  return result;
end $$;

-- ------------------------------------------------------------------ detail kategórie
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

-- ------------------------------------------------------------------ detail obchodu (porovnanie k rovnakému dňu)
create or replace function public.analytics_store(
  p_household_id uuid, p_store_key text, p_from date, p_to date, p_prev_from date, p_prev_to date
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
    select s.*, s.total - s.deposits as amount, r.category_id as rest_cat, s.total - s.items_total as rest
      from public._spend_receipts(p_household_id, least(p_prev_from, months_from), p_to) s
      join public.receipts r on r.id = s.receipt_id
     where s.store_key = p_store_key
  ), cur as (select * from sr where purchased_on between p_from and p_to),
  it as (
    select i.category_id, i.product_id, i.line_total from public.receipt_items i
      join cur on cur.receipt_id = i.receipt_id where i.category_id <> 'deposit'
  )
  select jsonb_build_object(
    'name', coalesce((select max(store_name) from sr), (select max(coalesce(store_name, 'Neznámy obchod'))
              from public.receipts where household_id = p_household_id and coalesce(store_key, '_none') = p_store_key)),
    'amount', coalesce((select sum(amount) from cur), 0),
    'receipts', (select count(*) from cur),
    'prev_amount', coalesce((select sum(amount) from sr where purchased_on between p_prev_from and prev_cut), 0),
    'prev_receipts', (select count(*) from sr where purchased_on between p_prev_from and prev_cut),
    'prev_cut', prev_cut,
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'amount', coalesce((select sum(amount) from sr where to_char(purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                 from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
    'weekdays', (select jsonb_agg(coalesce((select count(*) from sr where extract(isodow from purchased_on) = d), 0) order by d)
                   from generate_series(1, 7) d),
    'categories', coalesce((select jsonb_agg(x order by x.amount desc) from (
                     select id, round(sum(a), 2) as amount from (
                       select category_id as id, line_total as a from it
                       union all
                       select coalesce(rest_cat, '_unassigned'), rest from cur where rest > 0
                     ) y group by id) x), '[]'),
    'products', coalesce((select jsonb_agg(x order by x.count desc, x.amount desc) from (
                   select it.product_id, max(p.name) as name, count(*) as count, round(sum(it.line_total), 2) as amount
                     from it left join public.products p on p.id = it.product_id
                    group by it.product_id order by count(*) desc, sum(it.line_total) desc limit 15) x), '[]'),
    'receipt_list', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', receipt_id, 'date', purchased_on,
                       'time', purchased_time, 'amount', round(amount, 2), 'status', status) order by purchased_on desc)
                       from cur), '[]')
  ) into result;
  return result;
end $$;

-- ------------------------------------------------------------------ produkty (zmena ceny alebo akcia)
create or replace function public.analytics_products(p_household_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    with pur as (
      select pp.*, row_number() over (partition by pp.product_id order by pp.purchased_on desc, pp.item_id) as rn
        from public._purchases(p_household_id) pp
    ), agg as (
      select product_id, count(*) as purchases, round(sum(line_total), 2) as spent, max(purchased_on) as last_date
        from pur group by product_id
    ), last as (select * from pur where rn = 1),
    st as (select * from public._price_status(p_household_id))
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'brand', p.brand, 'size_value', p.size_value, 'size_unit', p.size_unit,
      'category_id', p.category_id, 'purchases', a.purchases, 'spent', a.spent, 'last_date', a.last_date,
      'last_price', l.line_total, 'last_store', l.store_name, 'unit_price', round(l.shelf_unit, 2), 'basis', l.basis,
      'change', case when abs(st.change) >= 0.01 then st.change end,
      'price_kind', st.kind, 'usual_price', st.old_price
    ) order by a.purchases desc, a.last_date desc, p.name)
      from agg a
      join public.products p on p.id = a.product_id
      join last l on l.product_id = a.product_id
      left join st on st.product_id = a.product_id
  ), '[]');
end $$;

-- ------------------------------------------------------------------ bankový výpis
-- Ku každej platbe z výpisu nájde doklad, ktorý už v aplikácii je (rovnaká suma,
-- dátum nákupu 0 až 3 dni pred dátumom platby) – taká platba sa neimportuje dvakrát.
create function public.preview_bank_payments(p_household_id uuid, p_rows jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('idx', (x ->> 'idx')::int, 'receipt_id', m.id, 'store_name', m.store_name,
                                        'purchased_on', m.purchased_on, 'origin', m.origin))
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
      cross join lateral (
        select r.id, r.store_name, r.purchased_on, r.origin from public.receipts r
         where r.household_id = p_household_id
           and r.status <> 'FAILED'
           and r.total is not null
           and abs(r.total - (x ->> 'amount')::numeric) < 0.01
           and r.purchased_on between (x ->> 'date')::date - 3 and (x ->> 'date')::date + 1
         order by abs(r.purchased_on - (x ->> 'date')::date), r.created_at
         limit 1
      ) m
     where (x ->> 'amount') ~ '^-?\d+(\.\d+)?$' and (x ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
  ), '[]');
end $$;

-- Uloží vybrané platby ako výdavky bez položiek (pôvod BANK). Tá istá platba
-- (rovnaký výpis a riadok) sa pri opakovanom importe preskočí.
create function public.import_bank_payments(p_household_id uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  x jsonb;
  v_amount numeric;
  v_date date;
  v_name text;
  v_cat text;
  n int := 0;
  inserted int;
begin
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_amount := nullif(x ->> 'amount', '')::numeric;
    v_date := nullif(x ->> 'date', '')::date;
    v_name := left(nullif(trim(x ->> 'merchant'), ''), 120);
    v_cat := x ->> 'category_id';
    if v_amount is null or v_amount <= 0 or v_amount >= 1000000 or v_date is null or v_name is null
       or coalesce(x ->> 'ref', '') = '' then
      raise exception 'VALIDATION';
    end if;
    if v_cat is not null and not exists (select 1 from public.categories where id = v_cat) then v_cat := null; end if;
    insert into public.receipts (household_id, uploaded_by, status, store_name, store_key, purchased_on, total,
                                 items_sum, image_path, image_checksum, source, origin, category_id)
    values (p_household_id, uid, 'OK', v_name, public.name_key(v_name), v_date, v_amount, 0, 'bank',
            encode(sha256(convert_to(p_household_id::text || '|bank|' || (x ->> 'ref'), 'UTF8')), 'hex'),
            'APP', 'BANK', v_cat)
    on conflict (household_id, image_checksum) do nothing;
    get diagnostics inserted = row_count;
    n := n + inserted;
  end loop;
  return n;
end $$;

-- Výdavok zadaný ručne (napr. nájom, hotovosť bez bločku).
create function public.add_manual_expense(
  p_household_id uuid, p_name text, p_date date, p_amount numeric, p_category_id text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  v_name text := left(nullif(trim(p_name), ''), 120);
  new_id uuid := gen_random_uuid();
begin
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if v_name is null or p_date is null or p_amount is null or p_amount <= 0 or p_amount >= 1000000
     or not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'VALIDATION';
  end if;
  insert into public.receipts (id, household_id, uploaded_by, status, store_name, store_key, purchased_on, total,
                               items_sum, image_path, image_checksum, source, origin, category_id)
  values (new_id, p_household_id, uid, 'OK', v_name, public.name_key(v_name), p_date, p_amount, 0, 'manual',
          encode(sha256(convert_to(new_id::text, 'UTF8')), 'hex'), 'APP', 'MANUAL', p_category_id);
  return new_id;
end $$;

-- ------------------------------------------------------------------ oprávnenia
revoke execute on function public._price_status(uuid) from public, anon, authenticated;
revoke execute on function public._price_news(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.preview_bank_payments(uuid, jsonb) from public, anon;
grant execute on function public.preview_bank_payments(uuid, jsonb) to authenticated;
revoke execute on function public.import_bank_payments(uuid, jsonb) from public, anon;
grant execute on function public.import_bank_payments(uuid, jsonb) to authenticated;
revoke execute on function public.add_manual_expense(uuid, text, date, numeric, text) from public, anon;
grant execute on function public.add_manual_expense(uuid, text, date, numeric, text) to authenticated;
