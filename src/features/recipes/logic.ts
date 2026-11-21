/*
 * Logika receptov (z prototypu): prepočet porcií, gramy, výživové hodnoty, spájanie surovín
 * z viacerých receptov a návrh balenia na nákup. Všetko deterministické – rovnaký vstup = rovnaký výsledok.
 */
import { formatNumber, t, tn, type Key, type PluralBase } from "@/i18n";
import { categoryOrder, normalizeName } from "@/lib/categories";
import { formatQuantity } from "@/lib/parseItem";
import { FOODS, STAPLE_KEYS } from "./foods";
import type { Ingredient, Recipe, RecipeCategory } from "./types";

export const recipeMeta = (r: Recipe) => t("rc.meta", { min: r.minutes, diff: t(`rc.diff.${r.difficulty}` as Key) });
export const isSweet = (r: Recipe) => r.category === "sladke" || r.tags.includes("sladke");
export const ingName = (ing: Ingredient) => FOODS[ing.food]?.name || ing.label || ing.food;
export const isStaple = (food: string | null) => !!food && STAPLE_KEYS.includes(food);
export const categoryName = (id: string) => t(`rc.cat.${id}` as Key);

/** Zhoda receptu s kategóriou z mriežky (rýchle a pre deti sú filtre). */
export function inCategory(r: Recipe, cat: string | null) {
  if (!cat) return true;
  if (cat === "rychle") return r.minutes <= 30;
  if (cat === "deti") return r.tags.includes("deti");
  return r.category === (cat as RecipeCategory);
}

/* ------------------------------------------------------------------ jednotky */
const SPOON_UNITS = ["lyzica", "lyzicka", "strucik", "stipka", "hrst", "hrncek", "bal", "platok"];
/** Množstvo bez čísla („soľ podľa chuti“, „olej na vyprážanie“) – nekupuje sa podľa množstva a vo výžive sa nepočíta. */
export const isFreeAmount = (unit: string) => unit === "podla_chuti" || unit === "podla_potreby";

/** „600 g“, „2 lyžice“, „1,5 lyžice“, „1 štipka“. */
export function formatAmount(qty: number, unit: string): string {
  if (unit === "podla_chuti") return t("rc.unit.toTaste");
  if (unit === "podla_potreby") return t("rc.unit.asNeeded");
  if (unit === "g" || unit === "ml" || unit === "kg" || unit === "l") return formatQuantity(qty, unit) ?? "";
  if (unit === "ks") return t("rc.unit.ks", { n: formatNumber(qty, { maximumFractionDigits: 1 }) });
  // Pol a štvrť lyžičky sa píše ako „½ lyžičky“ a „¼ lyžičky“, nie „0,5“ či „0,3 lyžičky“.
  const frac = qty === 0.5 ? "½" : qty === 0.25 ? "¼" : null;
  if (SPOON_UNITS.includes(unit)) return tn(`rc.unit.${unit}` as PluralBase, qty, { n: frac ?? formatNumber(qty, { maximumFractionDigits: 1 }) });
  return `${formatNumber(qty, { maximumFractionDigits: 1 })} ${unit}`;
}

/** Hmotnosť v gramoch alebo null, ak sa nedá prepočítať (napr. „hrsť“). */
export function toGrams(foodKey: string | null, qty: number, unit: string): number | null {
  if (unit === "g") return qty;
  const food = foodKey ? FOODS[foodKey] : undefined;
  if (!food) return null;
  switch (unit) {
    case "ml": return qty * food.dens;
    case "ks": return food.g ? qty * food.g : null;
    case "lyzica": return qty * food.lyz;
    case "lyzicka": return qty * food.lyzk;
    case "strucik": return qty * 5;
    case "stipka": return qty * 0.5;
    // Hrsť: bylinky a koreniny (lyžica do 7 g) 10 g, ostatné 30 g; hrnček 250 ml; balenie = hmotnosť balenia.
    case "hrst": return qty * (food.lyz <= 7 ? 10 : 30);
    case "hrncek": return qty * 250 * food.dens;
    case "bal": return food.g ? qty * food.g : food.pack?.g ? qty * food.pack.g : null;
    // Plátok: hmotnosť kusu potraviny (eidam 40 g), inak 15 g (saláma, slanina).
    case "platok": return qty * (food.g ?? 15);
    default: return null;
  }
}

/** Zaokrúhli množstvo tak, ako by ho napísal človek. */
export function roundQty(q: number, unit: string) {
  if (unit === "g" || unit === "ml") {
    if (q < 20) return Math.max(1, Math.round(q));
    if (q < 200) return Math.round(q / 5) * 5;
    return Math.round(q / 10) * 10;
  }
  if (unit === "strucik" || unit === "stipka" || unit === "bal" || unit === "platok") return Math.max(1, Math.round(q));
  if (unit === "ks" || unit === "lyzica" || unit === "lyzicka") return Math.max(0.5, Math.round(q * 2) / 2);
  return Math.round(q * 10) / 10;
}

const UNI: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const NUM_RE = String.raw`\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔]`;
const numOf = (s: string) => {
  if (UNI[s] != null) return UNI[s]!;
  const fr = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  return fr ? Number(fr[1]) / Number(fr[2]) : Number(s.replace(",", "."));
};

const fmt2 = (n: number) => formatNumber(Math.round(n * 100) / 100, { maximumFractionDigits: 2 });

/** Jednotky, ktoré appka neukazuje, a ich prepočet: dekagramy → g, decilitre a centilitre → ml, hrnček/šálka (250 ml) → ml. */
const CUP = String.raw`hrnek|hrnk\p{L}*|hrnč\p{L}*|šál\p{L}*`;
const ODD = String.raw`dkg|dag|dl|cl|${CUP}`;
const oddFactor = (u: string): [number, "g" | "ml"] => {
  const x = u.toLowerCase();
  return x === "dkg" || x === "dag" ? [10, "g"] : x === "dl" ? [100, "ml"] : x === "cl" ? [10, "ml"] : [250, "ml"];
};
const CUP_PAREN = new RegExp(String.raw`\s*\(\s*(?:cca\.?\s*)?(?:${NUM_RE})(?:\s*[-–]\s*(?:${NUM_RE}))?\s*(?:${CUP})\s*\)`, "giu");
const ODD_AMOUNT = new RegExp(String.raw`(?<![\d.,/])(${NUM_RE})(?:(\s*[-–]\s*)(${NUM_RE}))?\s*(${ODD})(?!\p{L})`, "giu");

/**
 * Text receptu len s gramami, kilami, mililitrami a litrami (pokyn majiteľa): „20 dkg“ → „200 g“, „3,5 dl“ → „350 ml“,
 * „1 hrnek“ → „250 ml“, nad 1000 g/ml kilá/litre. Hrnčeky v zátvorke („60 ml protlaku (0,25 hrnku)“) sú len iné vyjadrenie
 * toho istého množstva – vynechajú sa. Originál v databáze ostáva nezmenený, prepočíta sa len pri zobrazení.
 */
export function metric(s: string): string {
  return s.replace(CUP_PAREN, "").replace(ODD_AMOUNT, (_m, a: string, dash: string | undefined, b: string | undefined, u: string) => {
    const [k, unit] = oddFactor(u);
    let x = numOf(a) * k;
    let y = b ? numOf(b) * k : null;
    let out: string = unit;
    if (x >= 1000 && (y == null || y >= 1000)) {
      x /= 1000;
      y = y == null ? null : y / 1000;
      out = unit === "g" ? "kg" : "l";
    }
    return `${fmt2(x)}${dash && y != null ? dash + fmt2(y) : ""} ${out}`;
  });
}

/**
 * Pôvodný riadok suroviny („0,5 kg celer“, „1-2 lžičky papriky“) s množstvom na začiatku prepočítaným na porcie (f = nové / pôvodné).
 * Desatinná bodka zdroja („0.5 kg“) sa ukáže po slovensky („0,5 kg“), jednotky cez metric().
 */
export function scaleOrig(orig: string, f: number): string {
  const re = new RegExp(String.raw`^(\s*)(${NUM_RE})(?:(\s*[-–]\s*)(${NUM_RE}))?(?:(\s+)(polievkov|čajov)\S* lyži\S*)?`);
  const lead = orig.replace(re, (m: string, sp: string, a: string, dash?: string, b?: string, gap?: string, spoon?: string) => {
    if (f === 1 && !m.includes(".")) return m;
    const num = `${sp}${fmt2(numOf(a) * f)}${dash && b ? dash + fmt2(numOf(b) * f) : ""}`;
    // Po prepočte sa lyžica skloňuje podľa nového čísla („1 polievková lyžica“ → „2 polievkové lyžice“).
    return spoon ? `${num}${gap}${spoonForm(numOf(b ?? a) * f, spoon === "polievkov")}` : num;
  });
  return metric(lead);
}

/** Tvar lyžice podľa čísla (údaje receptu sú po slovensky): 1 → „polievková lyžica“, 2–4 → „polievkové lyžice“, 1,5 → „polievkovej lyžice“, 5 → „polievkových lyžíc“. */
function spoonForm(n: number, tbsp: boolean): string {
  const k = !Number.isInteger(n) ? 2 : n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 3;
  return (tbsp
    ? ["polievková lyžica", "polievkové lyžice", "polievkovej lyžice", "polievkových lyžíc"]
    : ["čajová lyžička", "čajové lyžičky", "čajovej lyžičky", "čajových lyžičiek"])[k] ?? "";
}

/** Suroviny prepočítané na počet porcií. */
export function scaleIngredients(r: Recipe, portions: number): Ingredient[] {
  const f = portions / r.portions;
  // Vajcia a žĺtky sa pri prepočte zaokrúhlia na celé kusy.
  const whole = (ing: Ingredient) => ing.unit === "ks" && (ing.food === "vajce" || ing.food === "zltok");
  return r.ingredients.map((ing) => ({
    ...ing,
    qty: f === 1 ? ing.qty : whole(ing) ? Math.max(1, Math.round(ing.qty * f)) : roundQty(ing.qty * f, ing.unit),
  }));
}

/** Text kroku s doplnenými množstvami: {cibula} → „2 ks“. */
export function renderStep(text: string, scaled: Ingredient[]) {
  return metric(
    text.replace(/\{([^}]+)\}/g, (_, k: string) => {
      const ing = findRef(scaled, k);
      return ing ? formatAmount(ing.qty, ing.unit) : "";
    }),
  );
}
/** Surovina podľa kľúča v kroku: {ref} (napr. muka_h) alebo {potravina} bez vlastného ref. */
export const findRef = (scaled: Ingredient[], k: string) => scaled.find((x) => x.ref === k) ?? scaled.find((x) => x.food === k && !x.ref);
/** Suroviny spomenuté v kroku (pre režim varenia). */
export function stepIngredients(text: string, scaled: Ingredient[]) {
  const keys = [...new Set([...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!))];
  return keys.map((k) => findRef(scaled, k)).filter((x): x is Ingredient => !!x);
}

/* ------------------------------------------------------------------ výživa
 * Referenčné príjmy (RI) podľa nariadenia EÚ 1169/2011, príloha XIII. Vláknina RI nemá.
 */
export type NutrientId = "kcal" | "fat" | "sat" | "carbs" | "sugar" | "fiber" | "protein" | "salt";
export const NUTRIENTS: { id: NutrientId; ri: number | null; idx: number; sub?: boolean }[] = [
  { id: "kcal", ri: 2000, idx: 0 },
  { id: "fat", ri: 70, idx: 4 },
  { id: "sat", ri: 20, idx: 5, sub: true },
  { id: "carbs", ri: 260, idx: 2 },
  { id: "sugar", ri: 90, idx: 3, sub: true },
  { id: "fiber", ri: null, idx: 6 },
  { id: "protein", ri: 50, idx: 1 },
  { id: "salt", ri: 6, idx: 7 },
];
export type Nutrition = {
  perPortion: Record<NutrientId, number>;
  per100: Record<NutrientId, number>;
  portionGrams: number;
  known: number;
  unknown: string[];
  skipped: string[];
};

/** Soľ do vody na cestoviny sa takmer celá vyleje – do výživy ju nepočítame. */
const skipForNutrition = (ing: Ingredient) => /do vody/.test(ing.note || "") || isFreeAmount(ing.unit);

export function recipeNutrition(r: Recipe): Nutrition {
  const total = Object.fromEntries(NUTRIENTS.map((n) => [n.id, 0])) as Record<NutrientId, number>;
  let grams = 0;
  let known = 0;
  const unknown: string[] = [];
  const skipped: string[] = [];
  for (const ing of r.ingredients) {
    if (skipForNutrition(ing)) {
      skipped.push(ingName(ing));
      continue;
    }
    const food = FOODS[ing.food];
    const g = toGrams(ing.food, ing.qty, ing.unit);
    if (!food?.n || g == null) {
      unknown.push(ingName(ing));
      if (g != null) grams += g;
      continue;
    }
    known += 1;
    const eg = g * (food.edible ?? 1); // kurča s kosťami: počíta sa len jedlá časť
    grams += eg;
    for (const n of NUTRIENTS) total[n.id] += ((food.n[n.idx] ?? 0) * eg) / 100;
  }
  const per = (d: number) => Object.fromEntries(NUTRIENTS.map((n) => [n.id, d ? total[n.id] / d : 0])) as Record<NutrientId, number>;
  return { perPortion: per(r.portions), per100: per(grams / 100), portionGrams: grams / r.portions, known, unknown, skipped };
}

export function fmtNutrient(v: number, id: NutrientId) {
  if (id === "kcal") return t("rc.n.kcalValue", { n: formatNumber(Math.round(v)) });
  const n = id === "salt" ? v : v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return t("rc.n.gValue", { n: formatNumber(n, { maximumFractionDigits: 1 }) });
}
export const riPct = (v: number, ri: number | null) => (ri ? (v / ri) * 100 : null);

/* ------------------------------------------------------------------ spájanie surovín z košíka receptov */
export type CartEntry = { recipeId: string; portions: number };
export type Source = { recipeId: string; recipeName: string; qty: number; unit: string; note: string };
export type Row = { key: string; food: string | null; name: string; cat: string; qty: number; unit: string; sources: Source[]; staple: boolean };

/** Kľúč riadku nákupu: potravina z databázy podľa kľúča, iná surovina podľa názvu („x:mangove pyre“). */
export function rowKey(ing: Pick<Ingredient, "food" | "label">) {
  return FOODS[ing.food] ? ing.food : `x:${normalizeName(ing.label || ing.food)}`;
}

export function mergeIngredients(cart: CartEntry[], find: (id: string) => Recipe | undefined): Row[] {
  const groups = new Map<string, { food: string | null; name: string; cat: string; sources: Source[] }>();
  for (const entry of cart) {
    const r = find(entry.recipeId);
    if (!r) continue;
    for (const ing of scaleIngredients(r, entry.portions)) {
      const food = FOODS[ing.food];
      if (food?.free) continue; // voda sa nekupuje
      const gk = rowKey(ing);
      if (!groups.has(gk)) groups.set(gk, { food: food ? ing.food : null, name: ingName(ing), cat: food?.cat || "other", sources: [] });
      groups.get(gk)!.sources.push({ recipeId: r.id, recipeName: r.name, qty: ing.qty, unit: ing.unit, note: ing.note || "" });
    }
  }
  const rows: Row[] = [];
  for (const [gk, g] of groups) {
    const base = { food: g.food, name: g.name, cat: g.cat, staple: isStaple(g.food) };
    const units = new Set(g.sources.map((x) => x.unit));
    if (units.size === 1) {
      const unit = g.sources[0]!.unit;
      rows.push({ ...base, key: gk, unit, qty: roundQty(g.sources.reduce((a, x) => a + x.qty, 0), unit), sources: g.sources });
      continue;
    }
    const grams = g.sources.map((x) => toGrams(g.food, x.qty, x.unit));
    const food = g.food ? FOODS[g.food] : undefined;
    if (food && grams.every((x) => x != null)) {
      const sum = (grams as number[]).reduce((a, x) => a + x, 0);
      // Tekutiny (olej, mlieko) ostanú v ml, aby sedeli s balením „1 l“.
      const liquid = units.has("ml") || !!food.pack?.ml;
      const unit = liquid ? "ml" : "g";
      rows.push({ ...base, key: gk, unit, qty: roundQty(liquid ? sum / food.dens : sum, unit), sources: g.sources });
      continue;
    }
    // Nedá sa sčítať (napr. hrsť + gramy) – samostatné riadky podľa jednotky.
    for (const unit of units) {
      const src = g.sources.filter((x) => x.unit === unit);
      rows.push({ ...base, key: `${gk}|${unit}`, unit, qty: roundQty(src.reduce((a, x) => a + x.qty, 0), unit), sources: src });
    }
  }
  return rows.sort((a, b) => categoryOrder(a.cat) - categoryOrder(b.cat) || a.name.localeCompare(b.name, "sk"));
}

/* ------------------------------------------------------------------ návrh nákupu
 * Z potrebného množstva urobí položku zoznamu v tom, čo sa reálne kupuje:
 * na váhu → kg (zaokrúhlené nahor na 50 g), balené → počet balení, kusové → ks.
 */
export type BuyPlan = { name: string; cat: string; qty: number; unit: string; detail: string; buyLabel: string };

const packLabel = (p: { g?: number; ml?: number; ks?: number }) =>
  p.g ? formatAmount(p.g >= 1000 ? p.g / 1000 : p.g, p.g >= 1000 ? "kg" : "g")
  : p.ml ? formatAmount(p.ml >= 1000 ? p.ml / 1000 : p.ml, p.ml >= 1000 ? "l" : "ml")
  : formatAmount(p.ks ?? 1, "ks");

export function buyPlan(row: Row): BuyPlan {
  const food = row.food ? FOODS[row.food] : undefined;
  const need = formatAmount(row.qty, row.unit);
  const name = food?.name || row.name;
  const cat = row.cat;
  if (isFreeAmount(row.unit)) return { name, cat, qty: 1, unit: "ks", detail: need, buyLabel: `${formatAmount(1, "ks")} · ${need}` };
  if (!food) {
    const simple = ["ks", "g", "ml"].includes(row.unit);
    return {
      name, cat,
      qty: simple ? row.qty : 1,
      unit: simple ? row.unit : "ks",
      detail: simple ? "" : need,
      buyLabel: simple ? need : `${formatAmount(1, "ks")} · ${need}`,
    };
  }
  const grams = toGrams(row.food, row.qty, row.unit);
  if (food.loose) {
    if (row.unit === "ks") {
      const n = Math.ceil(row.qty);
      return { name, cat, qty: n, unit: "ks", detail: "", buyLabel: formatAmount(n, "ks") };
    }
    const kg = Math.round(Math.ceil((grams ?? row.qty) / 50) * 0.05 * 100) / 100;
    return { name, cat, qty: kg, unit: "kg", detail: "", buyLabel: formatAmount(kg, "kg") };
  }
  if (food.pack) {
    const p = food.pack;
    let packs = 1;
    if (p.ks) {
      const pieces = row.unit === "ks" ? row.qty : grams != null && food.g ? grams / food.g : 1;
      packs = Math.max(1, Math.ceil(pieces / p.ks - 1e-9));
    } else if (p.ml) {
      const ml = row.unit === "ml" ? row.qty : grams != null ? grams / food.dens : p.ml;
      packs = Math.max(1, Math.ceil(ml / p.ml - 1e-9));
    } else if (p.g) {
      packs = Math.max(1, Math.ceil((grams ?? p.g) / p.g - 1e-9));
    }
    const label = packLabel(p);
    const buyLabel = p.ks === 1 ? formatAmount(packs, "ks") : packs > 1 ? `${formatNumber(packs)} × ${label}` : label;
    const exact = (p.g && grams === packs * p.g) || (p.ml && row.unit === "ml" && row.qty === packs * p.ml) || (p.ks && row.unit === "ks" && row.qty === packs * p.ks);
    const needed = exact ? "" : t("rc.needed", { qty: need });
    const detail = p.ks === 1 ? needed : [label, needed].filter(Boolean).join(" · ");
    return { name, cat, qty: packs, unit: "ks", detail, buyLabel };
  }
  const n = row.unit === "ks" ? Math.ceil(row.qty) : food.g && grams != null ? Math.max(1, Math.ceil(grams / food.g)) : 1;
  return { name, cat, qty: n, unit: "ks", detail: row.unit === "ks" ? "" : t("rc.needed", { qty: need }), buyLabel: formatAmount(n, "ks") };
}

/** Položka do zoznamu (plan_recipes). Poznámka hovorí, na ktorý recept to je. */
export function toListEntry(row: Row) {
  const p = buyPlan(row);
  const recipes = [...new Set(row.sources.map((x) => x.recipeName))].join(", ");
  return { name: p.name, quantity: p.qty, unit: p.unit, category_id: p.cat, note: [p.detail, t("rc.forRecipe", { names: recipes })].filter(Boolean).join(" · ") };
}

/* ------------------------------------------------------------------ odporúčania „Pre teba“
 * Podľa nákupov za posledné 2 týždne: čím viac surovín receptu ste nedávno kúpili, tým vyššie.
 * Pri každom otvorení sa poradie medzi podobne dobrými zamieša, nič sa samo neotáča.
 */
const words = (s: string) => normalizeName(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 5));

export function recommendations(catalog: Recipe[], recentProducts: string[], count = 5) {
  const bought = recentProducts.map(words);
  const boughtFood = (foodName: string) => {
    const w = words(foodName);
    return w.length > 0 && bought.some((b) => w.every((x) => b.includes(x)));
  };
  const scored = catalog.map((r) => {
    const hits: string[] = [];
    for (const ing of r.ingredients) {
      const food = FOODS[ing.food];
      if (!food || isStaple(ing.food) || hits.includes(food.name) || !boughtFood(food.name)) continue;
      hits.push(food.name);
    }
    return { r, hits, score: hits.length + Math.random() * 1.5 };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ r, hits }) => ({
      recipe: r,
      reason: hits.length ? t("rc.reasonBought", { names: hits.slice(0, 3).join(", ") }) : t("rc.reasonLong"),
    }));
}

/* ------------------------------------------------------------------ hľadanie
 * Vety ako „niečo rýchle s kuracím“ rozloží na filtre (rýchle, kuracie) a zvyšné slová.
 */
const STOP = new Set(
  "s so z zo na do a nieco chcem mam mame chut dnes obed vecera veceru recept recepty nejake nejaky nejaku pre k ku mi by som si daj uvarit varit dobre dobry co something with for i want".split(" "),
);
const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 2) : w);

export type Filters = { cat?: string | null; meat?: string | null; time?: number | null; taste?: "sladke" | "slane" | null };

export function interpretQuery(q: string) {
  const filters: Filters = {};
  const implied: Key[] = [];
  let text = ` ${normalizeName(q)} `;
  const take = (re: RegExp, apply: () => void, label: Key) => {
    if (re.test(text)) {
      text = text.replace(re, " ");
      apply();
      implied.push(label);
    }
  };
  take(/ bez mas\w* | without meat | vegetarian\w* /, () => (filters.meat = "bez"), "rc.meat.bez");
  take(/ rychl\w* | quick\w* | fast /, () => (filters.time = 30), "rc.q.quick");
  take(/ kurac\w* | kura\w* | chicken /, () => (filters.meat = "kuracie"), "rc.meat.kuracie");
  take(/ bravc\w* | pork /, () => (filters.meat = "bravcove"), "rc.meat.bravcove");
  take(/ hovadz\w* | beef /, () => (filters.meat = "hovadzie"), "rc.meat.hovadzie");
  take(/ ryb\w* | fish /, () => (filters.meat = "ryby"), "rc.meat.ryby");
  take(/ sladk\w* | sweet /, () => (filters.taste = "sladke"), "rc.taste.sladke");
  take(/ slan\w* | savoury | savory /, () => (filters.taste = "slane"), "rc.taste.slane");
  take(/ polievk\w* | soup\w* /, () => (filters.cat = "polievky"), "rc.cat.polievky");
  take(/ cestovin\w* | pasta /, () => (filters.cat = "cestoviny"), "rc.cat.cestoviny");
  take(/ salat\w* | salad\w* /, () => (filters.cat = "salaty"), "rc.cat.salaty");
  take(/ ranajk\w* | breakfast /, () => (filters.cat = "ranajky"), "rc.cat.ranajky");
  take(/ pre deti | for kids /, () => (filters.cat = "deti"), "rc.cat.deti");
  const terms = text.split(" ").filter((w) => w && !STOP.has(w)).map(stem);
  return { terms, filters, implied };
}

export function matchesTerms(r: Recipe, terms: string[]) {
  if (!terms.length) return true;
  const hay = normalizeName([r.name, categoryName(r.category), ...r.tags, ...r.ingredients.map(ingName)].join(" "));
  return terms.every((w) => hay.includes(w));
}

export function matchesFilters(r: Recipe, f: Filters) {
  if (f.cat && !inCategory(r, f.cat)) return false;
  if (f.meat && r.meat !== f.meat) return false;
  if (f.time && r.minutes > f.time) return false;
  if (f.taste === "sladke" && !isSweet(r)) return false;
  if (f.taste === "slane" && isSweet(r)) return false;
  return true;
}

/* ------------------------------------------------------------------ varenie */
/** Časovač len pri krokoch, kde sa čaká (dusenie, pečenie v rúre, varenie, kysnutie, odpočinok). */
const WAIT = /(dus|peč.*rúr|v rúre|var(?!.*krátko)|kysn|odpoč|nechaj|chlad|marin|simmer|bake|boil|rest|rise)/i;
export const isWait = (step: { text: string; timerMin?: number | null; wait?: boolean }) => !!step.timerMin && (step.wait ?? WAIT.test(step.text));
