-- =============================================================================
-- Doklady vo formáte PDF (faktúry z e-shopov): úložisko aj registrácia
-- prijmú aj PDF. Funkcia sa len nahrádza; oprávnenia ostávajú.
-- =============================================================================
create or replace function public.register_receipt(
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
  if p_ext not in ('jpg', 'png', 'webp', 'heic', 'pdf') or p_source not in ('APP', 'LOVABLE') then
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


update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
 where id = 'receipts';
