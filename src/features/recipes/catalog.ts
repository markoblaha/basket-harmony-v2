/*
 * Kategórie receptov. Samotné recepty knihy sú v databáze (api.ts useBookRecipes). V krokoch {kľúč} = množstvo danej suroviny
 * prepočítané na zvolený počet porcií. Obsah receptov je údaj, nie text rozhrania – preto nie je v i18n.
 */
import type { RecipeCategory } from "./types";

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
