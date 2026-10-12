-- =============================================================================
-- Basket Harmony v2 — jadro databázy
--
-- Princípy:
--  * Databáza je jediný zdroj pravdy. Pravidlá (kto čo smie, kedy sa položka
--    pridá priamo a kedy ako žiadosť) sú tu, nie v prehliadači.
--  * Každá tabuľka má zapnuté RLS (Row Level Security) – riadok uvidí iba člen
--    domácnosti, ktorej riadok patrí.
--  * Zápisy, ktoré musia byť atómické (pridanie položky počas nákupu, prijatie
--    žiadosti, pozvánky), idú iba cez funkcie nižšie.
-- =============================================================================

-- ---------------------------------------------------------------- typy
create type public.member_role       as enum ('OWNER', 'MEMBER');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED');
create type public.item_status       as enum ('OPEN', 'PURCHASED');
create type public.session_status    as enum ('ACTIVE', 'ENDED', 'EXPIRED');
create type public.request_status    as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- Normalizovaný kľúč názvu: malé písmená, bez diakritiky, jedna medzera.
-- "  Mlieko  POLOTUČNÉ " -> "mlieko polotucne"
create function public.name_key(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(
    lower(translate(trim(p),
      'áäčďéěíĺľňóôŕřšťúůýžÁÄČĎÉĚÍĹĽŇÓÔŔŘŠŤÚŮÝŽ',
      'aacdeeillnoorrstuuyzAACDEEILLNOORRSTUUYZ')),
    '\s+', ' ', 'g')
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- profily
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Profil sa vytvorí automaticky pri registrácii.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                  'Používateľ'), 60)
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- domácnosti
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null default 'MEMBER',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- Pomocné funkcie pre RLS. "security definer" = bežia s právami vlastníka,
-- aby politika na household_members nevolala sama seba donekonečna.
create function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  )
$$;

create function public.is_owner(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role = 'OWNER'
  )
$$;

create function public.shares_household(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  )
$$;

create table public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by   uuid references auth.users (id) on delete set null,
  -- Ukladáme iba odtlačok (SHA-256) tokenu. Samotný token pozná len ten,
  -- kto dostal odkaz – ani únik databázy ho neprezradí.
  token_hash   text not null unique,
  status       public.invitation_status not null default 'PENDING',
  expires_at   timestamptz not null,
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index household_invitations_household_idx on public.household_invitations (household_id);

-- ---------------------------------------------------------------- kategórie
create table public.categories (
  id         text primary key,
  name       text not null,
  emoji      text not null,
  sort_order int  not null
);
insert into public.categories (id, name, emoji, sort_order) values
  ('produce',            'Ovocie a zelenina',      '🥦', 10),
  ('bakery',             'Pečivo',                 '🥖', 20),
  ('dairy_eggs',         'Mliečne a vajcia',       '🥛', 30),
  ('deli_chilled',       'Údeniny a chladené',     '🧀', 40),
  ('meat_fish',          'Mäso a ryby',            '🥩', 50),
  ('frozen',             'Mrazené',                '🧊', 60),
  ('pantry',             'Trvanlivé potraviny',    '🥫', 70),
  ('breakfast',          'Raňajky, káva a čaj',    '☕', 80),
  ('snacks_sweets',      'Sladkosti a slané',      '🍫', 90),
  ('beverages',          'Nápoje',                 '🧃', 100),
  ('alcohol',            'Alkohol',                '🍷', 105),
  ('household_cleaning', 'Domácnosť a čistenie',   '🧽', 110),
  ('personal_care',      'Drogéria',               '🧴', 120),
  ('baby',               'Pre deti',               '🍼', 130),
  ('pet',                'Zvieratá',               '🐾', 140),
  ('other',              'Ostatné',                '🛒', 999);

-- ---------------------------------------------------------------- zoznamy
create table public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 60),
  is_archived  boolean not null default false,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index shopping_lists_household_idx on public.shopping_lists (household_id);
create trigger shopping_lists_touch before update on public.shopping_lists
  for each row execute function public.touch_updated_at();

create table public.shopping_list_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.shopping_lists (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 120),
  quantity     numeric(10, 3) check (quantity > 0),
  unit         text check (char_length(unit) <= 20),
  note         text check (char_length(note) <= 300),
  category_id  text not null default 'other' references public.categories (id),
  status       public.item_status not null default 'OPEN',
  added_by     uuid references auth.users (id) on delete set null,
  purchased_by uuid references auth.users (id) on delete set null,
  purchased_at timestamptz,
  -- Idempotencia: ak mobil pošle tú istú požiadavku dvakrát (zlý signál),
  -- vznikne iba jedna položka.
  client_op_id uuid unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id, status);
create index shopping_list_items_household_idx on public.shopping_list_items (household_id);

-- Pamäť kategórií: keď niekto položke zmení kategóriu, domácnosť si to
-- zapamätá a nabudúce ju rovnako zaradí.
create table public.category_memory (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key     text not null,
  category_id  text not null references public.categories (id),
  updated_at   timestamptz not null default now(),
  primary key (household_id, name_key)
);

-- ---------------------------------------------------------------- nakupovanie
create table public.shopping_sessions (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.shopping_lists (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  shopper_id   uuid not null references auth.users (id) on delete cascade,
  status       public.session_status not null default 'ACTIVE',
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  ended_at     timestamptz
);
-- Databáza fyzicky nedovolí dva aktívne nákupy toho istého zoznamu.
create unique index shopping_sessions_one_active
  on public.shopping_sessions (list_id) where status = 'ACTIVE';
create index shopping_sessions_household_idx on public.shopping_sessions (household_id);

create table public.addition_requests (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.shopping_sessions (id) on delete cascade,
  list_id           uuid not null references public.shopping_lists (id) on delete cascade,
  household_id      uuid not null references public.households (id) on delete cascade,
  requested_by      uuid references auth.users (id) on delete set null,
  requested_for     uuid not null references auth.users (id) on delete cascade,
  name              text not null check (char_length(trim(name)) between 1 and 120),
  quantity          numeric(10, 3) check (quantity > 0),
  unit              text check (char_length(unit) <= 20),
  note              text check (char_length(note) <= 300),
  category_id       text not null default 'other' references public.categories (id),
  status            public.request_status not null default 'PENDING',
  client_op_id      uuid unique,
  created_at        timestamptz not null default now(),
  decided_at        timestamptz,
  decided_by        uuid references auth.users (id) on delete set null,
  resulting_item_id uuid references public.shopping_list_items (id) on delete set null
);
create index addition_requests_session_idx on public.addition_requests (session_id, status);
create index addition_requests_household_idx on public.addition_requests (household_id);
