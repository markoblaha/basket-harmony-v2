// Prečíta nákupný doklad (fotka, snímka obrazovky alebo PDF) cez Gemini – NA POZADÍ.
//
// Tok: aplikácia nahrá súbory a zavolá v databáze queue_receipt. Databáza pošle sem
// požiadavku s tajným kľúčom (x-worker-secret). Funkcia si doklad „zoberie“
// (claim_receipt – nikdy sa nečíta dvakrát naraz), HNEĎ odpovie a číta na pozadí.
// Aplikácia na nič nečaká; výsledok sa v nej objaví sám (živá synchronizácia).
// Zaseknuté doklady dobehne plánovač v databáze (dispatch_stuck_receipts).
//
// Lacno a presne:
//  1. čítanie s obmedzeným „premýšľaním“ (to sa platí ako výstup a bolo hlavnou cenou),
//  2. databáza (save_receipt_extraction) skontroluje súčet, dátum, položky,
//  3. iba keď niečo nesedí, prečíta doklad silnejší model s informáciou, čo bolo zle.
// Každé volanie AI sa zapíše do ai_usage (tokeny + cena).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { GeminiError, isGlobalError, logUsage } from "../_shared/gemini.ts";
import {
  compact,
  MIME,
  problemText,
  readReceipt,
  sanitize,
  type Extraction,
  type Page,
  type ReadConfig,
  type Saved,
} from "../_shared/receipt.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Prvé čítanie. Namerané 20. 10. 2026 na 20 overených dokladoch domácnosti:
//   3.8 Flash + premýšľanie „low“: súčet 20/20, položky 19/20, ~0,38 centa, ~6 s  <- používame
//   3.5 Flash-Lite „minimal“:      súčet 20/20, položky 16/20 (zľavy ako položky, chýbajúci obchod), ~0,28 centa
//   3.1 Flash-Lite „minimal“:      súčet 18/20, ~0,17 centa
//   pôvodné nastavenie (3.8 Flash bez obmedzenia, vysoké rozlíšenie): ~0,96 centa, ~13 s (+ drahé Pro pri chybe)
// Ďalšie modely v zozname sú záloha pri výpadku.
const FIRST: ReadConfig[] = [
  { model: Deno.env.get("GEMINI_RECEIPT_MODEL") ?? "gemini-3.8-flash", thinking: "low" },
  { model: "gemini-3.6-flash", thinking: "low" },
  { model: "gemini-3.5-flash-lite", thinking: "minimal" },
];
// Druhé čítanie, len keď databáza výsledok neprijme: viac premýšľania a vyššie rozlíšenie (zriedkavé).
const STRONG: ReadConfig[] = [
  { model: "gemini-3.8-flash", thinking: "medium", mediaResolution: "MEDIA_RESOLUTION_HIGH" },
  { model: "gemini-3.6-flash", thinking: "medium", mediaResolution: "MEDIA_RESOLUTION_HIGH" },
];

/** Všetko musí skončiť skôr, než Supabase ukončí funkciu (bezplatný plán: 150 s). */
const TOTAL_BUDGET_MS = 130_000;
/** Gemini prijme v jednej požiadavke najviac ~20 MB (base64 je o tretinu väčšie). */
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
const SECOND_PASS_MIN_MS = 35_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Ctx = { admin: SupabaseClient; receiptId: string; householdId: string; deadline: number; today: string };

/** Jedno čítanie: skúša modely v poradí; dočasné chyby (preťaženie) raz zopakuje. */
async function read(ctx: Ctx, pages: Page[], configs: ReadConfig[], hint?: string): Promise<Extraction> {
  let last: Error = new Error("GEMINI_UNKNOWN");
  for (const cfg of configs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = ctx.deadline - Date.now();
      if (left < 10_000) throw new Error(`GEMINI_TIMEOUT: ${last.message.slice(0, 120)}`);
      if (attempt > 0) await sleep(2000);
      try {
        const res = await readReceipt(pages, cfg, ctx.today, Math.min(75_000, left - 5_000), hint);
        await logUsage(ctx.admin, { fn: "extract-receipt", model: cfg.model, usage: res.usage, household_id: ctx.householdId, receipt_id: ctx.receiptId });
        return res.json;
      } catch (e) {
        last = e instanceof Error ? e : new Error(String(e));
        if (e instanceof GeminiError) {
          // Aj pokazená odpoveď sa platí – zapíšeme ju.
          await logUsage(ctx.admin, { fn: "extract-receipt", model: cfg.model, usage: e.usage, household_id: ctx.householdId, receipt_id: ctx.receiptId, ok: false });
        }
        console.error("extract-receipt", cfg.model, last.message.slice(0, 200));
        if (isGlobalError(last.message)) throw last;
        const transient = /^GEMINI_(429|5\d\d|EMPTY|BAD_JSON)|TimeoutError|network/i.test(last.message);
        if (!transient) break; // ďalší model
      }
    }
  }
  throw last;
}

/** Čím menší rozdiel medzi súčtom položiek a celkovou sumou, tým lepšie čítanie. */
const gap = (s: Saved) => (s.total == null ? Infinity : Math.abs(Number(s.items_sum) - Number(s.total)));
const isBetter = (a: Saved, b: Saved) =>
  (a.status === "OK") !== (b.status === "OK") ? a.status === "OK" : gap(a) <= gap(b);

async function loadPages(admin: SupabaseClient, receiptId: string, firstPath: string): Promise<Page[]> {
  const { data: rows } = await admin.from("receipt_pages").select("image_path").eq("receipt_id", receiptId).order("position");
  const paths = rows && rows.length > 0 ? rows.map((r: { image_path: string }) => r.image_path) : [firstPath];
  const pages: Page[] = [];
  let totalBytes = 0;
  for (const [i, path] of paths.entries()) {
    const file = await admin.storage.from("receipts").download(path);
    if (file.error || !file.data) {
      // Prvá strana je povinná; chýbajúcu ďalšiu (prerušené nahrávanie) preskočíme.
      if (i > 0) continue;
      throw new Error("IMAGE_MISSING: " + (file.error?.message ?? path));
    }
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("FILES_TOO_LARGE");
    const ext = path.split(".").pop()?.toLowerCase() ?? "jpg";
    pages.push({ b64: encodeBase64(bytes), mime: MIME[ext] ?? "image/jpeg" });
  }
  return pages;
}

/** Celé spracovanie jedného dokladu (beží na pozadí po odpovedi). */
async function process(admin: SupabaseClient, receiptId: string, started: number) {
  const { data: receipt } = await admin.from("receipts").select("id, image_path, household_id").eq("id", receiptId).maybeSingle();
  if (!receipt) return;
  const ctx: Ctx = {
    admin, receiptId, householdId: receipt.household_id,
    deadline: started + TOTAL_BUDGET_MS, today: new Date().toISOString().slice(0, 10),
  };
  const timeLeft = () => ctx.deadline - Date.now();
  const save = async (payload: Extraction): Promise<Saved> => {
    const r = await admin.rpc("save_receipt_extraction", { p_receipt_id: receiptId, p_payload: sanitize(payload) });
    if (r.error) throw new Error("SAVE_FAILED: " + r.error.message);
    return r.data as Saved;
  };

  try {
    const pages = await loadPages(admin, receiptId, receipt.image_path);

    let first = await read(ctx, pages, FIRST);
    // „Nie je to doklad“ overí silnejší model, aby sa nezahodil skutočný doklad.
    if (first.is_receipt === false && timeLeft() > SECOND_PASS_MIN_MS) {
      try {
        first = await read(ctx, pages, STRONG,
          "Prvé čítanie tvrdí, že na obrázku nie je nákupný doklad. Over to: ak je tam akýkoľvek doklad s cenami (aj faktúra, potvrdenie objednávky, snímka obrazovky), prečítaj ho. Ak naozaj nie, nechaj is_receipt = false.");
      } catch (e) {
        if (isGlobalError(e instanceof Error ? e.message : String(e))) throw e;
      }
    }
    if (first.is_receipt === false) throw new Error("NOT_A_RECEIPT");

    let saved = await save(first);

    // Doklad iba s celkovou sumou a názvami bez cien (prehľad objednávky) druhé čítanie nezlepší.
    const pricelessOnly = saved.review_reason === "NO_ITEMS" && saved.total != null &&
      (Array.isArray(first.items) ? first.items : []).some((it: Record<string, unknown>) => it && it.line_total == null);
    const problem = saved.status === "OK" || pricelessOnly ? null : problemText(saved);
    if (problem && timeLeft() > SECOND_PASS_MIN_MS) {
      try {
        const second = await read(ctx, pages, STRONG,
          `Prvé čítanie tohto dokladu je podozrivé: ${problem}. Prečítaj doklad znovu od začiatku, riadok po riadku, a oprav chyby: chýbajúce alebo zdvojené riadky, zle prečítané ceny a množstvá, zľavy, celkovú sumu, dátum. Prvé čítanie (môže byť chybné; názov | množstvo | suma):\n${compact(first)}`);
        if (second.is_receipt !== false) {
          const saved2 = await save(second);
          if (isBetter(saved2, saved)) saved = saved2;
          else saved = await save(first);
        }
      } catch (e) {
        // Druhé čítanie je bonus – prvý výsledok je uložený.
        console.error("extract-receipt second pass", receiptId, e instanceof Error ? e.message : String(e));
      }
    }

    // Nové produkty zjednotíme (samostatná funkcia, tiež na pozadí).
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/normalize-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-secret": await workerSecret(admin) },
      body: JSON.stringify({ household_id: receipt.household_id }),
      signal: AbortSignal.timeout(5_000),
    }).then((r) => r.body?.cancel()).catch(() => {/* zjednotenie dobehne aj z Prehľadov */});
    console.log("extract-receipt done", receiptId, saved.status, Date.now() - started, "ms");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("extract-receipt", receiptId, message);
    await admin.rpc("fail_receipt", { p_receipt_id: receiptId, p_error: message });
  }
}

let cachedSecret: string | null = null;
/** Tajný kľúč si funkcia vypýta od databázy (je v trezore), ten istý posiela ďalej. */
async function workerSecret(admin: SupabaseClient): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const { data } = await admin.rpc("worker_secret");
  cachedSecret = typeof data === "string" ? data : "";
  return cachedSecret;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const started = Date.now();
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let receiptId: string | undefined;
  try {
    receiptId = (await req.json())?.receipt_id;
  } catch { /* prázdne telo */ }
  if (!receiptId || !/^[0-9a-f-]{36}$/i.test(receiptId)) return json({ error: "VALIDATION" }, 400);

  // 1) Volanie z databázy (fronta).
  const secret = req.headers.get("x-worker-secret");
  if (secret) {
    const ok = await admin.rpc("check_worker_secret", { p_secret: secret });
    if (ok.error || ok.data !== true) return json({ error: "FORBIDDEN" }, 403);
    const claim = await admin.rpc("claim_receipt", { p_receipt_id: receiptId });
    if (claim.error) return json({ error: "CLAIM_FAILED" }, 500);
    if (claim.data !== true) return json({ status: "SKIPPED" }); // už sa číta alebo je hotový
    const task = process(admin, receiptId, started);
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(task);
      return json({ status: "ACCEPTED" }, 202);
    }
    await task;
    return json({ status: "DONE" });
  }

  // 2) Staršia verzia aplikácie volá funkciu priamo: len doklad zaradíme do fronty.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const q = await asUser.rpc("queue_receipt", { p_receipt_id: receiptId });
  if (q.error) return json({ error: q.error.message }, q.error.message === "NOT_FOUND" ? 404 : 400);
  return json({ status: "QUEUED" });
});
