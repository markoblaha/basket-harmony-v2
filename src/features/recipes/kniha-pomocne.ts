/*
 * Kniha receptov – spoločné pomocné funkcie šarží (kniha-sarza1.ts, kniha-sarza2.ts…).
 * Každý recept je JEDEN skutočný recept: najhodnotenejší z hlavných webov (Apetit, Vaření, Toprecepty), ktorý prešiel
 * kontrolou proti 11–20 ďalším receptom toho istého variantu (kniha-porovnanie.ts, bookCheck v kniha.ts).
 * Suroviny, množstvá aj postup sú presne podľa neho – len preložené do slovenčiny (bez reklamy, odkazov a histórie).
 * Rady „Hotové je, keď / Pozor / Tip“ majú na konci pôvod: zdroj (písmeno z porovnania), pôvodný recept
 * alebo pravidlo bezpečnosti potravín. Výživa a alergény sa počítajú zo surovín (foods.ts).
 * Obsah receptov je údaj (ako názov produktu), nie text rozhrania – preto nie je v i18n.
 */
import { COMPARE } from "./kniha-porovnanie";
import type { BookInfo, Ingredient, Recipe, Step } from "./types";

export type I = [food: string, qty: number, unit: Ingredient["unit"], extra?: Partial<Ingredient>];
export type S = [text: string, min: number, uses: string[], extra?: Partial<Step>];

/** Pravidlá bezpečnosti potravín (pôvod rád, ktoré nie sú zo zdrojov). */
export const RULE = {
  poultry: "pravidlo bezpečnosti potravín (USDA: hydina aspoň 74 °C vo vnútri)",
  eggs: "pravidlo bezpečnosti potravín (EFSA, USDA: nedovarené vajcia a rizikové skupiny)",
  leftovers: "Varené jedlo schlaď a daj do chladničky do 2 hodín, zjedz do 3–4 dní (pravidlo USDA).",
};

/** Pôvod rady zo zdroja: písmeno a web podľa adresy receptu („A – Vaření“), aby sedel aj po novom porovnaní. */
const SITE: Record<string, string> = { "vareni.cz": "Vaření", "apetitonline.cz": "Apetit", "toprecepty.cz": "Toprecepty", "labuznik.cz": "Labužník", "receptar.sk": "Receptár", "recepty.aktuality.sk": "Aktuality" };
export function from(id: string, url: string) {
  const s = COMPARE[id]!.sources.find((x) => x.url === url);
  if (!s) throw new Error(`${id}: zdroj ${url} nie je v porovnaní`);
  return `zdroj ${s.k} (${SITE[s.site] ?? s.site})`;
}
/** Pôvod rady z úkonu, ktorý robia viaceré zdroje: „zdroje A, F, I“. */
export function fromAct(id: string, act: string) {
  const a = COMPARE[id]!.check.acts.find((x) => x.a === act);
  if (!a?.src) throw new Error(`${id}: úkon ${act} nemá zdroje`);
  return `zdroje ${[...a.src].join(", ")}`;
}

export const ings = (group: string | undefined, list: I[]): Ingredient[] =>
  list.map(([food, qty, unit, extra]) => ({ food, qty, unit, ...(group ? { group } : {}), ...extra }));

/** Kroky: zdroj kroku je vždy kotva (recept sa preberá presne), suroviny kroku sú dané (uses). */
export function steps(id: string, list: S[]): Step[] {
  const anchor = COMPARE[id]!.check.anchor;
  return list.map(([text, min, uses, extra]) => ({ text, timerMin: min || null, src: anchor, uses, ...(min ? { wait: true } : {}), ...extra }));
}

/** Zdroje, porovnanie a údaje knihy z kniha-porovnanie.ts. Skúšobná šarža (batch) má namiesto fotky obrázok s číslom šarže. */
export function book(id: string, info: Omit<BookInfo, "sources" | "check" | "photos">): BookInfo {
  const c = COMPARE[id]!;
  return {
    photos: 1,
    ...info,
    sources: c.sources.map(({ k, site, name, url, rating, votes }) => ({ k, site, name, url, ...(rating ? { rating } : {}), ...(votes ? { votes } : {}) })),
    check: {
      ...c.check,
      portions: Object.fromEntries(c.sources.filter((s) => s.portions).map((s) => [s.k, s.portions!])),
      changes: [],
    },
  };
}

/** Pri každej surovine písmená zdrojov, ktoré ju majú (podľa riadkov porovnania). */
export function finish(r: Recipe): Recipe {
  const rows = r.book?.check?.rows ?? [];
  return {
    ...r,
    ingredients: r.ingredients.map((x) => {
      const row = rows.find((w) => w.foods.split("+").includes(x.food) && !w.group);
      return row ? { ...x, src: Object.keys(row.v).sort().join("") } : x;
    }),
  };
}
