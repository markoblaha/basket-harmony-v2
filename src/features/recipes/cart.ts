/**
 * Košík receptov – rozpracovaný výber receptov na nákup surovín (recepty a porcie,
 * čo máš doma, ďalšie veci). Je to len koncept v zariadení (bh.recipeCart); do databázy
 * ide až po „Vytvoriť zoznam / Pridať do zoznamu“ cez plan_recipes.
 * Prečítaný recept pred uložením (kontrola importu) drží bh.recipeDraft na čas relácie.
 */
import { useSyncExternalStore } from "react";
import type { CartEntry } from "./logic";
import type { RecipeDraft } from "./api";

export type Extra = { id: string; name: string; qty: number; unit: string; cat: string };
export type CartState = { household: string | null; items: CartEntry[]; marks: Record<string, "home" | "buy">; extras: Extra[] };

const KEY = "bh.recipeCart";
const EMPTY: CartState = { household: null, items: [], marks: {}, extras: [] };
const listeners = new Set<() => void>();

function read(): CartState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<CartState>;
    return { household: v.household ?? null, items: Array.isArray(v.items) ? v.items : [], marks: v.marks ?? {}, extras: Array.isArray(v.extras) ? v.extras : [] };
  } catch {
    return EMPTY;
  }
}
let state: CartState = read();

function write(next: CartState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* súkromné okno – košík ostane len v pamäti */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Košík pre domácnosť (pri inej domácnosti je prázdny). */
export function useCart(householdId: string): CartState {
  const s = useSyncExternalStore(subscribe, () => state);
  return s.household === householdId ? s : EMPTY;
}

export const cart = {
  get: (householdId: string) => (state.household === householdId ? state : { ...EMPTY, household: householdId }),
  update(householdId: string, fn: (s: CartState) => CartState) {
    write(fn({ ...this.get(householdId), household: householdId }));
  },
  set(householdId: string, recipeId: string, portions: number) {
    this.update(householdId, (s) => {
      const has = s.items.some((x) => x.recipeId === recipeId);
      return { ...s, items: has ? s.items.map((x) => (x.recipeId === recipeId ? { ...x, portions } : x)) : [...s.items, { recipeId, portions }] };
    });
  },
  remove(householdId: string, recipeId: string) {
    this.update(householdId, (s) => ({ ...s, items: s.items.filter((x) => x.recipeId !== recipeId) }));
  },
  clear(householdId: string) {
    write({ ...EMPTY, household: householdId });
  },
};

/* ------------------------------------------------------------------ prečítaný recept na kontrolu */
const DRAFT = "bh.recipeDraft";
export type StoredDraft = { recipe: RecipeDraft; from: "photo" | "link" | "text" | "ai" };

export function saveDraft(d: StoredDraft) {
  try {
    sessionStorage.setItem(DRAFT, JSON.stringify(d));
  } catch {
    /* bez úložiska kontrola po obnovení stránky nebude */
  }
  memoryDraft = d;
}
let memoryDraft: StoredDraft | null = null;
export function loadDraft(): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT);
    if (raw) return JSON.parse(raw) as StoredDraft;
  } catch {
    /* pozri nižšie */
  }
  return memoryDraft;
}
export function clearDraft() {
  memoryDraft = null;
  try {
    sessionStorage.removeItem(DRAFT);
  } catch {
    /* nič */
  }
}
