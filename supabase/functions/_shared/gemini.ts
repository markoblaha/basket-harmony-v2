// Spoločné volanie Gemini pre všetky funkcie: jedna požiadavka, štruktúrovaný JSON,
// počty tokenov a cena. Každé volanie sa zapíše do tabuľky ai_usage, aby bolo vidno,
// koľko stojí doklad, hlasový príkaz či domácnosť za mesiac.
//
// Cena = vstupné tokeny × cena vstupu + (výstup + „premýšľanie“) × cena výstupu.
// Premýšľanie sa účtuje ako výstup – preto ho všade obmedzujeme (thinkingLevel).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** USD za 1 milión tokenov (štandardná cena, aistudio.google.com/docs/pricing, overené 3. 11. 2026). */
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
};
/** Ohlásené zmeny cien: od dátumu (UTC) platí nová cena. Google: 3.6 a 3.8 Flash od 1. 1. 2027 dvojnásobok. */
const PRICE_CHANGES: Record<string, { from: string; input: number; output: number }[]> = {
  "gemini-3.6-flash": [{ from: "2027-01-01", input: 1.5, output: 7.5 }],
  "gemini-3.8-flash": [{ from: "2027-01-01", input: 1.5, output: 7.5 }],
};

/** Cena modelu v daný deň (predvolene dnes). Neznámy model = cena Flash, aby náklady neboli podhodnotené. */
export function priceFor(model: string, at: Date = new Date()): { input: number; output: number } {
  const day = at.toISOString().slice(0, 10);
  const later = (PRICE_CHANGES[model] ?? []).filter((c) => c.from <= day).sort((a, b) => (a.from < b.from ? 1 : -1))[0];
  return later ?? PRICES[model] ?? (day >= "2027-01-01" ? { input: 1.5, output: 7.5 } : { input: 0.75, output: 3.75 });
}

export type Usage = { input: number; output: number; thinking: number };
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export type GeminiCall = {
  model: string;
  parts: unknown[];
  schema: unknown;
  thinking?: ThinkingLevel;
  mediaResolution?: "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH";
  maxOutputTokens?: number;
  /** Predvolene 0 (presné čítanie); recepty chcú trochu nápaditosti. */
  temperature?: number;
  timeoutMs: number;
};

export type GeminiResult = { json: Record<string, unknown>; usage: Usage; model: string };

export function costUsd(model: string, u: Usage, at: Date = new Date()): number {
  const p = priceFor(model, at);
  return (u.input * p.input + (u.output + u.thinking) * p.output) / 1_000_000;
}

/** Chyby, pri ktorých nemá zmysel skúšať ďalší model (kredit, kľúč, oprávnenie). */
export const isGlobalError = (message: string) => /^(GEMINI_(401|402|403)|GEMINI_API_KEY_MISSING)/.test(message);

/** Chyba s počtom tokenov – aj neúspešné volanie (pokazený JSON) sa platí a zapíše. */
export class GeminiError extends Error {
  constructor(message: string, public usage: Usage | null = null, public model = "") {
    super(message);
  }
}

/** Jedna požiadavka na Gemini. Vráti JSON podľa schémy a spotrebu tokenov. */
export async function callGemini(c: GeminiCall): Promise<GeminiResult> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new GeminiError("GEMINI_API_KEY_MISSING");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: c.parts }],
      generationConfig: {
        temperature: c.temperature ?? 0,
        responseMimeType: "application/json",
        responseSchema: c.schema,
        ...(c.thinking ? { thinkingConfig: { thinkingLevel: c.thinking } } : {}),
        ...(c.mediaResolution ? { mediaResolution: c.mediaResolution } : {}),
        ...(c.maxOutputTokens ? { maxOutputTokens: c.maxOutputTokens } : {}),
      },
    }),
    signal: AbortSignal.timeout(c.timeoutMs),
  });
  if (!res.ok) throw new GeminiError(`GEMINI_${res.status}: ${(await res.text()).slice(0, 300)}`, null, c.model);
  const data = await res.json();
  const m = data?.usageMetadata ?? {};
  const usage: Usage = {
    input: m.promptTokenCount ?? 0,
    output: m.candidatesTokenCount ?? 0,
    thinking: m.thoughtsTokenCount ?? 0,
  };
  const candidate = data?.candidates?.[0];
  const out = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!out) {
    throw new GeminiError(
      `GEMINI_EMPTY: ${candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "bez dôvodu"}`,
      usage,
      c.model,
    );
  }
  try {
    return { json: JSON.parse(out), usage, model: c.model };
  } catch {
    throw new GeminiError(`GEMINI_BAD_JSON: ${candidate?.finishReason ?? "?"}`, usage, c.model);
  }
}

/** Zapíše spotrebu do ai_usage. Chyba zápisu nikdy nezhodí samotnú funkciu. */
export async function logUsage(
  admin: SupabaseClient,
  row: { fn: string; model: string; usage: Usage | null; household_id?: string | null; receipt_id?: string | null; ok?: boolean },
): Promise<void> {
  if (!row.usage) return;
  try {
    const { error } = await admin.from("ai_usage").insert({
      fn: row.fn,
      model: row.model,
      household_id: row.household_id ?? null,
      receipt_id: row.receipt_id ?? null,
      input_tokens: row.usage.input,
      output_tokens: row.usage.output,
      thinking_tokens: row.usage.thinking,
      cost_usd: costUsd(row.model, row.usage),
      ok: row.ok ?? true,
    });
    if (error) console.error("ai_usage", error);
  } catch (e) {
    console.error("ai_usage", String(e));
  }
}
