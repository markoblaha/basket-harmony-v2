-- =============================================================================
-- Párovanie dokladu s nákupom (obrazovka „Patrí doklad k nákupu?“).
--  receipt_match_candidates – nákupy bez dokladu okolo dátumu dokladu so zhodou
--      (obchod, dátum, ktoré položky sedia, ktoré chýbajú, čo je na doklade navyše).
--  receipt_match_suggestions – doklady bez nákupu, pre ktoré je dobrý kandidát
--      (do časti „Na vybavenie“). Automaticky priradené (≥ 0,45) sa tu neukazujú.
--  dismiss_receipt_match – „Bez nákupu“: doklad sa už nebude navrhovať (match_score = 0).
-- =============================================================================

-- Slová názvu na porovnanie (prvé 4 písmená slov s aspoň 3 znakmi) – rovnako ako _receipt_list_score.
create function public._match_words(p_key text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(left(w, 4)), '{}')
    from regexp_split_to_table(coalesce(p_key, ''), '[^a-z0-9]+') w
   where char_length(w) >= 3
$$;

create function public.receipt_match_candidates(p_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r   public.receipts;
  day date;
  res jsonb := '[]'::jsonb;
  l   record;
  st  boolean;
  hit jsonb; miss jsonb; extra jsonb;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  day := coalesce(r.purchased_on, r.created_at::date);

  for l in
    select x.id, x.name, x.completed_at, x.receipt_state
      from public.shopping_lists x
     where x.household_id = r.household_id
       and x.completed_at is not null
       and (x.receipt_id is null or x.id = r.list_id)
       and public.can_access_list(x.id)
       and x.completed_at::date between day - 7 and day + 7
  loop
    st := r.store_key is not null and char_length(r.store_key) >= 3 and (
            position(public.name_key(l.name) in r.store_key) > 0 or position(r.store_key in public.name_key(l.name)) > 0
            or split_part(r.store_key, ' ', 1) = split_part(public.name_key(l.name), ' ', 1));
    with li as (
      select i.name, public._match_words(public.name_key(i.name)) as words
        from public.shopping_list_items i where i.list_id = l.id and i.status = 'PURCHASED'
    ), rw as (
      select ri.raw_name, ri.line_total, public._match_words(ri.name_key) as words
        from public.receipt_items ri where ri.receipt_id = r.id
    )
    select coalesce((select jsonb_agg(li.name order by li.name) from li where exists (select 1 from rw where rw.words && li.words)), '[]'),
           coalesce((select jsonb_agg(li.name order by li.name) from li where not exists (select 1 from rw where rw.words && li.words)), '[]'),
           coalesce((select jsonb_agg(jsonb_build_object('name', rw.raw_name, 'line_total', rw.line_total) order by rw.raw_name)
                       from rw where not exists (select 1 from li where li.words && rw.words)), '[]')
      into hit, miss, extra;
    res := res || jsonb_build_object(
      'list_id', l.id, 'name', l.name, 'completed_at', l.completed_at, 'receipt_state', l.receipt_state,
      'attached', l.id = r.list_id,
      'score', public._receipt_list_score(r.id, l.id), 'store_match', st,
      'days', abs(l.completed_at::date - day),
      'hit', hit, 'missing', miss, 'extra', extra);
  end loop;
  return coalesce((select jsonb_agg(e order by (e->>'score')::numeric desc) from jsonb_array_elements(res) e), '[]'::jsonb);
end $$;

create function public.receipt_match_suggestions(p_household_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r    record;
  l    record;
  best uuid; best_s numeric; sc numeric;
  res  jsonb := '[]'::jsonb;
begin
  perform public._require_uid();
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  for r in
    select x.id, coalesce(x.purchased_on, x.created_at::date) as day
      from public.receipts x
     where x.household_id = p_household_id and x.list_id is null and x.match_score is null
       and x.origin = 'RECEIPT' and x.status in ('OK', 'NEEDS_REVIEW')
       and x.created_at > now() - interval '60 days'
  loop
    best := null; best_s := 0;
    for l in
      select x.id from public.shopping_lists x
       where x.household_id = p_household_id and x.completed_at is not null and x.receipt_id is null
         and public.can_access_list(x.id)
         and x.completed_at::date between r.day - 7 and r.day + 7
    loop
      sc := public._receipt_list_score(r.id, l.id);
      if sc > best_s then best_s := sc; best := l.id; end if;
    end loop;
    if best is not null and best_s >= 0.25 then
      res := res || jsonb_build_object('receipt_id', r.id, 'list_id', best, 'score', best_s);
    end if;
  end loop;
  return res;
end $$;

create function public.dismiss_receipt_match(p_receipt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.receipts;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  update public.receipts set match_score = 0 where id = r.id and list_id is null;
end $$;

revoke all on function public._match_words(text) from public, anon, authenticated;
revoke all on function public.receipt_match_candidates(uuid) from public, anon;
revoke all on function public.receipt_match_suggestions(uuid) from public, anon;
revoke all on function public.dismiss_receipt_match(uuid) from public, anon;
grant execute on function public.receipt_match_candidates(uuid) to authenticated;
grant execute on function public.receipt_match_suggestions(uuid) to authenticated;
grant execute on function public.dismiss_receipt_match(uuid) to authenticated;
