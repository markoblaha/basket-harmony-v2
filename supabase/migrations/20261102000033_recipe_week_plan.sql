-- =============================================================================
-- Plán týždňa v Receptoch (Fáza 6 prestavby podľa mockupu).
--  * recipe_plans.planned_on – deň, na ktorý je jedlo naplánované (nepovinný),
--  * plan_recipes: recept môže mať deň („day“: RRRR-MM-DD); na jeden deň je jedno jedlo –
--    predchádzajúci čakajúci recept toho dňa sa odloží (DISMISSED),
--  * plan_recipes bez zoznamu a bez položiek = len naplánovanie (suroviny sa nepridávajú).
-- Zrušenie dňa = set_recipe_plan_status(id, 'DISMISSED') (už existuje).
-- =============================================================================
alter table public.recipe_plans add column if not exists planned_on date;
create index if not exists recipe_plans_day_idx on public.recipe_plans (household_id, planned_on) where status = 'PENDING';

create or replace function public.plan_recipes(p_household_id uuid, p_list_id uuid, p_new_list jsonb, p_items jsonb, p_recipes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := public._require_uid();
  lid   uuid := p_list_id;
  it    jsonb;
  rc    jsonb;
  res   jsonb;
  day   date;
  n_it  int := 0;
  n_req int := 0;
begin
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  if jsonb_typeof(coalesce(p_items, 'null')) <> 'array' or jsonb_typeof(coalesce(p_recipes, 'null')) <> 'array'
     or jsonb_array_length(p_items) > 120 or jsonb_array_length(p_recipes) > 20 then
    raise exception 'INVALID_INPUT';
  end if;

  if lid is null and jsonb_typeof(coalesce(p_new_list, 'null')) = 'object' then
    if coalesce(btrim(p_new_list->>'name'), '') = '' then raise exception 'INVALID_INPUT'; end if;
    insert into public.shopping_lists (household_id, name, created_by, planned_for, note)
    values (p_household_id, left(btrim(p_new_list->>'name'), 60), uid,
            nullif(p_new_list->>'planned_for', '')::date, nullif(left(btrim(p_new_list->>'note'), 300), ''))
    returning id into lid;
  elsif lid is not null and (not exists (select 1 from public.shopping_lists where id = lid and household_id = p_household_id)
        or not public.can_access_list(lid)) then
    raise exception 'NOT_FOUND';
  end if;
  -- položky bez zoznamu nemajú kam ísť
  if lid is null and jsonb_array_length(p_items) > 0 then raise exception 'INVALID_INPUT'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    res := public.add_item(
      lid,
      it->>'name',
      nullif(it->>'quantity', '')::numeric,
      nullif(it->>'unit', ''),
      nullif(left(it->>'note', 200), ''),
      null,
      nullif(it->>'category_id', ''),
      gen_random_uuid());
    if res->>'kind' = 'REQUEST' then n_req := n_req + 1; else n_it := n_it + 1; end if;
  end loop;

  for rc in select * from jsonb_array_elements(p_recipes) loop
    if coalesce(btrim(rc->>'key'), '') = '' or coalesce(btrim(rc->>'name'), '') = '' then raise exception 'INVALID_INPUT'; end if;
    day := nullif(rc->>'day', '')::date;
    -- ten istý recept znova = nový plán namiesto starého čakajúceho; na jeden deň jedno jedlo
    update public.recipe_plans set status = 'DISMISSED'
     where household_id = p_household_id and status = 'PENDING'
       and (recipe_key = rc->>'key' or (day is not null and planned_on = day));
    insert into public.recipe_plans (household_id, recipe_key, recipe_name, portions, list_id, created_by, planned_on)
    values (p_household_id, left(rc->>'key', 60), left(btrim(rc->>'name'), 120),
            greatest(1, least(50, coalesce((rc->>'portions')::int, 4))), lid, uid, day);
  end loop;

  return jsonb_build_object('list_id', lid, 'items', n_it, 'requests', n_req);
end $$;
revoke all on function public.plan_recipes(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.plan_recipes(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
