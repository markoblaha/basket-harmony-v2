-- =============================================================================
-- Recepty.
--  recipes          – vlastné recepty domácnosti (prečítané z fotky, odkazu, textu
--                     alebo navrhnuté AI). Katalóg receptov je v aplikácii, nie tu.
--  recipe_favorites – obľúbené recepty používateľa (katalógové aj vlastné).
--  recipe_plans     – recepty, ktorých suroviny išli do zoznamu a čakajú na uvarenie,
--                     a záznam o uvarení (kedy, koľko porcií, ako dlho).
--  plan_recipes     – suroviny receptov do nového alebo existujúceho zoznamu
--                     (cez add_item, takže počas nákupu vzniknú žiadosti) + čakajúce recepty.
--  cook_recipe      – „Uvarené“: čakajúci recept sa uzavrie, inak vznikne nový záznam.
--  set_recipe_plan_status – odobrať z čakajúcich / vrátiť späť.
-- Recept sa označuje kľúčom (recipe_key): id vlastného receptu alebo id z katalógu.
-- =============================================================================

-- ---------------------------------------------------------------- 1. vlastné recepty
create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  category     text not null default 'hlavne' check (category in ('hlavne', 'cestoviny', 'polievky', 'sladke', 'ranajky', 'salaty')),
  meat         text not null default 'bez' check (meat in ('kuracie', 'bravcove', 'hovadzie', 'ryby', 'bez')),
  minutes      int  not null default 30 check (minutes between 1 and 1440),
  difficulty   smallint not null default 1 check (difficulty between 1 and 3),
  portions     int  not null default 4 check (portions between 1 and 50),
  icon         text check (char_length(icon) <= 30),
  tags         text[] not null default '{}',
  source       text check (char_length(source) <= 200),
  source_url   text check (char_length(source_url) <= 2000),
  ingredients  jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 80),
  steps        jsonb not null default '[]' check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 60),
  qa           jsonb not null default '[]' check (jsonb_typeof(qa) = 'array'),
  ai           boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index recipes_household_idx on public.recipes (household_id, created_at desc);
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

alter table public.recipes enable row level security;
-- Supabase dáva novým tabuľkám predvolene všetky práva – povolíme len to, čo treba.
revoke all on public.recipes from anon, authenticated;
grant select, delete on public.recipes to authenticated;
grant insert (household_id, name, category, meat, minutes, difficulty, portions, icon, tags, source, source_url, ingredients, steps, qa, ai)
  on public.recipes to authenticated;
grant update (name, category, meat, minutes, difficulty, portions, icon, tags, source, source_url, ingredients, steps, qa)
  on public.recipes to authenticated;

create policy recipes_select on public.recipes for select to authenticated using (public.is_member(household_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy recipes_update on public.recipes for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy recipes_delete on public.recipes for delete to authenticated using (public.is_member(household_id));

-- ---------------------------------------------------------------- 2. obľúbené
create table public.recipe_favorites (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_key   text not null check (char_length(recipe_key) between 1 and 60),
  created_at   timestamptz not null default now(),
  primary key (user_id, household_id, recipe_key)
);
alter table public.recipe_favorites enable row level security;
revoke all on public.recipe_favorites from anon, authenticated;
grant select, delete on public.recipe_favorites to authenticated;
grant insert (household_id, recipe_key) on public.recipe_favorites to authenticated;
create policy recipe_favorites_select on public.recipe_favorites for select to authenticated
  using (user_id = auth.uid() and public.is_member(household_id));
create policy recipe_favorites_insert on public.recipe_favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(household_id));
create policy recipe_favorites_delete on public.recipe_favorites for delete to authenticated
  using (user_id = auth.uid() and public.is_member(household_id));

-- ---------------------------------------------------------------- 3. čakajúce a uvarené
create type public.recipe_plan_status as enum ('PENDING', 'COOKED', 'DISMISSED');

create table public.recipe_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_key   text not null check (char_length(recipe_key) between 1 and 60),
  recipe_name  text not null check (char_length(recipe_name) between 1 and 120),
  portions     int  not null check (portions between 1 and 50),
  list_id      uuid references public.shopping_lists (id) on delete set null,
  status       public.recipe_plan_status not null default 'PENDING',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  cooked_at    timestamptz,
  cooked_by    uuid references auth.users (id) on delete set null,
  cook_seconds int check (cook_seconds is null or cook_seconds between 0 and 86400)
);
create index recipe_plans_household_idx on public.recipe_plans (household_id, status, created_at desc);

alter table public.recipe_plans enable row level security;
revoke all on public.recipe_plans from anon, authenticated;
grant select on public.recipe_plans to authenticated;
create policy recipe_plans_select on public.recipe_plans for select to authenticated using (public.is_member(household_id));

/*
 * Suroviny receptov do zoznamu. p_list_id = existujúci zoznam, inak sa založí nový z p_new_list
 * {name, planned_for, note}. p_items = [{name, quantity, unit, note, category_id}],
 * p_recipes = [{key, name, portions}]. Vracia {list_id, items, requests}.
 */
create function public.plan_recipes(p_household_id uuid, p_list_id uuid, p_new_list jsonb, p_items jsonb, p_recipes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := public._require_uid();
  lid   uuid := p_list_id;
  it    jsonb;
  rc    jsonb;
  res   jsonb;
  n_it  int := 0;
  n_req int := 0;
begin
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  if jsonb_typeof(coalesce(p_items, 'null')) <> 'array' or jsonb_typeof(coalesce(p_recipes, 'null')) <> 'array'
     or jsonb_array_length(p_items) > 120 or jsonb_array_length(p_recipes) > 20 then
    raise exception 'INVALID_INPUT';
  end if;

  if lid is null then
    if coalesce(btrim(p_new_list->>'name'), '') = '' then raise exception 'INVALID_INPUT'; end if;
    insert into public.shopping_lists (household_id, name, created_by, planned_for, note)
    values (p_household_id, left(btrim(p_new_list->>'name'), 60), uid,
            nullif(p_new_list->>'planned_for', '')::date, nullif(left(btrim(p_new_list->>'note'), 300), ''))
    returning id into lid;
  elsif not exists (select 1 from public.shopping_lists where id = lid and household_id = p_household_id)
        or not public.can_access_list(lid) then
    raise exception 'NOT_FOUND';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    res := public.add_item(
      lid,
      it->>'name',
      nullif(it->>'quantity', '')::numeric,
      nullif(it->>'unit', ''),
      nullif(left(it->>'note', 200), ''),
      null,
      nullif(it->>'category_id', ''),  -- len odhad: pamäť kategórií domácnosti má prednosť
      gen_random_uuid());
    if res->>'kind' = 'REQUEST' then n_req := n_req + 1; else n_it := n_it + 1; end if;
  end loop;

  for rc in select * from jsonb_array_elements(p_recipes) loop
    if coalesce(btrim(rc->>'key'), '') = '' or coalesce(btrim(rc->>'name'), '') = '' then raise exception 'INVALID_INPUT'; end if;
    -- ten istý recept znova = nový plán namiesto starého čakajúceho
    update public.recipe_plans set status = 'DISMISSED'
     where household_id = p_household_id and recipe_key = rc->>'key' and status = 'PENDING';
    insert into public.recipe_plans (household_id, recipe_key, recipe_name, portions, list_id, created_by)
    values (p_household_id, left(rc->>'key', 60), left(btrim(rc->>'name'), 120),
            greatest(1, least(50, coalesce((rc->>'portions')::int, 4))), lid, uid);
  end loop;

  return jsonb_build_object('list_id', lid, 'items', n_it, 'requests', n_req);
end $$;

/* „Uvarené“: uzavrie čakajúci recept (ak je), inak zapíše nový záznam o uvarení. */
create function public.cook_recipe(p_household_id uuid, p_recipe_key text, p_recipe_name text, p_portions int, p_seconds int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  pid uuid;
begin
  if not public.is_member(p_household_id) then raise exception 'NOT_FOUND'; end if;
  if coalesce(btrim(p_recipe_key), '') = '' or coalesce(btrim(p_recipe_name), '') = '' then raise exception 'INVALID_INPUT'; end if;
  select id into pid from public.recipe_plans
   where household_id = p_household_id and recipe_key = p_recipe_key and status = 'PENDING'
   order by created_at desc limit 1 for update;
  if pid is null then
    insert into public.recipe_plans (household_id, recipe_key, recipe_name, portions, created_by, status)
    values (p_household_id, left(p_recipe_key, 60), left(btrim(p_recipe_name), 120), greatest(1, least(50, coalesce(p_portions, 4))), uid, 'COOKED')
    returning id into pid;
  end if;
  update public.recipe_plans
     set status = 'COOKED', cooked_at = now(), cooked_by = uid,
         portions = greatest(1, least(50, coalesce(p_portions, portions))),
         cook_seconds = case when p_seconds between 0 and 86400 then p_seconds end
   where id = pid;
  return pid;
end $$;

/* Odobrať z čakajúcich (DISMISSED) alebo to vrátiť späť (PENDING). Uvarené sa už nemení. */
create function public.set_recipe_plan_status(p_plan_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.recipe_plans;
begin
  perform public._require_uid();
  if p_status not in ('PENDING', 'DISMISSED') then raise exception 'INVALID_INPUT'; end if;
  select * into p from public.recipe_plans where id = p_plan_id for update;
  if not found or not public.is_member(p.household_id) then raise exception 'NOT_FOUND'; end if;
  if p.status = 'COOKED' then raise exception 'INVALID_INPUT'; end if;
  update public.recipe_plans set status = p_status::public.recipe_plan_status where id = p.id;
end $$;

revoke all on function public.plan_recipes(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.cook_recipe(uuid, text, text, int, int) from public, anon;
revoke all on function public.set_recipe_plan_status(uuid, text) from public, anon;
grant execute on function public.plan_recipes(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.cook_recipe(uuid, text, text, int, int) to authenticated;
grant execute on function public.set_recipe_plan_status(uuid, text) to authenticated;

alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_plans;
