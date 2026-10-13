// Prečíta fotku bločku cez Gemini a výsledok uloží do databázy.
//
// Tok: aplikácia nahrá fotku do súkromného úložiska a zavolá túto funkciu s
// {receipt_id}. Funkcia (1) overí prihláseného používateľa a že bloček vidí
// (to rozhoduje RLS v databáze), (2) stiahne fotku, (3) pošle ju Gemini,
// (4) výsledok odovzdá databázovej funkcii save_receipt_extraction, ktorá
// skontroluje súčet, dátum a duplicity. Kľúč GEMINI_API_KEY je iba tu, na serveri.
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
  "snacks_sweets", "beverages", "alcohol", "household_cleaning", "personal_care", "baby", "pet", "other",
];

const PROMPT = `Si presný čítač slovenských pokladničných bločkov. Z fotky vytiahni údaje a vráť ich ako JSON podľa schémy.

Pravidlá:
- store_name: iba značka obchodu (napr. "Lidl", "Tesco", "Billa", "Kaufland", "Coop Jednota", "dm", "Metro"), nie celá adresa ani názov s.r.o.
- purchased_on: dátum nákupu vo formáte YYYY-MM-DD. Bločky sú zo súčasnosti (roky 2025–2026). Ak dátum nevidno celý alebo si nie si istý rokom, daj null – radšej null ako tipovať.
- purchased_time: čas HH:MM, ak je na bločku.
- total: konečná suma na zaplatenie presne tak, ako je vytlačená na bločku (Spolu, Celkom, K úhrade). Nepočítaj ju zo súčtu položiek – prepíš ju z bločku.
- items: každý nakúpený riadok v poradí z bločku. name presne podľa bločku (bez vymýšľania). quantity a unit: pri kusoch quantity = počet a unit "ks"; pri vážených veciach quantity = hmotnosť a unit "kg". unit_price = cena za jednotku. line_total = suma, ktorú si za riadok naozaj zaplatil PO zľave.
- Riadky so zľavou (Zľava, Akcia, Kupón) pripoj k položke, ktorej patria: zníž jej line_total a do discount daj kladnú sumu zľavy. Ak zľava patrí celému nákupu, nepridávaj ju ako položku, len ju sčítaj do discount_total.
- Záloha na obaly: samostatná položka "Záloha na obal" (category_id other). Vrátená záloha je položka so zápornou sumou.
- category_id vyber z povolených hodnôt podľa druhu tovaru.
- Ak obrázok nie je pokladničný bloček, daj is_receipt = false a items prázdne.
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
          line_total: { type: "NUMBER" },
          discount: { type: "NUMBER", nullable: true },
          category_id: { type: "STRING", enum: CATEGORIES },
        },
        required: ["name", "line_total", "category_id"],
      },
    },
  },
  required: ["is_receipt", "items"],
};

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };

async function askGemini(imageB64: string, mime: string): Promise<Record<string, unknown>> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: imageB64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) throw new Error("GEMINI_EMPTY: " + JSON.stringify(data).slice(0, 300));
      return JSON.parse(text);
    }
    lastError = `GEMINI_${res.status}: ${(await res.text()).slice(0, 300)}`;
    // Opakujeme len pri preťažení / limite; ostatné chyby sú trvalé.
    if (res.status !== 429 && res.status < 500) break;
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

  let receiptId: string | undefined;
  try {
    receiptId = (await req.json())?.receipt_id;
  } catch { /* prázdne telo */ }
  if (!receiptId || !/^[0-9a-f-]{36}$/i.test(receiptId)) return json({ error: "VALIDATION" }, 400);

  // Bloček musí vidieť sám používateľ (RLS = je člen domácnosti).
  const asUser = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: receipt, error: receiptError } = await asUser
    .from("receipts").select("id, image_path").eq("id", receiptId).maybeSingle();
  if (receiptError || !receipt) return json({ error: "NOT_FOUND" }, 404);

  try {
    await admin.from("receipts").update({ status: "PROCESSING", review_reason: null, error_text: null }).eq("id", receiptId);

    const file = await admin.storage.from("receipts").download(receipt.image_path);
    if (file.error || !file.data) throw new Error("IMAGE_MISSING: " + (file.error?.message ?? ""));
    const ext = receipt.image_path.split(".").pop()?.toLowerCase() ?? "jpg";
    const bytes = new Uint8Array(await file.data.arrayBuffer());

    const result = await askGemini(encodeBase64(bytes), MIME[ext] ?? "image/jpeg");
    if (result.is_receipt === false) throw new Error("NOT_A_RECEIPT");

    const saved = await admin.rpc("save_receipt_extraction", { p_receipt_id: receiptId, p_payload: result });
    if (saved.error) throw new Error("SAVE_FAILED: " + saved.error.message);
    return json({ status: saved.data?.status, review_reason: saved.data?.review_reason });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("extract-receipt", receiptId, message);
    await admin.rpc("fail_receipt", { p_receipt_id: receiptId, p_error: message });
    return json({ error: "EXTRACTION_FAILED", detail: message }, 502);
  }
});
