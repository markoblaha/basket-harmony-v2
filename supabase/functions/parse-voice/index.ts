// Rozbor nadiktovanej vety pre hlasový nákupný zoznam.
//
// Tok: aplikácia pošle {household_id, text | audio, items, target, source}. Funkcia (1) overí prihláseného
// používateľa, členstvo v domácnosti a limit volaní (ai_allow v databáze), (2) pošle vetu (alebo krátky zvukový úsek) a aktuálne položky Gemini,
// (3) vráti prepis, zámer (intent), operácie (pridať / zmeniť / zmazať / hotovo), jedlá, ktoré chce
// človek uvariť („chcem uvariť hovädzí guláš“ → cook), a obchod, ak ho povedal.
// Mikrofón počúva stále, takže zachytí aj rozhovor, televízor či šum: intent "other" = veta nie je nákup
// a nič sa nepridá. Do zoznamu ide len tovar (is_product). Napísaný text (source "typed") sa nefiltruje –
// človek ho napísal do zoznamu zámerne.
// Zvuk posiela appka tam, kde rozpoznávanie reči v prehliadači nefunguje (iPhone,
// appka spustená z plochy) – prepis aj rozbor tak spraví Gemini naraz.
// Nič neukladá – ukladá až aplikácia po „Hotovo“ cez add_item (pravidlá ostávajú
// v databáze). Pri texte appka medzitým ukáže okamžitý lokálny rozbor; táto odpoveď ho
// do sekundy spresní (rozdelí vety bez čiarok, opraví tvary slov, doplní kategóriu).
import { callGemini, GeminiError, isGlobalError, type ThinkingLevel } from "../_shared/gemini.ts";
import { guardAi, type Guarded } from "../_shared/guard.ts";

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
    intent: { type: "STRING", enum: ["list", "other"] },
    ops: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          op: { type: "STRING", enum: ["add", "change", "remove", "done"] },
          name: { type: "STRING", nullable: true },
          is_product: { type: "BOOLEAN" },
          target: { type: "STRING", nullable: true },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true, enum: UNITS },
          delta: { type: "NUMBER", nullable: true },
          category_id: { type: "STRING", nullable: true, enum: CATEGORIES },
          status: { type: "STRING", enum: ["ok", "needs_qty", "unclear"] },
          suggestions: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["op", "is_product", "status"],
        // Najprv názov, potom posúdenie, či je to tovar (model tak o každej položke naozaj rozhodne).
        propertyOrdering: ["op", "name", "is_product", "target", "quantity", "unit", "delta", "category_id", "status", "suggestions"],
      },
    },
    cook: { type: "ARRAY", items: { type: "STRING" } },
    store: { type: "STRING", nullable: true },
  },
  required: ["transcript", "intent", "ops", "cook"],
  // Zámer sa rozhodne skôr, než model začne vypisovať položky.
  propertyOrdering: ["transcript", "intent", "ops", "cook", "store"],
};

/** Pri texte netreba prepis späť (máme ho) – kratšia odpoveď = lacnejšia. */
const { transcript: _transcript, ...TEXT_PROPS } = SCHEMA.properties;
const SCHEMA_TEXT = { ...SCHEMA, properties: TEXT_PROPS, required: ["intent", "ops", "cook"], propertyOrdering: ["intent", "ops", "cook", "store"] };

/*
 * Pokyny sú zámerne stručné: vstup tvorí ~2/3 ceny vety (14. 11. 2026 skrátené z ~1 650 tokenov).
 * Po každej zmene spusti testy/hlas-vety.mjs – všetkých 58 viet musí prejsť.
 */

/** Mikrofón počúva stále – čo do zoznamu patrí (len pre hovorenú reč; napísaný text sa nefiltruje). */
const LISTEN_RULES = `Mikrofón počúva stále – zachytí aj rozhovor, telefonát, televízor, spev či šum. Do zoznamu patrí LEN to, čo chce kúpiť.
intent "list": diktuje nákup alebo hovorí, čo treba kúpiť či čo chýba ("nemáme už maslo", "kúp ešte pivo"), mení zoznam ("ešte dve", "zmaž banány", "hotovo"), chce variť ("chcem uvariť guláš") alebo ide do obchodu ("idem do Lidla").
intent "other" (ops [], cook [], store null): všetko ostatné – rozhovor, otázky, rozprávanie, pokyny iným, televízor, rádio, citoslovcia, nezmysel. Napr. "kde máš kľúče", "podaj mi lyžicu", "mlieko je v chladničke", "včera sme mali rezne", "koľko stálo to maslo", "ty kokos", "ale to je", "dnes sme nič nekúpili", "najlepšie ceny len tento týždeň", výrazy oddelené pomlčkami.
Zmiešaná veta ("počkaj chvíľu, a kúp mlieko"): intent "list", ops len z nákupnej časti.
is_product true len pre tovar z obchodu; mená, miesta, činnosti a slová z rozhovoru do ops nedávaj. Nevymýšľaj.`;

const rules = (items: string, target: string | null, vocab: string) => `ops v poradí, ako zazneli; každý produkt zvlášť, množstvo patrí k produktu, pri ktorom zaznelo:
"banány 3 rožky maslo" -> Banány | Rožok 3 ks | Maslo; "mlieko 3 kusy banány" -> Mlieko 3 ks | Banány; "tri banány" -> Banány 3 ks.
- add: name v 1. páde a v jazyku, v ktorom zaznel ("two milks" -> Milk 2 ks), prvé písmeno veľké, bez množstva; "pol kila múky" -> Múka 0.5 kg; "25 deka šunky" -> Šunka 25 dkg. Bez množstva quantity a unit null. Jednotky: ${UNITS.join(", ")}.
- category_id: ${CATEGORIES.join(", ")}.
- status: "needs_qty" = mäso, ryby, syr či šunka z pultu bez množstva; "unclear" = asi zle rozpoznaný tovar (suggestions: 2–3 podobné produkty); inak "ok", suggestions [].
- change: produkt už je v zozname ("ešte jedny banány" -> target Banány, delta 1; "banánov daj tri" -> quantity 3; "nie, tri" -> posledná položka). remove: "zmaž X". done: "hotovo", "to je všetko". target presne podľa zoznamu.
- cook: konkrétne jedlo, ktoré chce sám uvariť či upiecť ("chcem uvariť hovädzí guláš" -> Hovädzí guláš); jeho suroviny do ops nedávaj. Nie: "jedlo", nápoj, "urobím ti čaj", "zjedol by som pizzu".
- store: obchod, do ktorého ide nakupovať ("idem do Lidla" -> Lidl), inak null.
${vocab ? `Domácnosť často kupuje: ${vocab}. Slovo z nákupu, ktoré znie podobne, je to – použi presne ten názov.\n` : ""}${target ? `Upravuje sa položka "${target}": ak veta hovorí o nej, vráť jednu operáciu change s target "${target}".\n` : ""}Zoznam (názov | množstvo):
${items || "(prázdny)"}`;

const textPrompt = (text: string, items: string, target: string | null, vocab: string) =>
  `Veta z mikrofónu v nákupnom zozname (slovenčina, bez čiarok, môže mať chyby rozpoznávania).
${LISTEN_RULES}
${rules(items, target, vocab)}
Veta: "${text}"`;

const typedPrompt = (text: string, items: string, target: string | null) =>
  `Text napísaný do nákupného zoznamu (slovenčina): intent "list", každá položka is_product true.
${rules(items, target, "")}
Text: "${text}"`;

const audioPrompt = (items: string, target: string | null, vocab: string) =>
  `Zvuk z mikrofónu v nákupnom zozname (slovenčina; môže byť šum z obchodu).
transcript = presný prepis s diakritikou; prepíš každý produkt ("mlieko chlieb a dve masla"), nespájaj dva do jedného slova, nedopĺňaj nezrozumiteľné.
Ticho alebo nič zrozumiteľné: transcript "", intent "other". Vzdialený hlas, televízor, rádio či hudba: intent "other".
${LISTEN_RULES}
${rules(items, target, vocab)}`;

type Cfg = { model: string; thinking: Record<string, unknown> | null };

/** Poradie: najrýchlejší model s minimálnym „premýšľaním“; ďalšie sú záloha. Dá sa zmeniť v GEMINI_VOICE_MODEL. */
const CANDIDATES: Cfg[] = [
  ...(Deno.env.get("GEMINI_VOICE_MODEL") ? [{ model: Deno.env.get("GEMINI_VOICE_MODEL")!, thinking: { thinkingLevel: "minimal" } }] : []),
  // Namerané 13. 10. 2026 na vete so 6 položkami: 3.5-flash-lite ≈ 1,0–1,5 s, 3.6-flash ≈ 1,9–2,3 s, 3.8-flash ≈ 5–6 s.
  { model: "gemini-3.5-flash-lite", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.6-flash", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } },
];
/**
 * Zvuk: prepis slovenčiny je pri flash-lite slabý (zle počuje názvy, spája dve položky do nezmyslu),
 * preto ide najprv na 3.6-flash; lite je už len záloha. Dá sa zmeniť v GEMINI_VOICE_AUDIO_MODEL.
 */
const AUDIO_CANDIDATES: Cfg[] = [
  ...(Deno.env.get("GEMINI_VOICE_AUDIO_MODEL") ? [{ model: Deno.env.get("GEMINI_VOICE_AUDIO_MODEL")!, thinking: { thinkingLevel: "minimal" } }] : []),
  { model: "gemini-3.6-flash", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.5-flash-lite", thinking: { thinkingLevel: "minimal" } },
  { model: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } },
];
/**
 * Modely, ktoré na tejto (teplej) inštancii neexistujú alebo sú zakázané (404/400) – ďalšie volania ich preskočia.
 * Pomalú odpoveď či preťaženie si NEPAMÄTÁME: každá veta začína najlacnejším modelom. (Predtým si inštancia po jednom
 * oneskorení zapamätala 2× drahší záložný model pre všetky ďalšie vety – 14. 11. 2026 tak išlo 16 z 58 viet.)
 */
const unavailable = new Set<string>();

type Part = Record<string, unknown>;
type Result = { transcript?: string; intent?: unknown; ops: Record<string, unknown>[]; cook?: unknown[]; store?: unknown };

async function call(cfg: Cfg, parts: Part[], schema: unknown, timeoutMs: number, g: Guarded): Promise<Result> {
  try {
    const res = await callGemini({
      model: cfg.model, parts, schema,
      thinking: cfg.thinking?.thinkingLevel as ThinkingLevel | undefined, timeoutMs,
    });
    g.log(cfg.model, res.usage, true);
    console.log("parse-voice tokeny", cfg.model, "vstup", res.usage.input, "z cache", res.usage.cached ?? 0, "výstup", res.usage.output);
    if (!Array.isArray(res.json?.ops)) throw new Error("GEMINI_BAD_JSON");
    return res.json as Result;
  } catch (e) {
    if (e instanceof GeminiError) g.log(cfg.model, e.usage, false);
    throw e;
  }
}

async function askGemini(parts: Part[], audio: boolean, g: Guarded): Promise<Result & { model: string }> {
  // Zvuk trvá dlhšie (prepis + rozbor), text má byť do pár sekúnd.
  const started = Date.now();
  const deadline = started + (audio ? 14_000 : 7_000);
  const list = (audio ? AUDIO_CANDIDATES : CANDIDATES).filter((c) => !unavailable.has(c.model));
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of list) {
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const r = await call(cfg, parts, audio ? SCHEMA : SCHEMA_TEXT, Math.min(audio ? 9_000 : 4_500, left), g);
      return { ...r, model: cfg.model + (cfg.thinking ? "+min" : "") };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/^GEMINI_(400|404)/.test(lastError)) unavailable.add(cfg.model);
      console.warn("parse-voice záloha", cfg.model, Date.now() - started, "ms", lastError.slice(0, 120));
      if (isGlobalError(lastError)) throw new Error(lastError);
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

  let body: { household_id?: unknown; text?: unknown; audio?: unknown; items?: unknown; target?: unknown; vocab?: unknown; source?: unknown } = {};
  try {
    body = await req.json();
  } catch { /* prázdne telo */ }

  const g = await guardAi(req, body.household_id, "parse-voice");
  if ("error" in g) return json({ error: g.error }, g.status);

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

  const vocab = (Array.isArray(body.vocab) ? body.vocab : [])
    .slice(0, 120)
    .map((v) => str(v, 40)?.replace(/[|\n"]/g, " "))
    .filter(Boolean)
    .join(", ");

  // Napísaný text je zámerný (nefiltruje sa); hovorená reč môže byť aj rozhovor okolo.
  const typed = !audioData && body.source === "typed";
  const parts: Part[] = audioData
    ? [{ text: audioPrompt(items, target, vocab) }, { inline_data: { mime_type: audioMime, data: audioData } }]
    : typed
      ? [{ text: typedPrompt(text!.replace(/"/g, "'"), items, target) }]
      : [{ text: textPrompt(text!.replace(/"/g, "'"), items, target, vocab) }];

  const t0 = Date.now();
  try {
    const result = await askGemini(parts, !!audioData, g);
    // Rozhovor, televízor, šum: nič sa nepridá (ani jedlo, ani obchod) – appka vetu len ukáže ako nepridanú.
    const intent = typed || result.intent !== "other" ? "list" : "other";
    const ops = (intent === "other" ? [] : result.ops)
      // Slovo, ktoré nie je tovar (meno, miesto, vec z rozhovoru), do zoznamu nepatrí.
      .filter((o) => typed || o.op !== "add" || o.is_product !== false)
      .slice(0, 20)
      .map((o) => ({
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
    const cook = intent === "other" ? [] : (Array.isArray(result.cook) ? result.cook : []).map((c) => str(c, 60)).filter(Boolean).slice(0, 3);
    const transcript = str(result.transcript, 400) ?? text ?? "";
    const dropped = result.ops.length - ops.length;
    console.log("parse-voice ok", audioData ? "audio" : typed ? "typed" : "text", intent, dropped ? `-${dropped}` : "", result.model, Date.now() - t0, "ms");
    return json({ transcript, intent, ops, cook, store: intent === "other" ? null : str(result.store, 40), model: result.model, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("parse-voice", Date.now() - t0, "ms", message);
    return json({ error: "PARSE_FAILED", detail: message.slice(0, 200) }, 502);
  }
});
