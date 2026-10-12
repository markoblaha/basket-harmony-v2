-- Pri prihlásení cez Google prichádza meno v poli full_name / name.
-- Poradie: meno zadané pri registrácii > meno z Google > časť e-mailu pred @.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                  nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                  'Používateľ'), 60)
  );
  return new;
end $$;
