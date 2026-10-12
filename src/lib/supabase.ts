import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Chýba VITE_SUPABASE_URL alebo VITE_SUPABASE_PUBLISHABLE_KEY.");
}

/**
 * Jediný klient Supabase v celej aplikácii. Prihlásenie sa ukladá v prehliadači
 * (persistSession), takže používateľ ostane prihlásený aj po zatvorení aplikácie,
 * a token sa sám obnovuje (autoRefreshToken).
 */
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
