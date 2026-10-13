// Prečíta nákupný doklad (fotka, snímka obrazovky alebo PDF) cez Gemini a výsledok uloží do databázy.
//
// Tok: aplikácia nahrá súbor do súkromného úložiska a zavolá túto funkciu s
// {receipt_id}. Funkcia (1) overí prihláseného používateľa a že doklad vidí
// (to rozhoduje RLS v databáze), (2) stiahne súbor, (3) pošle ho Gemini,
// (4) výsledok odovzdá databázovej funkcii save_receipt_extraction, ktorá
// skontroluje súčet, dátum a duplicity.
// (5) Ak databáza výsledok neprijme (súčet nesedí, chýbajú položky, divný dátum),
// funkcia doklad prečíta ešte raz – silnejším modelom a s informáciou, čo bolo
// podozrivé – a nechá si lepší z oboch výsledkov. Prvé čítanie sa nikdy nestratí.
// Kľúč GEMINI_API_KEY je iba tu, na serveri.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CATEGORIES = [
  "produce", "bakery", "dairy_eggs", "deli_chilled", "meat_fish", "frozen", "pantry", "breakfast",
  "snacks_sweets", "beverages", "alcohol", "household_cleaning", "personal_care", "health", "baby", "pet",
  "clothing", "home", "toys_hobby", "electronics", "fuel", "transport", "dining", "leisure", "fees", "deposit", "other",
];

// Modely: bežné čítanie, záložný model (ak prvý nie je dostupný) a silnejší model na druhé čítanie.
const modelMain = () => Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
const modelFallback = () => "gemini-3.6-flash";
const modelStrong = () => Deno.env.get("GEMINI_MODEL_STRONG") ?? "gemini-3.1-pro-preview";

/** Celé spracovanie musí skončiť skôr, než Supabase preruší dlho trvajúcu požiadavku (~150 s). */
const TOTAL_BUDGET_MS = 130_000;
/** Gemini prijme v jednej požiadavke najviac ~20 MB (po prevode do base64 je súbor o tretinu väčší). */
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
const SECOND_PASS_MIN_MS = 40_000;

const pageNote = (pages: number) =>
  pages > 1
    ? `\n\nTento doklad má ${pages} strán (fotiek alebo snímok obrazovky) v poradí, v akom nasledujú. Je to JEDEN doklad: spoj všetky strany do jedného výsledku. Hlavička (obchod, dátum) je zvyčajne na prvej strane, celková suma na poslednej. Ak sa riadky na konci jednej strany opakujú na začiatku ďalšej (fotky sa prekrývajú), započítaj ich iba raz.`
    : "";

const promptFor = (today: string, pages = 1) => `Si presný čítač nákupných dokladov: pokladničné bločky, e-shopové faktúry, potvrdenia objednávok (fotka, snímka obrazovky alebo PDF). Z dokladu vytiahni údaje a vráť ich ako JSON podľa schémy. Dnes je ${today}.${pageNote(pages)}

Najdôležitejšia je presnosť. Čísla prepisuj znak po znaku (pozor na zámenu 3/8, 1/7, 5/6, 0/8 a na desatinnú čiarku). Nič nevynechaj a nič nevymýšľaj. Pri dlhom doklade prejdi každý riadok od prvého po posledný.

Pravidlá:
- is_receipt: true pre každý nákupný doklad (pokladničný bloček, faktúra, potvrdenie alebo prehľad objednávky z e-shopu), aj keď je to len časť dokladu. Ak sú na ňom ceny položiek, vyplň ich. Ak je na ňom iba celková suma a názvy položiek bez cien, vyplň čo vidíš (obchod, dátum, total) a položkám daj line_total = null – ceny nikdy nevymýšľaj. false iba ak na obrázku vôbec nie je nákupný doklad (bežná fotka, krajina, text bez nákupu) – vtedy daj items prázdne.
- store_name: iba značka obchodu alebo predajcu (napr. "Lidl", "Tesco", "Billa", "Kaufland", "Coop Jednota", "dm", "Metro", "Dr.Max", "Mykan"), nie celá adresa ani názov s.r.o. Ak názov obchodu na doklade nie je (napr. je to len pokračovanie alebo časť bločku), daj null – nehádaj ho podľa tovaru.
- purchased_on: dátum nákupu YYYY-MM-DD. Slovenský zápis je deň.mesiac.rok (13.9.2026 = 2026-09-13). Pri faktúre dátum vystavenia, pri objednávke dátum objednávky. Doklady sú spravidla z posledného roka. Ak dátum alebo rok nevidno celý, daj null – radšej null ako tipovať.
- purchased_time: čas HH:MM, ak je na doklade.
- total: konečná suma na zaplatenie presne tak, ako je vytlačená na doklade (Spolu, Celkom, K úhrade, Na zaplatenie). Prepíš ju z dokladu, nepočítaj ju zo súčtu položiek. Pri dlhom doklade je na úplnom konci – nezabudni ju.
- items: každý nakúpený riadok v poradí z dokladu. name presne podľa dokladu. quantity a unit: pri kusoch quantity = počet a unit "ks"; pri vážených veciach quantity = hmotnosť a unit "kg". unit_price = cena za jednotku. line_total = suma, ktorú si zákazník za riadok naozaj zaplatil PO zľave a S DPH (ak je na faktúre cena bez DPH aj s DPH, použi s DPH); ak cena riadku na doklade nie je, daj null.
- Riadky so zľavou (Zľava, Akcia, Kupón, Lidl Plus) pripoj k položke, ktorej patria: zníž jej line_total a do discount daj kladnú sumu zľavy. Ak zľava patrí celému nákupu, nepridávaj ju ako položku, len ju sčítaj do discount_total.
- Pohonné hmoty (nafta, benzín, LPG): quantity = počet litrov, unit "l", unit_price = cena za liter, category_id fuel.
- Doprava, poštovné, balné a iné poplatky sú samostatné položky (category_id fees). Položka s nulovou cenou (darček, kupón na budúci nákup) sa neuvádza.
- Záloha na obaly: samostatná položka "Záloha na obal" (category_id deposit). Vrátená záloha je položka so zápornou sumou (tiež deposit).
- category_id vyber z povolených hodnôt podľa druhu tovaru: health = lieky, vitamíny, zdravotnícke potreby; baby = plienky, detská výživa a potreby pre deti; clothing = oblečenie a obuv; home = vybavenie domácnosti, kuchynské potreby, dekorácie; toys_hobby = hračky, hobby, kancelária; electronics = elektronika; fuel = pohonné hmoty; transport = parkovanie, diaľničná známka, umývanie a servis auta, MHD; leisure = vstupenky, kino, šport; dining = jedlo a pitie v reštaurácii či bufete; household_cleaning = čistiace a pracie prostriedky; other len ak nič nesedí.
- Kontrola pred odpoveďou: sčítaj line_total všetkých položiek; má sa rovnať total. Ak nie, vráť sa k dokladu a nájdi chýbajúci alebo zle prečítaný riadok, kým to nesedí. Ak súčet nevie sedieť ani po dôkladnej kontrole (doklad je poškodený alebo nečitateľný), vráť čo čítaš a nič nedopočítavaj.
Vymýšľať údaje je zakázané: čo nevidíš, daj null.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_receipt: { type: "BOOLEAN" },
    store_name: { type: "STRING", nullable: true },
    purchased_on: { type: "STRING", nullable: true },
    purchased_time: { type: "STRING", nullable: true },
    total: { type: "NUMBER", nullable: true },
    discount_total: { type: "NUMBER", nullable: true },
    currency: { type: "STRING", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          unit_price: { type: "NUMBER", nullable: true },
          line_total: { type: "NUMBER", nullable: true },
          discount: { type: "NUMBER", nullable: true },
          category_id: { type: "STRING", enum: CATEGORIES },
        },
        required: ["name", "line_total", "category_id"],
      },
    },
  },
  required: ["is_receipt", "items"],
};

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

type Extraction = Record<string, unknown>;
/** Jedna strana dokladu: súbor v base64 a jeho typ. Doklad môže mať viac strán. */
type Page = { b64: string; mime: string };
type Saved = {
  status: string;
  review_reason: string | null;
  total: number | string | null;
  items_sum: number | string | null;
  purchased_on: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chyby, pri ktorých nemá zmysel skúšať ďalší model ani ďalší doklad (kredit, kľúč, oprávnenie). */
const isGlobalError = (message: string) => /^(GEMINI_(401|402|403)|GEMINI_API_KEY_MISSING)/.test(message);

/**
 * Jedno čítanie jedným modelom. Dočasné chyby (preťaženie, výpadok siete, nedokončený
 * alebo pokazený JSON) sa opakujú; trvalé (kredit, kľúč, zlý model) končia hneď.
 */
async function askGemini(
  pages: Page[],
  model: string,
  today: string,
  deadline: number,
  hint?: string,
): Promise<Extraction> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const prompt = promptFor(today, pages.length);
  const text = hint ? `${prompt}\n\n${hint}` : prompt;
  const fileParts = pages.flatMap((pg, i) => [
    ...(pages.length > 1 ? [{ text: `Strana ${i + 1} z ${pages.length}:` }] : []),
    { inline_data: { mime_type: pg.mime, data: pg.b64 } },
  ]);
  // Vyššie rozlíšenie a väčší limit odpovede pomáhajú pri dlhých dokladoch. Ak ich model
  // neprijme (chyba 400), skúsime to raz bez nich.
  let extras = true;
  const makeBody = () => ({
    contents: [{ parts: [{ text }, ...fileParts] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      ...(extras ? { mediaResolution: "MEDIA_RESOLUTION_HIGH", maxOutputTokens: 16384 } : {}),
    },
  });

  let lastError = "GEMINI_UNKNOWN";
  let attempts = 0;
  while (attempts < 3) {
    if (attempts > 0) await sleep(2000 * attempts);
    attempts++;
    const remaining = deadline - Date.now();
    if (remaining < 10_000) throw new Error(`GEMINI_TIMEOUT: došiel čas na čítanie (${lastError.slice(0, 120)})`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(makeBody()),
        signal: AbortSignal.timeout(Math.min(70_000, remaining)),
      });
    } catch (e) {
      lastError = `GEMINI_NETWORK: ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const out = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (!out) {
        lastError = `GEMINI_EMPTY: ${candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "bez dôvodu"}`;
        continue;
      }
      try {
        return JSON.parse(out);
      } catch {
        lastError = `GEMINI_BAD_JSON: ${candidate?.finishReason ?? "?"}`;
        continue;
      }
    }

    lastError = `GEMINI_${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (res.status === 400 && extras) {
      extras = false;
      attempts--;
      continue;
    }
    // Opakujeme len pri preťažení / limite / výpadku; ostatné chyby sú trvalé.
    if (res.status !== 429 && res.status < 500) break;
  }
  throw new Error(lastError);
}

/** Skúša modely popri sebe: ďalší sa použije, ak ten predchádzajúci nie je dostupný alebo zlyhal. */
async function read(
  pages: Page[],
  models: string[],
  today: string,
  deadline: number,
  hint?: string,
): Promise<Extraction> {
  let lastError: Error = new Error("GEMINI_UNKNOWN");
  for (const model of [...new Set(models)]) {
    try {
      return await askGemini(pages, model, today, deadline, hint);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.error("extract-receipt model", model, lastError.message);
      if (isGlobalError(lastError.message)) throw lastError;
    }
  }
  throw lastError;
}

/** Zlé hodnoty od modelu (neplatný dátum, text namiesto čísla) nesmú zhodiť ukladanie celého dokladu. */
function sanitize(x: Extraction): Extraction {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const date = (v: unknown) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(v + "T00:00:00Z");
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
  };
  const time = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? v : null);
  const items = (Array.isArray(x.items) ? x.items : [])
    .filter((it: Record<string, unknown>) => it && typeof it.name === "string" && num(it.line_total) !== null)
    .map((it: Record<string, unknown>) => ({
      name: String(it.name),
      quantity: num(it.quantity),
      unit: typeof it.unit === "string" ? it.unit : null,
      unit_price: num(it.unit_price),
      line_total: num(it.line_total),
      discount: num(it.discount),
      category_id: typeof it.category_id === "string" ? it.category_id : "other",
    }));
  return {
    ...x,
    purchased_on: date(x.purchased_on),
    purchased_time: time(x.purchased_time),
    total: num(x.total),
    discount_total: num(x.discount_total),
    items,
  };
}

/** Čím menší rozdiel medzi súčtom položiek a celkovou sumou, tým lepšie čítanie. */
const gap = (s: Saved) => (s.total == null ? Infinity : Math.abs(Number(s.items_sum) - Number(s.total)));
const isBetter = (a: Saved, b: Saved) =>
  (a.status === "OK") !== (b.status === "OK") ? a.status === "OK" : gap(a) <= gap(b);

/** Čo bolo podozrivé na prvom čítaní – povie sa to druhému čítaniu. */
function problemText(s: Saved): string | null {
  switch (s.review_reason) {
    case "TOTAL_MISMATCH":
      return s.total == null
        ? `celková suma sa neprečítala (súčet načítaných položiek je ${s.items_sum} €) – nájdi ju na doklade`
        : `súčet načítaných položiek je ${s.items_sum} €, ale celková suma na doklade je ${s.total} €`;
    case "NO_ITEMS":
      return "nenašli sa žiadne položky";
    case "DATE_SUSPECT":
      return `dátum ${s.purchased_on ?? "(chýba)"} je nepravdepodobný alebo chýba`;
    default:
      return null;
  }
}

/** Spustí zjednotenie produktov (funkcia normalize-products) po odoslaní odpovede. */
function normalizeInBackground(url: string, token: string, householdId: string) {
  const task = fetch(`${url}/functions/v1/normalize-products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ household_id: householdId }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("extract-receipt normalize", String(e)));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
}

const compact = (x: Extraction) =>
  (Array.isArray(x.items) ? x.items : [])
    .map((it: Record<string, unknown>) => `${it.name} | ${it.quantity ?? 1} | ${it.line_total}`)
    .join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  const started = Date.now();
  const deadline = started + TOTAL_BUDGET_MS;
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

  let receiptId: string | undefined;
  try {
    receiptId = (await req.json())?.receipt_id;
  } catch { /* prázdne telo */ }
  if (!receiptId || !/^[0-9a-f-]{36}$/i.test(receiptId)) return json({ error: "VALIDATION" }, 400);

  // Doklad musí vidieť sám používateľ (RLS = je člen domácnosti).
  const asUser = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: receipt, error: receiptError } = await asUser
    .from("receipts").select("id, image_path, household_id").eq("id", receiptId).maybeSingle();
  if (receiptError || !receipt) return json({ error: "NOT_FOUND" }, 404);

  const save = async (payload: Extraction): Promise<Saved> => {
    const r = await admin.rpc("save_receipt_extraction", { p_receipt_id: receiptId, p_payload: sanitize(payload) });
    if (r.error) throw new Error("SAVE_FAILED: " + r.error.message);
    return r.data as Saved;
  };

  try {
    await admin.from("receipts").update({ status: "PROCESSING", review_reason: null, error_text: null }).eq("id", receiptId);

    // Všetky strany dokladu v poradí (starší doklad bez záznamu strán = jedna strana).
    const { data: pageRows } = await admin
      .from("receipt_pages").select("image_path").eq("receipt_id", receiptId).order("position");
    const paths = pageRows && pageRows.length > 0
      ? pageRows.map((r: { image_path: string }) => r.image_path)
      : [receipt.image_path];
    const pages: Page[] = [];
    let totalBytes = 0;
    for (const [i, path] of paths.entries()) {
      const file = await admin.storage.from("receipts").download(path);
      if (file.error || !file.data) {
        // Prvá strana je povinná. Ďalšia, ktorej súbor chýba (nahrávanie sa prerušilo), sa preskočí.
        if (i > 0) {
          console.error("extract-receipt chýba súbor strany", receiptId, path);
          continue;
        }
        throw new Error("IMAGE_MISSING: " + (file.error?.message ?? path));
      }
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("FILES_TOO_LARGE");
      const ext = path.split(".").pop()?.toLowerCase() ?? "jpg";
      pages.push({ b64: encodeBase64(bytes), mime: MIME[ext] ?? "image/jpeg" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const timeLeft = () => deadline - Date.now();

    // 1. čítanie
    let first = await read(pages, [modelMain(), modelFallback()], today, deadline);

    // „Nie je to doklad“ si radšej overíme druhým pohľadom, aby sa nezahodil skutočný doklad.
    if (first.is_receipt === false) {
      if (timeLeft() > SECOND_PASS_MIN_MS) {
        try {
          const again = await read(
            pages, [modelStrong(), modelMain(), modelFallback()], today, deadline,
            "Prvé čítanie tvrdí, že na obrázku nie je nákupný doklad. Over to pozorne: ak je tam akýkoľvek doklad s cenami položiek (aj faktúra, potvrdenie objednávky alebo snímka obrazovky), prečítaj ho. Ak tam naozaj nie je, nechaj is_receipt = false.",
          );
          first = again;
        } catch (e) {
          if (isGlobalError(e instanceof Error ? e.message : String(e))) throw e;
        }
      }
      if (first.is_receipt === false) throw new Error("NOT_A_RECEIPT");
    }

    let saved = await save(first);

    // 2. čítanie, ak databáza výsledok neprijala (súčet, položky, dátum)
    // Doklad, ktorý má len celkovú sumu a názvy položiek bez cien (napr. prehľad objednávok), druhé čítanie nezlepší.
    const pricelessOnly = saved.review_reason === "NO_ITEMS" && saved.total != null &&
      (Array.isArray(first.items) ? first.items : []).some((it: Record<string, unknown>) => it && it.line_total == null);
    const problem = saved.status === "OK" || pricelessOnly ? null : problemText(saved);
    if (problem && timeLeft() > SECOND_PASS_MIN_MS) {
      try {
        const second = await read(
          pages, [modelStrong(), modelMain(), modelFallback()], today, deadline,
          `Prvé čítanie tohto dokladu je podozrivé: ${problem}. Prečítaj doklad znovu úplne od začiatku, riadok po riadku, a oprav chyby: chýbajúce alebo zdvojené riadky, zle prečítané ceny a množstvá, zľavy, celkovú sumu, dátum. Prvé čítanie je len na porovnanie a môže byť chybné (názov | množstvo | suma):\n${compact(first)}`,
        );
        if (second.is_receipt !== false) {
          const saved2 = await save(second);
          if (isBetter(saved2, saved)) saved = saved2;
          else saved = await save(first); // druhé čítanie nebolo lepšie – vrátime prvé
        }
      } catch (e) {
        // Druhé čítanie je bonus: prvý výsledok je už uložený a ostáva.
        console.error("extract-receipt second pass", receiptId, e instanceof Error ? e.message : String(e));
      }
    }

    // Nové produkty z tohto dokladu zjednotíme na pozadí (odpoveď aplikácii tým nečaká).
    normalizeInBackground(url, token, receipt.household_id);

    return json({ status: saved.status, review_reason: saved.review_reason, ms: Date.now() - started });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("extract-receipt", receiptId, message);
    await admin.rpc("fail_receipt", { p_receipt_id: receiptId, p_error: message });
    return json({ error: "EXTRACTION_FAILED", detail: message }, 502);
  }
});
