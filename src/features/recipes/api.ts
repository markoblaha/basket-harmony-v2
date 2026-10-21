/**
 * Prístup k dátam receptov. Katalóg je v aplikácii (catalog.ts), vlastné recepty, obľúbené
 * a čakajúce/uvarené recepty sú v databáze. Pravidlá (suroviny do zoznamu, žiadosti počas
 * nákupu, uvarenie) robia SQL funkcie plan_recipes / cook_recipe / set_recipe_plan_status.
 * Čítanie receptu z fotky/odkazu/textu, návrh receptu a otázky pri varení robí edge funkcia recipe-ai (Gemini).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocale } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { CATALOG } from "./catalog";
import { FOODS } from "./foods";
import type { Ingredient, Meat, QA, Recipe, RecipeCategory, Step } from "./types";

export const recipeKeys = {
  mine: (h: string) => ["recipes", h] as const,
  favs: (h: string) => ["recipe-favs", h] as const,
  plans: (h: string) => ["recipe-plans", h] as const,
};

type RecipeRow = {
  id: string;
  name: string;
  category: string;
  meat: string;
  minutes: number;
  difficulty: number;
  portions: number;
  icon: string | null;
  tags: string[];
  source: string | null;
  source_url: string | null;
  ingredients: Json;
  steps: Json;
  qa: Json;
  ai: boolean;
};

const HUES: Record<string, number> = { hlavne: 25, cestoviny: 45, polievky: 95, sladke: 340, ranajky: 50, salaty: 130 };
const ICONS: Record<string, string> = { hlavne: "CookingPot", cestoviny: "UtensilsCrossed", polievky: "Soup", sladke: "CakeSlice", ranajky: "Egg", salaty: "Salad" };

function fromRow(r: RecipeRow): Recipe {
  return {
    id: r.id,
    name: r.name,
    category: r.category as RecipeCategory,
    meat: r.meat as Meat,
    minutes: r.minutes,
    difficulty: Math.min(3, Math.max(1, r.difficulty)) as 1 | 2 | 3,
    portions: r.portions,
    hue: HUES[r.category] ?? 30,
    icon: r.icon || ICONS[r.category] || "CookingPot",
    tags: r.tags ?? [],
    source: r.source ?? "",
    sourceUrl: r.source_url,
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []) as unknown as Ingredient[],
    steps: (Array.isArray(r.steps) ? r.steps : []) as unknown as Step[],
    qa: (Array.isArray(r.qa) ? r.qa : []) as unknown as QA[],
    mine: true,
    ai: r.ai,
  };
}

/** Vlastné recepty domácnosti (najnovšie prvé). */
export function useMyRecipes(householdId: string) {
  return useQuery({
    queryKey: recipeKeys.mine(householdId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name, category, meat, minutes, difficulty, portions, icon, tags, source, source_url, ingredients, steps, qa, ai")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as RecipeRow[]).map(fromRow);
    },
  });
}

/** Všetky recepty (vlastné + katalóg) a vyhľadanie podľa id. */
export function useRecipes(householdId: string) {
  const mine = useMyRecipes(householdId);
  return useMemo(() => {
    const own = mine.data ?? [];
    const all = [...own, ...CATALOG];
    const byId = new Map(all.map((r) => [r.id, r]));
    return { mine: own, catalog: CATALOG, all, find: (id: string) => byId.get(id), isPending: mine.isPending, error: mine.error };
  }, [mine.data, mine.isPending, mine.error]);
}

export type RecipeDraft = Omit<Recipe, "id" | "hue" | "mine">;

/** Uloží recept (po kontrole importu alebo návrhu AI). Neisté miesta sa neukladajú. */
export function useSaveRecipe(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: RecipeDraft) => {
      const clean = <T extends { uncertain?: unknown }>(x: T) => {
        const { uncertain: _u, ...rest } = x;
        return rest;
      };
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          household_id: householdId,
          name: d.name.trim().slice(0, 120),
          category: d.category,
          meat: d.meat,
          minutes: d.minutes,
          difficulty: d.difficulty,
          portions: d.portions,
          icon: d.icon,
          tags: d.tags,
          source: d.source?.slice(0, 200) || null,
          source_url: d.sourceUrl?.slice(0, 2000) || null,
          ingredients: d.ingredients.map(clean) as unknown as Json,
          steps: d.steps.map(clean) as unknown as Json,
          qa: (d.qa ?? []) as unknown as Json,
          ai: !!d.ai,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.mine(householdId) }),
  });
}

export function useDeleteRecipe(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.mine(householdId) }),
  });
}

/* ------------------------------------------------------------------ obľúbené */
export function useFavorites(householdId: string) {
  return useQuery({
    queryKey: recipeKeys.favs(householdId),
    queryFn: async () => {
      const { data, error } = await supabase.from("recipe_favorites").select("recipe_key").eq("household_id", householdId);
      if (error) throw error;
      return new Set(data.map((x) => x.recipe_key));
    },
  });
}

export function useToggleFavorite(householdId: string) {
  const qc = useQueryClient();
  const key = recipeKeys.favs(householdId);
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const res = on
        ? await supabase.from("recipe_favorites").insert({ household_id: householdId, recipe_key: id })
        : await supabase.from("recipe_favorites").delete().eq("household_id", householdId).eq("recipe_key", id);
      if (res.error && res.error.code !== "23505") throw res.error;
    },
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<Set<string>>(key);
      const next = new Set(before ?? []);
      if (on) next.add(id);
      else next.delete(id);
      qc.setQueryData(key, next);
      return { before };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/* ------------------------------------------------------------------ čakajúce a uvarené */
export type RecipePlan = {
  id: string;
  recipe_key: string;
  recipe_name: string;
  portions: number;
  list_id: string | null;
  status: "PENDING" | "COOKED" | "DISMISSED";
  created_at: string;
  cooked_at: string | null;
  cook_seconds: number | null;
};

export function useRecipePlans(householdId: string) {
  return useQuery({
    queryKey: recipeKeys.plans(householdId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_plans")
        .select("id, recipe_key, recipe_name, portions, list_id, status, created_at, cooked_at, cook_seconds")
        .eq("household_id", householdId)
        .neq("status", "DISMISSED")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RecipePlan[];
    },
  });
}

export type PlanItem = { name: string; quantity: number; unit: string; category_id: string; note: string };
export type PlanInput = {
  listId: string | null;
  newList: { name: string; planned_for: string | null; note: string } | null;
  items: PlanItem[];
  recipes: { key: string; name: string; portions: number }[];
};

/** Suroviny receptov do zoznamu (nového alebo existujúceho) + recepty čakajú na uvarenie. */
export function usePlanRecipes(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const { data, error } = await supabase.rpc("plan_recipes", {
        p_household_id: householdId,
        p_list_id: input.listId,
        p_new_list: input.newList as unknown as Json,
        p_items: input.items as unknown as Json,
        p_recipes: input.recipes as unknown as Json,
      });
      if (error) throw error;
      return data as { list_id: string; items: number; requests: number };
    },
    // Počká na nové zoznamy – aplikácia hneď otvorí (aj novo vytvorený) zoznam.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: recipeKeys.plans(householdId) }),
        qc.invalidateQueries({ queryKey: ["lists"] }),
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["requests"] }),
        qc.invalidateQueries({ queryKey: ["list-stats"] }),
      ]),
  });
}

export function useCookRecipe(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { key: string; name: string; portions: number; seconds: number }) => {
      const { error } = await supabase.rpc("cook_recipe", {
        p_household_id: householdId,
        p_recipe_key: v.key,
        p_recipe_name: v.name,
        p_portions: v.portions,
        p_seconds: v.seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.plans(householdId) }),
  });
}

export function useSetPlanStatus(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: "PENDING" | "DISMISSED" }) => {
      const { error } = await supabase.rpc("set_recipe_plan_status", { p_plan_id: v.id, p_status: v.status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.plans(householdId) }),
  });
}

/* ------------------------------------------------------------------ Gemini (edge funkcia recipe-ai) */
/** Zoznam potravín pre Gemini, aby suroviny priradil ku kľúčom (kvôli výžive a baleniam). */
const FOOD_LIST = Object.entries(FOODS).map(([k, f]) => `${k}=${f.name}`).join("; ");

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("recipe-ai", { body: { ...body, locale: getLocale(), foods: FOOD_LIST } });
  if (error) {
    // Kód chyby je v tele odpovede ({ error: "LINK_UNREADABLE" } …) – preložíme ho cez error.*.
    const ctx = (error as { context?: Response }).context;
    const parsed = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    if (parsed?.error) throw new Error(String(parsed.error));
    throw error;
  }
  return data as T;
}

export type ReadInput =
  | { kind: "photo"; images: { mime: string; data: string }[] }
  | { kind: "link"; url: string }
  | { kind: "text"; text: string };

/** Prečíta recept z fotky (aj viac strán), snímky obrazovky, odkazu alebo textu. Neisté miesta označí. */
export function readRecipe(input: ReadInput) {
  return invoke<{ recipe: RecipeDraft }>({ action: "read", ...input }).then((r) => r.recipe);
}

/** Navrhne nový recept podľa zadania („palacinky so špenátom“). */
export function createRecipe(query: string) {
  return invoke<{ recipe: RecipeDraft }>({ action: "create", query }).then((r) => r.recipe);
}

export type RecipeVariant = { name: string; variant: string; minutes: number; difficulty: 1 | 2 | 3; icon: string | null };

/** Hlasový nákup: za 1–2 s názvy rôznych variantov jedla („Hovädzí guláš“ → klasický, pivný…). */
export function recipeVariants(query: string, count: number, exclude: string[]) {
  return invoke<{ variants: RecipeVariant[] }>({ action: "variants", query, count, exclude }).then((r) => r.variants);
}

/** Hlasový nákup: suroviny a postup k vybranému variantu (appka ich pýta pre všetky varianty naraz). */
export function suggestRecipe(name: string, variant: string) {
  return invoke<{ recipe: RecipeDraft & { variant: string } }>({ action: "suggest", name, variant }).then((r) => r.recipe);
}

export type Chat = { q: string; a: string; off?: boolean };

/** Otázka pri varení – odpovedá len k tomuto receptu a kroku. */
export function askRecipe(v: { recipe: Recipe; portions: number; step: number; question: string; history: Chat[] }) {
  const r = v.recipe;
  return invoke<{ answer: string; off_topic: boolean }>({
    action: "ask",
    question: v.question,
    portions: v.portions,
    step: v.step,
    history: v.history.slice(-6),
    recipe: { name: r.name, portions: r.portions, ingredients: r.ingredients.map((i) => ({ name: FOODS[i.food]?.name || i.label || i.food, qty: i.qty, unit: i.unit })), steps: r.steps.map((s) => s.text) },
  });
}

/** Zmenší fotku pred odoslaním (dlhšia strana najviac 1600 px, JPEG) a vráti base64 bez hlavičky. */
export async function imageToBase64(file: File): Promise<{ mime: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}
