// Zjednotí produkty domácnosti: z rôznych zápisov na bločkoch ("RAJO MLIEKO POL.1,5% 1L",
// "Mlieko Rajo 1l") urobí jeden čistý produkt s názvom, značkou, veľkosťou balenia a kategóriou.
//
// Tok: aplikácia zavolá funkciu s {household_id}. Funkcia (1) overí používateľa,
// (2) cez jeho oprávnenia (RLS) načíta nezjednotené produkty – cudzí nič nevidí,
// (3) pošle ich názvy Gemini (iba text, žiadne fotky, obmedzené premýšľanie – je to lacné),
// (4) výsledok odovzdá databázovej funkcii apply_product_normalization, ktorá produkty
// upraví a rovnaké spojí. Spracuje jednu dávku; aplikácia volá znova, kým niečo zostáva.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callGemini, GeminiError, isGlobalError, logUsage, type ThinkingLevel, type Usage } from "../_shared/gemini.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Menšia dávka = kratšia odpoveď AI; funkcia musí skončiť pred limitom Supabase (~150 s).
const BATCH = 20;
const BUDGET_MS = 110_000;
const CATEGORIES: Record<string, string> = {
  produce: "ovocie a zelenina",
  bakery: "pečivo",
  dairy_eggs: "mlieko, mliečne výrobky, syry, vajcia",
  deli_chilled: "údeniny, šunky, salámy, chladené hotové jedlá, nátierky",
  meat_fish: "mäso a ryby",
  frozen: "mrazené",
  pantry: "trvanlivé potraviny (múka, cestoviny, ryža, konzervy, oleje, koreniny)",
  breakfast: "raňajky, káva, čaj, cereálie",
  snacks_sweets: "sladkosti a slané pochutiny",
  beverages: "nealko nápoje a voda",
  alcohol: "alkohol a pivo",
  household_cleaning: "čistiace prostriedky, prací prášok, papierové utierky, vrecká",
  personal_care: "drogéria a kozmetika",
  health: "lieky, vitamíny, zdravotnícke potreby",
  baby: "potreby pre bábätká a deti (plienky, detská výživa, vlhčené obrúsky)",
  pet: "zvieratá",
  clothing: "oblečenie, obuv, spodná bielizeň",
  home: "vybavenie domácnosti, kuchynské potreby, dekorácie, sviečky, nábytok",
  toys_hobby: "hračky, hobby, kreatívne potreby, kancelária",
  electronics: "elektronika a príslušenstvo",
  fuel: "pohonné hmoty (nafta, benzín, LPG)",
  dining: "jedlo a pitie v reštaurácii, bufete, kaviarni",
  fees: "doprava, poštovné, balné, poplatky",
  deposit: "záloha na obaly (fľaše, plechovky)",
  other: "nič z uvedeného",
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    products: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          product_id: { type: "STRING" },
          name: { type: "STRING" },
          brand: { type: "STRING", nullable: true },
          size_value: { type: "NUMBER", nullable: true },
          size_unit: { type: "STRING", nullable: true, enum: ["g", "ml", "ks"] },
          category_id: { type: "STRING", enum: Object.keys(CATEGORIES) },
        },
        required: ["product_id", "name", "category_id"],
      },
    },
  },
  required: ["products"],
};

const prompt = (known: string[], rows: string) => `Zjednocuješ produkty z nákupných bločkov jednej slovenskej domácnosti, aby sa dali porovnávať ceny toho istého produktu v čase a medzi obchodmi.

Pre každý riadok vráť:
- name: čistý všeobecný slovenský názov produktu s dôležitými vlastnosťami, BEZ značky a BEZ veľkosti balenia. Prvé písmeno veľké, bez skratiek bločku (napr. "RAJO MLIEKO POL.1,5% 1L" -> "Mlieko polotučné 1,5 %", "*SK BRAV.BOK B.KOSTI" -> "Bravčový bok bez kosti", "babylove vlh.ut.99%vody" -> "Vlhčené utierky 99 % vody"). Pri nepotravinách krátky zrozumiteľný názov ("Pánska mikina s kapucňou").
- brand: značka, ak je zrejmá (Rajo, Babylove, Milka); inak null. Privátne značky obchodov (Pilos, Clever, K-Classic) sú tiež značky.
- size_value + size_unit: obsah balenia prepočítaný na g, ml alebo ks (1 kg = 1000 g, 1 l = 1000 ml, 0,5l = 500 ml, 42 PC = 42 ks, 4x80 ks = 320 ks, 6x0,5 l = 3000 ml). Ak veľkosť nie je v názve, daj null. Vážený tovar (banány, mäso na váhu) má null.
- category_id: podľa druhu tovaru:
${Object.entries(CATEGORIES).map(([id, d]) => `  ${id} = ${d}`).join("\n")}

Dôležité: ten istý produkt musí dostať PRESNE rovnaký name, brand a veľkosť, aj keď je na bločkoch zapísaný inak alebo je z iného obchodu. Ak riadok zodpovedá niektorému z už známych produktov nižšie, použi presne ten istý názov a značku.
Nevymýšľaj: čo nevieš určiť, daj null.

Už známe produkty domácnosti (názov | značka | balenie):
${known.length > 0 ? known.join("\n") : "(zatiaľ žiadne)"}

Riadky na zjednotenie (product_id | zápis na bločku | ďalšie zápisy | obchod | súčasná kategória):
${rows}`;

// Text bez fotiek – stačí model s obmedzeným premýšľaním. Ďalšie sú záloha pri výpadku.
const MODELS: { model: string; thinking: ThinkingLevel }[] = [
  { model: Deno.env.get("GEMINI_NORMALIZE_MODEL") ?? "gemini-3.8-flash", thinking: "low" },
  { model: "gemini-3.6-flash", thinking: "low" },
  { model: "gemini-3.5-flash-lite", thinking: "minimal" },
];

async function askGemini(
  text: string,
  deadline: number,
  log: (model: string, usage: Usage | null, ok: boolean) => Promise<void>,
): Promise<{ products: Record<string, unknown>[] }> {
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      const remaining = deadline - Date.now();
      if (remaining < 15_000) throw new Error(`GEMINI_TIMEOUT: ${lastError.slice(0, 120)}`);
      try {
        const res = await callGemini({
          model: cfg.model, thinking: cfg.thinking, parts: [{ text }], schema: SCHEMA,
          timeoutMs: Math.min(60_000, remaining - 5_000),
        });
        await log(cfg.model, res.usage, true);
        if (Array.isArray(res.json?.products)) return res.json as { products: Record<string, unknown>[] };
        lastError = "GEMINI_BAD_JSON";
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (e instanceof GeminiError) await log(cfg.model, e.usage, false);
        if (isGlobalError(lastError)) throw new Error(lastError);
        if (!/^GEMINI_(429|5\d\d|EMPTY|BAD_JSON)|TimeoutError/i.test(lastError)) break; // ďalší model
      }
    }
  }
  throw new Error(lastError);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const deadline = Date.now() + BUDGET_MS;

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let householdId: string | undefined;
  try {
    householdId = (await req.json())?.household_id;
  } catch { /* prázdne telo */ }
  if (!householdId || !/^[0-9a-f-]{36}$/i.test(householdId)) return json({ error: "VALIDATION" }, 400);

  // Dva spôsoby volania: (a) po prečítaní dokladu na pozadí (tajný kľúč z databázy),
  // (b) z aplikácie (Prehľady) s prihláseným používateľom – vtedy čítame cez jeho oprávnenia (RLS).
  // deno-lint-ignore no-explicit-any
  let asUser: any;
  const secret = req.headers.get("x-worker-secret");
  if (secret) {
    const ok = await admin.rpc("check_worker_secret", { p_secret: secret });
    if (ok.error || ok.data !== true) return json({ error: "FORBIDDEN" }, 403);
    asUser = admin;
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);
    asUser = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const member = await asUser.from("households").select("id").eq("id", householdId).maybeSingle();
    if (member.error || !member.data) return json({ error: "NOT_FOUND" }, 404);
  }
  const log = (model: string, usage: Usage | null, ok: boolean) =>
    logUsage(admin, { fn: "normalize-products", model, usage, household_id: householdId, ok });

  try {
    const todo = await asUser
      .from("products").select("id, name, category_id")
      .eq("household_id", householdId).is("merged_into", null).eq("normalized", false)
      .order("created_at").limit(BATCH);
    if (todo.error) throw new Error("LOAD_FAILED: " + todo.error.message);
    if (!todo.data || todo.data.length === 0) return json({ processed: 0, remaining: 0 });
    const todoRows = todo.data as { id: string; name: string; category_id: string }[];

    const ids = todoRows.map((p) => p.id);
    const items = await asUser
      .from("receipt_items").select("product_id, raw_name, receipts(store_name)")
      .in("product_id", ids).limit(BATCH * 6);
    const known = await asUser
      .from("products").select("name, brand, size_value, size_unit")
      .eq("household_id", householdId).is("merged_into", null).eq("normalized", true)
      .order("updated_at", { ascending: false }).limit(250);

    const byProduct = new Map<string, { names: Set<string>; stores: Set<string> }>();
    for (const it of (items.data ?? []) as { product_id: string; raw_name: string; receipts: { store_name: string | null } | null }[]) {
      const entry = byProduct.get(it.product_id) ?? { names: new Set(), stores: new Set() };
      entry.names.add(it.raw_name);
      if (it.receipts?.store_name) entry.stores.add(it.receipts.store_name);
      byProduct.set(it.product_id, entry);
    }
    const clean = (s: string) => s.replace(/[|\n]/g, " ").trim();
    const rows = todoRows.map((p) => {
      const e = byProduct.get(p.id);
      const others = [...(e?.names ?? [])].filter((n) => n !== p.name).slice(0, 3).map(clean).join(" ; ");
      const stores = [...(e?.stores ?? [])].slice(0, 2).map(clean).join(", ");
      return `${p.id} | ${clean(p.name)} | ${others || "-"} | ${stores || "-"} | ${p.category_id}`;
    }).join("\n");
    const knownLines = ((known.data ?? []) as { name: string; brand: string | null; size_value: number | null; size_unit: string | null }[]).map((k) =>
      `${clean(k.name)} | ${k.brand ?? "-"} | ${k.size_value ? `${Number(k.size_value)} ${k.size_unit}` : "-"}`
    );

    const result = await askGemini(prompt(knownLines, rows), deadline, log);
    const allowed = new Set(ids);
    const payload = result.products
      .filter((x) => typeof x.product_id === "string" && allowed.has(x.product_id) && typeof x.name === "string")
      .map((x) => ({
        product_id: x.product_id,
        name: String(x.name).slice(0, 200),
        brand: typeof x.brand === "string" && x.brand.trim() ? x.brand.trim().slice(0, 80) : null,
        size_value: typeof x.size_value === "number" && Number.isFinite(x.size_value) && x.size_value > 0 ? x.size_value : null,
        size_unit: ["g", "ml", "ks"].includes(String(x.size_unit)) ? x.size_unit : null,
        category_id: typeof x.category_id === "string" ? x.category_id : null,
      }));
    // Produkty, ktoré model vynechal, označíme ako spracované s pôvodným názvom –
    // inak by sa dávka opakovala donekonečna.
    const returned = new Set(payload.map((p) => p.product_id));
    for (const p of todoRows) {
      if (!returned.has(p.id)) payload.push({ product_id: p.id, name: p.name, brand: null, size_value: null, size_unit: null, category_id: p.category_id });
    }

    const applied = await admin.rpc("apply_product_normalization", { p_household_id: householdId, p_items: payload });
    if (applied.error) throw new Error("SAVE_FAILED: " + applied.error.message);

    const left = await asUser
      .from("products").select("id", { count: "exact", head: true })
      .eq("household_id", householdId).is("merged_into", null).eq("normalized", false);
    return json({ processed: applied.data ?? 0, remaining: left.count ?? 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("normalize-products", householdId, message);
    return json({ error: "NORMALIZE_FAILED", detail: message.slice(0, 300) }, 502);
  }
});
