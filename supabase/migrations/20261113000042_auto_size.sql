-- Veľkosť balenia sama (13. 11. 2026): keď jeden obchod na bločku veľkosť nepíše („KOZEL 10 PLECH“) a iný áno
-- („KOZEL SVETLY PLECH 0,5L“), AI z nich urobí dva výrobky s rovnakým názvom a značkou – jeden bez veľkosti.
-- Výrobok bez veľkosti ju prevezme od rovnakého výrobku (rovnaký názov a značka v domácnosti), ale len keď je
-- veľkosť jednoznačná (všetky také výrobky majú tú istú, v g alebo ml). Odkiaľ je, sa pamätá v size_from;
-- ručná zmena (set_product_size) ho zruší. Nič sa nemaže.

alter table public.products add column if not exists size_from uuid references public.products(id) on delete set null;

-- doplní veľkosť výrobkom bez veľkosti v skupine (domácnosť + názov + značka); vráti počet doplnených
create or replace function public._fill_sizes(p_household_id uuid, p_name text, p_brand text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  with src as (
    select min(s.size_value) as v, min(s.size_unit) as u, (array_agg(s.id order by s.updated_at desc))[1] as id
      from public.products s
     where s.household_id = p_household_id and s.merged_into is null
       and lower(btrim(s.name)) = lower(btrim(p_name)) and lower(coalesce(s.brand, '')) = lower(coalesce(p_brand, ''))
       and s.size_value is not null and s.size_unit in ('g', 'ml')
    having count(distinct (s.size_value, s.size_unit)) = 1
  )
  update public.products m
     set size_value = src.v, size_unit = src.u, size_from = src.id
    from src
   where m.household_id = p_household_id and m.merged_into is null and m.size_value is null
     and lower(btrim(m.name)) = lower(btrim(p_name)) and lower(coalesce(m.brand, '')) = lower(coalesce(p_brand, ''));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public._fill_sizes(uuid, text, text) from public, anon, authenticated;

create or replace function public._products_fill_sizes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or new.merged_into is not null then return null; end if;
  perform public._fill_sizes(new.household_id, new.name, new.brand);
  return null;
end $$;
revoke all on function public._products_fill_sizes() from public, anon, authenticated;

drop trigger if exists products_fill_sizes on public.products;
create trigger products_fill_sizes after insert or update of size_value, size_unit, name, brand on public.products
  for each row execute function public._products_fill_sizes();

-- ručne zmenená veľkosť (úprava výrobku) už nie je „prevzatá“; _fill_sizes mení size_from spolu s veľkosťou
create or replace function public._products_size_manual()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.size_value, new.size_unit) is distinct from (old.size_value, old.size_unit) and new.size_from is not distinct from old.size_from then
    new.size_from := null;
  end if;
  return new;
end $$;
drop trigger if exists products_size_manual on public.products;
create trigger products_size_manual before update of size_value, size_unit on public.products
  for each row execute function public._products_size_manual();

-- ručne zadaná veľkosť už nie je „prevzatá“
create or replace function public.set_product_size(p_product_id uuid, p_size_value numeric, p_size_unit text)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare p public.products;
begin
  perform public._require_uid();
  if p_size_value is null or p_size_value <= 0 or p_size_unit not in ('g', 'ml', 'ks') then raise exception 'INVALID_INPUT'; end if;
  select * into p from public.products where id = p_product_id and merged_into is null for update;
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;
  update public.products set size_value = p_size_value, size_unit = p_size_unit, size_from = null where id = p.id returning * into p;
  return p;
end $$;

-- výrobky, ktorým appka veľkosť doplnila sama, s pôvodom (posledný riadok bločku oboch výrobkov)
create or replace function public.analytics_auto_sizes(p_household_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(x order by x.buys desc, x.name) from (
      select m.id as product_id, m.name, m.brand, m.kind, m.category_id, m.size_value, m.size_unit,
             case m.size_unit when 'g' then 'kg' else 'l' end as basis,
             (select count(*) from public.receipt_items ri where ri.product_id = m.id) as buys,
             a.raw_name as raw, a.store_name as store, a.store_key, b.raw_name as from_raw, b.store_name as from_store, b.store_key as from_key
        from public.products m
        left join lateral (
          select ri.raw_name, r.store_name, r.store_key from public.receipt_items ri join public.receipts r on r.id = ri.receipt_id
           where ri.product_id = m.id order by r.purchased_on desc nulls last limit 1) a on true
        left join lateral (
          select ri.raw_name, r.store_name, r.store_key from public.receipt_items ri join public.receipts r on r.id = ri.receipt_id
           where ri.product_id = m.size_from order by r.purchased_on desc nulls last limit 1) b on true
       where m.household_id = p_household_id and m.merged_into is null and m.size_from is not null
    ) x), '[]'::jsonb);
end $$;
revoke all on function public.analytics_auto_sizes(uuid) from public, anon;
grant execute on function public.analytics_auto_sizes(uuid) to authenticated;

-- doplniť existujúce výrobky
do $$
declare g record;
begin
  for g in select distinct household_id, name, brand from public.products where size_value is null and merged_into is null loop
    perform public._fill_sizes(g.household_id, g.name, g.brand);
  end loop;
end $$;
