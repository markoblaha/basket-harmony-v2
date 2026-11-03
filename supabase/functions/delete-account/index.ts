// Zmazanie účtu (Viac → Zmazať účet). Človek môže zmazať len seba.
//
// 1) Overí prihlásenie a potvrdenie ({ confirm: "DELETE" }).
// 2) S tokenom človeka zavolá prepare_account_deletion(): zmaže jeho súkromné zoznamy a odíde
//    zo všetkých domácností (posledný člen domácnosť zruší aj s nákupmi a bločkami).
// 3) Zmaže fotky bločkov zrušených domácností z úložiska (receipts/<domácnosť>/…).
// 4) Zmaže účet (auth.users) – profil, členstvá a lajky sa zmažú kaskádou v DB.
//
// Odpoveď: { ok: true } alebo { error: KÓD } (texty sú v appke pod error.<KÓD>).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zmaže všetky súbory domácnosti v úložisku bločkov (cesty sú <domácnosť>/<súbor>). */
async function removeHouseholdFiles(admin: SupabaseClient, householdId: string): Promise<void> {
  for (let round = 0; round < 50; round++) {
    const { data, error } = await admin.storage.from("receipts").list(householdId, { limit: 100 });
    if (error) throw new Error(`STORAGE_LIST: ${error.message}`);
    const files = (data ?? []).filter((f) => f.id).map((f) => `${householdId}/${f.name}`);
    if (!files.length) return;
    const { error: rmError } = await admin.storage.from("receipts").remove(files);
    if (rmError) throw new Error(`STORAGE_REMOVE: ${rmError.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "VALIDATION" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const uid = userData.user.id;

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") return json({ error: "VALIDATION" }, 400);

  // Odchod z domácností s oprávneniami človeka (pravidlá sú v DB).
  const asUser = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const prep = await asUser.rpc("prepare_account_deletion");
  if (prep.error) {
    console.error("delete-account prepare", uid, prep.error.message);
    return json({ error: /^[A-Z_]+$/.test(prep.error.message) ? prep.error.message : "DELETE_FAILED" }, 500);
  }
  const gone: string[] = ((prep.data as { deleted_households?: unknown })?.deleted_households as string[] | undefined) ?? [];
  for (const hid of gone) {
    if (!UUID.test(hid)) continue;
    try {
      await removeHouseholdFiles(admin, hid);
    } catch (e) {
      // Fotky bez domácnosti sú nedostupné (pravidlá úložiska vyžadujú členstvo); zapíše sa na dočistenie.
      console.error("delete-account files", hid, String(e));
    }
  }

  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) {
    console.error("delete-account user", uid, del.error.message);
    return json({ error: "DELETE_FAILED" }, 500);
  }
  console.log("delete-account ok", uid, "households removed:", gone.length);
  return json({ ok: true });
});
