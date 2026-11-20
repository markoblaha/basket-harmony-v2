/** Recept: katalógový (id z katalógu) alebo vlastný z databázy (uuid, mine = true). */
export type Unit = "g" | "ml" | "ks" | "lyzica" | "lyzicka" | "strucik" | "stipka" | "hrst" | "hrncek" | "bal" | "podla_chuti" | "podla_potreby" | (string & {});

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
  /** Náhrada spomenutá v postupe („masť alebo olej“) – kontrola surovín ↔ postup ju berie ako túto surovinu. */
  alt?: string[];
  /** Kniha receptov: pôvodný riadok suroviny zo zdroja („0,5 kg celer“) – appka ho ukáže presne, pri inom počte porcií prepočíta číslo. */
  orig?: string;
  /**
   * Kniha receptov: ako túto surovinu pripraviť, keď ju treba najprv urobiť (tekvicové pyré, zápražka, fondán…) –
   * z odkazu v zdroji („jak připravit“) alebo z kvalitného zdroja. Appka ju ukáže pri surovine aj ako „Vopred priprav“ v postupe.
   */
  how?: PrepHow;
};

/** Malý postup prípravy suroviny (podrecept). */
export type PrepHow = { title: string; ingredients?: string[]; steps: string[]; url?: string; /** pôvodný text zdroja */ orig?: string };

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
  /** Kniha receptov: nadpis časti receptu zo zdroja („Krém“, „Korpus“) – ukáže sa nad prvým krokom časti. */
  group?: string;
};

/**
 * Overenie receptu: recept je jeden skutočný recept (kotva = najhodnotenejší, ktorý prešiel kontrolou), prevzatý
 * presne (suroviny, množstvá, postup – len preložený). Každá surovina, množstvo a úkon sa porovná s ostatnými
 * receptami toho istého variantu (11–20). Prejde, keď: chýba najviac 1 surovina väčšiny, najviac 1 množstvo je neobvyklé
 * (mimo Tukeyho hraníc na log škále) a má väčšinu úkonov väčšiny. Výpočet: bookCheck v kniha.ts, test v kniha.test.ts.
 */
export type BookCheck = {
  /** Písmeno zdroja, ktorého recept je základom. */
  anchor: string;
  /** Na koľko porcií je recept zdroja (chýba = zdroj porcie neuvádza). */
  portions: Record<string, number>;
  /** Recept na jeden kus (torta): každý zdroj je na celý kus, množstvá sa porovnávajú na celý kus; porcie = kúsky na krájanie. */
  whole?: boolean;
  /** Pečenie: množstvá sa porovnávajú na 100 g tejto suroviny (riadok foods), lebo formy majú rôznu veľkosť. */
  base?: string;
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
  /** Fotky (alebo obrázok šarže): hlavná a ďalšie zábery (súbory public/kniha/<id>-<n>.webp, triedy pic-kb_<id>_<n>). */
  photos: number;
  /** Začiatok adresy fotiek z databázy (image_path bez „-1.webp“, napr. /kniha/v2/svieckova); súbory <base>-<n>.webp, <base>-1s.webp. */
  photoBase?: string;
  /** Čas práce v minútách (minutes = celkový čas). */
  active: number;
  /** Čakanie navyše (odležanie). */
  wait?: string;
  cuisine: string;
  tools: string[];
  store: string;
  sources: { k: string; site: string; name: string; url: string; rating?: number; votes?: number }[];
  /** Skúšobná šarža (1, 2, …): namiesto fotky obrázok s označením šarže, kým majiteľ recepty neschváli. */
  batch?: number;
  /**
   * Prepočet porcií: „free“ = varené jedlo, ľubovoľne ½–2×; „piece“ = na kusy (palacinky), po jednej porcii;
   * „whole“ = pečenie, len celé násobky receptu (forma). Časy sa neprepočítavajú, vajcia sa zaokrúhlia na celé.
   */
  scale?: "free" | "piece" | "whole";
  /** Pôvodný recept počet porcií neuvádza – porcie sú odhad (napr. knedle, štrúdľa na krájanie). */
  portionsGuess?: boolean;
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
