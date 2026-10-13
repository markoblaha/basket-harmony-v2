/**
 * Čisté výpočty rozdiktovaného zoznamu (bez React-u, dajú sa testovať).
 *
 * Každá veta sa spracuje dvakrát:
 *  1. hneď lokálne (parse.ts) – položky padnú do zoznamu bez čakania,
 *  2. o chvíľu AI – výsledok lokálneho kroku sa „vráti“ a nahradí presnejším.
 * `applyOps` preto okrem nového zoznamu vracia aj, čo presne zmenila (undo).
 */
import { guessCategory, normalizeName } from "@/lib/categories";
import { countOf, isCountable, sameProduct } from "@/features/lists/qty";
import type { DraftItem } from "./api";
import type { VoiceOp } from "./parse";

/** Krok pri potiahnutí: kusy po 1, gramy po 100, kilá po pol… */
export function stepOf(unit: string | null): number {
  switch (unit) {
    case "g": return 100;
    case "dkg": return 10;
    case "kg": return 0.5;
    case "ml": return 250;
    default: return 1;
  }
}

export function findItem(items: DraftItem[], name: string): DraftItem | undefined {
  const key = normalizeName(name);
  return (
    items.find((i) => sameProduct(i.name, name)) ??
    items.find((i) => {
      const k = normalizeName(i.name);
      return k.length > 2 && key.length > 2 && (k.includes(key) || key.includes(k));
    })
  );
}

export type Effect = {
  items: DraftItem[];
  /** nové položky, v poradí, ako zazneli */
  added: string[];
  /** zmenené položky a ich pôvodný stav */
  prev: Record<string, DraftItem>;
  merged: string[];
  removed: { item: DraftItem; index: number }[];
  done: boolean;
  understood: boolean;
};

const newId = () => crypto.randomUUID();

/** Použije operácie na zoznam. `reuseId` dovolí AI výsledku zdediť ID lokálne pridanej položky (bez druhého pádu). */
export function applyOps(start: DraftItem[], ops: VoiceOp[], reuseId?: (name: string) => string | undefined): Effect {
  let items = [...start];
  const eff: Effect = { items, added: [], prev: {}, merged: [], removed: [], done: false, understood: false };
  const remember = (it: DraftItem) => {
    if (!eff.prev[it.id] && !eff.added.includes(it.id)) eff.prev[it.id] = it;
  };
  const patch = (id: string, p: Partial<DraftItem>) => {
    items = items.map((i) => (i.id === id ? { ...i, ...p } : i));
  };

  for (const op of ops) {
    if (op.op === "done") {
      eff.done = true;
      eff.understood = true;
    } else if (op.op === "add") {
      eff.understood = true;
      const existing = op.status === "ok" ? findItem(items, op.name) : undefined;
      if (existing && existing.status === "ok" && isCountable(existing.unit) && isCountable(op.unit) && sameProduct(existing.name, op.name)) {
        remember(existing);
        patch(existing.id, { quantity: countOf(existing.quantity) + countOf(op.quantity), unit: existing.unit ?? "ks" });
        if (!eff.added.includes(existing.id)) eff.merged.push(existing.id);
        continue;
      }
      const it: DraftItem = {
        id: reuseId?.(op.name) ?? newId(),
        name: op.name,
        quantity: op.quantity,
        unit: op.unit,
        categoryId: op.categoryId ?? guessCategory(op.name),
        status: op.status,
        suggestions: op.suggestions,
      };
      items = [it, ...items];
      eff.added.push(it.id);
    } else if (op.op === "remove") {
      const it = findItem(items, op.target);
      if (!it) continue;
      eff.understood = true;
      const index = items.indexOf(it);
      if (eff.added.includes(it.id)) eff.added = eff.added.filter((x) => x !== it.id);
      else eff.removed.push({ item: eff.prev[it.id] ?? it, index });
      items = items.filter((i) => i.id !== it.id);
    } else if (op.op === "change") {
      const it = findItem(items, op.target);
      if (!it) continue;
      eff.understood = true;
      remember(it);
      const p: Partial<DraftItem> = { status: "ok" };
      if (op.name && op.quantity == null && op.delta == null) Object.assign(p, { name: op.name, suggestions: [] });
      if (op.quantity != null) Object.assign(p, { quantity: op.quantity, unit: op.unit ?? it.unit ?? "ks" });
      else if (op.delta != null) {
        const step = isCountable(it.unit) ? 1 : stepOf(it.unit);
        Object.assign(p, { quantity: Math.max(stepOf(it.unit), countOf(it.quantity) + op.delta * step), unit: it.unit ?? "ks" });
      }
      if (op.name && (op.quantity != null || op.delta != null)) p.name = op.name;
      if (it.status === "needs_qty" && p.quantity == null) delete p.status;
      if (op.name) p.categoryId = guessCategory(op.name);
      patch(it.id, p);
      if (!eff.added.includes(it.id)) eff.merged.push(it.id);
    }
  }
  eff.items = items;
  return eff;
}

/** Vráti zoznam do stavu pred lokálnym rozborom vety (to, čo človek medzitým urobil inde, ostane). */
export function undo(current: DraftItem[], eff: Effect): DraftItem[] {
  let items = current.filter((i) => !eff.added.includes(i.id)).map((i) => eff.prev[i.id] ?? i);
  for (const { item, index } of eff.removed) {
    if (items.some((i) => i.id === item.id)) continue;
    items = [...items.slice(0, index), item, ...items.slice(index)];
  }
  return items;
}

/**
 * Nahradí lokálny výsledok vety výsledkom AI. Položky s rovnakým názvom si
 * ponechajú ID, takže sa len potichu spresnia (kategória, tvar slova) a znova nepadajú.
 */
export function reconcile(current: DraftItem[], local: Effect, aiOps: VoiceOp[]): Effect {
  const base = undo(current, local);
  const pool = local.added
    .map((id) => current.find((i) => i.id === id))
    .filter((i): i is DraftItem => !!i);
  const reuse = (name: string) => {
    const k = normalizeName(name);
    const hit = pool.find((i) => normalizeName(i.name) === k) ?? pool.find((i) => {
      const n = normalizeName(i.name);
      return n.slice(0, 4) === k.slice(0, 4);
    });
    if (!hit) return undefined;
    pool.splice(pool.indexOf(hit), 1);
    return hit.id;
  };
  return applyOps(base, aiOps, reuse);
}

/** Čo sa medzi dvoma stavmi zmenilo – podľa toho obrazovka animuje. */
export function diff(before: DraftItem[], after: DraftItem[]) {
  const b = new Map(before.map((i) => [i.id, i]));
  const a = new Set(after.map((i) => i.id));
  const added = after.filter((i) => !b.has(i.id)).map((i) => i.id);
  const removed = before.map((item, index) => ({ item, index })).filter(({ item }) => !a.has(item.id));
  const changed = after
    .filter((i) => {
      const o = b.get(i.id);
      return o && (o.name !== i.name || o.quantity !== i.quantity || o.unit !== i.unit || o.status !== i.status);
    })
    .map((i) => i.id);
  return { added, removed, changed };
}
