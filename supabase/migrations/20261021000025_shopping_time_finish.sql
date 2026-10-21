-- =============================================================================
-- Nákup podľa nového dizajnu:
--  1. „Nemali“ (UNAVAILABLE) sa počíta ako vybavená položka: zapamätá sa kto a kedy
--     (purchased_by/purchased_at = kto ju vybavil), nákup sa uzavrie ako pri kúpenej.
--  2. Čas nákupu pri zozname (planned_time, napr. 17:30) – nepovinný.
--  3. finish_shopping – koniec nákupu s voľbou, čo s nekúpenými (presunúť na zajtra
--     do nového zoznamu / nechať v zozname). Všetko v jednej transakcii.
--  4. move_item – „Kúpim inde“: presun položky do iného zoznamu (alebo do nového).
-- =============================================================================

-- ---------------------------------------------------------------- 1. Nemali
create or replace function public.items_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('PURCHASED', 'UNAVAILABLE') then
      -- kto a kedy položku vybavil (kúpil alebo zistil, že ju nemali)
      new.purchased_by := auth.uid();
      new.purchased_at := now();
    else
      new.purchased_by := null;
      new.purchased_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- 2. čas nákupu
alter table public.shopping_lists add column if not exists planned_time time;
grant insert (household_id, name, is_private, planned_for, planned_time, note) on public.shopping_lists to authenticated;
grant update (name, is_archived, is_private, planned_for, planned_time, note) on public.shopping_lists to authenticated;

-- ---------------------------------------------------------------- 3. koniec nákupu
-- p_unbought: 'MOVE' = nekúpené do nového zoznamu na zajtra (rovnaký názov a súkromie),
--             'KEEP' = ostanú v tomto zozname (zoznam ostane rozpracovaný).
-- Vráti id nového zoznamu (pri MOVE, ak niečo ostalo), inak null.
create function public.finish_shopping(p_session_id uuid, p_unbought text default 'KEEP')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  s   public.shopping_sessions;
  lst public.shopping_lists;
  new_id uuid;
begin
  if p_unbought not in ('MOVE', 'KEEP') then raise exception 'INVALID_INPUT'; end if;
  select * into s from public.shopping_sessions where id = p_session_id for update;
  if not found or not public.can_access_list(s.list_id) then raise exception 'NOT_FOUND'; end if;
  select * into lst from public.shopping_lists where id = s.list_id for update;

  if p_unbought = 'MOVE'
     and exists (select 1 from public.shopping_list_items where list_id = lst.id and status = 'OPEN') then
    insert into public.shopping_lists (household_id, name, created_by, is_private, planned_for, note)
    values (lst.household_id, lst.name, uid, lst.is_private, current_date + 1, lst.note)
    returning id into new_id;
    update public.shopping_list_items set list_id = new_id
     where list_id = lst.id and status = 'OPEN';
  end if;

  perform public.end_shopping(p_session_id);
  return new_id;
end $$;

-- ---------------------------------------------------------------- 4. kúpim inde
-- Presun položky do iného zoznamu tej istej domácnosti. Bez cieľa sa založí nový
-- zoznam na zajtra s názvom p_new_name (text dodá aplikácia v jazyku používateľa).
create function public.move_item(p_item_id uuid, p_target_list uuid default null, p_new_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  it  public.shopping_list_items;
  src public.shopping_lists;
  dst public.shopping_lists;
  target uuid := p_target_list;
begin
  select * into it from public.shopping_list_items where id = p_item_id for update;
  if not found or not public.can_access_list(it.list_id) then raise exception 'NOT_FOUND'; end if;
  select * into src from public.shopping_lists where id = it.list_id;
  if target is null then
    if coalesce(trim(p_new_name), '') = '' then raise exception 'INVALID_INPUT'; end if;
    insert into public.shopping_lists (household_id, name, created_by, is_private, planned_for)
    values (src.household_id, left(trim(p_new_name), 60), uid, src.is_private, current_date + 1)
    returning id into target;
  else
    select * into dst from public.shopping_lists where id = target;
    if not found or dst.household_id <> src.household_id or not public.can_access_list(dst.id) then
      raise exception 'NOT_FOUND';
    end if;
    -- presun do hotového nákupu ho znova otvorí
    update public.shopping_lists set completed_at = null where id = dst.id and completed_at is not null;
  end if;
  update public.shopping_list_items
     set list_id = target, status = 'OPEN'
   where id = it.id;
  return target;
end $$;

revoke all on function public.finish_shopping(uuid, text) from public, anon;
revoke all on function public.move_item(uuid, uuid, text) from public, anon;
grant execute on function public.finish_shopping(uuid, text) to authenticated;
grant execute on function public.move_item(uuid, uuid, text) to authenticated;
