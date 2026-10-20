// Čítanie nákupného dokladu (prompt, schéma, kontrola výsledku) – spoločné pre
// extract-receipt a meranie presnosti modelov.
import { callGemini, GeminiError, type GeminiResult, type ThinkingLevel } from "./gemini.ts";

export const CATEGORIES = [
  "produce", "bakery", "dairy_eggs", "deli_chilled", "meat_fish", "frozen", "pantry", "breakfast",
  "snacks_sweets", "beverages", "alcohol", "household_cleaning", "personal_care", "health", "baby", "pet",
  "clothing", "home", "toys_hobby", "electronics", "fuel", "transport", "dining", "leisure", "fees", "deposit", "other",
];

export const pageNote = (pages: number) =>
  pages > 1
    ? `\n\nTento doklad má ${pages} strán (fotiek alebo snímok obrazovky) v poradí, v akom nasledujú. Je to JEDEN doklad: spoj všetky strany do jedného výsledku. Hlavička (obchod, dátum) je zvyčajne na prvej strane, celková suma na poslednej. Ak sa riadky na konci jednej strany opakujú na začiatku ďalšej (fotky sa prekrývajú), započítaj ich iba raz.`
    : "";

export const promptFor = (today: string, pages = 1) => `Si presný čítač nákupných dokladov: pokladničné bločky, e-shopové faktúry, potvrdenia objednávok (fotka, snímka obrazovky alebo PDF). Z dokladu vytiahni údaje a vráť ich ako JSON podľa schémy. Dnes je ${today}.${pageNote(pages)}

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
- total sa má rovnať súčtu line_total všetkých položiek. Ak nesedí, skontroluj na doklade riadky, ktoré si mohol vynechať alebo zle prečítať. Nič nedopočítavaj.
Vymýšľať údaje je zakázané: čo nevidíš, daj null.`;

export const SCHEMA = {
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

export const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

export type Extraction = Record<string, unknown>;
/** Jedna strana dokladu: súbor v base64 a jeho typ. Doklad môže mať viac strán. */
export type Page = { b64: string; mime: string };
export type Saved = {
  status: string;
  review_reason: string | null;
  total: number | string | null;
  items_sum: number | string | null;
  purchased_on: string | null;
};

/** Zlé hodnoty od modelu (neplatný dátum, text namiesto čísla) nesmú zhodiť ukladanie celého dokladu. */
export function sanitize(x: Extraction): Extraction {
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

/** Čo bolo podozrivé na prvom čítaní – povie sa to druhému čítaniu. */
export function problemText(s: Saved): string | null {
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

export const compact = (x: Extraction) =>
  (Array.isArray(x.items) ? x.items : [])
    .map((it: Record<string, unknown>) => `${it.name} | ${it.quantity ?? 1} | ${it.line_total}`)
    .join("\n");

/** Nastavenie jedného čítania. */
export type ReadConfig = { model: string; thinking?: ThinkingLevel; mediaResolution?: "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH" };

/** Jedno čítanie dokladu jedným modelom. */
export function readReceipt(pages: Page[], cfg: ReadConfig, today: string, timeoutMs: number, hint?: string): Promise<GeminiResult> {
  const prompt = promptFor(today, pages.length);
  const text = hint ? `${prompt}\n\n${hint}` : prompt;
  const fileParts = pages.flatMap((pg, i) => [
    ...(pages.length > 1 ? [{ text: `Strana ${i + 1} z ${pages.length}:` }] : []),
    { inline_data: { mime_type: pg.mime, data: pg.b64 } },
  ]);
  return callGemini({
    model: cfg.model,
    parts: [{ text }, ...fileParts],
    schema: SCHEMA,
    thinking: cfg.thinking,
    mediaResolution: cfg.mediaResolution,
    maxOutputTokens: 16384,
    timeoutMs,
  });
}

export { GeminiError };
