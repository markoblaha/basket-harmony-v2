-- Funkcia extract-receipt posiela tajný kľúč ďalej (normalize-products), aby aj
-- zjednotenie produktov bežalo na pozadí bez prihláseného používateľa.
create function public.worker_secret() returns text
language sql stable security definer set search_path = '' as $$
  select public._vault('receipt_worker_secret');
$$;
revoke execute on function public.worker_secret() from public, anon, authenticated;
grant execute on function public.worker_secret() to service_role;
