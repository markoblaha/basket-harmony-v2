// Prečíta bankový výpis (PDF, snímka obrazovky alebo CSV z internet bankingu) a vráti
// zoznam pohybov: dátum, suma, obchodník, druh platby a navrhovaná kategória.
//
// Súkromie: výpis sa NIKDE neukladá. Funkcia ho len pošle Gemini a vráti aplikácii
// zoznam platieb; čísla účtov ani zostatky sa nevracajú. Do databázy sa uloží iba to,
// čo človek v aplikácii potvrdí (cez import_bank_payments).
import { createClient } from "npm:@supabase/supabase-js@2";
import { callGemini, GeminiError, isGlobalError, logUsage, type ThinkingLevel, type Usage } from "../_shared/gemini.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_BYTES = 12 * 1024 * 1024;
const KINDS = ["purchase", "bill", "transfer", "cash", "income", "fee", "other"];
const CATEGORIES: Record<string, string> = {
  groceries: "nákup v supermarkete / potravinách (Lidl, Kaufland, Tesco, Billa, Coop...)",
  dining: "reštaurácia, bufet, kaviareň, rozvoz jedla",
  alcohol: "obchod s alkoholom",
  personal_care: "drogéria (dm, Teta, Rossmann)",
  health: "lekáreň, lekár, zdravie (Dr.Max, Benu)",
  baby: "potreby pre deti",
  household_cleaning: "domácnosť, čistiace potreby",
  home: "nábytok, vybavenie domu, hobby market (IKEA, Hornbach, Pepco, Tedi)",
  clothing: "oblečenie a obuv (KiK, Reserved, Zara, Deichmann)",
  electronics: "elektronika (Alza, Datart, Nay)",
  toys_hobby: "hračky, hobby, kníhkupectvo",
  fuel: "čerpacia stanica (Slovnaft, OMV, Shell, MOL)",
  transport: "parkovanie, diaľničná známka, MHD, vlak, servis a umývanie auta",
  leisure: "vstupenky, kino, šport, voľný čas, dovolenka",
  housing: "nájom, hypotéka, elektrina, plyn, voda, správca bytu",
  telecom: "mobil, internet, TV, streaming a predplatné (Netflix, Spotify)",
  insurance: "poistenie, bankové a finančné služby",
  fees: "poplatky, poštovné",
  pet: "zvieratá",
  other: "nič z uvedeného",
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_statement: { type: "BOOLEAN" },
    currency: { type: "STRING", nullable: true },
    transactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          amount: { type: "NUMBER" },
          direction: { type: "STRING", enum: ["out", "in"] },
          merchant: { type: "STRING" },
          description: { type: "STRING", nullable: true },
          kind: { type: "STRING", enum: KINDS },
          category_id: { type: "STRING", enum: Object.keys(CATEGORIES) },
        },
        required: ["date", "amount", "direction", "merchant", "kind", "category_id"],
      },
    },
  },
  required: ["is_statement", "transactions"],
};

const prompt = (today: string) => `Si presný čítač bankových výpisov slovenskej domácnosti. Dnes je ${today}.
Z výpisu (PDF, snímka obrazovky alebo CSV z internet bankingu) vypíš KAŽDÝ pohyb na účte ako jednu transakciu. Nič nevynechaj a nič nevymýšľaj.

Pre každú transakciu:
- date: dátum transakcie YYYY-MM-DD. Ak je uvedený dátum platby kartou aj dátum zúčtovania, použi dátum platby kartou (deň nákupu). Slovenský zápis je deň.mesiac.rok.
- amount: suma ako kladné číslo (bez znamienka), presne podľa výpisu.
- direction: "out" = peniaze odišli z účtu (platba, výber, poplatok), "in" = prišli na účet (výplata, vrátenie, prevod na účet).
- merchant: krátky čitateľný názov obchodníka alebo príjemcu bez čísel karty, miest a kódov (napr. "LIDL DAKUJEME ZA NAKUP 1234 BRATISLAVA" -> "Lidl", "SLOVNAFT 9123" -> "Slovnaft", "NETFLIX.COM" -> "Netflix"). Pri prevode meno príjemcu alebo účel.
- description: pôvodný text pohybu skrátený na najviac 80 znakov (bez čísla účtu a karty).
- kind: purchase = platba kartou alebo online v obchode, e-shope, na pumpe, v reštaurácii; bill = pravidelná platba za služby (nájom, hypotéka, energie, mobil, internet, poistenie, predplatné, trvalý príkaz firme); transfer = prevod medzi osobami alebo vlastnými účtami, sporenie; cash = výber z bankomatu; income = príjem; fee = poplatok banky; other = nič z toho.
- category_id: podľa obchodníka alebo účelu:
${Object.entries(CATEGORIES).map(([id, d]) => `  ${id} = ${d}`).join("\n")}

Nevypisuj čísla účtov, IBAN, zostatky ani čísla kariet.
is_statement = false, ak to nie je bankový výpis ani zoznam pohybov na účte (vtedy transactions prázdne).`;

const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic" };

// Výpis je dlhý prepis riadkov – stačí obmedzené premýšľanie (to sa platí ako výstup).
const MODELS: { model: string; thinking: ThinkingLevel }[] = [
  { model: Deno.env.get("GEMINI_STATEMENT_MODEL") ?? "gemini-3.8-flash", thinking: "low" },
  { model: "gemini-3.6-flash", thinking: "low" },
];

async function askGemini(
  parts: unknown[],
  log: (model: string, usage: Usage | null, ok: boolean) => Promise<void>,
): Promise<Record<string, unknown>> {
  let lastError = "GEMINI_UNKNOWN";
  for (const cfg of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await callGemini({
          model: cfg.model, thinking: cfg.thinking, parts, schema: SCHEMA, maxOutputTokens: 32768, timeoutMs: 110_000,
        });
        await log(cfg.model, res.usage, true);
        return res.json;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (e instanceof GeminiError) await log(cfg.model, e.usage, false);
        if (isGlobalError(lastError)) throw new Error(lastError);
        if (!/^GEMINI_(429|5\d\d|EMPTY|BAD_JSON)|TimeoutError/i.test(lastError)) break;
      }
    }
  }
  throw new Error(lastError);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

  let body: { household_id?: string; file_b64?: string; ext?: string; text?: string } = {};
  try {
    body = await req.json();
  } catch { /* prázdne telo */ }
  const householdId = body.household_id;
  if (!householdId || !/^[0-9a-f-]{36}$/i.test(householdId)) return json({ error: "VALIDATION" }, 400);

  const asUser = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const member = await asUser.from("households").select("id").eq("id", householdId).maybeSingle();
  if (member.error || !member.data) return json({ error: "NOT_FOUND" }, 404);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const parts: unknown[] = [{ text: prompt(today) }];
    if (typeof body.text === "string" && body.text.trim()) {
      // CSV alebo iný textový export: pošleme ho ako text.
      if (body.text.length > MAX_BYTES) return json({ error: "FILES_TOO_LARGE" }, 413);
      parts.push({ text: `Obsah výpisu:\n${body.text}` });
    } else if (typeof body.file_b64 === "string" && body.file_b64) {
      if (body.file_b64.length * 0.75 > MAX_BYTES) return json({ error: "FILES_TOO_LARGE" }, 413);
      const mime = MIME[(body.ext ?? "").toLowerCase()] ?? "application/pdf";
      parts.push({ inline_data: { mime_type: mime, data: body.file_b64 } });
    } else {
      return json({ error: "VALIDATION" }, 400);
    }

    const result = await askGemini(parts, (model, usage, ok) =>
      logUsage(admin, { fn: "read-statement", model, usage, household_id: householdId, ok }));
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.abs(Math.round(v * 100) / 100) : null);
    const date = (v: unknown) => {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
      const d = new Date(v + "T00:00:00Z");
      return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
    };
    const rows = (Array.isArray(result.transactions) ? result.transactions : [])
      .map((t: Record<string, unknown>, idx: number) => ({
        idx,
        date: date(t.date),
        amount: num(t.amount),
        direction: t.direction === "in" ? "in" : "out",
        merchant: typeof t.merchant === "string" ? t.merchant.trim().slice(0, 120) : "",
        description: typeof t.description === "string" ? t.description.replace(/\b[A-Z]{2}\d{2}[0-9A-Z ]{10,}\b/g, "").slice(0, 80) : null,
        kind: KINDS.includes(String(t.kind)) ? t.kind : "other",
        category_id: typeof t.category_id === "string" && t.category_id in CATEGORIES ? t.category_id : "other",
      }))
      .filter((t) => t.date && t.amount && t.merchant);
    return json({ is_statement: result.is_statement !== false, currency: result.currency ?? "EUR", transactions: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("read-statement", message);
    return json({ error: "READ_FAILED", detail: message.slice(0, 300) }, 502);
  }
});
