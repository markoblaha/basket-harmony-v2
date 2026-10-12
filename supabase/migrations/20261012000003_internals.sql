-- =============================================================================
-- Interné pomocné funkcie (nie sú dostupné z aplikácie)
-- =============================================================================
create function public._require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return uid;
end $$;

-- Vráti aktívny nákup zoznamu a zamkne ho (FOR UPDATE), aby sa s ním nemohla
-- súčasne hýbať iná operácia. Ak už vypršal, označí ho ako EXPIRED aj s jeho
-- čakajúcimi žiadosťami a vráti NULL.
create function public._lock_active_session(p_list_id uuid)
returns public.shopping_sessions
language plpgsql set search_path = '' as $$
declare s public.shopping_sessions;
begin
  select * into s from public.shopping_sessions
   where list_id = p_list_id and status = 'ACTIVE'
   for update;
  if not found then return null; end if;
  if s.expires_at <= now() then
    update public.shopping_sessions
       set status = 'EXPIRED', ended_at = s.expires_at
     where id = s.id;
    update public.addition_requests
       set status = 'EXPIRED', decided_at = now()
     where session_id = s.id and status = 'PENDING';
    return null;
  end if;
  return s;
end $$;

create function public._remember_category(p_household uuid, p_name text, p_category text)
returns void language sql set search_path = '' as $$
  insert into public.category_memory (household_id, name_key, category_id)
  values (p_household, public.name_key(p_name), p_category)
  on conflict (household_id, name_key)
  do update set category_id = excluded.category_id, updated_at = now()
$$;

-- Pred úpravou položky: dopočítaj, kto a kedy ju kúpil.
create function public.items_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'PURCHASED' then
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
create trigger items_before_update before update on public.shopping_list_items
  for each row execute function public.items_before_update();

-- Po úprave položky: zapamätaj zmenenú kategóriu a predĺž nákup, kým
-- nakupujúci aktívne odškrtáva (nákup nevyprší uprostred obchodu).
create function public.items_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.category_id is distinct from old.category_id and auth.uid() is not null then
    perform public._remember_category(new.household_id, new.name, new.category_id);
  end if;
  if new.status is distinct from old.status and auth.uid() is not null then
    update public.shopping_sessions
       set expires_at = greatest(expires_at, now() + interval '2 hours')
     where list_id = new.list_id and status = 'ACTIVE'
       and shopper_id = auth.uid() and expires_at > now();
  end if;
  return null;
end $$;
create trigger items_after_update after update on public.shopping_list_items
  for each row execute function public.items_after_update();
