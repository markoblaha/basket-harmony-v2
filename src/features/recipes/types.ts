/** Recept: katalógový (id z katalógu) alebo vlastný z databázy (uuid, mine = true). */
export type Unit = "g" | "ml" | "ks" | "lyzica" | "lyzicka" | "strucik" | "stipka" | (string & {});

export type Ingredient = {
  /** Kľúč suroviny: z databázy potravín (foods.ts) alebo vlastný – podľa neho sa dopĺňajú množstvá v krokoch {kľúč}. */
  food: string;
  /** Názov, ak surovina nie je v databáze potravín. */
  label?: string;
  qty: number;
  unit: Unit;
  note?: string;
  /** Neisté miesto po čítaní (len pri kontrole importu). */
  uncertain?: string | null;
  /** Kniha receptov: skupina surovín („Halušky“), voliteľná surovina, iný kľúč do krokov ({ref}). */
  group?: string;
  optional?: boolean;
  ref?: string;
  /** Kniha receptov: zdroje (písmená z book.sources), v ktorých surovina je. */
  src?: string;
};

export type Step = {
  text: string;
  timerMin?: number | null;
  /** Čaká sa (dusenie, pečenie…) – ukáže sa časovač. */
  wait?: boolean;
  /** Podrobnosti kroku pri varení. */
  done?: string;
  tip?: string;
  more?: string;
  uncertain?: string | null;
  /** Kniha receptov: stupeň ohňa alebo teplota rúry, „Pozor“ a zdroje kroku (písmená z book.sources). */
  heat?: string;
  warn?: string;
  src?: string;
  /** Kniha receptov: suroviny kroku (kľúč alebo ref), keď sa z textu nedajú určiť jednoznačne. */
  uses?: string[];
};

/**
 * Overenie receptu (metóda „kotva“, 15. 11. 2026): základom je jeden skutočný recept (kotva) a každá surovina,
 * množstvo a úkon sa porovná so všetkými zdrojmi. Výpočet a pravidlá: bookCheck v kniha.ts, test v kniha.test.ts.
 */
export type BookCheck = {
  /** Písmeno zdroja, ktorého recept je základom. */
  anchor: string;
  /** Na koľko porcií je recept zdroja (chýba = zdroj porcie neuvádza). */
  portions: Record<string, number>;
  /** Recept na jeden kus (torta): každý zdroj je na celý kus, množstvá sa porovnávajú na celý kus; porcie = kúsky na krájanie. */
  whole?: boolean;
  /**
   * Skupina surovín s vlastnými zdrojmi (napr. halušky k paprikášu): písmená jej zdrojov a jej kotva.
   * Riadky a úkony skupiny (group) sa porovnávajú len s jej zdrojmi; hlavné jedlo so zvyšnými.
   * Riadok so skupinou, ktorá tu nie je (napr. „Krém“), sa porovnáva s hlavnými zdrojmi, ale patria k nemu
   * len suroviny tej skupiny (maslo do krému ≠ maslo do cesta).
   */
  groups?: Record<string, { src: string; anchor: string }>;
  /**
   * Suroviny v zdrojoch: kľúče potravín (viac cez +, napr. koreňová zelenina), jednotka (g alebo ks)
   * a množstvo na celý recept zdroja; 0 = zdroj surovinu má, ale bez množstva („podľa chuti“).
   */
  rows: { foods: string; unit: "g" | "ks"; v: Record<string, number>; label?: string; group?: string }[];
  /** Úkony postupu: ktoré zdroje ich robia a ktorý náš krok ho robí (od 1), alebo je z neho rada (tip). */
  acts: { a: string; src: string; step?: number; tip?: boolean; group?: string }[];
  /** Čo sa oproti kotve zmenilo a prečo. */
  changes: string[];
};

/** Recept z knihy: spojený zo skutočných receptov (zdroje), s fotkami a doplnkami. */
export type BookInfo = {
  /** Fotky: hlavná a ďalšie zábery (súbory public/kniha/<id>-<n>.webp, triedy pic-kb_<id>_<n>). */
  photos: number;
  /** Čas práce v minútách (minutes = celkový čas). */
  active: number;
  /** Čakanie navyše (odležanie). */
  wait?: string;
  cuisine: string;
  tools: string[];
  store: string;
  sources: { k: string; site: string; name: string; url: string }[];
  /** Overenie metódou „kotva“ (novšie recepty); staršie recepty sú spojené z 3–5 zdrojov bez neho. */
  check?: BookCheck;
};

export type QA = { q: string; a: string };

export type RecipeCategory = "hlavne" | "cestoviny" | "polievky" | "sladke" | "ranajky" | "salaty";
export type Meat = "kuracie" | "bravcove" | "hovadzie" | "ryby" | "bez";

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  meat: Meat;
  minutes: number;
  difficulty: 1 | 2 | 3;
  portions: number;
  hue: number;
  icon: string;
  tags: string[];
  source: string;
  sourceUrl?: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  qa?: QA[];
  mine?: boolean;
  ai?: boolean;
  book?: BookInfo;
};
