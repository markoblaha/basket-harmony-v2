/**
 * Rýchle pridanie – čisté výpočty (bez Reactu, dajú sa testovať).
 *
 * Dlaždice, bubliny aj návrhy pri písaní sú „sloty“: produkt ostáva na svojom mieste, kým
 * ho nepridáš. Potom (alebo keď sa objaví v zozname) jeho miesto dostane ďalší produkt
 * v poradí. Ostatné sa nepohnú, takže prst nikdy netrafí omylom iný produkt.
 */
import { normalizeName } from "@/lib/categories";

export const keyOf = (name: string) => normalizeName(name);

/** Spojí zdroje v poradí priority, bez duplicít a bez vylúčených (napr. čo už je v zozname). */
export function candidates(sources: readonly (readonly string[])[], exclude: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources)
    for (const name of src) {
      const k = keyOf(name);
      if (!k || seen.has(k) || exclude.has(k)) continue;
      seen.add(k);
      out.push(name);
    }
  return out;
}

/**
 * Nové sloty: kto z `prev` je stále v `pool` (alebo sa práve ťuká – `hold`), ostane na svojom mieste;
 * prázdne miesta dostanú ďalších z `pool` v poradí.
 */
export function nextSlots(prev: readonly string[], pool: readonly string[], size: number, hold: ReadonlySet<string> = new Set()): string[] {
  const inPool = new Set(pool.map(keyOf));
  const kept = prev.slice(0, size).map((n) => (inPool.has(keyOf(n)) || hold.has(keyOf(n)) ? n : null));
  const used = new Set(kept.filter((n): n is string => !!n).map(keyOf));
  const rest = pool.filter((n) => !used.has(keyOf(n)));
  const out: string[] = [];
  for (let i = 0; i < size; i++) {
    const k = kept[i];
    if (k) out.push(k);
    else {
      const fill = rest.shift();
      if (fill) out.push(fill);
    }
  }
  return out;
}

export const sameSlots = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((n, i) => n === b[i]);
