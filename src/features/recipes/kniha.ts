/*
 * Kniha receptov Basket Harmony – pomocné funkcie knihy (fotky, alergény, suroviny pri kroku) a overenie
 * receptu porovnaním s ostatnými receptami toho istého variantu (bookCheck). Samotné recepty sú v kniha-overene.ts. Výživa a alergény sa počítajú
 * zo surovín (foods.ts, USDA), nič sa nepíše ručne. Kontroly sú v kniha.test.ts.
 */
import { FOODS, type Allergen } from "./foods";
import { findRef, toGrams } from "./logic";
import type { BookCheck, Ingredient, Recipe, Step } from "./types";

/**
 * Obrázky receptov z databázy (image_path): pre každý recept sa raz pridá CSS pravidlo pic-kb_<id>_1 (veľký) a _1s (malý náhľad),
 * ktoré používajú karty, kategórie a celá obrazovka (bookPics). Súbor „-1s“ je malý náhľad vedľa hlavného obrázka.
 */
export function injectBookPics(items: { id: string; path: string | null }[]) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("book-pics") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "book-pics";
    document.head.appendChild(el);
  }
  el.textContent = items
    .filter((x) => x.path)
    .map((x) => {
      const small = x.path!.replace(/-1\.webp$/, "-1s.webp");
      return `.pic-kb_${x.id}_1, .bhm .pic-kb_${x.id}_1 { background-image: url("${x.path}"); } .pic-kb_${x.id}_1s, .bhm .pic-kb_${x.id}_1s { background-image: url("${small}"); }`;
    })
    .join("\n");
}

/** Triedy fotiek receptu: pic-kb_<id>_<n> (súbory public/kniha/<id>-<n>.webp). */
export function bookPics(r: Pick<Recipe, "id" | "book">) {
  const n = r.book?.photos ?? 0;
  return Array.from({ length: n }, (_, k) => `kb_${r.id}_${k + 1}`);
}

/** Alergény receptu – odvodené zo surovín (nikdy nie ručne). */
export function recipeAllergens(r: Pick<Recipe, "ingredients">) {
  const al = new Set<Allergen>();
  const check = new Set<string>();
  for (const ing of r.ingredients) {
    const food = FOODS[ing.food];
    for (const a of food?.al ?? []) al.add(a);
    if (food?.check && food.al?.length) check.add(ing.label || food.name);
  }
  return { allergens: [...al], check: [...check] };
}

/** Adresy fotiek receptu z knihy (veľké na celú obrazovku) a malá prvá fotka ako náhľad počas načítania. */
export function bookPhotos(r: Pick<Recipe, "id" | "book">) {
  const n = r.book?.photos ?? 0;
  return {
    urls: Array.from({ length: n }, (_, k) => `/kniha/${r.id}-${k + 1}.webp`),
    small: n ? `/kniha/${r.id}-1s.webp` : null,
  };
}

/* Ako sa surovina volá v texte postupu (začiatky slov, slovenské tvary). Používa ho kontrolný program
 * (kniha.test.ts: suroviny ↔ postup) aj varenie (suroviny pri kroku). Nová surovina v knihe = nový riadok. */
export const SAID: Record<string, string> = {
  pliecko: "mäs", bocik: "bôčik|mäs", kurca: "kurč|mäs", kuracie_stehna: "steh|mäs|kurať|kurac", kuracie_prsia: "prs|mäs|kurať|kurac", mlete: "mäs", mast: "masť|mast[ií]", cibula: "cibu", cesnak: "cesn", rasca: "rasc",
  paprika_mleta: "papri", paprika_udena: "papri", sol: "soľ|osoľ|osol|soli", korenie: "koren|koreň|okoren|okoreň", gulas_korenie: "koren", tekute_korenie: "tekut\\S* koren",
  vyvar: "vývar", kapusta: "kapust", smotana_sladka: "smotan", smotana: "smotan", kysla_smotana: "smotan", muka: "múk", muka_polohruba: "múk", muka_hruba: "múk",
  knedla: "knedľ", olej: "olej", voda: "vod", vajce: "vajc|vajce|vajíč|žĺt|bielk", zltok: "žĺt", maslo: "masl", zemiaky: "zemiak", sampinony: "hub", kopor: "kôpor", ocot: "oct",
  tuk: "tuk", cukor: "cukr|cukor|pocukr", cukor_mly: "cukr|cukor|práškov", cukor_vanil: "vanilk", med: "med(om)?\\b", soda: "sód", kondenz: "kondenz\\S* mliek|karamel",
  orechy: "orech(y|mi)\\b", olivovy_olej: "olej", mrkva: "mrkv", zeler_stopkovy: "zeler", pasirovane: "paradaj", muskat: "muškát", lasagne: "lasagn",
  parmezan: "parmez|syr", pecorino: "pecorin|syr", kremovy_syr: "syr", mlieko: "mliek", hovadzie: "mäs|sviečkov", udene: "mäs|údené", klobasa: "klobás",
  huby_susene: "hub|hríb", baklazan: "baklažán", pretlak: "paradajk\\S* pretlak|pretlak", paradajky_kraj: "paradaj", fazula: "fazu", paprika: "papri", paprika_cervena: "papri",
  chilli: "chilli", rimska_rasca: "rímsk\\S* rasc", skorica: "škoric", bobkovy_list: "bobkov", nove_korenie: "nov\\S* koren", korenie_cele: "koren",
  citron: "citrón", citron_kora: "kôru|kôra|kôry|citrónov\\S* kôr", vanilka: "vanilk", brusnice: "brusn", horcica: "horčic", uhorky_kysle: "uhor", ryza: "ryž", eidam: "syr", oregano: "oregan",
  majoran: "majorán", slanina: "slanin|pancett|špek", parky: "párk|párok", zeler: "zeler", petrzlen: "petržl", petrzlenova_vnat: "petržl|vňať",
  bryndza: "bryndz", spagety: "špaget|cestovin", cestoviny: "kolienk|cestovin", susienky: "sušienk", majoneza: "majonéz", tatarska: "tatársk",
  kakao: "kaka", prasok: "kypriac|prášk\\S* do peč", paradajky: "paradaj", klincek: "klinček", ryza_varena: "ryž", pazitka: "pažít", marhule: "marhu",
  listkove_cesto: "lístkov", skoricovy_cukor: "škoricov\\S* cukor|škoricov\\S* cukr", hrozienka: "hrozien", tvaroh: "tvaroh", struhanka: "strúhank", hrasok: "hrášok|hrášk", jablko: "jablk|jabĺk", kapia: "kápi",
};
/** Výraz, ktorý nájde surovinu v texte (na začiatku slova). */
export const said = (food: string) => new RegExp(`(^|[^a-záäčďéíĺľňóôŕšťúýž])(${SAID[food] ?? "\\u0000"})`, "i");

/**
 * Suroviny, ktoré krok používa (s množstvom pre zvolené porcie): {odkazy} v texte, potom slová z textu.
 * Pri surovine vo viacerých skupinách (múka do omáčky aj do halušiek) rozhodne skupina odkazov v kroku,
 * inak tá bez vlastného ref. Krok môže suroviny určiť priamo (uses).
 */
export function stepFoods(st: Pick<Step, "text" | "uses">, scaled: Ingredient[]): Ingredient[] {
  const pick = new Set<Ingredient>();
  if (st.uses) {
    for (const k of st.uses) {
      const x = findRef(scaled, k);
      if (x) pick.add(x);
    }
  } else {
    const refs = [...st.text.matchAll(/\{([^}]+)\}/g)].map((m) => findRef(scaled, m[1]!)).filter((x): x is Ingredient => !!x);
    refs.forEach((x) => pick.add(x));
    const ctx = new Set(refs.map((x) => x.group));
    const text = st.text.replace(/\{[^}]+\}/g, " ");
    for (const food of new Set(scaled.map((x) => x.food))) {
      if ([...pick].some((x) => x.food === food) || !SAID[food] || !said(food).test(text)) continue;
      const cand = scaled.filter((x) => x.food === food && x.note !== "do vody");
      const x = cand.find((c) => ctx.has(c.group)) ?? cand.find((c) => !c.ref) ?? cand[0];
      if (x) pick.add(x);
    }
  }
  return scaled.filter((x) => pick.has(x));
}

/* ------------------------------------------------------------------ overenie metódou „kotva“ */

/** Percentil zoradených hodnôt (lineárne medzi susednými). */
function pct(sorted: number[], p: number) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (i - lo);
}

/** Základná porcia: najčastejší počet porcií v zdrojoch; pri zhode ten bližší k mediánu. */
export function basePortions(portions: number[]) {
  const count = new Map<number, number>();
  for (const p of portions) count.set(p, (count.get(p) ?? 0) + 1);
  const top = Math.max(...count.values());
  const med = pct([...portions].sort((a, b) => a - b), 0.5);
  return [...count].filter(([, c]) => c === top).map(([p]) => p).sort((a, b) => Math.abs(a - med) - Math.abs(b - med) || a - b)[0]!;
}

export type CheckRow = {
  foods: string[];
  /** Skupina s vlastnými zdrojmi (napr. „Halušky“); undefined = hlavné jedlo. */
  group?: string;
  /** Počet zdrojov, s ktorými sa riadok porovnáva. */
  all: number;
  /** Názov riadku, keď spája viac potravín (napr. „Tuk (olej, maslo)“). */
  label?: string;
  unit: "g" | "ks";
  /** V koľkých zdrojoch surovina je (a z koľkých). */
  count: number;
  share: number;
  /** Naše množstvo na základné porcie (null = surovinu nemáme). */
  ours: number | null;
  /** Množstvo vo zdrojoch prepočítané na naše porcie: celé rozpätie a bežné rozpätie (20.–80. percentil). */
  min: number | null;
  max: number | null;
  lo: number | null;
  hi: number | null;
  /** Koľko zdrojov uvádza množstvo (porovnáva sa od 4). */
  quantified: number;
  /** Naše množstvo nie je neobvyklé – je v Tukeyho hraniciach (null = neporovnáva sa). Malé množstvá (koreniny pod 1 g)
   * sa porovnávajú len hrubo: neobvyklé je až viac ako trojnásobok bežného. Do pravidla „najviac 1“ sa ráta toto. */
  typical: boolean | null;
  /** Naše množstvo je v pásme „bežne“ (20.–80. percentil) – len informácia. */
  usual: boolean | null;
  /** Tukeyho hranice (log škála): mimo nich je množstvo neobvyklé. */
  fenceLo: number | null;
  fenceHi: number | null;
  inRange: boolean | null;
};

export type CheckResult = {
  /** Zdroje hlavného jedla (bez skupín s vlastnými zdrojmi). */
  sources: number;
  sites: number;
  /** Skupiny s vlastnými zdrojmi: koľko zdrojov a webov, kotva skupiny. */
  groups: { name: string; sources: number; sites: number; anchor: string }[];
  base: number;
  rows: CheckRow[];
  /** Suroviny väčšiny (viac ako polovica zdrojov), ktoré v recepte chýbajú. */
  missing: string[];
  /** Naše suroviny, ktoré má menej ako 30 % zdrojov (voliteľné menej ako 20 %), alebo nie sú v porovnaní. */
  weak: string[];
  /** Úkony väčšiny, ktoré v postupe chýbajú. */
  actsMissing: string[];
  /** Počet úkonov väčšiny. */
  actsMajor: number;
  /** Koľko našich množstiev je neobvyklých (mimo Tukeyho hraníc). */
  outside: number;
  /** Prešiel kontrolou: chýba najviac 1 surovina väčšiny, najviac 1 neobvyklé množstvo, väčšina úkonov väčšiny. */
  ok: boolean;
  /** Zhoda 0–1: priemer (suroviny väčšiny, množstvá v bežnom rozpätí, úkony väčšiny). */
  score: number;
  parts: { ingredients: number; amounts: number; steps: number };
};

/** Skupina porovnania, do ktorej surovina patrí (undefined = hlavné jedlo). */
export function checkGroup(c: BookCheck, ing: Pick<Ingredient, "group">) {
  return ing.group && (c.groups?.[ing.group] || c.rows.some((x) => x.group === ing.group)) ? ing.group : undefined;
}

/** Riadok porovnania pre surovinu (podľa potraviny a skupiny). */
export function checkRow<T extends { foods: string | string[]; group?: string }>(c: BookCheck, rows: T[], ing: Pick<Ingredient, "food" | "group">) {
  const g = checkGroup(c, ing);
  return rows.find((x) => (typeof x.foods === "string" ? x.foods.split("+") : x.foods).includes(ing.food) && x.group === g);
}

/** Naše množstvo pre riadok porovnania (gramy alebo kusy). */
function ourAmount(r: Recipe, c: BookCheck, foods: string[], unit: "g" | "ks", group?: string) {
  let sum = 0;
  let found = false;
  for (const ing of r.ingredients) {
    // Soľ do vody na varenie (halušky) v jedle neostane – do porovnania nepatrí.
    if (!foods.includes(ing.food) || checkGroup(c, ing) !== group || ing.note === "do vody") continue;
    found = true;
    if (unit === "ks") sum += ing.unit === "ks" ? ing.qty : (toGrams(ing.food, ing.qty, ing.unit) ?? 0) / (FOODS[ing.food]?.g || 1);
    else sum += toGrams(ing.food, ing.qty, ing.unit) ?? 0;
  }
  return found ? sum : null;
}

/** Porovná recept so všetkými zdrojmi (suroviny, množstvá na porciu, úkony) a vypočíta zhodu. */
export function bookCheck(r: Recipe): CheckResult | null {
  const c: BookCheck | undefined = r.book?.check;
  if (!c) return null;
  const src = r.book!.sources;
  const inGroup = new Set(Object.values(c.groups ?? {}).flatMap((g) => [...g.src]));
  const main = src.map((s) => s.k).filter((k) => !inGroup.has(k));
  const of = (g?: string) => (g && c.groups?.[g] ? [...c.groups[g].src] : main);
  const sites = (letters: string[]) => new Set(src.filter((s) => letters.includes(s.k)).map((s) => s.site)).size;
  const base = c.whole || !c.portions[c.anchor] ? r.portions : c.portions[c.anchor]!;
  // Množstvo zdroja/naše na porovnanie: na porciu, na celý kus, alebo (pečenie) na 100 g základnej suroviny.
  const baseRow = c.base ? c.rows.find((x) => x.foods.split("+").includes(c.base!)) : undefined;
  const ourBase = baseRow ? ourAmount(r, c, baseRow.foods.split("+"), baseRow.unit) : null;
  const rows: CheckRow[] = c.rows.map((row) => {
    const foods = row.foods.split("+");
    const letters = of(row.group);
    const have = Object.keys(row.v).filter((k) => letters.includes(k));
    const per = have
      .filter((k) => row.v[k]! > 0)
      .map((k) => {
        if (baseRow) return baseRow.v[k] ? (row.v[k]! / baseRow.v[k]!) * 100 : NaN;
        if (c.whole) return row.v[k]!;
        return c.portions[k] ? (row.v[k]! / c.portions[k]!) * r.portions : NaN;
      })
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);
    const raw = ourAmount(r, c, foods, row.unit, row.group);
    const ours = raw == null ? null : baseRow ? (ourBase ? (raw / ourBase) * 100 : null) : raw;
    const q = per.length;
    const min = q ? per[0]! : null;
    const max = q ? per[q - 1]! : null;
    const lo = q >= 4 ? pct(per, 0.2) : min;
    const hi = q >= 4 ? pct(per, 0.8) : max;
    const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
    const isBase = row === baseRow;
    const cmp = ours != null && ours > 0 && q >= 4 && !isBase;
    // na porciu (alebo na 100 g základu) pod 1 g = korenina: porovnáva sa len hrubo
    const tiny = cmp && pct(per, 0.5) / (baseRow || c.whole ? 1 : r.portions) < 1;
    // Neobvyklé množstvo = mimo Tukeyho hraníc na logaritmickej škále (kvartily ± 1,5 × medzikvartilové rozpätie);
    // pásmo lo–hi (20.–80. percentil) je len informácia „bežne“.
    const lg = per.filter((x) => x > 0).map(Math.log);
    const q1 = lg.length >= 4 ? pct(lg, 0.25) : null;
    const q3 = lg.length >= 4 ? pct(lg, 0.75) : null;
    const fenceLo = q1 != null && q3 != null ? Math.exp(q1 - 1.5 * (q3 - q1)) : null;
    const fenceHi = q1 != null && q3 != null ? Math.exp(q3 + 1.5 * (q3 - q1)) : null;
    return {
      foods, group: row.group, all: letters.length, label: row.label, unit: row.unit, count: have.length, share: have.length / letters.length,
      ours, min, max, lo, hi, quantified: q,
      fenceLo, fenceHi,
      usual: cmp ? (ours! >= lo! || near(ours!, lo!)) && (ours! <= hi! || near(ours!, hi!)) : null,
      typical: !cmp ? null : tiny ? ours! <= hi! * 3 : ours! >= fenceLo! * 0.999 && ours! <= fenceHi! * 1.001,
      inRange: cmp ? (ours! >= min! || near(ours!, min!)) && (ours! <= max! || near(ours!, max!)) : null,
    };
  });
  const name = (foods: string[]) => foods.map((f) => FOODS[f]?.name ?? f).join(" + ");
  const core = rows.filter((x) => x.share > 0.5);
  // soľ a korenie zdroje často v zozname neuvádzajú – ich chýbanie sa nepočíta
  const missing = core.filter((x) => x.ours == null && !x.foods.every((f) => f === "sol" || f === "korenie")).map((x) => name(x.foods));
  const weak: string[] = [];
  for (const ing of r.ingredients) {
    if (FOODS[ing.food]?.free) continue;
    const row = checkRow(c, rows, ing);
    if (!row || row.share < (ing.optional ? 0.2 : 0.3)) weak.push(ing.label || FOODS[ing.food]?.name || ing.food);
  }
  const majorActs = c.acts.filter((a) => a.src.length / of(a.group).length > 0.5);
  const actsMissing = majorActs.filter((a) => !a.step).map((a) => a.a);
  const compared = rows.filter((x) => x.typical != null);
  const parts = {
    ingredients: core.length ? (core.length - missing.length) / core.length : 1,
    amounts: compared.length ? compared.filter((x) => x.typical).length / compared.length : 1,
    steps: majorActs.length ? (majorActs.length - actsMissing.length) / majorActs.length : 1,
  };
  const outside = rows.filter((x) => x.typical === false).length;
  return {
    sources: main.length,
    sites: sites(main),
    groups: Object.entries(c.groups ?? {}).map(([g, x]) => ({ name: g, sources: x.src.length, sites: sites([...x.src]), anchor: x.anchor })),
    base,
    rows,
    missing,
    weak,
    actsMissing,
    actsMajor: majorActs.length,
    outside,
    ok: missing.length <= 1 && outside <= 1 && actsMissing.length <= Math.floor(majorActs.length / 2),
    score: (parts.ingredients + parts.amounts + parts.steps) / 3,
    parts,
  };
}
