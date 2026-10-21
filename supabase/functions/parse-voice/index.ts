// Rozbor nadiktovanej vety pre hlasový nákupný zoznam.
//
// Tok: aplikácia pošle {text | audio, items, target}. Funkcia (1) overí prihláseného
// používateľa, (2) pošle vetu (alebo krátky zvukový úsek) a aktuálne položky Gemini,
// (3) vráti prepis, operácie (pridať / zmeniť / zmazať / hotovo), jedlá, ktoré chce
// človek uvariť („chcem uvariť hovädzí guláš“ → cook), a obchod, ak ho povedal.
// Zvuk posiela appka tam, kde rozpoznávanie reči v prehliadači nefunguje (iPhone,
// appka spustená z plochy) – prepis aj rozbor tak spraví Gemini naraz.
// Nič neukladá – ukladá až aplikácia po „Hotovo“ cez add_item (pravidlá ostávajú
// v databáze). Pri texte appka medzitým ukáže okamžitý lokálny rozbor; táto odpoveď ho
// do sekundy spresní (rozdelí vety bez čiarok, opraví tvary slov, doplní kategóriu).
import { createClient } from "npm:@supabase/supabase-js@2";

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
    transcript: { type: "STRING" },
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
    cook: { type: "ARRAY", items: { type: "STRING" } },
    store: { type: "STRING", nullable: true },
  },
  required: ["transcript", "ops", "cook"],
};

const rules = (items: string, target: string | null) => `Rozdeľ reč na jednotlivé položky a vráť operácie (ops) v poradí, ako zazneli.

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
- change: produkt už je v zozname ("ešte jedny banány" -> target "Banány", delta 1; "banánov daj tri" -> target "Banány", quantity 3, unit "ks";
  "nie, tri" -> posledná alebo upravovaná položka). remove: "zmaž/vymaž X" -> target. done: "hotovo", "to je všetko". target presne podľa zoznamu.
- cook: jedlá, ktoré chce človek uvariť alebo pripraviť ("chcem uvariť hovädzí guláš", "urobím burgre", "na večeru lasagne",
  "upečiem bábovku") -> názov jedla v 1. páde ("Hovädzí guláš", "Hovädzí burger"). Suroviny takého jedla NEPRIDÁVAJ do ops – appka ponúkne recepty.
  Ak nič také nezaznelo, cook [].
- store: obchod, ak ho povedal ("idem do Lidla" -> "Lidl", "v Kauflande" -> "Kaufland"), inak null. Obchod nie je položka.
${target ? `Upravuje sa položka "${target}": vráť jednu operáciu change s target "${target}" (množstvo, jednotka alebo nový name).\n` : ""}
Zoznam (názov | množstvo):
${items || "(prázdny)"}`;

const textPrompt = (text: string, items: string, target: string | null) =>
  `Hlasom nadiktovaný nákupný zoznam (slovenčina). Prepis z rozpoznávania reči NEMÁ čiarky a môže mať chyby.
${rules(items, target)}

transcript = veta bez zmeny.
Veta: "${text}"`;

const audioPrompt = (items: string, target: string | null) =>
  `Priložený zvuk je krátky úsek, v ktorom človek po slovensky diktuje nákupný zoznam (môže byť šum z obchodu).
transcript = presný prepis toho, čo povedal (s diakritikou, bez úvodzoviek). Ak je ticho alebo nič zrozumiteľné, transcript "" a ops [].
${rules(items, target)}`;

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

type Part = Record<string, unknown>;
type Result = { transcript?: string; ops: Record<string, unknown>[]; cook?: unknown[]; store?: unknown };

async function call(cfg: Cfg, parts: Part[], timeoutMs: number): Promise<Result> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        ...(cfg.thinking ? { thinkingConfig: cfg.thinking } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GEMINI_${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  const parsed = JSON.parse(out ?? "");
  if (!Array.isArray(parsed?.ops)) throw new Error("GEMINI_BAD_JSON");
  return parsed;
}

async function askGemini(parts: Part[], audio: boolean): Promise<Result & { model: string }> {
  // Zvuk trvá dlhšie (prepis + rozbor), text má byť do pár sekúnd.
  const deadline = Date.now() + (audio ? 14_000 : 7_000);
  const list = preferred ? [preferred, ...CANDIDATES.filter((c) => c !== preferred)] : CANDIDATES;
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of list) {
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const r = await call(cfg, parts, Math.min(audio ? 9_000 : 3_500, left));
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
const AUDIO_TYPES = /^audio\/(wav|x-wav|webm|ogg|mp4|mpeg|aac|flac)$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  let body: { text?: unknown; audio?: unknown; items?: unknown; target?: unknown } = {};
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

  const text = str(body.text, 400);
  const audio = body.audio && typeof body.audio === "object" ? (body.audio as { mime?: unknown; data?: unknown }) : null;
  const audioData = audio && typeof audio.data === "string" && audio.data.length < 3_000_000 ? audio.data : null;
  const audioMime = audio && AUDIO_TYPES.test(String(audio.mime)) ? String(audio.mime) : "audio/wav";
  if (!text && !audioData) return json({ error: "VALIDATION" }, 400);
  const target = str(body.target);
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 80)
    .map((i) => (i && typeof i === "object" ? (i as { name?: unknown; qty?: unknown }) : {}))
    .map((i) => `${str(i.name)?.replace(/[|\n"]/g, " ") ?? ""} | ${str(i.qty, 20) ?? "-"}`)
    .filter((l) => !l.startsWith(" |"))
    .join("\n");

  const parts: Part[] = audioData
    ? [{ text: audioPrompt(items, target) }, { inline_data: { mime_type: audioMime, data: audioData } }]
    : [{ text: textPrompt(text!.replace(/"/g, "'"), items, target) }];

  const t0 = Date.now();
  try {
    const result = await askGemini(parts, !!audioData);
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
    const cook = (Array.isArray(result.cook) ? result.cook : []).map((c) => str(c, 60)).filter(Boolean).slice(0, 3);
    const transcript = str(result.transcript, 400) ?? text ?? "";
    console.log("parse-voice ok", audioData ? "audio" : "text", result.model, Date.now() - t0, "ms");
    return json({ transcript, ops, cook, store: str(result.store, 40), model: result.model, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("parse-voice", Date.now() - t0, "ms", message);
    return json({ error: "PARSE_FAILED", detail: message.slice(0, 200) }, 502);
  }
});
