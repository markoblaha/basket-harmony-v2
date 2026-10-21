/**
 * Nastavenia uložené v zariadení (každý telefón si ich volí sám), ako bh.theme a bh.locale.
 * Sú to len predvoľby zobrazovania; spoločné pravidlá domácnosti patria do databázy.
 *
 * Použitie v ľubovoľnej časti appky:
 *   const [prices] = useSetting("prices");        // v komponente (prekreslí sa pri zmene)
 *   if (getSetting("haptics")) …                    // mimo komponentu
 */
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "bh.settings";

export type NotifKind = "start" | "request" | "reply" | "unavailable" | "end" | "receiptMissing" | "receiptRead" | "receiptMatch";

export type Settings = {
  /** Posledná cena a obchod pri položkách zoznamu. */
  prices: boolean;
  /** Odhad sumy zoznamu pod zoznamom. */
  estimate: boolean;
  /** Sekcia „Máš doma“ (suroviny z receptov, ktoré sú doma) v zozname. */
  homeSection: boolean;
  /** Výživové hodnoty v receptoch. */
  nutrition: boolean;
  /** Zloženie nákupu v analytike. */
  basketMix: boolean;
  /** Pás „Pre teba“ v Receptoch. */
  recipeSuggestions: boolean;
  /** Krátke vibrácie pri odškrtnutí a pridaní. */
  haptics: boolean;
  /** Hlasový režim začne počúvať hneď po otvorení. */
  micAutostart: boolean;
  /** Obrázky receptov: kresby alebo fotky. */
  recipeImages: "drawings" | "photos";
  /** Moje obchody: obľúbené (podľa mena) a poradie, v akom sa ponúkajú. */
  favStores: string[];
  storeOrder: string[];
  /** Ktoré upozornenia v appke chcem dostávať. */
  notif: Record<NotifKind, boolean>;
};

export const DEFAULT_SETTINGS: Settings = {
  prices: true,
  estimate: true,
  homeSection: true,
  nutrition: true,
  basketMix: true,
  recipeSuggestions: true,
  haptics: true,
  micAutostart: true,
  recipeImages: "drawings",
  favStores: ["Lidl", "Kaufland", "Tesco", "DM"],
  storeOrder: [],
  notif: { start: true, request: true, reply: true, unavailable: true, end: true, receiptMissing: true, receiptRead: true, receiptMatch: true },
};

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, notif: { ...DEFAULT_SETTINGS.notif, ...(parsed.notif ?? {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: Settings = read();
const subs = new Set<() => void>();

function subscribe(cb: () => void) {
  subs.add(cb);
  // Zmena v inej karte alebo okne tej istej appky.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = read();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSettings(): Settings {
  return current;
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return current[key];
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* súkromný režim prehliadača – voľba platí do zatvorenia */
  }
  subs.forEach((f) => f());
}

/** Všetky nastavenia; komponent sa prekreslí pri každej zmene. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}

export function useSetting<K extends keyof Settings>(key: K): [Settings[K], (v: Settings[K]) => void] {
  const value = useSyncExternalStore(subscribe, () => current[key]);
  const set = useCallback((v: Settings[K]) => setSetting(key, v), [key]);
  return [value, set];
}

/** Zoradí mená obchodov podľa „Moje obchody“: najprv v mojom poradí, ostatné za nimi v pôvodnom poradí. */
export function orderStores(names: string[]): string[] {
  const order = current.storeOrder.map((s) => s.toLowerCase());
  const rank = (n: string) => {
    const i = order.indexOf(n.toLowerCase());
    return i < 0 ? order.length : i;
  };
  return names.map((n, i) => ({ n, i })).sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i).map((x) => x.n);
}
