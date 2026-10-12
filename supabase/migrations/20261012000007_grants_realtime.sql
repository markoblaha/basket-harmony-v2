-- =============================================================================
-- Oprávnenia na funkcie: aplikácia smie volať iba verejné funkcie,
-- a iba prihlásený používateľ.
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.name_key(text),
  public.is_member(uuid),
  public.is_owner(uuid),
  public.shares_household(uuid),
  public.create_household(text),
  public.create_invitation(uuid),
  public.invitation_preview(text),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.add_item(uuid, text, numeric, text, text, text, text, uuid),
  public.start_shopping(uuid),
  public.end_shopping(uuid),
  public.accept_request(uuid),
  public.reject_request(uuid)
to authenticated;
-- Triggerové funkcie musia byť spustiteľné pre rolu, ktorá robí UPDATE.
grant execute on function
  public.touch_updated_at(),
  public.items_before_update(),
  public.items_after_update(),
  public._require_uid()
to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;

-- =============================================================================
-- Realtime: zmeny v týchto tabuľkách sa okamžite pošlú do otvorených aplikácií
-- (RLS platí aj tu – každý dostane len zmeny svojej domácnosti).
-- =============================================================================
alter publication supabase_realtime add table
  public.shopping_lists,
  public.shopping_list_items,
  public.shopping_sessions,
  public.addition_requests,
  public.household_members;
