-- =============================================================================
-- Nákup v3:
--  1. Obľúbené dlaždice – každý člen si ich skladá sám (vlastný text na dlaždici,
--     produkt, ktorý sa pridá do zoznamu, poradie).
--  2. Odpoveď na žiadosť – nakupujúci môže tomu, kto žiada, poslať krátku správu
--     („Nemajú to“, „Beriem len 4“). Žiadateľ ju uvidí pri svojej žiadosti.
--  3. Najčastejšie položky – poradie produktov pre rotujúce dlaždice.
-- =============================================================================

-- ---------------------------------------------------------------- 1. dlaždice
create table public.favorite_tiles (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label        text not null check (char_length(btrim(label)) between 1 and 40),
  item_name    text not null check (char_length(btrim(item_name)) between 1 and 120),
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index favorite_tiles_owner_idx on public.favorite_tiles (user_id, household_id, position);

alter table public.favorite_tiles enable row level security;
grant select, delete on public.favorite_tiles to authenticated;
grant insert (household_id, label, item_name, position) on public.favorite_tiles to authenticated;
grant update (label, item_name, position) on public.favorite_tiles to authenticated;

-- Dlaždice vidí a mení iba ich majiteľ, a iba v domácnosti, ktorej je členom.
create policy favorite_tiles_select on public.favorite_tiles for select to authenticated
  using (user_id = auth.uid() and public.is_member(household_id));
create policy favorite_tiles_insert on public.favorite_tiles for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(household_id));
create policy favorite_tiles_update on public.favorite_tiles for update to authenticated
  using (user_id = auth.uid() and public.is_member(household_id))
  with check (user_id = auth.uid() and public.is_member(household_id));
create policy favorite_tiles_delete on public.favorite_tiles for delete to authenticated
  using (user_id = auth.uid() and public.is_member(household_id));

-- ---------------------------------------------------------------- 2. odpoveď
alter table public.addition_requests
  add column response_note text check (response_note is null or char_length(response_note) <= 300),
  add column responded_at  timestamptz;

-- Odpovedať smie iba ten, komu bola žiadosť poslaná (nakupujúci).
-- Odpoveď sa dá poslať aj po rozhodnutí (napr. „Zahodil som, nemali to“).
create function public.reply_request(p_request_id uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  r   public.addition_requests;
  msg text := btrim(coalesce(p_message, ''));
begin
  select * into r from public.addition_requests where id = p_request_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.requested_for <> uid then raise exception 'FORBIDDEN'; end if;
  if char_length(msg) = 0 or char_length(msg) > 300 then raise exception 'INVALID_INPUT'; end if;
  update public.addition_requests
     set response_note = msg, responded_at = now()
   where id = r.id;
end $$;

-- ---------------------------------------------------------------- 3. najčastejšie
-- Produkty domácnosti zoradené podľa toho, ako často sa za posledný polrok
-- dostali do zoznamu. Rovnaký produkt s inou veľkosťou písmen sa ráta spolu.
create function public.frequent_items(p_household_id uuid, p_limit int default 40)
returns table (name text, times bigint, category_id text)
language sql stable security invoker set search_path = '' as $$
  select (array_agg(i.name order by i.created_at desc))[1] as name,
         count(*) as times,
         (array_agg(i.category_id order by i.created_at desc))[1] as category_id
    from public.shopping_list_items i
   where i.household_id = p_household_id
     and i.created_at > now() - interval '180 days'
   group by public.name_key(i.name)
   order by count(*) desc, max(i.created_at) desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke execute on function public.reply_request(uuid, text), public.frequent_items(uuid, int) from public, anon;
grant execute on function
  public.reply_request(uuid, text),
  public.frequent_items(uuid, int)
to authenticated;

alter publication supabase_realtime add table public.favorite_tiles;
