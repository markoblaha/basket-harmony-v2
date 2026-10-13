-- =============================================================================
-- Analytika: katalóg produktov, nové kategórie, rozpočty a výpočty pre Prehľady.
--
-- Hlavné pravidlá (platia na všetkých obrazovkách rovnako):
--  * Výdavok = suma na doklade (nie súčet položiek). Rozdiel medzi sumou a
--    položkami je "Nerozpísané" (alebo "Zľavy na celý nákup", ak je záporný),
--    takže kategórie spolu vždy dajú presne celkovú sumu.
--  * Zálohy na obaly sa nerátajú ako výdavok (dostaneš ich späť), ukazujú sa zvlášť.
--  * Rátajú sa doklady v poriadku aj čakajúce na kontrolu; doklad s podozrivým
--    dátumom až po potvrdení (inak by jeden zlý rok pokazil celý graf).
--  * Kategória patrí produktu: oprava kategórie produktu platí pre všetky jeho
--    nákupy, minulé aj budúce.
--  * Cena v čase sa porovnáva podľa ceny za jednotku (€/kg, €/l, €/ks) pred zľavou,
--    takže akcia nie je "zlacnenie" a väčšie balenie nie je "zdraženie".
-- Nič sa nemaže: spojený produkt sa iba presmeruje (merged_into).
-- =============================================================================

-- ------------------------------------------------------------------ kategórie
alter table public.categories add column everyday boolean not null default true;
comment on column public.categories.everyday is 'Bežné výdavky domácnosti (potraviny, drogéria...). Prepínač "Len potraviny a domácnosť".';

insert into public.categories (id, name, emoji, sort_order, everyday) values
  ('health',      'Zdravie a lekáreň',  '💊', 125, true),
  ('clothing',    'Oblečenie a obuv',   '👕', 150, false),
  ('home',        'Domov a vybavenie',  '🛋️', 160, false),
  ('toys_hobby',  'Hračky a hobby',     '🧸', 170, false),
  ('electronics', 'Elektronika',        '🔌', 180, false),
  ('fuel',        'Pohonné hmoty',      '⛽', 190, false),
  ('dining',      'Jedlo von',          '🍽️', 200, false),
  ('fees',        'Doprava a poplatky', '📦', 210, false),
  ('deposit',     'Zálohy',             '♻️', 220, false)
on conflict (id) do nothing;
update public.categories set everyday = false where id = 'other';

-- ------------------------------------------------------------------ produkty
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  -- Kľúč na hľadanie rovnakého produktu (názov + značka + balenie bez diakritiky).
  product_key     text not null,
  brand           text check (char_length(brand) <= 80),
  -- Veľkosť balenia v základnej jednotke: g, ml alebo ks (napr. 1 l = 1000 ml).
  size_value      numeric(12, 3) check (size_value > 0),
  size_unit       text check (size_unit in ('g', 'ml', 'ks')),
  category_id     text not null default 'other' references public.categories (id),
  -- Kategóriu nastavil človek: AI ju už nemení.
  category_manual boolean not null default false,
  -- Názov a balenie už zjednotila AI (alebo človek).
  normalized      boolean not null default false,
  -- Spojený produkt: všetko sa presunulo sem.
  merged_into     uuid references public.products (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index products_household_key on public.products (household_id, product_key) where merged_into is null;
create index products_household_idx on public.products (household_id) where merged_into is null;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Rôzne zápisy toho istého produktu na bločkoch ("RAJO MLIEKO POL.1,5%", "Mlieko Rajo 1l").
create table public.product_aliases (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key     text not null,
  product_id   uuid not null references public.products (id) on delete cascade,
  primary key (household_id, name_key)
);
create index product_aliases_product_idx on public.product_aliases (product_id);

alter table public.receipt_items add column product_id uuid references public.products (id) on delete set null;
create index receipt_items_product_idx on public.receipt_items (product_id);

alter table public.products        enable row level security;
alter table public.product_aliases enable row level security;
grant select on public.products, public.product_aliases to authenticated;
create policy products_select on public.products for select to authenticated
  using (public.is_member(household_id));
create policy product_aliases_select on public.product_aliases for select to authenticated
  using (public.is_member(household_id));

-- Koncový produkt (po spojeniach).
create function public._product_root(p_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  cur uuid := p_id;
  nxt uuid;
  guard int := 0;
begin
  loop
    select merged_into into nxt from public.products where id = cur;
    exit when nxt is null or guard > 20;
    cur := nxt;
    guard := guard + 1;
  end loop;
  return cur;
end $$;

-- Každá položka bločku sa napojí na produkt (podľa zápisu na bločku). Nový zápis
-- = nový produkt; AI ho neskôr zjednotí s rovnakými produktmi.
create function public.receipt_items_link_product() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  p public.products;
begin
  select product_id into pid from public.product_aliases
   where household_id = new.household_id and name_key = new.name_key;
  if pid is null then
    insert into public.products (household_id, name, product_key, category_id)
    values (new.household_id, new.raw_name, new.name_key, new.category_id)
    on conflict (household_id, product_key) where merged_into is null
    do update set updated_at = now()
    returning id into pid;
    insert into public.product_aliases (household_id, name_key, product_id)
    values (new.household_id, new.name_key, pid)
    on conflict do nothing;
  end if;
  select * into p from public.products where id = public._product_root(pid);
  new.product_id := p.id;
  -- Kategória patrí produktu, keď ju určil človek alebo zjednotenie.
  if p.category_manual or p.normalized then new.category_id := p.category_id; end if;
  return new;
end $$;

create trigger receipt_items_product before insert or update of name_key on public.receipt_items
  for each row execute function public.receipt_items_link_product();

-- Doterajšie položky dostanú produkt.
update public.receipt_items set name_key = name_key;

-- ------------------------------------------------------------------ spájanie a úpravy produktov
-- Presunie nákupy a zápisy z p_source do p_target (bez mazania).
create function public._merge_product(p_target uuid, p_source uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.products;
begin
  select * into t from public.products where id = p_target;
  update public.receipt_items set product_id = p_target, category_id = t.category_id where product_id = p_source;
  update public.product_aliases set product_id = p_target where product_id = p_source;
  update public.products set merged_into = p_target, product_key = product_key || '#' || id::text
   where id = p_source;
end $$;

create function public._product_key(p_name text, p_brand text, p_size numeric, p_unit text) returns text
language sql immutable set search_path = '' as $$
  select public.name_key(coalesce(p_name, '')) || '|' || coalesce(public.name_key(p_brand), '') || '|' ||
         coalesce(trim(to_char(p_size, 'FM999999990.###')) || p_unit, '')
$$;

-- Výsledok zjednotenia od AI (volá len server): názov, značka, balenie, kategória.
-- Ak taký produkt v domácnosti už je, spoja sa.
create function public.apply_product_normalization(p_household_id uuid, p_items jsonb)
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
    v_key := public._product_key(v_name, v_brand, v_size, v_unit);

    select id into other from public.products
     where household_id = p_household_id and product_key = v_key and merged_into is null and id <> p.id;
    if other is not null then
      -- Rovnaký produkt už existuje: tento sa doň presunie.
      update public.products set normalized = true,
        category_id = case when category_manual then category_id else v_cat end
       where id = other;
      perform public._merge_product(other, p.id);
    else
      update public.products set name = v_name, brand = v_brand, size_value = v_size, size_unit = v_unit,
        product_key = v_key, category_id = v_cat, normalized = true
       where id = p.id;
      update public.receipt_items set category_id = v_cat where product_id = p.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Človek upraví produkt (názov, značka, balenie, kategória). Kategória sa prenesie na všetky nákupy.
create function public.update_product(
  p_product_id  uuid,
  p_name        text,
  p_brand       text,
  p_size_value  numeric,
  p_size_unit   text,
  p_category_id text
) returns public.products
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
  v_name text := left(nullif(trim(p_name), ''), 200);
  v_brand text := left(nullif(trim(p_brand), ''), 80);
  v_key text;
begin
  perform public._require_uid();
  select * into p from public.products where id = p_product_id and merged_into is null for update;
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;
  if v_name is null then raise exception 'VALIDATION'; end if;
  if (p_size_value is null) <> (p_size_unit is null) or p_size_unit not in ('g', 'ml', 'ks') or p_size_value <= 0 then
    raise exception 'VALIDATION';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then raise exception 'VALIDATION'; end if;
  v_key := public._product_key(v_name, v_brand, p_size_value, p_size_unit);
  if exists (select 1 from public.products where household_id = p.household_id and product_key = v_key
              and merged_into is null and id <> p.id) then
    raise exception 'PRODUCT_EXISTS';
  end if;
  update public.products set name = v_name, brand = v_brand, size_value = p_size_value, size_unit = p_size_unit,
    product_key = v_key, normalized = true,
    category_manual = category_manual or category_id <> p_category_id,
    category_id = p_category_id
   where id = p.id returning * into p;
  update public.receipt_items set category_id = p.category_id where product_id = p.id;
  return p;
end $$;

-- Človek spojí produkty ("toto je ten istý produkt"). Prvý zostane.
create function public.merge_products(p_target uuid, p_sources uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.products;
  s uuid;
begin
  perform public._require_uid();
  select * into t from public.products where id = p_target and merged_into is null for update;
  if not found or not public.is_member(t.household_id) then raise exception 'NOT_FOUND'; end if;
  if coalesce(array_length(p_sources, 1), 0) = 0 or p_target = any (p_sources) then raise exception 'VALIDATION'; end if;
  foreach s in array p_sources loop
    if not exists (select 1 from public.products where id = s and household_id = t.household_id and merged_into is null) then
      raise exception 'NOT_FOUND';
    end if;
    perform public._merge_product(p_target, s);
  end loop;
  return p_target;
end $$;

-- ------------------------------------------------------------------ rozpočty
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- null = celkový mesačný rozpočet
  category_id  text references public.categories (id),
  -- null = rozpočet vypnutý
  amount       numeric(10, 2) check (amount > 0),
  updated_at   timestamptz not null default now()
);
create unique index budgets_household_category on public.budgets (household_id, coalesce(category_id, '*'));
alter table public.budgets enable row level security;
grant select on public.budgets to authenticated;
create policy budgets_select on public.budgets for select to authenticated using (public.is_member(household_id));

create function public.set_budget(p_household_id uuid, p_category_id text, p_amount numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_amount is not null and (p_amount <= 0 or p_amount >= 1000000) then raise exception 'VALIDATION'; end if;
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'VALIDATION';
  end if;
  update public.budgets set amount = p_amount, updated_at = now()
   where household_id = p_household_id and coalesce(category_id, '*') = coalesce(p_category_id, '*');
  if not found then
    insert into public.budgets (household_id, category_id, amount) values (p_household_id, p_category_id, p_amount);
  end if;
end $$;

-- ------------------------------------------------------------------ podklady pre výpočty
-- Doklady, ktoré sa rátajú, a ich sumy: celkom, zálohy, bežné výdavky.
create function public._spend_receipts(p_household_id uuid, p_from date, p_to date)
returns table (
  receipt_id uuid, purchased_on date, purchased_time time, store_key text, store_name text,
  total numeric, items_total numeric, deposits numeric, everyday numeric, status text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.purchased_on, r.purchased_time,
         coalesce(r.store_key, '_none'), coalesce(r.store_name, 'Neznámy obchod'),
         coalesce(r.total, coalesce(sum(i.line_total), 0)),
         coalesce(sum(i.line_total), 0),
         coalesce(sum(i.line_total) filter (where i.category_id = 'deposit'), 0),
         coalesce(sum(i.line_total) filter (where c.everyday), 0),
         r.status::text
    from public.receipts r
    left join public.receipt_items i on i.receipt_id = r.id
    left join public.categories c on c.id = i.category_id
   where r.household_id = p_household_id
     and r.status in ('OK', 'NEEDS_REVIEW')
     and r.purchased_on between p_from and p_to
     and not (r.status = 'NEEDS_REVIEW' and r.review_reason = 'DATE_SUSPECT')
   group by r.id
$$;

-- Nákupy produktov s cenou za jednotku (pred zľavou = "cena na regáli", po zľave = zaplatené).
create function public._purchases(p_household_id uuid)
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
             when p.size_unit in ('g', 'ml') then i.quantity * p.size_value / 1000
             when p.size_unit = 'ks' then i.quantity * p.size_value
             else i.quantity end as units,
        case when lower(coalesce(i.unit, '')) in ('kg', 'g') then 'kg'
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

-- Zmeny cien: posledná cena na regáli oproti priemeru predchádzajúcich nákupov v TOM ISTOM obchode
-- (rovnaká jednotka). Rozdiel medzi obchodmi nie je zdraženie – ten ukazuje porovnanie obchodov.
create function public._price_changes(p_household_id uuid, p_from date, p_to date)
returns table (product_id uuid, name text, basis text, old_price numeric, new_price numeric,
               change numeric, store_name text, purchased_on date)
language sql stable security definer set search_path = '' as $$
  with pur as (
    select pp.*, row_number() over (partition by pp.product_id order by pp.purchased_on desc, pp.item_id) as rn
      from public._purchases(p_household_id) pp
     where pp.shelf_unit is not null
  ), last as (
    select * from pur where rn = 1 and purchased_on between p_from and p_to
  ), prev as (
    select pur.product_id, avg(pur.shelf_unit) as avg_price
      from pur join last l on l.product_id = pur.product_id and l.basis = pur.basis and l.store_key = pur.store_key
     where pur.rn > 1 and pur.purchased_on >= l.purchased_on - 180
     group by pur.product_id
  )
  select l.product_id, p.name, l.basis, round(pv.avg_price, 2), round(l.shelf_unit, 2),
         round(l.shelf_unit / pv.avg_price - 1, 4), l.store_name, l.purchased_on
    from last l
    join prev pv on pv.product_id = l.product_id
    join public.products p on p.id = l.product_id
   where pv.avg_price > 0
     and abs(l.shelf_unit / pv.avg_price - 1) >= 0.05
     and abs(l.shelf_unit - pv.avg_price) >= 0.05
   order by abs(l.shelf_unit / pv.avg_price - 1) desc
   limit 8
$$;

-- Čo možno dochádza: bežný produkt kúpený aspoň 3-krát a od posledného nákupu prešiel jeho obvyklý interval.
create function public._restock(p_household_id uuid)
returns table (product_id uuid, name text, category_id text, last_date date, interval_days numeric,
               days_since int, last_price numeric, last_store text)
language sql stable security definer set search_path = '' as $$
  with days as (
    select pp.product_id, pp.purchased_on, max(pp.line_total) as price, max(pp.store_name) as store
      from public._purchases(p_household_id) pp
      join public.categories c on c.id = pp.category_id
     where c.everyday
     group by pp.product_id, pp.purchased_on
  ), stats as (
    select product_id, count(*) as n, min(purchased_on) as first_date, max(purchased_on) as last_date
      from days group by product_id having count(*) >= 3
  )
  select s.product_id, p.name, p.category_id, s.last_date,
         round((s.last_date - s.first_date)::numeric / (s.n - 1), 1),
         current_date - s.last_date,
         d.price, d.store
    from stats s
    join public.products p on p.id = s.product_id
    join days d on d.product_id = s.product_id and d.purchased_on = s.last_date
   where (s.last_date - s.first_date)::numeric / (s.n - 1) between 2 and 60
     and current_date - s.last_date >= 0.9 * (s.last_date - s.first_date)::numeric / (s.n - 1)
   order by (current_date - s.last_date) / nullif((s.last_date - s.first_date)::numeric / (s.n - 1), 0) desc
   limit 8
$$;

-- ------------------------------------------------------------------ Prehľad
-- p_scope: 'all' (všetko) alebo 'everyday' (len potraviny a domácnosť).
create function public.analytics_overview(
  p_household_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date, p_scope text default 'all'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_everyday boolean := p_scope = 'everyday';
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  span_from date := least(p_prev_from, months_from, p_from);
  span_to date := greatest(p_to, p_prev_to);
  offset_days int := case when current_date between p_from and p_to then current_date - p_from end;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_from > p_to or p_prev_from > p_prev_to or p_to - p_from > 3700 then raise exception 'VALIDATION'; end if;

  with sr as (
    select s.*,
           case when v_everyday then s.everyday else s.total - s.deposits end as amount,
           case when s.purchased_on between p_from and p_to then 'cur'
                when s.purchased_on between p_prev_from and p_prev_to then 'prev' end as period
      from public._spend_receipts(p_household_id, span_from, span_to) s
  ), counted as (
    select * from sr where not v_everyday or sr.everyday > 0
  ), cur as (select * from counted where period = 'cur'),
     prev as (select * from counted where period = 'prev'),
  items as (
    select i.*, c.everyday as cat_everyday, sr.period
      from public.receipt_items i
      join sr on sr.receipt_id = i.receipt_id
      join public.categories c on c.id = i.category_id
     where sr.period is not null and i.category_id <> 'deposit' and (not v_everyday or c.everyday)
  ), cats as (
    select category_id as id,
           sum(line_total) filter (where period = 'cur') as amount,
           count(*) filter (where period = 'cur') as items,
           coalesce(sum(line_total) filter (where period = 'prev'), 0) as prev_amount
      from items group by category_id
    union all
    select '_unassigned',
           sum(greatest(total - items_total, 0)) filter (where period = 'cur'), 0,
           coalesce(sum(greatest(total - items_total, 0)) filter (where period = 'prev'), 0)
      from sr where not v_everyday and period is not null
    union all
    select '_receipt_discount',
           sum(least(total - items_total, 0)) filter (where period = 'cur'), 0,
           coalesce(sum(least(total - items_total, 0)) filter (where period = 'prev'), 0)
      from sr where not v_everyday and period is not null
  ), stores as (
    select store_key as key, max(store_name) as name,
           sum(amount) filter (where period = 'cur') as amount,
           count(*) filter (where period = 'cur') as receipts,
           coalesce(sum(amount) filter (where period = 'prev'), 0) as prev_amount,
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
    'prev_to_date',   case when offset_days is null then null else
                        coalesce((select sum(amount) from prev where purchased_on <= p_prev_from + offset_days), 0) end,
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
    'price_changes',  coalesce((select jsonb_agg(to_jsonb(pc)) from public._price_changes(p_household_id, p_from, p_to) pc), '[]'),
    'restock',        coalesce((select jsonb_agg(to_jsonb(rs)) from public._restock(p_household_id) rs), '[]'),
    'budgets',        coalesce((select jsonb_agg(jsonb_build_object('category_id', b.category_id, 'amount', b.amount,
                                  'spent', case when b.category_id is null then coalesce((select sum(amount) from cur), 0)
                                                else coalesce((select sum(line_total) from items
                                                                where period = 'cur' and category_id = b.category_id), 0) end))
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
create function public.analytics_category(
  p_household_id uuid, p_category_id text, p_from date, p_to date, p_prev_from date, p_prev_to date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;

  if p_category_id = '_unassigned' or p_category_id = '_receipt_discount' then
    with sr as (
      select s.*, case when p_category_id = '_unassigned' then greatest(s.total - s.items_total, 0)
                       else least(s.total - s.items_total, 0) end as rest
        from public._spend_receipts(p_household_id, least(p_prev_from, months_from), p_to) s
    )
    select jsonb_build_object(
      'amount', coalesce((select sum(rest) from sr where purchased_on between p_from and p_to), 0),
      'prev_amount', coalesce((select sum(rest) from sr where purchased_on between p_prev_from and p_prev_to), 0),
      'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                   'amount', coalesce((select sum(rest) from sr where to_char(purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                   from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
      'products', '[]'::jsonb, 'stores', '[]'::jsonb, 'items', '[]'::jsonb,
      'receipts', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', receipt_id, 'date', purchased_on,
                   'store', store_name, 'amount', round(rest, 2), 'total', total) order by purchased_on desc)
                   from sr where rest <> 0 and purchased_on between p_from and p_to), '[]')
    ) into result;
    return result;
  end if;

  with sr as (
    select * from public._spend_receipts(p_household_id, least(p_prev_from, months_from), p_to)
  ), it as (
    select i.*, sr.purchased_on, sr.store_key, sr.store_name
      from public.receipt_items i join sr on sr.receipt_id = i.receipt_id
     where i.category_id = p_category_id
  ), cur as (select * from it where purchased_on between p_from and p_to)
  select jsonb_build_object(
    'amount', coalesce((select sum(line_total) from cur), 0),
    'prev_amount', coalesce((select sum(line_total) from it where purchased_on between p_prev_from and p_prev_to), 0),
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'amount', coalesce((select sum(line_total) from it where to_char(purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                 from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
    'products', coalesce((select jsonb_agg(x order by x.amount desc) from (
                   select cur.product_id, max(p.name) as name, round(sum(cur.line_total), 2) as amount, count(*) as count
                     from cur left join public.products p on p.id = cur.product_id
                    group by cur.product_id order by sum(cur.line_total) desc limit 20) x), '[]'),
    'stores', coalesce((select jsonb_agg(x order by x.amount desc) from (
                 select store_key as key, max(store_name) as name, round(sum(line_total), 2) as amount, count(*) as count
                   from cur group by store_key) x), '[]'),
    'items', coalesce((select jsonb_agg(x order by x.date desc) from (
                select cur.id as item_id, cur.receipt_id, cur.product_id, cur.purchased_on as date, cur.store_name as store,
                       cur.raw_name as name, cur.line_total, cur.discount
                  from cur order by cur.purchased_on desc limit 80) x), '[]'),
    'receipts', '[]'::jsonb
  ) into result;
  return result;
end $$;

-- ------------------------------------------------------------------ detail obchodu
create function public.analytics_store(
  p_household_id uuid, p_store_key text, p_from date, p_to date, p_prev_from date, p_prev_to date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  months_from date := (date_trunc('month', p_to) - interval '11 months')::date;
  result jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;

  with sr as (
    select s.*, s.total - s.deposits as amount
      from public._spend_receipts(p_household_id, least(p_prev_from, months_from), p_to) s
     where s.store_key = p_store_key
  ), cur as (select * from sr where purchased_on between p_from and p_to),
  it as (
    select i.* from public.receipt_items i join cur on cur.receipt_id = i.receipt_id where i.category_id <> 'deposit'
  )
  select jsonb_build_object(
    'name', coalesce((select max(store_name) from sr), (select max(coalesce(store_name, 'Neznámy obchod'))
              from public.receipts where household_id = p_household_id and coalesce(store_key, '_none') = p_store_key)),
    'amount', coalesce((select sum(amount) from cur), 0),
    'receipts', (select count(*) from cur),
    'prev_amount', coalesce((select sum(amount) from sr where purchased_on between p_prev_from and p_prev_to), 0),
    'prev_receipts', (select count(*) from sr where purchased_on between p_prev_from and p_prev_to),
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'amount', coalesce((select sum(amount) from sr where to_char(purchased_on, 'YYYY-MM') = to_char(m, 'YYYY-MM')), 0)) order by m)
                 from generate_series(months_from, date_trunc('month', p_to)::date, interval '1 month') m),
    'weekdays', (select jsonb_agg(coalesce((select count(*) from sr where extract(isodow from purchased_on) = d), 0) order by d)
                   from generate_series(1, 7) d),
    'categories', coalesce((select jsonb_agg(x order by x.amount desc) from (
                     select category_id as id, round(sum(line_total), 2) as amount from it group by category_id) x), '[]'),
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

-- ------------------------------------------------------------------ produkty
create function public.analytics_products(p_household_id uuid) returns jsonb
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
    prev as (
      select pur.product_id, avg(pur.shelf_unit) as avg_price
        from pur join last l on l.product_id = pur.product_id and l.basis = pur.basis and l.store_key = pur.store_key
       where pur.rn > 1 group by pur.product_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'brand', p.brand, 'size_value', p.size_value, 'size_unit', p.size_unit,
      'category_id', p.category_id, 'purchases', a.purchases, 'spent', a.spent, 'last_date', a.last_date,
      'last_price', l.line_total, 'last_store', l.store_name, 'unit_price', round(l.shelf_unit, 2), 'basis', l.basis,
      'change', case when pv.avg_price > 0 then round(l.shelf_unit / pv.avg_price - 1, 4) end
    ) order by a.purchases desc, a.last_date desc, p.name)
      from agg a
      join public.products p on p.id = a.product_id
      join last l on l.product_id = a.product_id
      left join prev pv on pv.product_id = a.product_id
  ), '[]');
end $$;

create function public.analytics_product(p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.products;
  result jsonb;
begin
  perform public._require_uid();
  select * into p from public.products where id = public._product_root(p_product_id);
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;

  with pur as (select * from public._purchases(p.household_id) where product_id = p.id),
  days as (select distinct purchased_on from pur)
  select jsonb_build_object(
    'product', to_jsonb(p),
    'aliases', coalesce((select jsonb_agg(distinct i.raw_name) from public.receipt_items i where i.product_id = p.id), '[]'),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'receipt_id', receipt_id, 'date', purchased_on,
                   'store', store_name, 'store_key', store_key, 'quantity', quantity, 'line_total', line_total,
                   'discount', discount, 'shelf_unit', round(shelf_unit, 2), 'paid_unit', round(paid_unit, 2), 'basis', basis)
                   order by purchased_on desc) from pur), '[]'),
    'stores', coalesce((select jsonb_agg(x order by x.avg_unit) from (
                 select store_key as key, max(store_name) as name, count(*) as count,
                        round(avg(shelf_unit), 2) as avg_unit, round(min(paid_unit), 2) as min_paid,
                        (array_agg(round(shelf_unit, 2) order by purchased_on desc))[1] as last_unit,
                        max(purchased_on) as last_date
                   from pur where shelf_unit is not null group by store_key) x), '[]'),
    'interval_days', (select case when count(*) >= 2 then round((max(purchased_on) - min(purchased_on))::numeric / (count(*) - 1), 1) end from days),
    'spent_year', coalesce((select sum(line_total) from pur where purchased_on >= date_trunc('year', current_date)), 0),
    'count_year', (select count(*) from pur where purchased_on >= date_trunc('year', current_date))
  ) into result;
  return result;
end $$;

-- Ceny k položkám nákupného zoznamu: čo je to za produkt, koľko stál naposledy a kde je najlacnejší.
create function public.list_price_hints(p_list_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  lst public.shopping_lists;
begin
  perform public._require_uid();
  select * into lst from public.shopping_lists where id = p_list_id;
  if not found or not public.is_member(lst.household_id) then raise exception 'NOT_FOUND'; end if;
  return coalesce((
    with pur as (select * from public._purchases(lst.household_id)),
    stats as (
      select product_id, count(*) as n, max(purchased_on) as last_date from pur group by product_id
    ),
    li as (
      select i.id, public.name_key(i.name) as k from public.shopping_list_items i
       where i.list_id = p_list_id and i.status = 'OPEN'
    ),
    match as (
      select distinct on (li.id) li.id as item_id, pr.id as product_id, pr.name
        from li
        join public.products pr on pr.household_id = lst.household_id and pr.merged_into is null
        join stats s on s.product_id = pr.id
        left join public.product_aliases a on a.product_id = pr.id and a.name_key = li.k
       where a.name_key is not null
          or public.name_key(pr.name) = li.k
          or public.name_key(pr.name) like li.k || ' %'
          or public.name_key(pr.name) like '% ' || li.k || ' %'
          or public.name_key(pr.name) like '% ' || li.k
       order by li.id, (a.name_key is not null) desc, s.n desc, s.last_date desc
    )
    select jsonb_agg(jsonb_build_object(
      'item_id', m.item_id, 'product_id', m.product_id, 'name', m.name,
      'last_price', l.line_total, 'last_store', l.store_name, 'last_date', l.purchased_on,
      'cheapest_store', c.store_name, 'cheapest_unit', round(c.shelf_unit, 2), 'basis', c.basis,
      'last_unit', round(l.shelf_unit, 2)
    ))
      from match m
      cross join lateral (select * from pur where pur.product_id = m.product_id
                          order by purchased_on desc limit 1) l
      cross join lateral (select store_name, avg(shelf_unit) as shelf_unit, max(basis) as basis from pur
                           where pur.product_id = m.product_id and pur.basis = l.basis and shelf_unit is not null
                           group by store_name order by avg(shelf_unit) limit 1) c
  ), '[]');
end $$;

-- ------------------------------------------------------------------ oprávnenia
revoke execute on function public._product_root(uuid) from public, anon, authenticated;
revoke execute on function public.receipt_items_link_product() from public, anon, authenticated;
revoke execute on function public._merge_product(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._product_key(text, text, numeric, text) from public, anon, authenticated;
revoke execute on function public._spend_receipts(uuid, date, date) from public, anon, authenticated;
revoke execute on function public._purchases(uuid) from public, anon, authenticated;
revoke execute on function public._price_changes(uuid, date, date) from public, anon, authenticated;
revoke execute on function public._restock(uuid) from public, anon, authenticated;
revoke execute on function public.apply_product_normalization(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_product_normalization(uuid, jsonb) to service_role;

revoke execute on function public.update_product(uuid, text, text, numeric, text, text) from public, anon;
grant execute on function public.update_product(uuid, text, text, numeric, text, text) to authenticated;
revoke execute on function public.merge_products(uuid, uuid[]) from public, anon;
grant execute on function public.merge_products(uuid, uuid[]) to authenticated;
revoke execute on function public.set_budget(uuid, text, numeric) from public, anon;
grant execute on function public.set_budget(uuid, text, numeric) to authenticated;
revoke execute on function public.analytics_overview(uuid, date, date, date, date, text) from public, anon;
grant execute on function public.analytics_overview(uuid, date, date, date, date, text) to authenticated;
revoke execute on function public.analytics_category(uuid, text, date, date, date, date) from public, anon;
grant execute on function public.analytics_category(uuid, text, date, date, date, date) to authenticated;
revoke execute on function public.analytics_store(uuid, text, date, date, date, date) from public, anon;
grant execute on function public.analytics_store(uuid, text, date, date, date, date) to authenticated;
revoke execute on function public.analytics_products(uuid) from public, anon;
grant execute on function public.analytics_products(uuid) to authenticated;
revoke execute on function public.analytics_product(uuid) from public, anon;
grant execute on function public.analytics_product(uuid) to authenticated;
revoke execute on function public.list_price_hints(uuid) from public, anon;
grant execute on function public.list_price_hints(uuid) to authenticated;
