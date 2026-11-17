-- Kniha receptov v databáze (17. 11. 2026): skutočné recepty vybrané a overené výrobnou linkou (tools/kniha), nie v kóde appky.
--
--  book_dishes   – zoznam jedál (čo sa má uvariť do knihy; jedno jedlo = jeden záznam, varianty sú recepty toho istého jedla)
--  book_recipes  – recepty: stav, údaje pre appku, výsledok automatických kontrol, obrázok; zdroj je vždy jeden skutočný recept
--  book_sources  – recepty, s ktorými sa recept porovnával (písmená A, B… ako v tabuľke „Ako sme recept overili“)
--  book_runs     – záznam o každom behu linky (dávka, model, sila uvažovania, počty) – podľa neho vieme, kde pokračovať
--
-- Čítať smie každý prihlásený len schválené a zverejnené recepty; zapisuje len linka (service role / migrácie).
-- Stavy receptu: draft → quarantine (neprešiel kontrolou, dôvod vo verification) | approved (prešiel kontrolami)
--                → published (viditeľný v appke, má obrázok alebo označenie šarže).

create table public.book_dishes (
  id          text primary key check (id ~ '^[a-z0-9_]+$'),
  name_sk     text not null,
  category    text not null,
  cuisine     text not null default 'SK-CZ' check (cuisine in ('SK', 'CZ', 'SK-CZ', 'EU', 'WORLD')),
  family      text,
  priority    smallint not null default 3 check (priority between 1 and 5),
  status      text not null default 'planned' check (status in ('planned', 'sourced', 'done', 'quarantine')),
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.book_recipes (
  id              text primary key check (id ~ '^[a-z0-9_]+$'),
  dish_id         text not null references public.book_dishes (id) on delete restrict,
  variant_key     text not null default 'classic',
  status          text not null default 'draft' check (status in ('draft', 'quarantine', 'approved', 'published')),
  version         integer not null default 1 check (version >= 1),
  batch           integer check (batch >= 1),
  name            text not null check (length(name) between 3 and 160),
  category        text not null,
  meat            text not null default 'bez',
  cuisine         text,
  minutes         integer not null check (minutes between 1 and 10080),
  active_minutes  integer check (active_minutes >= 0),
  difficulty      smallint not null default 2 check (difficulty between 1 and 3),
  portions        integer not null check (portions between 1 and 100),
  scale           text check (scale in ('free', 'piece', 'whole')),
  portions_guess  boolean not null default false,
  tags            text[] not null default '{}',
  tools           text[] not null default '{}',
  store           text,
  wait            text,
  ingredients     jsonb not null check (jsonb_typeof(ingredients) = 'array'),
  steps           jsonb not null check (jsonb_typeof(steps) = 'array'),
  check_data      jsonb,                       -- porovnanie s ostatnými receptami (riadky, úkony, kotva), ak linka robila plné porovnanie
  verification    jsonb not null default '{}', -- výsledky automatických kontrol a dôvod karantény
  image_path      text,                        -- hlavný obrázok (neskôr Gemini); kým nie je, označenie šarže
  image_status    text not null default 'none' check (image_status in ('none', 'batch_label', 'generated')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (dish_id, variant_key)
);
create index book_recipes_status_idx on public.book_recipes (status, batch);

create table public.book_sources (
  recipe_id  text not null references public.book_recipes (id) on delete cascade,
  k          text not null check (k ~ '^[A-Z]{1,2}$'),
  site       text not null,
  name       text not null,
  url        text not null check (url ~ '^https://'),
  portions   integer,
  rating     numeric(4, 2),
  votes      integer,
  is_anchor  boolean not null default false,
  primary key (recipe_id, k)
);
-- každý recept má najviac jeden zdroj, z ktorého je prevzatý
create unique index book_sources_one_anchor on public.book_sources (recipe_id) where is_anchor;

create table public.book_runs (
  id          bigint generated always as identity primary key,
  batch       integer,
  kind        text not null check (kind in ('select', 'translate', 'validate', 'publish', 'images')),
  model       text,
  effort      text,
  total       integer not null default 0,
  ok          integer not null default 0,
  quarantined integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

create trigger book_recipes_touch before update on public.book_recipes
  for each row execute function public.touch_updated_at();

alter table public.book_dishes  enable row level security;
alter table public.book_recipes enable row level security;
alter table public.book_sources enable row level security;
alter table public.book_runs    enable row level security;

revoke all on public.book_dishes, public.book_recipes, public.book_sources, public.book_runs from anon, authenticated;
grant select on public.book_recipes, public.book_sources, public.book_dishes to authenticated;

create policy book_recipes_read on public.book_recipes for select to authenticated using (status in ('approved', 'published'));
create policy book_sources_read on public.book_sources for select to authenticated
  using (exists (select 1 from public.book_recipes r where r.id = recipe_id and r.status in ('approved', 'published')));
create policy book_dishes_read on public.book_dishes for select to authenticated using (true);
-- book_runs: bez politiky = zatvorené pre všetkých okrem service role
