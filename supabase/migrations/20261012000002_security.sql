-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles              enable row level security;
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.household_invitations enable row level security;
alter table public.categories            enable row level security;
alter table public.shopping_lists        enable row level security;
alter table public.shopping_list_items   enable row level security;
alter table public.category_memory       enable row level security;
alter table public.shopping_sessions     enable row level security;
alter table public.addition_requests     enable row level security;

-- Najprv všetko zakážeme, potom povolíme presne to, čo treba.
revoke all on all tables in schema public from anon, authenticated;

-- profily: vidím seba a ľudí z mojej domácnosti; meniť môžem iba svoje meno
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_household(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- domácnosti: čítajú členovia, premenovať môže vlastník
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- členovia: iba čítanie (zmeny cez funkcie)
grant select on public.household_members to authenticated;
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));

-- pozvánky: čítajú členovia domácnosti (bez tokenu – ten v DB nie je)
grant select (id, household_id, created_by, status, expires_at, accepted_by, accepted_at, created_at)
  on public.household_invitations to authenticated;
create policy invitations_select on public.household_invitations for select to authenticated
  using (public.is_member(household_id));

-- kategórie: verejný číselník
grant select on public.categories to authenticated;
create policy categories_select on public.categories for select to authenticated using (true);

-- zoznamy
grant select, delete on public.shopping_lists to authenticated;
grant insert (household_id, name) on public.shopping_lists to authenticated;
grant update (name, is_archived) on public.shopping_lists to authenticated;
create policy lists_select on public.shopping_lists for select to authenticated
  using (public.is_member(household_id));
create policy lists_insert on public.shopping_lists for insert to authenticated
  with check (public.is_member(household_id));
create policy lists_update on public.shopping_lists for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy lists_delete on public.shopping_lists for delete to authenticated
  using (public.is_member(household_id));

-- položky: pridávanie iba cez add_item() (kvôli pravidlu počas nákupu),
-- úprava a mazanie priamo – ale len vybrané stĺpce.
grant select, delete on public.shopping_list_items to authenticated;
grant update (name, quantity, unit, note, category_id, status) on public.shopping_list_items to authenticated;
create policy items_select on public.shopping_list_items for select to authenticated
  using (public.is_member(household_id));
create policy items_update on public.shopping_list_items for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy items_delete on public.shopping_list_items for delete to authenticated
  using (public.is_member(household_id));

grant select on public.category_memory to authenticated;
create policy category_memory_select on public.category_memory for select to authenticated
  using (public.is_member(household_id));

grant select on public.shopping_sessions to authenticated;
create policy sessions_select on public.shopping_sessions for select to authenticated
  using (public.is_member(household_id));

grant select on public.addition_requests to authenticated;
create policy requests_select on public.addition_requests for select to authenticated
  using (public.is_member(household_id));
