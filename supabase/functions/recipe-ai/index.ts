// Recepty s Gemini.
//
// action "read"   – prečíta recept z fotky (aj viac strán / snímka obrazovky), z odkazu
//                   (stránka s receptom alebo YouTube) alebo z vloženého textu.
// action "create" – navrhne nový recept podľa zadania („palacinky so špenátom“).
// action "ask"    – odpovie na otázku pri varení, len k tomuto receptu (inak odmietne).
//
// Nič neukladá: recept skontroluje človek a uloží ho aplikácia (tabuľka recipes, RLS).
// Suroviny sa priradia ku kľúčom z databázy potravín aplikácie (posiela ich aplikácia),
// aby fungovala výživa a návrh balení; v krokoch sú množstvá ako {kľúč}, takže sa
// prepočítajú na zvolený počet porcií. Neisté miesta vráti v poli "uncertain".
// Chyby vracia ako kódy ({ error: "LINK_UNREADABLE" }), texty má aplikácia (error.*).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELS = () => [Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash", "gemini-3.6-flash"];
const CATEGORIES = ["hlavne", "cestoviny", "polievky", "sladke", "ranajky", "salaty"];
const MEATS = ["kuracie", "bravcove", "hovadzie", "ryby", "bez"];
const UNITS = ["g", "ml", "ks", "lyzica", "lyzicka", "strucik", "stipka", "hrst"];
const TAGS = ["klasika", "deti", "rychle", "sladke"];
const ICONS = ["CookingPot", "UtensilsCrossed", "Soup", "CakeSlice", "Egg", "Salad", "Beef", "Ham", "Drumstick", "Wheat", "Croissant", "Fish"];

const S = (extra: Record<string, unknown> = {}) => ({ type: "STRING", ...extra });
const RECIPE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_recipe: { type: "BOOLEAN" },
    name: S(),
    category: S({ enum: CATEGORIES }),
    meat: S({ enum: MEATS }),
    icon: S({ enum: ICONS }),
    minutes: { type: "INTEGER" },
    difficulty: { type: "INTEGER" },
    portions: { type: "INTEGER" },
    tags: { type: "ARRAY", items: S({ enum: TAGS }) },
    source: S({ nullable: true }),
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: S(),
          label: S(),
          qty: { type: "NUMBER", nullable: true },
          unit: S({ enum: UNITS }),
          note: S(),
          uncertain: S({ nullable: true }),
        },
        required: ["key", "label", "unit"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: S(),
          timer_min: { type: "INTEGER", nullable: true },
          wait: { type: "BOOLEAN" },
          done: S(),
          tip: S(),
          more: S(),
          uncertain: S({ nullable: true }),
        },
        required: ["text"],
      },
    },
    qa: { type: "ARRAY", items: { type: "OBJECT", properties: { q: S(), a: S() }, required: ["q", "a"] } },
  },
  required: ["is_recipe", "name", "category", "meat", "minutes", "difficulty", "portions", "ingredients", "steps"],
};
const ASK_SCHEMA = {
  type: "OBJECT",
  properties: { answer: S(), off_topic: { type: "BOOLEAN" } },
  required: ["answer", "off_topic"],
};

const lang = (locale: string) => (locale === "en" ? "English" : "slovenčina");

function recipeRules(locale: string, foods: string) {
  return `Jazyk všetkých textov receptu: ${lang(locale)} (preložiť, ak je zdroj v inom jazyku).
Pravidlá:
- ingredients: každá surovina zvlášť. key = kľúč z databázy potravín nižšie, ak tá istá surovina (inak krátky ascii kľúč malými písmenami, napr. "petrzlenova_vnat").
  label = názov suroviny v 1. páde. qty = číslo, unit iba: ${UNITS.join(", ")} ("lyzica" = polievková lyžica, "lyzicka" = čajová, "strucik" cesnaku, "stipka", "hrst").
  Deka/kilá/litre prepočítaj na g/ml. Kusy = "ks". note = krátka poznámka ("príloha", "do vody", "na vyprážanie"), inak "".
- steps: krátke kroky vlastnými slovami. {key} sa v aplikácii nahradí LEN množstvom (napr. "2 ks", "30 g"), preto názov suroviny vždy vypíš slovom
  a množstvo daj do zátvorky: "Cibuľu ({cibula}) speň na masle ({maslo})." – nikdy "Na {maslo} speň {cibula}". Čísla množstiev do textu nepíš.
  timer_min = minúty, ak sa v kroku čaká (varenie, dusenie, pečenie, kysnutie, odpočinok), inak null. wait = true, ak treba časovač.
  done = ako poznáš, že je krok hotový; tip = jedna praktická rada; more = podrobnejší postup pre začiatočníka (2–3 vety).
- qa: 2 časté otázky k receptu s krátkou odpoveďou.
- category: ${CATEGORIES.join(", ")}; meat: ${MEATS.join(", ")} ("bez" = bez mäsa); difficulty 1–3; minutes = celkový čas; portions = počet porcií.
- tags: "klasika" (tradičné jedlo), "deti" (chutí deťom), "rychle" (do 30 min), "sladke".
Databáza potravín (key=názov): ${foods.slice(0, 6000)}`;
}

const readPrompt = (locale: string, foods: string, source: string) => `Z priloženého zdroja (${source}) vypíš recept.
${recipeRules(locale, foods)}
- uncertain: pri surovine alebo kroku, kde si nie si istý (rozmazané číslo, nepresná miera „hrsť“, „podľa chuti“, chýbajúci čas),
  napíš krátko, čo treba skontrolovať (napr. "Číslo pred „lyžice“ je rozmazané – 2 alebo 3?"). Inak null. Nevymýšľaj, čo v zdroji nie je – radšej označ.
- is_recipe = false, ak zdroj neobsahuje recept (potom ostatné polia vyplň prázdne).
- source = názov zdroja (kniha, web, autor), ak ho vidíš, inak null.`;

const createPrompt = (locale: string, foods: string, query: string) => `Navrhni domáci recept podľa zadania: "${query.slice(0, 200)}".
Bežné suroviny zo slovenských obchodov, realistické množstvá na 4 porcie, overený postup.
${recipeRules(locale, foods)}
- uncertain: null všade. is_recipe = false, ak zadanie nie je jedlo. source = null.`;

type Part = Record<string, unknown>;

async function gemini(parts: Part[], schema: unknown, deadline: number, temperature = 0.2): Promise<Record<string, unknown>> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  let last = "GEMINI_UNKNOWN";
  for (const model of MODELS()) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } },
        }),
        signal: AbortSignal.timeout(Math.min(left, 90_000)),
      });
      if (!res.ok) throw new Error(`GEMINI_${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      return JSON.parse(out ?? "");
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      console.error("recipe-ai", model, last);
      if (/^GEMINI_(401|402|403)|GEMINI_API_KEY_MISSING/.test(last)) break;
    }
  }
  throw new Error(last);
}

/* ------------------------------------------------------------------ odkaz */
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd]|.*\.internal$|.*\.local$)/i;

function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("LINK_INVALID");
  }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) throw new Error("LINK_INVALID");
  return u;
}
const isYoutube = (u: URL) => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(u.hostname);

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Stránka → text pre Gemini: najprv štruktúrovaný recept (JSON-LD), inak čistý text stránky. */
async function pageText(u: URL): Promise<string> {
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BasketHarmony/1.0; recipe reader)", Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error("LINK_UNREADABLE");
  if (PRIVATE.test(new URL(res.url).hostname)) throw new Error("LINK_INVALID");
  const html = (await res.text()).slice(0, 1_500_000);
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((x) => /Recipe/i.test(x));
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  const body = ld.length ? `Štruktúrovaný recept:\n${ld.join("\n").slice(0, 20_000)}\n\nText stránky:\n${text.slice(0, 8_000)}` : text.slice(0, 25_000);
  if (body.length < 80) throw new Error("LINK_UNREADABLE");
  return `Názov stránky: ${title}\nAdresa: ${u.href}\n\n${body}`;
}

/* ------------------------------------------------------------------ úprava výsledku */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;

function clean(raw: Record<string, unknown>, source: string, sourceUrl: string | null, ai: boolean) {
  if (raw.is_recipe === false) throw new Error("NOT_A_RECIPE");
  const used = new Set<string>();
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).slice(0, 60).map((x: Record<string, unknown>, i: number) => {
    let key = str(x.key, 40).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || `s${i + 1}`;
    while (used.has(key)) key = `${key}_${i + 1}`;
    used.add(key);
    const qty = typeof x.qty === "number" && x.qty > 0 && x.qty < 100_000 ? Math.round(x.qty * 100) / 100 : null;
    const unit = UNITS.includes(String(x.unit)) ? String(x.unit) : "ks";
    // chýbajúce množstvo = kód "#qty" (text dá aplikácia)
    const uncertain = str(x.uncertain, 200) || (qty == null ? "#qty" : "");
    return { food: key, label: str(x.label, 80) || key, qty: qty ?? 1, unit, note: str(x.note, 80), uncertain: uncertain || null };
  });
  const keys = new Set(ingredients.map((x) => x.food));
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 40).map((x: Record<string, unknown>) => ({
    // {kľúč}, ktorý nie je medzi surovinami, by sa zobrazil prázdny – odstránime zátvorky
    text: str(x.text, 800).replace(/\{([^}]+)\}/g, (m, k) => (keys.has(k) ? m : k)),
    timerMin: typeof x.timer_min === "number" && x.timer_min > 0 ? Math.min(600, Math.round(x.timer_min)) : null,
    wait: x.wait === true,
    done: str(x.done, 300),
    tip: str(x.tip, 300),
    more: str(x.more, 800),
    uncertain: str(x.uncertain, 200) || null,
  })).filter((s) => s.text);
  if (!ingredients.length || !steps.length) throw new Error("NOT_A_RECIPE");
  const category = CATEGORIES.includes(String(raw.category)) ? String(raw.category) : "hlavne";
  return {
    name: str(raw.name, 120) || "Recept",
    category,
    meat: MEATS.includes(String(raw.meat)) ? String(raw.meat) : "bez",
    icon: ICONS.includes(String(raw.icon)) ? String(raw.icon) : null,
    minutes: int(raw.minutes, 5, 1440, 30),
    difficulty: int(raw.difficulty, 1, 3, 1),
    portions: int(raw.portions, 1, 50, 4),
    tags: (Array.isArray(raw.tags) ? raw.tags : []).filter((t: unknown) => TAGS.includes(String(t))).map(String),
    source: str(raw.source, 200) || source,
    sourceUrl,
    ingredients,
    steps,
    qa: (Array.isArray(raw.qa) ? raw.qa : []).slice(0, 4).map((x: Record<string, unknown>) => ({ q: str(x.q, 200), a: str(x.a, 600) })).filter((x) => x.q && x.a),
    ai,
  };
}

/* ------------------------------------------------------------------ server */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "VALIDATION" }, 400);
  }
  const locale = body.locale === "en" ? "en" : "sk";
  const foods = typeof body.foods === "string" ? body.foods : "";
  const deadline = Date.now() + 120_000;

  try {
    if (body.action === "read") {
      if (body.kind === "photo") {
        const images = (Array.isArray(body.images) ? body.images : []).slice(0, 6) as { mime?: string; data?: string }[];
        if (!images.length || images.some((x) => typeof x.data !== "string" || x.data.length > 6_000_000)) return json({ error: "VALIDATION" }, 400);
        const parts: Part[] = [
          { text: readPrompt(locale, foods, images.length > 1 ? `${images.length} fotky strán – jeden recept` : "fotka alebo snímka obrazovky") },
          ...images.map((x) => ({ inline_data: { mime_type: /^image\/(jpeg|png|webp|heic)$/.test(String(x.mime)) ? x.mime : "image/jpeg", data: x.data } })),
        ];
        const raw = await gemini(parts, RECIPE_SCHEMA, deadline, 0);
        return json({ recipe: clean(raw, locale === "en" ? "Photo" : "Fotka", null, false) });
      }
      if (body.kind === "link") {
        const u = checkUrl(String(body.url ?? ""));
        const parts: Part[] = isYoutube(u)
          ? [{ text: readPrompt(locale, foods, "video") }, { file_data: { file_uri: u.href, mime_type: "video/*" } }]
          : [{ text: readPrompt(locale, foods, "webová stránka") }, { text: await pageText(u) }];
        const raw = await gemini(parts, RECIPE_SCHEMA, deadline, 0);
        return json({ recipe: clean(raw, u.hostname.replace(/^www\./, ""), u.href, false) });
      }
      if (body.kind === "text") {
        const text = str(body.text, 30_000);
        if (text.length < 20) return json({ error: "NOT_A_RECIPE" }, 422);
        const raw = await gemini([{ text: readPrompt(locale, foods, "vložený text") }, { text }], RECIPE_SCHEMA, deadline, 0);
        return json({ recipe: clean(raw, locale === "en" ? "Text" : "Text", null, false) });
      }
      return json({ error: "VALIDATION" }, 400);
    }

    if (body.action === "create") {
      const query = str(body.query, 200);
      if (!query) return json({ error: "VALIDATION" }, 400);
      const raw = await gemini([{ text: createPrompt(locale, foods, query) }], RECIPE_SCHEMA, deadline, 0.6);
      return json({ recipe: clean(raw, "Gemini", null, true) });
    }

    if (body.action === "ask") {
      const question = str(body.question, 400);
      const recipe = body.recipe as { name?: string } | undefined;
      if (!question || !recipe?.name) return json({ error: "VALIDATION" }, 400);
      const history = (Array.isArray(body.history) ? body.history : []).slice(-6) as { q?: string; a?: string }[];
      const prompt = `Si pomocník pri varení. Odpovedáš IBA na otázky k vareniu tohto receptu (náhrady surovín, postup, porcie, čas, skladovanie, ako poznať, že je hotovo).
Na čokoľvek iné (šport, správy, politika, iné témy) slušne odmietni jednou vetou, off_topic = true.
Odpovedaj stručne (najviac 3 vety), prakticky, jazyk: ${lang(locale)}.
Recept: ${JSON.stringify(recipe).slice(0, 8000)}
Varí sa na ${int(body.portions, 1, 50, 4)} porcií, práve krok ${int(body.step, 0, 100, 0) + 1}.
${history.length ? `Predchádzajúce otázky:\n${history.map((h) => `- ${str(h.q, 300)} → ${str(h.a, 600)}`).join("\n")}\n` : ""}Otázka: "${question}"`;
      const raw = await gemini([{ text: prompt }], ASK_SCHEMA, Date.now() + 30_000, 0.3);
      return json({ answer: str(raw.answer, 1200), off_topic: raw.off_topic === true });
    }

    return json({ error: "VALIDATION" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = /^(LINK_INVALID|LINK_UNREADABLE|NOT_A_RECIPE)$/.test(msg)
      ? msg
      : /^GEMINI_402/.test(msg) ? "GEMINI_402"
      : "RECIPE_AI_FAILED";
    console.error("recipe-ai", body.action, msg);
    return json({ error: code, detail: msg.slice(0, 300) }, code === "RECIPE_AI_FAILED" ? 502 : 422);
  }
});
