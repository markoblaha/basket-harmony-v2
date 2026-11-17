-- ---------------------------------------------------------------- Istý nákup
-- Hlavné dlaždice rýchleho pridania: produkty, ktoré domácnosť kupuje pravidelne
-- a ktoré sú „na rade“ – s veľkou istotou budú aj v najbližšom nákupe.
--
-- Nákup = deň, v ktorom sa niečo kúpilo (posledných 12 takých dní, najviac 240 dní dozadu).
--   share = v koľkých z tých nákupov produkt bol (0–1)
--   due   = dni od posledného kúpenia / jeho zvyčajný odstup (medián), najviac 1,3
--           (mlieko kupované každých 5 dní je po 5 dňoch „na rade“, deň po nákupe nie)
--   score = share × (0,35 + 0,65 × due) + 0,15, ak bol v jednom z posledných 3 nákupov
-- Do úvahy prichádza len produkt kúpený aspoň v 3 nákupoch a aspoň v 40 % z nich.
-- Keď história nestačí, funkcia nevráti nič a appka použije najčastejšie produkty.
create function public.staple_items(p_household_id uuid, p_limit int default 12)
returns table (name text, category_id text, score numeric, share numeric, due numeric)
language sql stable security invoker set search_path = '' as $$
  with bought as (
    select public.name_key(i.name) as k, i.name, i.category_id,
           (i.purchased_at at time zone 'Europe/Bratislava')::date as d
      from public.shopping_list_items i
     where i.household_id = p_household_id
       and i.status = 'PURCHASED'
       and i.purchased_at is not null
       and i.purchased_at > now() - interval '240 days'
  ),
  trips as (select distinct d from bought order by d desc limit 12),
  recent3 as (select min(d) as since from (select d from trips order by d desc limit 3) r),
  total as (select count(*)::numeric as n from trips),
  per as (
    select b.k,
           (array_agg(b.name order by b.d desc))[1] as name,
           (array_agg(b.category_id order by b.d desc))[1] as category_id,
           count(distinct b.d) filter (where b.d in (select d from trips)) as hits,
           max(b.d) as last,
           array_agg(distinct b.d order by b.d) as days
      from bought b
     group by b.k
  ),
  scored as (
    select p.name, p.category_id, p.last,
           p.hits / t.n as share,
           least(1.3, ((now() at time zone 'Europe/Bratislava')::date - p.last)::numeric / greatest(coalesce((
             select percentile_cont(0.5) within group (order by g.gap)
               from (select p.days[i + 1] - p.days[i] as gap
                       from generate_subscripts(p.days, 1) as i
                      where i < array_length(p.days, 1)) g
           ), 7)::numeric, 1)) as due
      from per p, total t
     where t.n >= 3 and p.hits >= 3 and p.hits / t.n >= 0.4
  )
  select s.name, s.category_id,
         round(s.share * (0.35 + 0.65 * s.due) + case when s.last >= (select since from recent3) then 0.15 else 0 end, 3) as score,
         round(s.share, 3) as share,
         round(s.due, 3) as due
    from scored s
   order by score desc, s.share desc, s.name
   limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

revoke execute on function public.staple_items(uuid, int) from public, anon;
grant execute on function public.staple_items(uuid, int) to authenticated;
