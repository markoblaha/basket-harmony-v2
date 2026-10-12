-- Začať nákup. Ak už nakupujem ja, vráti môj existujúci nákup.
create function public.start_shopping(p_list_id uuid)
returns public.shopping_sessions language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  lst public.shopping_lists;
  s   public.shopping_sessions;
begin
  select * into lst from public.shopping_lists where id = p_list_id;
  if not found or not public.is_member(lst.household_id) then raise exception 'NOT_FOUND'; end if;
  s := public._lock_active_session(p_list_id);
  if s.id is not null then
    if s.shopper_id = uid then return s; end if;
    raise exception 'SESSION_ALREADY_ACTIVE';
  end if;
  insert into public.shopping_sessions (list_id, household_id, shopper_id, expires_at)
  values (p_list_id, lst.household_id, uid, now() + interval '2 hours')
  returning * into s;
  return s;
exception
  when unique_violation then raise exception 'SESSION_ALREADY_ACTIVE';
end $$;

-- Ukončiť nákup. Kúpené položky ostanú v histórii, nekúpené ostanú v zozname,
-- nevybavené žiadosti prepadnú (nič sa nepridá potajomky).
create function public.end_shopping(p_session_id uuid)
returns public.shopping_sessions language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  s   public.shopping_sessions;
begin
  select * into s from public.shopping_sessions where id = p_session_id for update;
  if not found or not public.is_member(s.household_id) then raise exception 'NOT_FOUND'; end if;
  if s.status <> 'ACTIVE' then return s; end if;
  update public.shopping_sessions
     set status = case when expires_at <= now() then 'EXPIRED'::public.session_status
                       else 'ENDED'::public.session_status end,
         ended_at = least(now(), expires_at)
   where id = s.id returning * into s;
  update public.addition_requests set status = 'EXPIRED', decided_at = now()
   where session_id = s.id and status = 'PENDING';
  return s;
end $$;

-- Prijať žiadosť. Volať sa dá koľkokoľvek krát – položka vznikne najviac raz.
create function public.accept_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  r   public.addition_requests;
  s   public.shopping_sessions;
  new_id uuid;
begin
  select * into r from public.addition_requests where id = p_request_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.status = 'ACCEPTED' then
    return jsonb_build_object('outcome', 'ACCEPTED', 'item_id', r.resulting_item_id);
  end if;
  if r.status <> 'PENDING' then
    return jsonb_build_object('outcome', r.status);
  end if;
  if r.requested_for <> uid then raise exception 'FORBIDDEN'; end if;

  s := public._lock_active_session(r.list_id);
  if s.id is null or s.id <> r.session_id then
    update public.addition_requests set status = 'EXPIRED', decided_at = now()
     where id = r.id and status = 'PENDING';
    return jsonb_build_object('outcome', 'EXPIRED');
  end if;

  insert into public.shopping_list_items
    (list_id, household_id, name, quantity, unit, note, category_id, added_by)
  values (r.list_id, r.household_id, r.name, r.quantity, r.unit, r.note, r.category_id, r.requested_by)
  returning id into new_id;

  update public.addition_requests
     set status = 'ACCEPTED', decided_at = now(), decided_by = uid, resulting_item_id = new_id
   where id = r.id;
  return jsonb_build_object('outcome', 'ACCEPTED', 'item_id', new_id);
end $$;

create function public.reject_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  r   public.addition_requests;
begin
  select * into r from public.addition_requests where id = p_request_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'PENDING' then return jsonb_build_object('outcome', r.status); end if;
  if r.requested_for <> uid then raise exception 'FORBIDDEN'; end if;
  update public.addition_requests
     set status = 'REJECTED', decided_at = now(), decided_by = uid
   where id = r.id;
  return jsonb_build_object('outcome', 'REJECTED');
end $$;

-- Upratovanie: vypršané nákupy označí ako EXPIRED (spúšťa sa každých 5 min).
create function public.expire_stale_sessions()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with expired as (
    update public.shopping_sessions
       set status = 'EXPIRED', ended_at = expires_at
     where status = 'ACTIVE' and expires_at <= now()
    returning id
  ), req as (
    update public.addition_requests set status = 'EXPIRED', decided_at = now()
     where status = 'PENDING' and session_id in (select id from expired)
    returning 1
  )
  select count(*) into n from expired;
  return n;
end $$;
