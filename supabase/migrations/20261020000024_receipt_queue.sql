-- =============================================================================
-- Čítanie dokladov na pozadí + meranie nákladov na AI.
--
-- Predtým: aplikácia nahrala fotku a ČAKALA, kým server doklad prečíta (aj minútu),
-- a ak sa zavrela, čítanie sa nedokončilo.
-- Teraz: aplikácia len nahrá súbory a zavolá queue_receipt. Databáza sama pošle
-- požiadavku funkcii extract-receipt (pg_net), tá hneď odpovie a číta na pozadí.
-- Plánovač (pg_cron) každú minútu dobehne doklady, ktorých čítanie sa stratilo
-- (výpadok, prerušené nahrávanie) – najviac 3 pokusy, potom FAILED.
--
-- Nastavenie (raz, mimo migrácie): v trezore (vault) musí byť adresa projektu:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
-- Tajný kľúč pre volania databáza -> funkcia vznikne sám (receipt_worker_secret).
-- =============================================================================
create extension if not exists pg_net with schema extensions;

alter table public.receipts
  add column queued_at       timestamptz,
  add column read_started_at timestamptz,
  add column read_attempts   int not null default 0;

create index receipts_queue_idx on public.receipts (queued_at) where status = 'PROCESSING';

-- Tajný kľúč, ktorým sa funkcia extract-receipt presvedčí, že ju volá databáza.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'receipt_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'receipt_worker_secret');
  end if;
end $$;

create function public._vault(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

-- Funkcia (service_role) overí hlavičku x-worker-secret.
create function public.check_worker_secret(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_secret is not null and p_secret = public._vault('receipt_worker_secret');
$$;

-- Pošle funkcii extract-receipt požiadavku „prečítaj tento doklad“ (asynchrónne, neblokuje).
create function public._dispatch_receipt(p_receipt_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text := public._vault('project_url');
begin
  if v_url is null then raise exception 'PROJECT_URL_MISSING'; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/extract-receipt',
    body := jsonb_build_object('receipt_id', p_receipt_id),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-worker-secret', public._vault('receipt_worker_secret')),
    timeout_milliseconds := 10000);
end $$;

-- Aplikácia: „súbory sú nahraté, prečítaj doklad“ (aj pre opätovné čítanie a spojené doklady).
create function public.queue_receipt(p_receipt_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.receipts;
begin
  perform public._require_uid();
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not public.is_member(r.household_id) then raise exception 'NOT_FOUND'; end if;
  update public.receipts
     set status = 'PROCESSING', review_reason = null, error_text = null,
         queued_at = now(), read_started_at = null, read_attempts = 0
   where id = p_receipt_id;
  perform public._dispatch_receipt(p_receipt_id);
end $$;

-- Funkcia si doklad „zoberie“. Vráti false, ak ho už číta niekto iný alebo nie je vo fronte
-- (chráni pred dvojitým čítaním = dvojitou platbou za AI).
create function public.claim_receipt(p_receipt_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.receipts
     set read_started_at = now(), read_attempts = read_attempts + 1
   where id = p_receipt_id and status = 'PROCESSING'
     and (read_started_at is null or read_started_at < now() - interval '3 minutes');
  return found;
end $$;

-- Každú minútu: doklady, ktoré čakajú alebo sa zasekli.
create function public.dispatch_stuck_receipts() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  -- Po 3 pokusoch to vzdáme – doklad bude v zozname s tlačidlom „Skúsiť znova“.
  update public.receipts set status = 'FAILED', error_text = 'READ_TIMEOUT', read_started_at = null
   where status = 'PROCESSING' and read_attempts >= 3
     and (read_started_at is null or read_started_at < now() - interval '3 minutes');

  for r in
    select id from public.receipts
     where status = 'PROCESSING' and read_attempts < 3
       and (
         -- vo fronte, ale funkcia si ho do 2 minút nezobrala (požiadavka sa stratila)
         (queued_at is not null and read_started_at is null and queued_at < now() - interval '2 minutes')
         -- čítanie začalo, ale neskončilo (funkcia spadla na limite)
         or (read_started_at < now() - interval '3 minutes')
         -- nahrávanie sa prerušilo pred queue_receipt (zavretá aplikácia); súbor tam možno je
         or (queued_at is null and created_at < now() - interval '10 minutes')
       )
     order by coalesce(queued_at, created_at) limit 20
  loop
    update public.receipts set queued_at = coalesce(queued_at, now()) where id = r.id;
    perform public._dispatch_receipt(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

select cron.schedule('dispatch-stuck-receipts', '* * * * *', $$select public.dispatch_stuck_receipts()$$);

-- Spojené doklady sa čítajú znova cez frontu (merge_receipts nastaví PROCESSING; aplikácia zavolá queue_receipt).

-- -----------------------------------------------------------------------------
-- Náklady na AI: každé volanie Gemini sa zapíše (tokeny + cena v USD podľa cenníka).
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id              bigint generated always as identity primary key,
  household_id    uuid references public.households (id) on delete cascade,
  receipt_id      uuid references public.receipts (id) on delete set null,
  fn              text not null,
  model           text not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  thinking_tokens int not null default 0,
  cost_usd        numeric(12, 6) not null default 0,
  ok              boolean not null default true,
  created_at      timestamptz not null default now()
);
create index ai_usage_household_idx on public.ai_usage (household_id, created_at desc);
alter table public.ai_usage enable row level security;
grant select on public.ai_usage to authenticated;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (public.is_member(household_id));

-- Prehľad pre majiteľa: koľko stojí AI podľa funkcie a mesiaca.
create view public.ai_cost_monthly with (security_invoker = true) as
  select household_id, date_trunc('month', created_at)::date as month, fn,
         count(*) as calls, sum(cost_usd) as cost_usd,
         round(sum(cost_usd) / nullif(count(distinct receipt_id), 0), 6) as cost_per_receipt_usd
    from public.ai_usage group by 1, 2, 3;
grant select on public.ai_cost_monthly to authenticated;

revoke execute on function public._vault(text) from public, anon, authenticated;
revoke execute on function public._dispatch_receipt(uuid) from public, anon, authenticated;
revoke execute on function public.dispatch_stuck_receipts() from public, anon, authenticated;
revoke execute on function public.check_worker_secret(text) from public, anon, authenticated;
grant execute on function public.check_worker_secret(text) to service_role;
revoke execute on function public.claim_receipt(uuid) from public, anon, authenticated;
grant execute on function public.claim_receipt(uuid) to service_role;
revoke execute on function public.queue_receipt(uuid) from public, anon;
grant execute on function public.queue_receipt(uuid) to authenticated;
