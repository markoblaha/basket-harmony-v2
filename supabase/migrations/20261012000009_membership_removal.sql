-- Odchod z domácnosti. Posledný člen ju tým zruší; ak odchádza vlastník,
-- vlastníctvo prejde na najdlhšie pôsobiaceho člena.
create function public.leave_household(p_household_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  was_owner boolean;
  successor uuid;
begin
  select role = 'OWNER' into was_owner from public.household_members
   where household_id = p_household_id and user_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  delete from public.household_members where household_id = p_household_id and user_id = uid;
  update public.shopping_sessions set status = 'ENDED', ended_at = now()
   where household_id = p_household_id and shopper_id = uid and status = 'ACTIVE';
  select user_id into successor from public.household_members
   where household_id = p_household_id order by joined_at limit 1;
  if successor is null then
    delete from public.households where id = p_household_id;
  elsif was_owner and not exists (select 1 from public.household_members
                                  where household_id = p_household_id and role = 'OWNER') then
    update public.household_members set role = 'OWNER'
     where household_id = p_household_id and user_id = successor;
  end if;
end $$;

create function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if not public.is_owner(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_user_id = uid then raise exception 'VALIDATION'; end if;
  delete from public.household_members where household_id = p_household_id and user_id = p_user_id;
  update public.shopping_sessions set status = 'ENDED', ended_at = now()
   where household_id = p_household_id and shopper_id = p_user_id and status = 'ACTIVE';
end $$;

revoke execute on function public.leave_household(uuid), public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.leave_household(uuid), public.remove_member(uuid, uuid) to authenticated;
