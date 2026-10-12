-- =============================================================================
-- Funkcie volané z aplikácie
-- =============================================================================

-- Založenie domácnosti + prvý zoznam. Zakladateľ je OWNER.
create function public.create_household(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  hid uuid;
begin
  if p_name is null or char_length(trim(p_name)) not between 1 and 60 then
    raise exception 'VALIDATION';
  end if;
  insert into public.households (name, created_by) values (trim(p_name), uid) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'OWNER');
  insert into public.shopping_lists (household_id, name, created_by) values (hid, 'Nákupný zoznam', uid);
  return hid;
end $$;

-- Vytvorí pozvánku platnú 7 dní a vráti token (iba raz – v DB je len odtlačok).
create function public.create_invitation(p_household_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := public._require_uid();
  token text;
  exp   timestamptz := now() + interval '7 days';
begin
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  -- 2× náhodné UUID = 244 bitov náhody; uhádnuť sa to nedá.
  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.household_invitations (household_id, created_by, token_hash, expires_at)
  values (p_household_id, uid, encode(sha256(convert_to(token, 'UTF8')), 'hex'), exp);
  return jsonb_build_object('token', token, 'expires_at', exp);
end $$;

-- Náhľad pozvánky pred prijatím (komu a od koho).
create function public.invitation_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.household_invitations;
  hname text;
  inviter text;
begin
  perform public._require_uid();
  select * into inv from public.household_invitations
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if not found then return jsonb_build_object('state', 'INVALID'); end if;
  select name into hname from public.households where id = inv.household_id;
  select display_name into inviter from public.profiles where id = inv.created_by;
  return jsonb_build_object(
    'state', case
      when public.is_member(inv.household_id) then 'ALREADY_MEMBER'
      when inv.status <> 'PENDING' then 'USED'
      when inv.expires_at <= now() then 'EXPIRED'
      else 'VALID' end,
    'household_id', inv.household_id,
    'household_name', hname,
    'invited_by', inviter,
    'expires_at', inv.expires_at);
end $$;

create function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  inv public.household_invitations;
begin
  select * into inv from public.household_invitations
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
   for update;
  if not found then raise exception 'INVITATION_INVALID'; end if;
  if public.is_member(inv.household_id) then return inv.household_id; end if;
  if inv.status <> 'PENDING' then raise exception 'INVITATION_USED'; end if;
  if inv.expires_at <= now() then raise exception 'INVITATION_EXPIRED'; end if;
  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'MEMBER');
  update public.household_invitations
     set status = 'ACCEPTED', accepted_by = uid, accepted_at = now()
   where id = inv.id;
  return inv.household_id;
end $$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  perform public._require_uid();
  select household_id into hid from public.household_invitations where id = p_invitation_id;
  if hid is null or not public.is_member(hid) then raise exception 'NOT_FOUND'; end if;
  update public.household_invitations set status = 'REVOKED'
   where id = p_invitation_id and status = 'PENDING';
end $$;
