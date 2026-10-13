// Rozbor nadiktovanej vety pre hlasový nákupný zoznam.
//
// Tok: aplikácia pošle {text, items, target}. Funkcia (1) overí prihláseného
// používateľa, (2) pošle vetu a aktuálne položky Gemini (iba krátky text – lacné
// a rýchle), (3) vráti zoznam operácií: pridať / zmeniť / zmazať / hotovo.
// Nič neukladá – ukladá až aplikácia po „Hotovo“ cez add_item (pravidlá ostávajú
// v databáze). Keď funkcia zlyhá, aplikácia použije lokálny rozbor (parse.ts).
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

const prompt = (text: string, items: string, target: string | null) => `Spracúvaš hlasom nadiktovaný nákupný zoznam slovenskej domácnosti.
Dostaneš prepis jednej vety z rozpoznávania reči (môže obsahovať chyby rozpoznania) a položky, ktoré už sú v zozname.
Vráť operácie (ops) v poradí, ako ich človek povedal.

Pravidlá:
- add: nová položka. name = prirodzený názov na nákupný zoznam v 1. páde, prvé písmeno veľké, bez množstva
  ("tri nugátové šišky" -> name "Nugátová šiška", quantity 3, unit "ks"; "pol kila múky" -> "Múka", 0.5, "kg";
  "dvadsaťpäť deka šunky" -> "Šunka", 25, "dkg"; "hovädzie dvesto päťdesiat gramov" -> "Hovädzie mäso", 250, "g";
  "banány" -> "Banány", quantity null, unit null). Jednotky iba: ${UNITS.join(", ")}. Počet kusov = "ks".
- category_id podľa druhu tovaru: ${CATEGORIES.join(", ")}.
- status "needs_qty": tovar sa bežne kupuje na váhu (mäso, ryby, syr alebo šunka z pultu, údeniny na váhu) a množstvo NEZAZNELO.
- status "unclear": slovo zjavne nie je nákupná položka alebo je asi zle rozpoznané (napr. "tráva"); do suggestions daj 2–3
  podobne znejúce bežné produkty v 1. páde. Inak status "ok" a suggestions [].
- change: zmena položky, ktorá už je v zozname ("ešte jedny banány" -> target "Banány", delta 1; "banánov daj tri" -> target "Banány", quantity 3, unit "ks").
  Keď je produkt už v zozname a človek ho povie znova, je to change s delta (nie druhý add).
- remove: "zmaž/vymaž/odstráň X" -> target = presný názov položky zo zoznamu.
- done: "hotovo", "to je všetko", "koniec".
- target vždy presne ako je napísaný v zozname nižšie.
${target ? `\nPoužívateľ práve upravuje položku "${target}". Veta sa týka iba jej: vráť jednu operáciu change s target "${target}" (množstvo, jednotka alebo nový názov v name).\n` : ""}
Položky v zozname (názov | množstvo):
${items || "(zatiaľ prázdny)"}

Veta: "${text}"`;

async function askGemini(text: string): Promise<{ ops: Record<string, unknown>[] }> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const models = [...new Set([Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash", "gemini-3.6-flash"])];
  let lastError = "GEMINI_UNKNOWN";
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
          },
        }),
        // Hlasové zadávanie musí byť svižné; aplikácia po ~7 s aj tak použije zálohu.
        signal: AbortSignal.timeout(6_500),
      });
    } catch (e) {
      lastError = `GEMINI_NETWORK: ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      try {
        const parsed = JSON.parse(out ?? "");
        if (Array.isArray(parsed?.ops)) return parsed;
      } catch { /* skúsi ďalší model */ }
      lastError = "GEMINI_BAD_JSON";
      continue;
    }
    lastError = `GEMINI_${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (/^GEMINI_(401|402|403)/.test(lastError)) throw new Error(lastError);
  }
  throw new Error(lastError);
}

const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100_000 ? v : null);

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

  let body: { text?: unknown; items?: unknown; target?: unknown } = {};
  try {
    body = await req.json();
  } catch { /* prázdne telo */ }
  const text = str(body.text, 400);
  if (!text) return json({ error: "VALIDATION" }, 400);
  const target = str(body.target);
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 80)
    .map((i) => (i && typeof i === "object" ? (i as { name?: unknown; qty?: unknown }) : {}))
    .map((i) => `${str(i.name)?.replace(/[|\n"]/g, " ") ?? ""} | ${str(i.qty, 20) ?? "-"}`)
    .filter((l) => !l.startsWith(" |"))
    .join("\n");

  try {
    const result = await askGemini(prompt(text.replace(/"/g, "'"), items, target));
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
    return json({ ops });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("parse-voice", message);
    return json({ error: "PARSE_FAILED", detail: message.slice(0, 200) }, 502);
  }
});
