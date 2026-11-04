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

/** Recept z knihy: spojený z 3–5 skutočných receptov (zdroje), s fotkami a doplnkami. */
export type BookInfo = {
  /** Fotky: hlavná, zhora, zblízka (súbory public/kniha/<id>-<n>.webp, triedy pic-kb_<id>_<n>). */
  photos: number;
  /** Čas práce v minútách (minutes = celkový čas). */
  active: number;
  /** Čakanie navyše (odležanie). */
  wait?: string;
  cuisine: string;
  tools: string[];
  store: string;
  sources: { k: string; site: string; name: string; url: string }[];
  /** Zdroje skupiny, ktorá má vlastné zdroje (napr. halušky). */
  groupSources?: Record<string, string>;
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
