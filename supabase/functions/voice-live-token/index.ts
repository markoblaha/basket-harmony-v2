// Živý prepis hlasu (Hlas 2.0): vydá krátkodobý jednorazový token pre Gemini Live
// (gemini-3.5-transcribe-live), aby sa telefón pripojil priamo a kľúč Gemini ostal na serveri.
//
// Tok: appka pošle { household_id, locale }. Funkcia overí člena a limit (ai_allow 'voice-live'),
// zostaví slovník domácnosti (často kupované položky – lepšie rozpozná „Kaiserka“, „Radegast“),
// a vytvorí token s pevne zamknutým nastavením (model, jazyk, slovník, len text). Token platí
// 1 minútu na pripojenie a 6 minút celkovo (najviac ~5 centov), použiť sa dá raz.
// Odpoveď: { token, model, expiresAt } alebo { error: KÓD }.
//
// Náklady: model účtuje ~0,9 centa za minútu streamovaného zvuku. Appka posiela zvuk len počas reči.
// Do ai_usage sa pri vydaní tokenu zapíše odhad 1 minúty (skutočnú dĺžku server nevidí).
import { createClient } from "npm:@supabase/supabase-js@2";
import { guardAi } from "../_shared/guard.ts";

const MODEL = Deno.env.get("GEMINI_LIVE_MODEL") ?? "gemini-3.5-transcribe-live";
/** VERBATIM = presne, čo zaznelo; SMART = upravený text (čísla ako číslice, interpunkcia). */
const MODE = Deno.env.get("GEMINI_LIVE_MODE") ?? "SMART";
const SESSION_MS = 6 * 60_000;
const CONNECT_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/**
 * Slovník domácnosti: len často kupované položky (najviac 40 krátkych výrazov).
 * Značky z bločkov sa NEPOSIELAJÚ: pri šume model niekedy vypíše celý slovník ako prepis
 * („Max - Golden Turtle - Finish - …“, 13. 11. 2026) a čím dlhší a čudnejší slovník, tým horšie.
 */
async function vocabulary(req: Request, householdId: string): Promise<string[]> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, serviceKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const out = new Set<string>();
  const add = (s: unknown) => {
    if (typeof s !== "string") return;
    const v = s.trim().replace(/\s+/g, " ");
    if (v.length >= 3 && v.length <= 30 && out.size < 40) out.add(v);
  };
  try {
    const freq = await asUser.rpc("frequent_items", { p_household_id: householdId, p_limit: 40 });
    for (const r of (freq.data as { name?: string }[] | null) ?? []) add(r.name);
  } catch (e) {
    console.error("voice-live-token vocab", String(e));
  }
  return [...out];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "VALIDATION" }, 405);
  const body = await req.json().catch(() => ({}));
  // Kontrola a slovník súbežne (slovník sa číta s oprávneniami človeka – cudzí nič nedostane).
  const hid = typeof body?.household_id === "string" ? body.household_id : "";
  const [g, vocab] = await Promise.all([guardAi(req, body?.household_id, "voice-live"), vocabulary(req, hid)]);
  if ("error" in g) return json({ error: g.error }, g.status);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "AI_UNAVAILABLE" }, 500);
  const lang = body?.locale === "en" ? "en-US" : "sk-SK";
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_MS).toISOString();
  // Nastavenie relácie je zamknuté v tokene – telefón ho nemôže zmeniť (model, jazyk, slovník, len text).
  const setup = {
    model: `models/${MODEL}`,
    generationConfig: { responseModalities: ["TEXT"] },
    inputAudioTranscription: { languageCodes: [lang], customVocabulary: vocab, mode: MODE },
  };
  const tokenBody = JSON.stringify({
    uses: 1,
    expireTime: expiresAt,
    newSessionExpireTime: new Date(now + CONNECT_MS).toISOString(),
    bidiGenerateContentSetup: setup,
  });
  let res: Response | null = null;
  for (const v of ["v1beta", "v1alpha"]) {
    res = await fetch(`https://generativelanguage.googleapis.com/${v}/auth_tokens`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: tokenBody,
      signal: AbortSignal.timeout(10_000),
    }).catch((e) => {
      console.error("voice-live-token fetch", v, String(e));
      return null;
    });
    if (res?.ok) break;
    console.error("voice-live-token", v, res?.status, res ? (await res.text()).slice(0, 400) : "network");
  }
  if (!res || !res.ok) return json({ error: "AI_UNAVAILABLE" }, 502);
  const data = await res.json();
  if (typeof data?.name !== "string") return json({ error: "AI_UNAVAILABLE" }, 502);
  // Odhad 1 minúty (25 zvukových tokenov/s, ~175 tokenov textu/min) – pre limity a prehľad nákladov.
  g.log(MODEL, { input: 1500, output: 175, thinking: 0 }, true);
  return json({ token: data.name, model: MODEL, setup, expiresAt, vocab: vocab.length });
});
