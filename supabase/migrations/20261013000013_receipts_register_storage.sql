-- Registrácia fotky bločku, súkromné úložisko, realtime.
-- Zaregistruje fotku bločku. Ak rovnaký súbor už v domácnosti je, vráti ten
-- existujúci (already_exists = true) – takto vzniká ochrana pred duplicitami.
create function public.register_receipt(
  p_household_id uuid,
  p_checksum     text,
  p_ext          text default 'jpg',
  p_source       text default 'APP'
) returns table (receipt_id uuid, path text, already_exists boolean)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_uid();
  r public.receipts;
  new_id uuid;
begin
  if not public.is_member(p_household_id) then raise exception 'FORBIDDEN'; end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION'; end if;
  if p_ext not in ('jpg', 'png', 'webp', 'heic') or p_source not in ('APP', 'LOVABLE') then
    raise exception 'VALIDATION';
  end if;

  select * into r from public.receipts
   where household_id = p_household_id and image_checksum = p_checksum;
  if found then
    return query select r.id, r.image_path, true;
    return;
  end if;

  new_id := gen_random_uuid();
  insert into public.receipts (id, household_id, uploaded_by, image_path, image_checksum, source)
  values (new_id, p_household_id, uid,
          p_household_id::text || '/' || new_id::text || '.' || p_ext,
          p_checksum, p_source);
  return query select new_id, p_household_id::text || '/' || new_id::text || '.' || p_ext, false;
end $$;

-- Súkromné úložisko na fotky: čítať a nahrávať smú len členovia domácnosti,
-- do priečinka svojej domácnosti. Fotky nemajú verejnú adresu.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy receipts_files_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy receipts_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));

revoke execute on function public.register_receipt(uuid, text, text, text) from public, anon;
grant execute on function public.register_receipt(uuid, text, text, text) to authenticated;

alter publication supabase_realtime add table public.receipts;
