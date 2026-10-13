/**
 * Jadro prekladov. Slovníky sú ploché objekty s typovanými kľúčmi
 * ("more.title"), takže preklep v kľúči alebo chýbajúci anglický text
 * zastaví `npm run typecheck`, nie až používateľa v appke.
 *
 *  t("more.title")                       -> "Viac" / "More"
 *  t("more.removeMember", { name })      -> parametre sú v texte ako {name}
 *  tn("receipts.count", 3)               -> množné číslo (slovenčina má 3 tvary)
 *
 * Slovenčina je zdroj pravdy: parametre `t()` sa odvodzujú z jej textu.
 * Zhodu anglických textov (rovnaké kľúče aj parametre) stráži test i18n.test.ts.
 */
import { sk } from "./sk";
import { en } from "./en";

export type Locale = "sk" | "en";
export const LOCALES: readonly Locale[] = ["sk", "en"];

export type Key = keyof typeof sk;
type Dict = typeof sk;

/** "Odobrať {name}" -> "name" */
type ParamNames<S> = S extends `${string}{${infer P}}${infer Rest}` ? P | ParamNames<Rest> : never;
/** Rozdeľuje sa po kľúčoch: pri konkrétnom kľúči sú parametre povinné, pri zväzku kľúčov (dynamický kľúč) nie. */
type Args<K extends Key> = K extends Key
  ? [ParamNames<Dict[K]>] extends [never]
    ? []
    : [params: { [P in ParamNames<Dict[K]>]: string | number }]
  : never;

/** "plural.items" ak existuje kľúč "plural.items.other" */
export type PluralBase = { [K in Key]: K extends `${infer B}.other` ? B : never }[Key];

const DICTS: Record<Locale, Record<string, string>> = { sk, en };
const STORAGE_KEY = "bh.locale";

/** Jazyk, v ktorom sa práve vykresľuje (nastavuje ho I18nProvider). */
let current: Locale = readStoredLocale();

export function readStoredLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "sk";
  } catch {
    return "sk"; // súkromný režim alebo prostredie bez prehliadača (testy)
  }
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* súkromný režim prehliadača – jazyk platí do zatvorenia */
  }
}

export const getLocale = (): Locale => current;
export function setActiveLocale(locale: Locale) {
  current = locale;
}

function lookup(key: string, locale: Locale = current): string {
  return DICTS[locale][key] ?? DICTS.sk[key] ?? key;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Zistí, či slovník pozná kľúč zložený za behu (napr. `error.${code}`). */
export function hasKey(key: string): key is Key {
  return key in DICTS.sk;
}

export function t<K extends Key>(key: K, ...args: Args<K>): string {
  return interpolate(lookup(key), args[0] as Record<string, string | number> | undefined);
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(n: number): Intl.LDMLPluralRule {
  const tag = intlTag();
  let rules = pluralRules.get(tag);
  if (!rules) pluralRules.set(tag, (rules = new Intl.PluralRules(tag)));
  return rules.select(n);
}

/**
 * Množné číslo. Slovník má pre základ tvary `.one`, `.few` (len slovenčina) a `.other`;
 * chýbajúci tvar spadne na `.other`. V texte je počet ako {n}.
 */
export function tn(base: PluralBase, n: number, params?: Record<string, string | number>): string {
  const dict = DICTS[current];
  const specific = `${base}.${pluralCategory(n)}`;
  const key = specific in dict ? specific : `${base}.other`;
  return interpolate(lookup(key), { n: formatNumber(n), ...params });
}

// ------------------------------------------------------------------ formátovanie
/** Štandard čísel a dátumov: slovenčina "1 234,50 €", angličtina v európskej podobe "€1,234.50". */
export const intlTag = () => (current === "sk" ? "sk-SK" : "en-GB");

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(intlTag(), options);
}

const moneyFormats = new Map<string, Intl.NumberFormat>();
export function formatEuro(n: number): string {
  const tag = intlTag();
  let f = moneyFormats.get(tag);
  if (!f) moneyFormats.set(tag, (f = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR" })));
  return f.format(n);
}

/** Dátum alebo čas z `Date`/ISO reťazca s plným časom (v časovom pásme zariadenia). */
export function formatDateTime(value: Date | string | number, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString(intlTag(), options);
}

/** Čistý dátum "2026-09-13" bez posunu časového pásma. */
export function formatCalendarDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlTag(), { ...options, timeZone: "UTC" });
}
