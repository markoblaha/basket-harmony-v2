-- =============================================================================
-- Bločky: fotka -> AI prečíta obchod, dátum a položky -> databáza skontroluje
-- súčet. Pravidlá (kto smie, kedy je bloček "v poriadku") sú tu, nie v prehliadači.
-- =============================================================================
create type public.receipt_status as enum ('PROCESSING', 'OK', 'NEEDS_REVIEW', 'FAILED');

create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  uploaded_by    uuid default auth.uid() references auth.users (id) on delete set null,
  status         public.receipt_status not null default 'PROCESSING',
  -- Prečo bloček čaká na kontrolu: TOTAL_MISMATCH, NO_ITEMS, DATE_SUSPECT, POSSIBLE_DUPLICATE
  review_reason  text,
  store_name     text check (char_length(store_name) <= 120),
  store_key      text,
  purchased_on   date,
  purchased_time time,
  total          numeric(10, 2),
  items_sum      numeric(10, 2),
  discount_total numeric(10, 2),
  currency       text not null default 'EUR',
  -- Fotka v súkromnom úložisku: <household_id>/<receipt_id>.<prípona>
  image_path     text not null,
  -- SHA-256 obsahu fotky. Ten istý súbor sa v domácnosti nedá nahrať dvakrát.
  image_checksum text not null check (image_checksum ~ '^[0-9a-f]{64}$'),
  source         text not null default 'APP' check (source in ('APP', 'LOVABLE')),
  duplicate_of   uuid references public.receipts (id) on delete set null,
  error_text     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, image_checksum)
);
create index receipts_household_date_idx on public.receipts (household_id, purchased_on desc);
create index receipts_status_idx on public.receipts (household_id, status);
create trigger receipts_touch before update on public.receipts
  for each row execute function public.touch_updated_at();

create table public.receipt_items (
  id           uuid primary key default gen_random_uuid(),
  receipt_id   uuid not null references public.receipts (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  position     int not null,
  raw_name     text not null check (char_length(raw_name) between 1 and 200),
  -- Normalizovaný názov (bez diakritiky, malé písmená): podľa neho sa
  -- neskôr porovnávajú ceny tej istej veci v čase a medzi obchodmi.
  name_key     text not null,
  quantity     numeric(10, 3) not null default 1,
  unit         text check (char_length(unit) <= 20),
  unit_price   numeric(10, 3),
  -- Suma za riadok po zľave (tá, ktorú si naozaj zaplatil).
  line_total   numeric(10, 2) not null,
  discount     numeric(10, 2) not null default 0,
  category_id  text not null default 'other' references public.categories (id)
);
create index receipt_items_receipt_idx on public.receipt_items (receipt_id, position);
create index receipt_items_household_name_idx on public.receipt_items (household_id, name_key);

alter table public.receipts      enable row level security;
alter table public.receipt_items enable row level security;

-- Čítať smú členovia domácnosti. Zápis výsledku čítania robí iba server
-- (funkcia save_receipt_extraction); fotku zaregistruje register_receipt.
grant select on public.receipts, public.receipt_items to authenticated;
create policy receipts_select on public.receipts for select to authenticated
  using (public.is_member(household_id));
create policy receipt_items_select on public.receipt_items for select to authenticated
  using (public.is_member(household_id));

-- Ručná oprava obchodu/dátumu/celkovej sumy po kontrole.
grant update (store_name, purchased_on, total) on public.receipts to authenticated;
create policy receipts_update on public.receipts for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
