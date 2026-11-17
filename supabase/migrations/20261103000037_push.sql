-- =============================================================================
-- Upozornenia do telefónu (Web Push), etapa 5b.
--
-- Telefón (appka z plochy na iPhone od iOS 16.4, Android, počítač) si uloží odber
-- (save_push_subscription). Pri udalosti v DB spúšťač pošle funkcii push-send krátku
-- správu (udalosť + id) s tajným kľúčom databázy; funkcia zistí, komu a čo poslať,
-- podľa nastavení na účte (prefs), nikdy nie tomu, kto akciu urobil.
-- Bez mazania: vypnutý odber dostane disabled_at. Kľúče VAPID sú v trezore (vapid_public, vapid_private_jwk) – vkladajú sa mimo migrácie.
-- =============================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  locale      text not null default 'sk',
  prefs       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,
  -- vypnutý odber (človek ho vypol alebo ho push služba už nepozná) – nič sa nemaže, len sa neposiela
  disabled_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select on public.push_subscriptions to authenticated;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Uloženie odberu tohto zariadenia (endpoint je jedinečný – pri prihlásení iného človeka prejde naňho).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_locale text, p_prefs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'VALIDATION';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale, prefs)
  values (uid, p_endpoint, p_p256dh, p_auth, case when p_locale = 'en' then 'en' else 'sk' end, coalesce(p_prefs, '{}'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        locale = excluded.locale, prefs = excluded.prefs, disabled_at = null;
end $$;

create function public.remove_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.push_subscriptions set disabled_at = now() where endpoint = p_endpoint and user_id = public._require_uid();
end $$;

-- Ktoré upozornenia chcem (rovnaké voľby ako Viac → Upozornenia) – na všetkých mojich zariadeniach.
create function public.set_push_prefs(p_prefs jsonb, p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.push_subscriptions
     set prefs = coalesce(p_prefs, '{}'), locale = case when p_locale = 'en' then 'en' else 'sk' end
   where user_id = public._require_uid();
end $$;

revoke execute on function public.save_push_subscription(text, text, text, text, jsonb), public.remove_push_subscription(text),
  public.set_push_prefs(jsonb, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, jsonb), public.remove_push_subscription(text),
  public.set_push_prefs(jsonb, text) to authenticated;

-- Kľúče VAPID pre funkciu push-send (len server).
create function public.push_vapid() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('public', public._vault('vapid_public'), 'private', public._vault('vapid_private_jwk'));
$$;
revoke execute on function public.push_vapid() from public, anon, authenticated;
grant execute on function public.push_vapid() to service_role;

-- Správa funkcii push-send (asynchrónne cez pg_net; chyba nikdy nezastaví samotnú zmenu v DB).
create function public._push(p_event text, p_id uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text := public._vault('project_url');
begin
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/push-send',
    body := jsonb_build_object('event', p_event, 'id', p_id, 'actor', p_actor),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', public._vault('receipt_worker_secret')),
    timeout_milliseconds := 10000);
exception when others then
  raise warning 'push %: %', p_event, sqlerrm;
end $$;
revoke execute on function public._push(text, uuid, uuid) from public, anon, authenticated;

create function public._push_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'shopping_sessions' then
    if tg_op = 'INSERT' and new.status = 'ACTIVE' then perform public._push('start', new.id, new.shopper_id);
    elsif tg_op = 'UPDATE' and old.status = 'ACTIVE' and new.status = 'ENDED' then perform public._push('end', new.id, new.shopper_id);
    end if;
  elsif tg_table_name = 'addition_requests' then
    if tg_op = 'INSERT' and new.status = 'PENDING' then perform public._push('request', new.id, new.requested_by);
    elsif tg_op = 'UPDATE' and old.status = 'PENDING' and new.status in ('ACCEPTED', 'REJECTED') then
      perform public._push('reply', new.id, new.decided_by);
    end if;
  elsif tg_table_name = 'shopping_list_items' then
    if new.status::text = 'UNAVAILABLE' and old.status::text <> 'UNAVAILABLE' then perform public._push('unavailable', new.id, new.purchased_by); end if;
  elsif tg_table_name = 'receipts' then
    if old.status = 'PROCESSING' and new.status in ('OK', 'NEEDS_REVIEW') then perform public._push('receipt', new.id, null); end if;
  end if;
  return null;
end $$;
revoke execute on function public._push_trigger() from public, anon, authenticated;

create trigger push_sessions after insert or update of status on public.shopping_sessions
  for each row execute function public._push_trigger();
create trigger push_requests after insert or update of status on public.addition_requests
  for each row execute function public._push_trigger();
create trigger push_items after update of status on public.shopping_list_items
  for each row execute function public._push_trigger();
create trigger push_receipts after update of status on public.receipts
  for each row execute function public._push_trigger();
