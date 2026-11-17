/**
 * Recepty v hlasovom nákupe – čisté funkcie (dajú sa testovať):
 *  - splitCook: „chcem uvariť hovädzí guláš“ → jedlo sa oddelí od položiek (okamžite, AI potom spresní),
 *  - recipeCommand: povely ku karte receptu („ten druhý“, „na šesť porcií“, „bez cibule“, „pridaj“),
 *  - ingredientRows: suroviny vybraného variantu ako položky nákupu (balenia, „mám doma“).
 */
import { normalizeName } from "@/lib/categories";
import { mergeIngredients, toListEntry, buyPlan, type Row } from "@/features/recipes/logic";
import type { Recipe } from "@/features/recipes/types";
import { numberOf } from "./parse";

const cap = (s: string) => (s ? s[0]!.toLocaleUpperCase("sk-SK") + s.slice(1) : s);

const COOK_VERB =
  /(?:^|[\s,])(?:(?:chcem|chceme|chcela? by som|by som chcel[a]?|budem|budeme|idem|ideme|pôjdem|chystám sa)\s+)?(?:si\s+)?(?:uvariť|navariť|variť|uvarím|uvaríme|navarím|urobiť|urobím|urobíme|spraviť|spravím|spravíme|pripraviť|pripravím|pripravíme|upiecť|upečiem|upečieme|piecť|cook|make|bake)\s+(?:si\s+|nejaký\s+|nejakú\s+|nejaké\s+)?/iu;
const MEAL = /(?:^|[\s,])na\s+(?:večeru|obed|raňajky|desiatu|víkend)\s+(?:bude|budú|chcem|bude mať|si dáme|dáme)\s+/iu;
const END = /[,.;!?]|\s+(?:a|a potom|potom|ešte|plus)\s+(?:kúp|kúpiť|treba|daj|pridaj|ešte|aj)\b/iu;

/** Oddelí jedlo na varenie od nákupných položiek. Názov jedla najviac 4 slová, v tvare, ako zaznel. */
export function splitCook(text: string): { cook: string[]; rest: string } {
  const m = COOK_VERB.exec(text) ?? MEAL.exec(text);
  if (!m) return { cook: [], rest: text };
  const after = text.slice(m.index + m[0].length);
  const stop = END.exec(after);
  const phrase = (stop ? after.slice(0, stop.index) : after).trim();
  const words = phrase.split(/\s+/).filter(Boolean);
  if (!words.length) return { cook: [], rest: text };
  const dish = words.slice(0, 4).join(" ").replace(/[„“"']/g, "");
  const tail = [words.slice(4).join(" "), stop ? after.slice(stop.index + stop[0].length) : ""]
    .filter(Boolean)
    .join(" ");
  const rest = `${text.slice(0, m.index)} ${tail}`.replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
  return { cook: [cap(dish)], rest };
}

/** Rovnaké jedlo („hovädzí guláš“ = „Hovädzí guláš“, „guláš“ ⊂ „hovädzí guláš“). */
export function sameDish(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
}

const ORD: [RegExp, number][] = [
  [/^(prv|jednotk)/, 0],
  [/^(druh|dvojk)/, 1],
  [/^(tret|trojk)/, 2],
  [/^(stvrt|stvork)/, 3],
];

export type RecipeCommand =
  | { kind: "pick"; index: number }
  | { kind: "portions"; n: number }
  | { kind: "without"; index: number }
  | { kind: "with"; index: number }
  | { kind: "add" }
  | { kind: "cancel" };

/** Slovo zo slova suroviny/variantu: prvých 5 písmen stačí na skloňovanie („cibule“ ~ „cibuľa“). */
const stem = (w: string) => w.slice(0, Math.max(4, Math.min(5, w.length - 1)));
const words = (s: string) => normalizeName(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

function findByWords(said: string, names: string[]): number {
  const sw = words(said).map(stem);
  if (!sw.length) return -1;
  let best = -1;
  let score = 0;
  names.forEach((n, i) => {
    const nw = words(n).map(stem);
    const s = sw.filter((w) => nw.includes(w)).length;
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

/**
 * Povel ku karte receptu, alebo null (veta ide ďalej ako nákupné položky).
 * options = názvy ponúknutých variantov, ingredients = názvy surovín vybraného variantu.
 */
export function recipeCommand(text: string, options: string[], ingredients: string[]): RecipeCommand | null {
  const k = normalizeName(text).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!k) return null;
  if (/^(zrus|nechcem|bez) (ten |tento )?recept|^(ziadny|ziaden) recept|^zrus to$/.test(k)) return { kind: "cancel" };
  if (/^(pridaj|pridat|ano|hej|jasne|ok|okej|dobre|beriem|berem|to beriem|daj to tam|pridaj (to|ich|suroviny|vsetko)|do zoznamu)$/.test(k)) return { kind: "add" };
  const por = /(?:^|\s)na (\S+)(?: (\S+))? porci/.exec(k) ?? /^(\S+) porci/.exec(k);
  if (por) {
    const n = numberOf(por[1]!) ?? (por[2] ? numberOf(por[2]) : null);
    if (n && n >= 1 && n <= 50) return { kind: "portions", n: Math.round(n) };
  }
  const without = /^(bez|nechcem|mam doma|mame doma|vyhod|zmaz|nie) (.+)$/.exec(k);
  if (without && ingredients.length) {
    const i = findByWords(without[2]!, ingredients);
    if (i >= 0) return { kind: "without", index: i };
  }
  const withIt = /^(aj|pridaj|aj s|s|kup aj|treba aj) (.+)$/.exec(k);
  if (withIt && ingredients.length) {
    const i = findByWords(withIt[2]!, ingredients);
    if (i >= 0) return { kind: "with", index: i };
  }
  if (options.length) {
    const body = k.replace(/^(ten|tu|to|tie|chcem|beriem|daj|vyberam|ten s|ten v|ten na|radsej) /, "").replace(/ (recept|variant|moznost)$/, "");
    for (const [re, i] of ORD) if (i < options.length && re.test(body) && !body.includes(" ")) return { kind: "pick", index: i };
    if (/^(posledn)/.test(body)) return { kind: "pick", index: options.length - 1 };
    // „ten pivný“, „kotlíkový“ – podľa slova z názvu variantu (len krátka veta, aby to nebola položka).
    if (k.split(" ").length <= 3 && /^(ten|tu|to|chcem|beriem|radsej)\b/.test(k)) {
      const i = findByWords(body, options);
      if (i >= 0) return { kind: "pick", index: i };
    }
  }
  return null;
}

export type IngredientRow = Row & { buy: ReturnType<typeof buyPlan> };

/** Suroviny jedného receptu na daný počet porcií (spojené rovnaké, prepočítané na balenia). */
export function ingredientRows(recipe: Recipe, portions: number): IngredientRow[] {
  return mergeIngredients([{ recipeId: recipe.id, portions }], (id) => (id === recipe.id ? recipe : undefined)).map((row) => ({
    ...row,
    buy: buyPlan(row),
  }));
}

/** Riadok suroviny → položka zoznamu (s poznámkou „na recept …“). */
export const rowToItem = (row: Row) => toListEntry(row);
