/** Účet prihláseného človeka (zmazanie). Pravidlá sú v DB a v edge funkcii delete-account. */
import { supabase } from "@/lib/supabase";

/**
 * Natrvalo zmaže účet: odíde zo všetkých domácností (posledný člen domácnosť zruší aj s nákupmi
 * a bločkami), zmaže súkromné zoznamy a profil. Potom odhlási. Chyba = kód (error.<KÓD>).
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
  if (error) {
    // Funkcia vracia { error: KÓD } aj pri chybe – nech sa ukáže presný text.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(typeof body?.error === "string" ? body.error : "DELETE_FAILED");
  }
  if (!data?.ok) throw new Error("DELETE_FAILED");
  await supabase.auth.signOut({ scope: "local" });
}
