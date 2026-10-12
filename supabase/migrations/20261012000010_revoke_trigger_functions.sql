-- Triggerové funkcie nepotrebujú právo EXECUTE pre používateľa (Postgres ho
-- pri spustení triggera nekontroluje). Odoberieme ho, aby neboli viditeľné cez API.
revoke execute on function
  public.touch_updated_at(),
  public.items_before_update(),
  public.items_after_update()
from authenticated;
