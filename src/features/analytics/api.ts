/**
 * Prístup k Prehľadom. Všetky čísla počíta databáza (funkcie analytics_*), aby boli
 * na každej obrazovke rovnaké. Tu ich len načítame a typovo opíšeme.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/database.types";
import type { Period } from "./period";

export type Basis = "kg" | "l" | "ks";
export type Product = Row<"products">;

export type Overview = {
  total: number;
  receipts: number;
  days: number;
  items: number;
  discounts: number;
  deposits: number;
  prev_total: number;
  prev_receipts: number;
  offset_days: number | null;
  prev_to_date: number | null;
  daily: { d: string; a: number }[];
  prev_daily: { d: string; a: number }[];
  categories: { id: string; amount: number; items: number; prev_amount: number }[];
  stores: { key: string; name: string; amount: number; receipts: number; prev_amount: number; last_date: string | null }[];
  months: { month: string; amount: number }[];
  price_changes: {
    product_id: string;
    name: string;
    basis: Basis;
    old_price: number;
    new_price: number;
    change: number;
    store_name: string;
    purchased_on: string;
  }[];
  restock: {
    product_id: string;
    name: string;
    category_id: string;
    last_date: string;
    interval_days: number;
    days_since: number;
    last_price: number;
    last_store: string;
  }[];
  budgets: { category_id: string | null; amount: number; spent: number }[];
  pending_review: number;
  suspect_dates: number;
  uncategorized: number;
  unnormalized: number;
};

export type CategoryDetail = {
  amount: number;
  prev_amount: number;
  months: { month: string; amount: number }[];
  products: { product_id: string | null; name: string | null; amount: number; count: number }[];
  stores: { key: string; name: string; amount: number; count: number }[];
  items: {
    item_id: string;
    receipt_id: string;
    product_id: string | null;
    date: string;
    store: string;
    name: string;
    line_total: number;
    discount: number;
  }[];
  receipts: { receipt_id: string; date: string; store: string; amount: number; total: number }[];
};

export type StoreDetail = {
  name: string;
  amount: number;
  receipts: number;
  prev_amount: number;
  prev_receipts: number;
  months: { month: string; amount: number }[];
  weekdays: number[];
  categories: { id: string; amount: number }[];
  products: { product_id: string | null; name: string | null; count: number; amount: number }[];
  receipt_list: { receipt_id: string; date: string; time: string | null; amount: number; status: string }[];
};

export type ProductSummary = {
  id: string;
  name: string;
  brand: string | null;
  size_value: number | null;
  size_unit: "g" | "ml" | "ks" | null;
  category_id: string;
  purchases: number;
  spent: number;
  last_date: string;
  last_price: number;
  last_store: string;
  unit_price: number | null;
  basis: Basis;
  change: number | null;
};

export type ProductDetail = {
  product: Product;
  aliases: string[];
  purchases: {
    item_id: string;
    receipt_id: string;
    date: string;
    store: string;
    store_key: string;
    quantity: number;
    line_total: number;
    discount: number;
    shelf_unit: number | null;
    paid_unit: number | null;
    basis: Basis;
  }[];
  stores: {
    key: string;
    name: string;
    count: number;
    avg_unit: number;
    min_paid: number;
    last_unit: number;
    last_date: string;
  }[];
  interval_days: number | null;
  spent_year: number;
  count_year: number;
};

export type PriceHint = {
  item_id: string;
  product_id: string;
  name: string;
  last_price: number;
  last_store: string;
  last_date: string;
  cheapest_store: string;
  cheapest_unit: number;
  last_unit: number;
  basis: Basis;
};

/** Čísla z databázy môžu prísť ako text (numeric) – prevedieme ich na čísla. */
function numbers<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)) as T;
}

export const analyticsKeys = {
  all: ["analytics"] as const,
  overview: (hid: string, p: Period) => ["analytics", "overview", hid, p.from, p.to, p.scope] as const,
  category: (hid: string, id: string, p: Period) => ["analytics", "category", hid, id, p.from, p.to] as const,
  store: (hid: string, key: string, p: Period) => ["analytics", "store", hid, key, p.from, p.to] as const,
  products: (hid: string) => ["analytics", "products", hid] as const,
  product: (id: string) => ["analytics", "product", id] as const,
  hints: (listId: string) => ["analytics", "hints", listId] as const,
};

export function useOverview(householdId: string, p: Period) {
  return useQuery({
    queryKey: analyticsKeys.overview(householdId, p),
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_overview", {
        p_household_id: householdId,
        p_from: p.from,
        p_to: p.to,
        p_prev_from: p.prevFrom,
        p_prev_to: p.prevTo,
        p_scope: p.scope,
      });
      if (error) throw error;
      return numbers<Overview>(data);
    },
  });
}

export function useCategoryDetail(householdId: string, categoryId: string, p: Period) {
  return useQuery({
    queryKey: analyticsKeys.category(householdId, categoryId, p),
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_category", {
        p_household_id: householdId,
        p_category_id: categoryId,
        p_from: p.from,
        p_to: p.to,
        p_prev_from: p.prevFrom,
        p_prev_to: p.prevTo,
      });
      if (error) throw error;
      return numbers<CategoryDetail>(data);
    },
  });
}

export function useStoreDetail(householdId: string, storeKey: string, p: Period) {
  return useQuery({
    queryKey: analyticsKeys.store(householdId, storeKey, p),
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_store", {
        p_household_id: householdId,
        p_store_key: storeKey,
        p_from: p.from,
        p_to: p.to,
        p_prev_from: p.prevFrom,
        p_prev_to: p.prevTo,
      });
      if (error) throw error;
      return numbers<StoreDetail>(data);
    },
  });
}

export function useProducts(householdId: string) {
  return useQuery({
    queryKey: analyticsKeys.products(householdId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_products", { p_household_id: householdId });
      if (error) throw error;
      return numbers<ProductSummary[]>(data);
    },
  });
}

export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: analyticsKeys.product(productId ?? "none"),
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_product", { p_product_id: productId! });
      if (error) throw error;
      return numbers<ProductDetail>(data);
    },
  });
}

export function useListPriceHints(listId: string | undefined) {
  return useQuery({
    queryKey: analyticsKeys.hints(listId ?? "none"),
    enabled: !!listId,
    staleTime: 5 * 60_000,
    // Bez nasadenej analytiky (alebo pri chybe) zoznam funguje ďalej, len bez cien.
    retry: false,
    queryFn: async (): Promise<Map<string, PriceHint>> => {
      const { data, error } = await supabase.rpc("list_price_hints", { p_list_id: listId! });
      if (error) throw error;
      return new Map(numbers<PriceHint[]>(data).map((h) => [h.item_id, h]));
    },
  });
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: analyticsKeys.all });
  qc.invalidateQueries({ queryKey: ["receipt"] });
};

export type ProductPatch = {
  name: string;
  brand: string | null;
  sizeValue: number | null;
  sizeUnit: "g" | "ml" | "ks" | null;
  categoryId: string;
};

export function useUpdateProduct(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProductPatch) => {
      const { error } = await supabase.rpc("update_product", {
        p_product_id: productId,
        p_name: patch.name,
        p_brand: patch.brand,
        p_size_value: patch.sizeValue,
        p_size_unit: patch.sizeUnit,
        p_category_id: patch.categoryId,
      });
      if (error) throw error;
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useMergeProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, sources }: { target: string; sources: string[] }) => {
      const { data, error } = await supabase.rpc("merge_products", { p_target: target, p_sources: sources });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useSetBudget(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (budgets: { categoryId: string | null; amount: number | null }[]) => {
      for (const b of budgets) {
        const { error } = await supabase.rpc("set_budget", {
          p_household_id: householdId,
          p_category_id: b.categoryId,
          p_amount: b.amount,
        });
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: analyticsKeys.all }),
  });
}

// ------------------------------------------------------------------ zjednotenie produktov
export type NormalizeState = { running: boolean; remaining: number | null; error: unknown };

/**
 * Keď sú v domácnosti nezjednotené produkty (nové bločky), spustí ich zjednotenie na serveri
 * po dávkach. Beží raz za otvorenie aplikácie; pri chybe sa dá zopakovať.
 */
export function useProductNormalization(householdId: string, pending: number | undefined) {
  const qc = useQueryClient();
  const [state, setState] = useState<NormalizeState>({ running: false, remaining: null, error: null });
  const started = useRef(false);

  async function run() {
    started.current = true;
    setState({ running: true, remaining: pending ?? null, error: null });
    try {
      for (let round = 0; round < 40; round++) {
        const { data, error } = await supabase.functions.invoke("normalize-products", { body: { household_id: householdId } });
        if (error) {
          let detail = "";
          try {
            detail = JSON.stringify(await (error as { context?: Response }).context?.json());
          } catch {
            /* bez detailu */
          }
          throw new Error(detail.includes("GEMINI_402") ? "GEMINI_402" : "NORMALIZE_FAILED");
        }
        const res = data as { processed: number; remaining: number };
        setState({ running: true, remaining: res.remaining, error: null });
        qc.invalidateQueries({ queryKey: analyticsKeys.all });
        if (res.remaining === 0 || res.processed === 0) break;
      }
      setState({ running: false, remaining: 0, error: null });
    } catch (error) {
      setState({ running: false, remaining: null, error });
    } finally {
      qc.invalidateQueries({ queryKey: analyticsKeys.all });
    }
  }

  useEffect(() => {
    if (!started.current && pending && pending > 0) void run();
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, retry: run };
}
