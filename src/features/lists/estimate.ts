/**
 * Odhad ceny položiek a zoznamov z katalógu domácnosti (item_catalog) – rovnaký výpočet v zozname,
 * v Nákupoch aj na Domove. Názov položky sa rozpozná raz (resolveName) a výsledok sa pamätá.
 */
import { useCallback, useMemo } from "react";
import { storeKeyOf } from "@/mockup/kit";
import { useItemCatalog, useItems, type Item } from "./api";
import { estimate, resolveName, type Estimate, type ItemCatalog, type Resolved } from "./itemCatalog";

export type Estimator = {
  catalog: ItemCatalog | undefined;
  resolve: (name: string) => Resolved | null;
  est: (item: Pick<Item, "name" | "quantity" | "unit">, storeKey: string | null) => Estimate | null;
};

export function useEstimator(householdId: string): Estimator {
  const catalog = useItemCatalog(householdId).data;
  const cache = useMemo(() => new Map<string, Resolved | null>(), [catalog]);
  const resolve = useCallback(
    (name: string) => {
      if (!catalog) return null;
      if (!cache.has(name)) cache.set(name, resolveName(catalog, name));
      return cache.get(name)!;
    },
    [catalog, cache],
  );
  const est = useCallback(
    (item: Pick<Item, "name" | "quantity" | "unit">, storeKey: string | null) => estimate(resolve(item.name), item.quantity, item.unit, storeKey, storeKeyOf),
    [resolve],
  );
  return { catalog, resolve, est };
}

export type Totals = { v: number; lo: number; hi: number; priced: number; n: number };

export function listTotals(items: Item[], est: Estimator["est"], storeKey: string | null): Totals {
  const t: Totals = { v: 0, lo: 0, hi: 0, priced: 0, n: 0 };
  for (const it of items) {
    t.n++;
    const e = est(it, storeKey);
    if (e) {
      t.v += e.v;
      t.lo += e.lo;
      t.hi += e.hi;
      t.priced++;
    }
  }
  return t;
}

/** Odhad otvorených položiek zoznamu (karta v Nákupoch, na Domove). */
export function useListEstimate(householdId: string, list: { id: string; name: string }, enabled = true): Totals | null {
  const items = useItems(enabled ? list.id : undefined);
  const e = useEstimator(householdId);
  return useMemo(() => {
    if (!items.data || !e.catalog) return null;
    return listTotals(
      items.data.filter((i) => i.status === "OPEN"),
      e.est,
      storeKeyOf(list.name),
    );
  }, [items.data, e, list.name]);
}
