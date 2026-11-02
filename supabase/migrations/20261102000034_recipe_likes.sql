-- =============================================================================
-- Ochutnávač v Receptoch (Fáza 6 prestavby): „Chcem“ pri recepte – za každého člena zvlášť.
-- Ostatní v domácnosti vidia, čo sa komu páči („Zhoda!“, keď to chcú dvaja). Pridať a odobrať
-- môže človek len svoje „Chcem“ (RLS), vidia ho len členovia domácnosti.
-- =============================================================================
create table public.recipe_likes (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipe_key   text not null check (char_length(recipe_key) between 1 and 60),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id, recipe_key)
);
alter table public.recipe_likes enable row level security;
revoke all on public.recipe_likes from anon, authenticated;
grant select, delete on public.recipe_likes to authenticated;
grant insert (household_id, recipe_key) on public.recipe_likes to authenticated;
create policy recipe_likes_select on public.recipe_likes for select to authenticated using (public.is_member(household_id));
create policy recipe_likes_insert on public.recipe_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(household_id));
create policy recipe_likes_delete on public.recipe_likes for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.recipe_likes;
