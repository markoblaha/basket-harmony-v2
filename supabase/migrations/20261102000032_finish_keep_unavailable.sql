-- =============================================================================
-- Koniec nákupu podľa mockupu (Fáza 4 prestavby): „Nekúpené nechať v zozname na budúce“.
-- Kúpené ide do histórie (nákup sa uzavrie), nekúpené a to, čo „nemali“, pokračuje v zozname
-- s rovnakým názvom. Zmeny oproti migrácii 25:
--  * položky „Nemali“ z tohto nákupu sa skopírujú do pokračujúceho zoznamu ako nekúpené
--    (v histórii nákupu ostanú ako „nemali“),
--  * pokračujúci zoznam si nechá pôvodný deň, ak je ešte pred nami, inak zajtra.
-- =============================================================================
create or replace function public.finish_shopping(p_session_id uuid, p_unbought text default 'KEEP')
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
     and exists (select 1 from public.shopping_list_items i
                  where i.list_id = lst.id
                    and (i.status = 'OPEN' or (i.status = 'UNAVAILABLE' and i.purchased_at >= s.started_at))) then
    insert into public.shopping_lists (household_id, name, created_by, is_private, planned_for, planned_time, note)
    values (lst.household_id, lst.name, uid, lst.is_private, greatest(lst.planned_for, current_date + 1), lst.planned_time, lst.note)
    returning id into new_id;
    update public.shopping_list_items set list_id = new_id
     where list_id = lst.id and status = 'OPEN';
    insert into public.shopping_list_items (household_id, list_id, name, quantity, unit, note, category_id, added_by)
    select i.household_id, new_id, i.name, i.quantity, i.unit, i.note, i.category_id, i.added_by
      from public.shopping_list_items i
     where i.list_id = lst.id and i.status = 'UNAVAILABLE' and i.purchased_at >= s.started_at;
  end if;

  perform public.end_shopping(p_session_id);
  return new_id;
end $$;
revoke all on function public.finish_shopping(uuid, text) from public, anon;
grant execute on function public.finish_shopping(uuid, text) to authenticated;
