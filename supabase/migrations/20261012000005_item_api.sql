-- -----------------------------------------------------------------------------
-- PRIDANIE POLOŽKY – jediné miesto, kde sa rozhoduje:
--   A) nikto nenakupuje            -> rovno do zoznamu
--   B) nakupujem ja                -> rovno do zoznamu
--   C) nakupuje niekto iný         -> žiadosť, ktorú nakupujúci schváli
-- Kategória: výber používateľa > pamäť domácnosti > odhad aplikácie > Ostatné.
-- -----------------------------------------------------------------------------
create function public.add_item(
  p_list_id        uuid,
  p_name           text,
  p_quantity       numeric default null,
  p_unit           text    default null,
  p_note           text    default null,
  p_category_id    text    default null,
  p_category_guess text    default null,
  p_client_op_id   uuid    default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := public._require_uid();
  lst  public.shopping_lists;
  s    public.shopping_sessions;
  cat  text;
  new_id uuid;
  nm   text := trim(coalesce(p_name, ''));
begin
  if char_length(nm) not between 1 and 120 then raise exception 'VALIDATION'; end if;

  -- Opakovaná požiadavka? Vráť pôvodný výsledok.
  if p_client_op_id is not null then
    select id into new_id from public.shopping_list_items where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'ITEM', 'id', new_id); end if;
    select id into new_id from public.addition_requests where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'REQUEST', 'id', new_id); end if;
  end if;

  select * into lst from public.shopping_lists where id = p_list_id;
  if not found or not public.is_member(lst.household_id) then raise exception 'NOT_FOUND'; end if;
  if lst.is_archived then raise exception 'LIST_ARCHIVED'; end if;

  if p_category_id is not null and exists (select 1 from public.categories where id = p_category_id) then
    cat := p_category_id;
    perform public._remember_category(lst.household_id, nm, cat);
  else
    select category_id into cat from public.category_memory
     where household_id = lst.household_id and name_key = public.name_key(nm);
    if cat is null and exists (select 1 from public.categories where id = p_category_guess) then
      cat := p_category_guess;
    end if;
  end if;
  cat := coalesce(cat, 'other');

  s := public._lock_active_session(p_list_id);

  if s.id is null or s.shopper_id = uid then
    insert into public.shopping_list_items
      (list_id, household_id, name, quantity, unit, note, category_id, added_by, client_op_id)
    values
      (p_list_id, lst.household_id, nm, p_quantity, nullif(trim(p_unit), ''),
       nullif(trim(p_note), ''), cat, uid, p_client_op_id)
    returning id into new_id;
    return jsonb_build_object('kind', 'ITEM', 'id', new_id);
  end if;

  insert into public.addition_requests
    (session_id, list_id, household_id, requested_by, requested_for,
     name, quantity, unit, note, category_id, client_op_id)
  values
    (s.id, p_list_id, lst.household_id, uid, s.shopper_id,
     nm, p_quantity, nullif(trim(p_unit), ''), nullif(trim(p_note), ''), cat, p_client_op_id)
  returning id into new_id;
  return jsonb_build_object('kind', 'REQUEST', 'id', new_id, 'shopper_id', s.shopper_id);
exception
  when unique_violation then
    -- Dve rovnaké požiadavky naraz: druhá narazí na unikátny client_op_id.
    select id into new_id from public.shopping_list_items where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'ITEM', 'id', new_id); end if;
    select id into new_id from public.addition_requests where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'REQUEST', 'id', new_id); end if;
    raise;
end $$;
