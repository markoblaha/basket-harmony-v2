/*
 * Ochutnávač – poradie receptov (bez React, testovateľné).
 * Nekonečný feed: kolá receptov s fotkou; v každom kole najprv recepty z knihy, ktoré si ešte nevidel
 * a na ktoré máš doma najviac surovín. Dve rovnaké kategórie za sebou len vtedy, keď iná by bola výrazne horšia,
 * recept nikdy dvakrát po sebe (ani na hranici kôl), recepty s „Nie“ až na konci.
 * Po každých BREAK_EVERY receptoch je prestávka so súhrnom.
 */
export const BREAK_EVERY = 12;
/** Položka feedu, ktorá nie je recept, ale prestávka so súhrnom. */
export const isBreak = (id: string) => id.startsWith("#b");

export type FeedRecipe = { id: string; cat: string; book: boolean };
export type FeedSignals = { have: (id: string) => number; seen: Record<string, number>; no: Record<string, number>; rnd: (id: string) => number };

export function feedScore(r: FeedRecipe, s: FeedSignals) {
  return (r.book ? 6 : 0) + s.have(r.id) * 3 - (s.seen[r.id] ? 4 : 0) - (s.no[r.id] ? 12 : 0) + s.rnd(r.id);
}

/** Jedno kolo receptov: podľa skóre, s pestrými kategóriami. */
export function feedRound(pool: FeedRecipe[], s: FeedSignals, after?: FeedRecipe): string[] {
  const left = [...pool].sort((a, b) => feedScore(b, s) - feedScore(a, s));
  const out: string[] = [];
  let prev = after;
  while (left.length) {
    // Najlepší ďalší recept; iná kategória má prednosť, ak nie je výrazne horšia (napr. odmietnutá).
    let best = left.findIndex((r) => r.id !== prev?.id);
    if (best < 0) best = 0;
    const alt = left.findIndex((r) => r.id !== prev?.id && r.cat !== prev?.cat);
    const i = alt >= 0 && feedScore(left[best]!, s) - feedScore(left[alt]!, s) <= 5 ? alt : best;
    const [r] = left.splice(i, 1);
    out.push(r!.id);
    prev = r;
  }
  return out;
}

/** Vloží prestávky: po každých BREAK_EVERY receptoch (počíta sa aj s receptmi, ktoré už vo feede sú). */
export function withBreaks(ids: string[], recipesBefore: number) {
  const out: string[] = [];
  let n = recipesBefore;
  for (const id of ids) {
    out.push(id);
    n += 1;
    if (n % BREAK_EVERY === 0) out.push(`#b${n}`);
  }
  return out;
}
