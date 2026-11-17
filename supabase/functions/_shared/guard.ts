// Poistka pre AI funkcie volané z aplikácie (parse-voice, recipe-ai).
// Pravidlo je v databáze (ai_allow): volajúci musí byť členom domácnosti a domácnosť
// nesmie prekročiť limit volaní. Funkcia sa pýta s oprávneniami prihláseného človeka.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { logUsage, type Usage } from "./gemini.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Guarded = {
  householdId: string;
  /** Zapíše spotrebu tokenov na pozadí – odpoveď kvôli tomu nečaká. */
  log: (model: string, usage: Usage | null, ok: boolean) => void;
};

/**
 * Overí prihlásenie, členstvo a limit. Vráti buď povolenie, alebo kód chyby
 * s HTTP stavom (NOT_AUTHENTICATED 401, NOT_FOUND 403, AI_LIMIT 429).
 */
export async function guardAi(
  req: Request,
  householdId: unknown,
  fn: "parse-voice" | "recipe-ai" | "voice-live",
): Promise<Guarded | { error: string; status: number }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "NOT_AUTHENTICATED", status: 401 };
  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { error: "NOT_AUTHENTICATED", status: 401 };
  if (typeof householdId !== "string" || !UUID.test(householdId)) return { error: "NOT_FOUND", status: 403 };

  const asUser = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const allowed = await asUser.rpc("ai_allow", { p_household_id: householdId, p_fn: fn });
  if (allowed.error) {
    const code = allowed.error.message;
    if (code === "AI_LIMIT") return { error: "AI_LIMIT", status: 429 };
    if (code === "NOT_FOUND") return { error: "NOT_FOUND", status: 403 };
    console.error(fn, "ai_allow", code);
    return { error: "AI_GUARD_FAILED", status: 500 };
  }

  return {
    householdId,
    log(model, usage, ok) {
      const task = logUsage(admin, { fn, model, usage, household_id: householdId, ok });
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(task);
    },
  };
}
