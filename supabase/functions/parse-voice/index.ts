// Rozbor nadiktovanej vety pre hlasový nákupný zoznam.
//
// Tok: aplikácia pošle {text, items, target}. Funkcia (1) overí prihláseného
// používateľa, (2) pošle vetu a aktuálne položky Gemini (iba krátky text – lacné
// a rýchle), (3) vráti zoznam operácií: pridať / zmeniť / zmazať / hotovo.
// Nič neukladá – ukladá až aplikácia po „Hotovo“ cez add_item (pravidlá ostávajú
// v databáze). Aplikácia medzitým ukáže okamžitý lokálny rozbor; táto odpoveď ho
// do sekundy spresní (rozdelí vety bez čiarok, opraví tvary slov, doplní kategóriu).
import { createClient } from "npm:@supabase/supabase-js@2";
import { callGemini, GeminiError, logUsage, type ThinkingLevel, type Usage } from "../_shared/gemini.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UNITS = ["ks", "kg", "g", "dkg", "l", "ml", "dl", "bal"];
const CATEGORIES = [
  "produce", "bakery", "dairy_eggs", "deli_chilled", "meat_fish", "frozen", "pantry", "breakfast",
  "snacks_sweets", "beverages", "alcohol", "household_cleaning", "personal_care", "health", "baby",
  "pet", "home", "toys_hobby", "electronics", "other",
];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    ops: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          op: { type: "STRING", enum: ["add", "change", "remove", "done"] },
          name: { type: "STRING", nullable: true },
          target: { type: "STRING", nullable: true },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true, enum: UNITS },
          delta: { type: "NUMBER", nullable: true },
          category_id: { type: "STRING", nullable: true, enum: CATEGORIES },
          status: { type: "STRING", enum: ["ok", "needs_qty", "unclear"] },
          suggestions: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["op", "status"],
      },
    },
  },
  required: ["ops"],
};

const prompt = (text: string, items: string, target: string | null) => `Hlasom nadiktovaný nákupný zoznam (slovenčina). Prepis z rozpoznávania reči NEMÁ čiarky a môže mať chyby.
Rozdeľ vetu na jednotlivé položky a vráť operácie (ops) v poradí, ako zazneli.

Delenie: každý produkt je samostatná položka. Množstvo patrí k produktu, pri ktorom zaznelo:
"banány 3 rožky maslo šunka" -> Banány | Rožok 3 ks | Maslo | Šunka
"mrkva pivo 6 kusov šunka" -> Mrkva | Pivo 6 ks | Šunka
"mlieko 3 kusy banány smotana 3 kusy" -> Mlieko 3 ks | Banány | Smotana 3 ks
"tri banány" = "banány 3 kusy" -> Banány 3 ks

- add: name = názov v 1. páde, prvé písmeno veľké, bez množstva ("tri nugátové šišky" -> "Nugátová šiška" 3 ks; "pol kila múky" -> "Múka" 0.5 kg;
  "dvadsaťpäť deka šunky" -> "Šunka" 25 dkg; "hovädzie dvesto päťdesiat gramov" -> "Hovädzie mäso" 250 g). Bez množstva: quantity null, unit null.
  Jednotky iba: ${UNITS.join(", ")}.
- category_id: ${CATEGORIES.join(", ")}.
- status "needs_qty": mäso, ryby, syr/šunka z pultu bez zaznetého množstva. "unclear": slovo nie je nákupná položka alebo je zle rozpoznané
  (suggestions: 2–3 podobne znejúce produkty v 1. páde). Inak "ok", suggestions [].
- change: produkt už je v zozname ("ešte jedny banány" -> target "Banány", delta 1; "banánov daj tri" -> target "Banány", quantity 3, unit "ks").
- remove: "zmaž/vymaž X" -> target. done: "hotovo", "to je všetko". target presne podľa zoznamu.
${target ? `Upravuje sa položka "${target}": vráť jednu operáciu change s target "${target}" (množstvo, jednotka alebo nový name).\n` : ""}
Zoznam (názov | množstvo):
${items || "(prázdny)"}

Veta: "${text}"`;

type Cfg = { model: string; thinking: Record<string, unknown> | null };

/** Poradie: najrýchlejší model s minimálnym „premýšľaním“; ďalšie sú záloha. Dá sa zmeniť v GEMINI_VOICE_MODEL. */
const CANDIDATES: Cfg[] = [
  ...(Deno.env.get("GEMINI_VOICE_MODEL") ? [{ model: Deno.env.get("GEMINI_VOICE_MODEL")!, thinking: { thinkingLevel: "minimal" } }] : []),
  // Namerané 13. 10. 2026 na vete so 6 položkami: 3.5-flash-lite ≈ 1,0–1,5 s, 3.6-flash ≈ 1,9–2,3 s, 3.8-flash ≈ 5–6 s.
  { model: "gemini-3.5-flash-lite", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.6-flash", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } },
];
/** Teplá inštancia si pamätá, ktorý model naposledy odpovedal (ďalšie volanie neskúša nedostupné). */
let preferred: Cfg | null = null;

/** Komu sa spotreba pripíše (domácnosť overená cez oprávnenia používateľa). */
type LogTo = { token: string; householdId: string | null };

/** Spotreba sa zapíše na pozadí, aby hlasový režim nečakal ani milisekundu navyše. */
function logInBackground(to: LogTo, model: string, usage: Usage | null, ok: boolean) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const task = (async () => {
    let householdId: string | null = null;
    if (to.householdId) {
      const asUser = createClient(url, serviceKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${to.token}` } },
      });
      const m = await asUser.from("households").select("id").eq("id", to.householdId).maybeSingle();
      if (m.data) householdId = to.householdId;
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await logUsage(admin, { fn: "parse-voice", model, usage, household_id: householdId, ok });
  })().catch((e) => console.error("parse-voice usage", String(e)));
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(task);
}

async function call(cfg: Cfg, text: string, timeoutMs: number, to: LogTo): Promise<{ ops: Record<string, unknown>[] }> {
  try {
    const res = await callGemini({
      model: cfg.model, parts: [{ text }], schema: SCHEMA,
      thinking: (cfg.thinking?.thinkingLevel as ThinkingLevel | undefined), timeoutMs,
    });
    logInBackground(to, cfg.model, res.usage, true);
    if (!Array.isArray(res.json?.ops)) throw new Error("GEMINI_BAD_JSON");
    return res.json as { ops: Record<string, unknown>[] };
  } catch (e) {
    if (e instanceof GeminiError) logInBackground(to, cfg.model, e.usage, false);
    throw e;
  }
}

async function askGemini(text: string, to: LogTo): Promise<{ ops: Record<string, unknown>[]; model: string }> {
  const deadline = Date.now() + 7_000;
  const list = preferred ? [preferred, ...CANDIDATES.filter((c) => c !== preferred)] : CANDIDATES;
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of list) {
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const r = await call(cfg, text, Math.min(3_500, left), to);
      preferred = cfg;
      return { ...r, model: cfg.model + (cfg.thinking ? "+min" : "") };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/^GEMINI_(401|402|403)|GEMINI_API_KEY_MISSING/.test(lastError)) throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100_000 ? v : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  let body: { text?: unknown; items?: unknown; target?: unknown; household_id?: unknown } = {};
  try {
    body = await req.json();
  } catch { /* prázdne telo */ }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

  const logTo: LogTo = {
    token,
    householdId: typeof body.household_id === "string" && /^[0-9a-f-]{36}$/i.test(body.household_id) ? body.household_id : null,
  };
  const text = str(body.text, 400);
  if (!text) return json({ error: "VALIDATION" }, 400);
  const target = str(body.target);
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 80)
    .map((i) => (i && typeof i === "object" ? (i as { name?: unknown; qty?: unknown }) : {}))
    .map((i) => `${str(i.name)?.replace(/[|\n"]/g, " ") ?? ""} | ${str(i.qty, 20) ?? "-"}`)
    .filter((l) => !l.startsWith(" |"))
    .join("\n");

  const t0 = Date.now();
  try {
    const result = await askGemini(prompt(text.replace(/"/g, "'"), items, target), logTo);
    const ops = result.ops.slice(0, 20).map((o) => ({
      op: ["add", "change", "remove", "done"].includes(String(o.op)) ? o.op : "add",
      name: str(o.name),
      target: str(o.target),
      quantity: num(o.quantity),
      unit: UNITS.includes(String(o.unit)) ? o.unit : null,
      delta: num(o.delta),
      category_id: CATEGORIES.includes(String(o.category_id)) ? o.category_id : null,
      status: ["ok", "needs_qty", "unclear"].includes(String(o.status)) ? o.status : "ok",
      suggestions: (Array.isArray(o.suggestions) ? o.suggestions : []).map((s) => str(s, 40)).filter(Boolean).slice(0, 3),
    }));
    console.log("parse-voice ok", result.model, Date.now() - t0, "ms");
    return json({ ops, model: result.model, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("parse-voice", Date.now() - t0, "ms", message);
    return json({ error: "PARSE_FAILED", detail: message.slice(0, 200) }, 502);
  }
});
