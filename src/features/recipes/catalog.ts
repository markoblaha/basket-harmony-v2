/*
 * Katalóg receptov: kategórie a recepty z knihy. V krokoch {kľúč} = množstvo danej suroviny
 * prepočítané na zvolený počet porcií. Obsah receptov je údaj, nie text rozhrania – preto nie je v i18n.
 */
import { BOOK } from "./kniha";
import type { Recipe, RecipeCategory } from "./types";

/** Mriežka kategórií na úvode (názvy cez t("rc.cat.<id>")). „rychle“ a „deti“ sú filtre, nie kategória receptu. */
export const RECIPE_CATEGORIES: { id: RecipeCategory | "rychle" | "deti"; icon: string; hue: number }[] = [
  { id: "hlavne", icon: "CookingPot", hue: 25 },
  { id: "cestoviny", icon: "UtensilsCrossed", hue: 45 },
  { id: "polievky", icon: "Soup", hue: 95 },
  { id: "sladke", icon: "CakeSlice", hue: 340 },
  { id: "ranajky", icon: "Egg", hue: 50 },
  { id: "salaty", icon: "Salad", hue: 130 },
  { id: "rychle", icon: "Timer", hue: 200 },
  { id: "deti", icon: "Baby", hue: 275 },
];
export const MEATS = ["kuracie", "bravcove", "hovadzie", "ryby", "bez"] as const;

/**
 * Katalóg = len recepty z knihy (kniha.ts) – overené zo skutočných receptov, s fotkami a podrobným postupom.
 * Pôvodné ukážkové recepty z prototypu boli 16. 11. 2026 odstránené (pokyn majiteľa). Plán týždňa v databáze
 * ich môže ešte obsahovať – zobrazí sa len uložený názov.
 */
export const CATALOG: Recipe[] = BOOK;
