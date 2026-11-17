-- =============================================================================
-- Etapa 2 revízie (3. 11. 2026): poistky pred vydaním.
--
-- 1) Zmazanie účtu (GDPR, právo na vymazanie). Databáza pripraví odchod:
--    zmaže súkromné zoznamy človeka (nikto iný ich nevidí), odíde zo všetkých
--    domácností (vlastníctvo prejde na ďalšieho člena; posledný člen domácnosť
--    zruší aj s nákupmi a bločkami). Samotný účet potom zmaže edge funkcia
--    delete-account (auth.users – profil, členstvá a lajky sa zmažú kaskádou,
--    autorstvo položiek a bločkov sa vynuluje). Vráti zrušené domácnosti, aby
--    funkcia zmazala aj ich fotky bločkov v úložisku.
-- 2) Prísnejšie limity AI. Pôvodné (hlas 1 500 a recepty 200 denne) dovolili
--    jednej domácnosti minúť pri cenách od 1. 1. 2027 až ~7 $ denne. Nové limity
--    stačia aj veľmi aktívnej rodine. Navyše mesačný strop nákladov na domácnosť
--    (5 $ ≈ 13× bežná rodina) pre hlas, recepty aj bločky.
-- 3) Limit bločkov: najviac 40 nových bločkov za 24 hodín na domácnosť
--    (čítanie bločku je najdrahší úkon AI a doteraz nemal limit).
-- =============================================================================

-- Náklady AI domácnosti v aktuálnom kalendárnom mesiaci (USD, podľa ai_usage).
create function public._ai_month_cost(p_household_id uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage
   where household_id = p_household_id and created_at >= date_trunc('month', now());
$$;
revoke execute on function public._ai_month_cost(uuid) from public, anon, authenticated;

-- Mesačný strop nákladov AI na domácnosť (USD).
create function public._ai_month_cap() returns numeric language sql immutable set search_path = '' as $$ select 5.0::numeric $$;
revoke execute on function public._ai_month_cap() from public, anon, authenticated;

create or replace function public.ai_allow(p_household_id uuid, p_fn text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hour int;
  v_day  int;
  v_max_hour int;
  v_max_day  int;
begin
  perform public._require_uid();
  if p_household_id is null or not public.is_member(p_household_id) then
    raise exception 'NOT_FOUND';
  end if;
  case p_fn
    -- Hlas posiela každú vetu zvlášť: 400 viet denne je ~20 dlhých diktovaní.
    when 'parse-voice' then v_max_hour := 120; v_max_day := 400;
    when 'recipe-ai'   then v_max_hour := 20;  v_max_day := 60;
    else raise exception 'INVALID_INPUT';
  end case;
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*)
    into v_hour, v_day
    from public.ai_usage
   where household_id = p_household_id and fn = p_fn
     and created_at > now() - interval '1 day';
  if v_hour >= v_max_hour or v_day >= v_max_day then
    raise exception 'AI_LIMIT';
  end if;
  if public._ai_month_cost(p_household_id) >= public._ai_month_cap() then
    raise exception 'AI_LIMIT';
  end if;
end $$;

create or replace function public.register_receipt(p_household_id uuid, p_checksum text, p_ext text default 'jpg', p_source text default 'APP')
returns table (receipt_id uuid, path text, already_exists boolean)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  pg public.receipt_pages;
  new_id uuid;
  new_path text;
begin
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION'; end if;
  if p_ext not in ('jpg', 'png', 'webp', 'heic', 'pdf') or p_source not in ('APP', 'LOVABLE') then
    raise exception 'VALIDATION';
  end if;

  select * into pg from public.receipt_pages
   where household_id = p_household_id and image_checksum = p_checksum;
  if found then
    return query select pg.receipt_id, pg.image_path, true;
    return;
  end if;

  -- Poistka: najviac 40 nových bločkov za 24 h a mesačný strop nákladov AI.
  if (select count(*) from public.receipts
       where household_id = p_household_id and created_at > now() - interval '1 day') >= 40
     or public._ai_month_cost(p_household_id) >= public._ai_month_cap() then
    raise exception 'RECEIPT_LIMIT';
  end if;

  new_id := gen_random_uuid();
  new_path := p_household_id::text || '/' || new_id::text || '.' || p_ext;
  insert into public.receipts (id, household_id, uploaded_by, image_path, image_checksum, source)
  values (new_id, p_household_id, uid, new_path, p_checksum, p_source);
  insert into public.receipt_pages (receipt_id, household_id, position, image_path, image_checksum)
  values (new_id, p_household_id, 1, new_path, p_checksum);
  return query select new_id, new_path, false;
end $$;

-- Príprava zmazania účtu (volá ju len edge funkcia delete-account s tokenom človeka).
create function public.prepare_account_deletion() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  h uuid;
  gone uuid[] := '{}';
begin
  -- Súkromné zoznamy vidí len autor – bez neho by ostali nikomu.
  delete from public.shopping_lists where created_by = uid and is_private;
  for h in select household_id from public.household_members where user_id = uid loop
    perform public.leave_household(h);
    if not exists (select 1 from public.households where id = h) then
      gone := gone || h;
    end if;
  end loop;
  return jsonb_build_object('deleted_households', to_jsonb(gone));
end $$;
revoke execute on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;
