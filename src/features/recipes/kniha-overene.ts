/*
 * Kniha receptov – overené recepty po šaržiach. Každý recept je JEDEN skutočný recept: najhodnotenejší z hlavných webov
 * (Apetit, Vaření, Toprecepty; aspoň ★4,0 a 10 hodnotení), ktorý prešiel kontrolou proti 11–20 ďalším receptom toho
 * istého variantu (kniha-porovnanie.ts z nástroja tools/kniha, bookCheck v kniha.ts). Suroviny, množstvá aj postup sú
 * presne podľa neho – len preložené do slovenčiny. Spoločné pravidlá: kniha-pomocne.ts.
 */
import { finish } from "./kniha-pomocne";
import { SARZA1 } from "./kniha-sarza1";
import { SARZA2 } from "./kniha-sarza2";
import type { Recipe } from "./types";

export const BOOK_CHECKED: Recipe[] = [...SARZA1, ...SARZA2].map(finish);
