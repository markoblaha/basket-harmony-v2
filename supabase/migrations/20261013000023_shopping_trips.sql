-- =============================================================================
-- Nákupy ako samostatné výlety (Lidl dnes, DM v sobotu…):
--  1. Zoznam má plánovaný deň, poznámku a môže byť SÚKROMNÝ – vidí ho iba ten,
--     kto ho založil (ostatní členovia ho nevidia ani v živej synchronizácii).
--  2. Zoznam sa po nákupe, v ktorom sa kúpilo všetko, sám presunie do histórie
--     (completed_at). Nový nákup alebo pridaná položka ho znova otvorí.
--  3. Doklad k nákupu: „doplním neskôr“ (receipt_state = LATER), priame priradenie
--     pri nahrávaní, a automatické spárovanie samostatne nahratého bločku s
--     ukončeným nákupom bez dokladu (podľa položiek, obchodu a dátumu).
-- =============================================================================

-- ---------------------------------------------------------------- stĺpce
alter table public.shopping_lists
  add column is_private    boolean not null default false,
  add column planned_for   date,
  add column note          text check (note is null or char_length(note) <= 200),
  add column completed_at  timestamptz,
  add column receipt_state text not null default 'NONE' check (receipt_state in ('NONE', 'LATER', 'ATTACHED')),
  add column receipt_id    uuid references public.receipts (id) on delete set null;

alter table public.receipts
  add column list_id     uuid references public.shopping_lists (id) on delete set null,
  add column match_score numeric(4, 3);
create index receipts_list_idx on public.receipts (list_id);

grant insert (household_id, name, is_private, planned_for, note) on public.shopping_lists to authenticated;
grant update (name, is_archived, is_private, planned_for, note) on public.shopping_lists to authenticated;

-- ---------------------------------------------------------------- prístup
-- Vidí zoznam? Člen domácnosti, a pri súkromnom zozname iba jeho autor.
create function public.can_access_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shopping_lists l
     where l.id = p_list_id
       and public.is_member(l.household_id)
       and (not l.is_private or l.created_by = (select auth.uid()))
  )
$$;

alter policy lists_select on public.shopping_lists
  using (public.is_member(household_id) and (not is_private or created_by = (select auth.uid())));
alter policy lists_insert on public.shopping_lists
  with check (public.is_member(household_id) and (not is_private or created_by = (select auth.uid())));
alter policy lists_update on public.shopping_lists
  using (public.is_member(household_id) and (not is_private or created_by = (select auth.uid())))
  with check (public.is_member(household_id) and (not is_private or created_by = (select auth.uid())));
alter policy lists_delete on public.shopping_lists
  using (public.is_member(household_id) and (not is_private or created_by = (select auth.uid())));

alter policy items_select on public.shopping_list_items using (public.can_access_list(list_id));
alter policy items_update on public.shopping_list_items
  using (public.can_access_list(list_id)) with check (public.can_access_list(list_id));
alter policy items_delete on public.shopping_list_items using (public.can_access_list(list_id));
alter policy sessions_select on public.shopping_sessions using (public.can_access_list(list_id));
alter policy requests_select on public.addition_requests using (public.can_access_list(list_id));

-- ---------------------------------------------------------------- funkcie nákupu
-- add_item: rovnaké pravidlá ako doteraz + súkromný zoznam + znovuotvorenie z histórie.
create or replace function public.add_item(
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

  if p_client_op_id is not null then
    select id into new_id from public.shopping_list_items where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'ITEM', 'id', new_id); end if;
    select id into new_id from public.addition_requests where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'REQUEST', 'id', new_id); end if;
  end if;

  select * into lst from public.shopping_lists where id = p_list_id;
  if not found or not public.can_access_list(lst.id) then raise exception 'NOT_FOUND'; end if;
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

  -- Pridanie do nákupu z histórie ho vráti medzi rozpracované.
  if lst.completed_at is not null then
    update public.shopping_lists set completed_at = null where id = lst.id;
  end if;

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
    select id into new_id from public.shopping_list_items where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'ITEM', 'id', new_id); end if;
    select id into new_id from public.addition_requests where client_op_id = p_client_op_id;
    if found then return jsonb_build_object('kind', 'REQUEST', 'id', new_id); end if;
    raise;
end $$;

-- start_shopping: súkromný zoznam nakupuje iba autor; začatý nákup vráti zoznam z histórie.
create or replace function public.start_shopping(p_list_id uuid)
returns public.shopping_sessions language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  lst public.shopping_lists;
  s   public.shopping_sessions;
begin
  select * into lst from public.shopping_lists where id = p_list_id;
  if not found or not public.can_access_list(lst.id) then raise exception 'NOT_FOUND'; end if;
  s := public._lock_active_session(p_list_id);
  if s.id is not null then
    if s.shopper_id = uid then return s; end if;
    raise exception 'SESSION_ALREADY_ACTIVE';
  end if;
  update public.shopping_lists set completed_at = null where id = p_list_id and completed_at is not null;
  insert into public.shopping_sessions (list_id, household_id, shopper_id, expires_at)
  values (p_list_id, lst.household_id, uid, now() + interval '2 hours')
  returning * into s;
  return s;
exception
  when unique_violation then raise exception 'SESSION_ALREADY_ACTIVE';
end $$;

-- end_shopping: ak už v zozname nič neostalo, nákup ide do histórie.
create or replace function public.end_shopping(p_session_id uuid)
returns public.shopping_sessions language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  s   public.shopping_sessions;
begin
  select * into s from public.shopping_sessions where id = p_session_id for update;
  if not found or not public.can_access_list(s.list_id) then raise exception 'NOT_FOUND'; end if;
  if s.status <> 'ACTIVE' then return s; end if;
  update public.shopping_sessions
     set status = case when expires_at <= now() then 'EXPIRED'::public.session_status
                       else 'ENDED'::public.session_status end,
         ended_at = least(now(), expires_at)
   where id = s.id returning * into s;
  update public.addition_requests set status = 'EXPIRED', decided_at = now()
   where session_id = s.id and status = 'PENDING';
  update public.shopping_lists set completed_at = now()
   where id = s.list_id
     and not exists (select 1 from public.shopping_list_items i where i.list_id = s.list_id and i.status = 'OPEN');
  return s;
end $$;

-- ---------------------------------------------------------------- doklad k nákupu
-- „Odfotím doklad neskôr“ – nákup v histórii bude pripomínať, že doklad chýba.
create function public.set_receipt_later(p_list_id uuid, p_later boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.can_access_list(p_list_id) then raise exception 'NOT_FOUND'; end if;
  update public.shopping_lists
     set receipt_state = case when p_later then 'LATER' else 'NONE' end
   where id = p_list_id and receipt_state <> 'ATTACHED';
end $$;

-- Priradenie dokladu k nákupu (pri nahrávaní z obrazovky nákupu alebo ručne).
create function public.attach_receipt_to_list(p_receipt_id uuid, p_list_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r   public.receipts;
  lst public.shopping_lists;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  select * into lst from public.shopping_lists where id = p_list_id for update;
  if not found or lst.household_id <> r.household_id or not public.can_access_list(lst.id) then
    raise exception 'NOT_FOUND';
  end if;
  -- Doklad mohol byť predtým priradený inému nákupu – ten ho stratí.
  update public.shopping_lists set receipt_id = null, receipt_state = 'LATER'
   where receipt_id = r.id and id <> lst.id;
  update public.receipts set list_id = lst.id, match_score = null where id = r.id;
  update public.shopping_lists set receipt_id = r.id, receipt_state = 'ATTACHED' where id = lst.id;
end $$;

-- Ako veľmi sa bloček podobá na nákup (0–1). Porovnáva položky (začiatky slov,
-- lebo na bločku býva „KAISERKA NAT.“), obchod a dátum.
create function public._receipt_list_score(p_receipt_id uuid, p_list_id uuid)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  r   public.receipts;
  lst public.shopping_lists;
  n_items int;
  n_hit int;
  item_score numeric := 0;
  store_score numeric := 0;
  date_score numeric := 0;
  days int;
begin
  select * into r from public.receipts where id = p_receipt_id;
  select * into lst from public.shopping_lists where id = p_list_id;
  if r.id is null or lst.id is null then return 0; end if;

  with li as (
    select i.id, array(
             select left(w, 4) from regexp_split_to_table(public.name_key(i.name), '[^a-z0-9]+') w
              where char_length(w) >= 3) as words
      from public.shopping_list_items i
     where i.list_id = lst.id and i.status = 'PURCHASED'
  ), rw as (
    select distinct left(w, 4) as w
      from public.receipt_items ri, regexp_split_to_table(ri.name_key, '[^a-z0-9]+') w
     where ri.receipt_id = r.id and char_length(w) >= 3
  )
  select count(*), count(*) filter (where exists (select 1 from rw where rw.w = any (li.words)))
    into n_items, n_hit from li;
  if n_items > 0 then item_score := n_hit::numeric / n_items; end if;

  if r.store_key is not null and char_length(r.store_key) >= 3 then
    if position(public.name_key(lst.name) in r.store_key) > 0 or position(r.store_key in public.name_key(lst.name)) > 0
       or split_part(r.store_key, ' ', 1) = split_part(public.name_key(lst.name), ' ', 1) then
      store_score := 1;
    end if;
  end if;

  days := abs(coalesce(r.purchased_on, r.created_at::date) - coalesce(lst.completed_at, lst.updated_at)::date);
  date_score := greatest(0, 1 - days / 3.0);

  return round(0.6 * item_score + 0.25 * store_score + 0.15 * date_score, 3);
end $$;

-- Samostatne nahratý bloček: nájdi ukončený nákup bez dokladu, ktorý sa naň najviac podobá.
create function public._auto_match_receipt(p_receipt_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r      public.receipts;
  best   uuid;
  best_s numeric := 0;
  cand   record;
  sc     numeric;
begin
  select * into r from public.receipts where id = p_receipt_id;
  if r.id is null or r.list_id is not null or r.status not in ('OK', 'NEEDS_REVIEW') then return null; end if;
  for cand in
    select l.id, l.receipt_state
      from public.shopping_lists l
     where l.household_id = r.household_id
       and l.completed_at is not null
       and l.receipt_id is null
       and l.receipt_state <> 'ATTACHED'
       and l.completed_at::date between coalesce(r.purchased_on, r.created_at::date) - 2
                                    and coalesce(r.purchased_on, r.created_at::date) + 2
  loop
    sc := public._receipt_list_score(r.id, cand.id) + case when cand.receipt_state = 'LATER' then 0.05 else 0 end;
    if sc > best_s then best_s := sc; best := cand.id; end if;
  end loop;
  -- Prah: musí sedieť aspoň časť položiek alebo obchod + deň.
  if best is null or best_s < 0.45 then return null; end if;
  update public.receipts set list_id = best, match_score = least(best_s, 1) where id = r.id;
  update public.shopping_lists set receipt_id = r.id, receipt_state = 'ATTACHED' where id = best;
  return best;
end $$;

create function public.receipts_auto_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.list_id is null and new.status in ('OK', 'NEEDS_REVIEW')
     and (old.status is distinct from new.status) then
    perform public._auto_match_receipt(new.id);
  end if;
  return null;
end $$;
create trigger receipts_auto_match after update of status on public.receipts
  for each row execute function public.receipts_auto_match();

revoke execute on function
  public.can_access_list(uuid), public.set_receipt_later(uuid, boolean), public.attach_receipt_to_list(uuid, uuid),
  public._receipt_list_score(uuid, uuid), public._auto_match_receipt(uuid), public.receipts_auto_match()
from public, anon;
grant execute on function
  public.can_access_list(uuid), public.set_receipt_later(uuid, boolean), public.attach_receipt_to_list(uuid, uuid),
  public.receipts_auto_match()
to authenticated;
grant execute on function public.receipts_auto_match(), public._auto_match_receipt(uuid), public._receipt_list_score(uuid, uuid) to service_role;
