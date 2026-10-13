-- =============================================================================
-- Viac strán jedného dokladu: dlhý bloček alebo faktúra na dvoch fotkách či
-- snímkach obrazovky je jeden doklad. Každá strana má vlastný riadok
-- (receipt_pages); receipts.image_path ostáva ako prvá strana.
-- Duplicitu hlída odtlačok každej strany osobitne.
-- Súčasťou je aj oprava: ručne zmenený obchod musí prepočítať store_key
-- (podľa neho sa neskôr zoskupujú výdavky a hľadajú duplicity).
-- =============================================================================
create table public.receipt_pages (
  id             uuid primary key default gen_random_uuid(),
  receipt_id     uuid not null references public.receipts (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  position       int not null,
  image_path     text not null,
  -- SHA-256 obsahu súboru. Ten istý súbor sa v domácnosti nedá nahrať dvakrát.
  image_checksum text not null check (image_checksum ~ '^[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  unique (household_id, image_checksum),
  unique (receipt_id, position) deferrable initially deferred
);
create index receipt_pages_receipt_idx on public.receipt_pages (receipt_id, position);

alter table public.receipt_pages enable row level security;
grant select on public.receipt_pages to authenticated;
create policy receipt_pages_select on public.receipt_pages for select to authenticated
  using (public.is_member(household_id));

-- Doterajšie doklady majú jednu stranu.
insert into public.receipt_pages (receipt_id, household_id, position, image_path, image_checksum)
select id, household_id, 1, image_path, image_checksum from public.receipts;

-- Nový doklad (prvá strana). Ak už rovnaký súbor v domácnosti je (v ktoromkoľvek
-- doklade), vráti ten existujúci (already_exists = true).
create or replace function public.register_receipt(
  p_household_id uuid,
  p_checksum     text,
  p_ext          text default 'jpg',
  p_source       text default 'APP'
) returns table (receipt_id uuid, path text, already_exists boolean)
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

  new_id := gen_random_uuid();
  new_path := p_household_id::text || '/' || new_id::text || '.' || p_ext;
  insert into public.receipts (id, household_id, uploaded_by, image_path, image_checksum, source)
  values (new_id, p_household_id, uid, new_path, p_checksum, p_source);
  insert into public.receipt_pages (receipt_id, household_id, position, image_path, image_checksum)
  values (new_id, p_household_id, 1, new_path, p_checksum);
  return query select new_id, new_path, false;
end $$;

-- Ďalšia strana k existujúcemu dokladu. Ak rovnaký súbor už v domácnosti je,
-- nepridá sa (already_exists = true) a vráti sa doklad, ktorému patrí.
create or replace function public.register_receipt_page(
  p_receipt_id uuid,
  p_checksum   text,
  p_ext        text default 'jpg'
) returns table (path text, already_exists boolean, owner_receipt_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  r public.receipts;
  pg public.receipt_pages;
  n int;
  new_path text;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION'; end if;
  if p_ext not in ('jpg', 'png', 'webp', 'heic', 'pdf') then raise exception 'VALIDATION'; end if;

  select * into pg from public.receipt_pages
   where household_id = r.household_id and image_checksum = p_checksum;
  if found then
    return query select pg.image_path, true, pg.receipt_id;
    return;
  end if;

  select count(*) into n from public.receipt_pages where receipt_id = p_receipt_id;
  if n >= 8 then raise exception 'TOO_MANY_PAGES'; end if;

  new_path := r.household_id::text || '/' || gen_random_uuid()::text || '.' || p_ext;
  insert into public.receipt_pages (receipt_id, household_id, position, image_path, image_checksum)
  values (p_receipt_id, r.household_id, n + 1, new_path, p_checksum);
  return query select new_path, false, p_receipt_id;
end $$;

revoke execute on function public.register_receipt(uuid, text, text, text) from public, anon;
grant execute on function public.register_receipt(uuid, text, text, text) to authenticated;
revoke execute on function public.register_receipt_page(uuid, text, text) from public, anon;
grant execute on function public.register_receipt_page(uuid, text, text) to authenticated;

-- Ručne zmenený obchod prepočíta store_key (a prázdny názov ho vynuluje).
create or replace function public.receipts_sync_store_key() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.store_name is distinct from old.store_name then
    new.store_key := case when nullif(trim(new.store_name), '') is null then null
                          else public.name_key(new.store_name) end;
  end if;
  return new;
end $$;
revoke execute on function public.receipts_sync_store_key() from public, anon;
grant execute on function public.receipts_sync_store_key() to authenticated;

create trigger receipts_store_key before update on public.receipts
  for each row execute function public.receipts_sync_store_key();

-- Doterajšie ručne opravené obchody bez store_key.
update public.receipts set store_key = public.name_key(store_name)
 where store_name is not null and store_key is null;
