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

/**
 * Mikrofón počúva nepretržite – pravidlá, čo do zoznamu patrí a čo nie (pre hovorenú reč; napísaný text sa nefiltruje).
 */
const LISTEN_RULES = `Mikrofón počúva nepretržite, takže zachytí aj rozhovor s inými ľuďmi, telefonát, televízor, rádio, pieseň, deti alebo šum.
Do zoznamu patrí LEN to, čo človek chce kúpiť. Najprv urč intent:
- "list": diktuje nákupný zoznam alebo hovorí, čo treba kúpiť, čo doma chýba, čo pridať, zmeniť či zmazať v zozname
  ("mlieko chlieb a dve masla", "treba kúpiť prací prášok", "nemáme už maslo", "kúp ešte pivo", "ešte dve", "zmaž banány", "hotovo"),
  chce niečo uvariť ("chcem uvariť guláš") alebo hovorí, do ktorého obchodu ide ("idem do Lidla").
- "other": všetko ostatné – rozhovor, otázky a odpovede, rozprávanie o tom, čo sa stalo, pokyny inému človeku, reklama a správy
  z televízora či rádia, spev, útržky bez zmyslu. Príklady: "kde máš kľúče od auta", "ahoj ako sa máš", "počkaj chvíľu",
  "včera sme mali na obed rezne", "podaj mi tú lyžicu", "zober si bundu je zima", "dobre tak zajtra", "hm", "ďakujem",
  "obleč sa ideme von", "najlepšie ceny len tento týždeň", "kedy prídeš domov", "ja som nič nevidel", "dnes sme nič nekúpili",
  citoslovcia a reakcie ("ty kokos" nie je kokos, "ale to je", "no teda", "fakt") a prepis, ktorý je len zoznam výrazov
  oddelených pomlčkami alebo nedáva zmysel ako veta (ozvena šumu).
  Pri "other": ops [], cook [], store null.
Ak sa v jednej vete mieša rozhovor s nákupom ("počkaj chvíľu, a ešte kúp mlieko"), intent "list" a ops len z nákupnej časti.
Vec spomenutá v rozhovore bez toho, aby ju chcel kúpiť ("podaj mi lyžicu", "mlieko je v chladničke"), do ops NEPATRÍ.
is_product: true len pre tovar z obchodu (potraviny, nápoje, drogéria, čistiace prostriedky, potreby do domácnosti,
pre zvieratá a deti, lieky, papiernictvo). Mená ľudí, miesta, časy, činnosti, pocity, služby a slová z rozhovoru sú is_product false
a do ops ich nedávaj vôbec. Nevymýšľaj položky, ktoré nezazneli.`;

const rules = (items: string, target: string | null, vocab: string) => `Rozdeľ reč na jednotlivé položky a vráť operácie (ops) v poradí, ako zazneli.

Delenie: každý produkt je samostatná položka. Množstvo patrí k produktu, pri ktorom zaznelo:
"banány 3 rožky maslo šunka" -> Banány | Rožok 3 ks | Maslo | Šunka
"mrkva pivo 6 kusov šunka" -> Mrkva | Pivo 6 ks | Šunka
"mlieko 3 kusy banány smotana 3 kusy" -> Mlieko 3 ks | Banány | Smotana 3 ks
"tri banány" = "banány 3 kusy" -> Banány 3 ks

- add: name = názov v 1. páde, prvé písmeno veľké, bez množstva ("tri nugátové šišky" -> "Nugátová šiška" 3 ks; "pol kila múky" -> "Múka" 0.5 kg;
  "dvadsaťpäť deka šunky" -> "Šunka" 25 dkg; "hovädzie dvesto päťdesiat gramov" -> "Hovädzie mäso" 250 g). Bez množstva: quantity null, unit null.
  Jednotky iba: ${UNITS.join(", ")}.
- category_id: ${CATEGORIES.join(", ")}.
- status "needs_qty": mäso, ryby, syr/šunka z pultu bez zaznetého množstva. "unclear": znie to ako tovar, ale slovo je asi zle rozpoznané
  (suggestions: 2–3 podobne znejúce produkty v 1. páde). Slovo, ktoré nie je tovar, nie je "unclear" – do ops nepatrí. Inak "ok", suggestions [].
- change: produkt už je v zozname ("ešte jedny banány" -> target "Banány", delta 1; "banánov daj tri" -> target "Banány", quantity 3, unit "ks";
  "nie, tri" -> posledná alebo upravovaná položka). remove: "zmaž/vymaž X" -> target. done: "hotovo", "to je všetko". target presne podľa zoznamu.
- cook: jedlá, ktoré chce človek uvariť alebo pripraviť ("chcem uvariť hovädzí guláš", "urobím burgre", "na večeru lasagne",
  "upečiem bábovku") -> názov jedla v 1. páde ("Hovädzí guláš", "Hovädzí burger"). Suroviny takého jedla NEPRIDÁVAJ do ops – appka ponúkne recepty.
  Len konkrétne jedlo, ktoré chce sám navariť alebo upiecť – nie všeobecné "jedlo", "večera", "niečo", nie nápoj ani jedlo,
  ktoré by len zjedol či objednal ("urobím ti čaj", "zjedol by som pizzu", "urobím jedlo" = intent "other"). Ak nič také nezaznelo, cook [].
- store: obchod, do ktorého ide nakupovať, ak ho povedal ("idem do Lidla" -> "Lidl", "v Kauflande" -> "Kaufland"), inak null. Obchod nie je položka.
${vocab ? `Produkty, ktoré táto domácnosť často kupuje: ${vocab}\n  Keď vyslovené slovo v nákupe znie podobne ako niektorý z nich, je to on – použi presne tento názov. Iné produkty zapíš normálne.\n  Rozhovor podľa tohto zoznamu na nákup NEMEŇ.\n` : ""}${target ? `Upravuje sa položka "${target}": ak veta hovorí o nej (množstvo, jednotka alebo nový názov), vráť jednu operáciu change s target "${target}". Rozhovor ju nemení.\n` : ""}
Zoznam (názov | množstvo):
${items || "(prázdny)"}`;

const textPrompt = (text: string, items: string, target: string | null, vocab: string) =>
  `Veta zachytená mikrofónom v hlasovom nákupnom zozname (slovenčina). Prepis z rozpoznávania reči NEMÁ čiarky a môže mať chyby.
${LISTEN_RULES}
${rules(items, target, vocab)}

transcript = veta bez zmeny.
Veta: "${text}"`;

const typedPrompt = (text: string, items: string, target: string | null) =>
  `Text, ktorý človek napísal rukou do nákupného zoznamu (slovenčina). Je určený do zoznamu: intent "list", každá položka is_product true.
${rules(items, target, "")}

transcript = text bez zmeny.
Text: "${text}"`;

const audioPrompt = (items: string, target: string | null, vocab: string) =>
  `Priložený zvuk je krátky úsek z mikrofónu v hlasovom nákupnom zozname (slovenčina; môže byť šum z obchodu).
transcript = presný prepis toho, čo zaznelo (s diakritikou, bez úvodzoviek). Počúvaj pozorne každé slovo – často zaznie viac produktov
za sebou ("mlieko chlieb a dve masla"): prepíš všetky, nič nevynechaj a nespájaj dva produkty do jedného slova.
Nevymýšľaj: čo nie je zrozumiteľné, nedopĺňaj; ak je ticho alebo nič zrozumiteľné, transcript "", intent "other" a ops [].
Vzdialený hlas, televízor, rádio alebo hudba (nie človek, ktorý hovorí do telefónu) je intent "other".
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
/** Teplá inštancia si pamätá, ktorý model naposledy odpovedal (ďalšie volanie neskúša nedostupné). */
const preferredFor: { text: Cfg | null; audio: Cfg | null } = { text: null, audio: null };

type Part = Record<string, unknown>;
type Result = { transcript?: string; intent?: unknown; ops: Record<string, unknown>[]; cook?: unknown[]; store?: unknown };

async function call(cfg: Cfg, parts: Part[], timeoutMs: number, g: Guarded): Promise<Result> {
  try {
    const res = await callGemini({
      model: cfg.model, parts, schema: SCHEMA,
      thinking: cfg.thinking?.thinkingLevel as ThinkingLevel | undefined, timeoutMs,
    });
    g.log(cfg.model, res.usage, true);
    if (!Array.isArray(res.json?.ops)) throw new Error("GEMINI_BAD_JSON");
    return res.json as Result;
  } catch (e) {
    if (e instanceof GeminiError) g.log(cfg.model, e.usage, false);
    throw e;
  }
}

async function askGemini(parts: Part[], audio: boolean, g: Guarded): Promise<Result & { model: string }> {
  // Zvuk trvá dlhšie (prepis + rozbor), text má byť do pár sekúnd.
  const deadline = Date.now() + (audio ? 14_000 : 7_000);
  const base = audio ? AUDIO_CANDIDATES : CANDIDATES;
  const preferred = preferredFor[audio ? "audio" : "text"];
  const list = preferred ? [preferred, ...base.filter((c) => c !== preferred)] : base;
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of list) {
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const r = await call(cfg, parts, Math.min(audio ? 9_000 : 3_500, left), g);
      preferredFor[audio ? "audio" : "text"] = cfg;
      return { ...r, model: cfg.model + (cfg.thinking ? "+min" : "") };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
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
