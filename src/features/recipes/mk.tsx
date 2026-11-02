/**
 * Spoločné časti receptov z mockupu (prototyp/src/cookbook.jsx, logic.js): karta receptu, kategórie
 * s fotkami, rýchly výber, „mám doma“ pri surovinách a cena za porciu z bločkov domácnosti.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { E, I } from "@/mockup/ui";
import { eur, recipeArt } from "@/mockup/kit";
import { useEstimator, type Estimator } from "@/features/lists/estimate";
import { buyPlan, mergeIngredients, type Row } from "./logic";
import type { Recipe } from "./types";

/** Kategórie knihy (ako v mockupe) – nad kategóriami a druhom mäsa receptov z appky. */
export const RCATS: { id: string; e: string; pic: string; test: (r: Recipe) => boolean }[] = [
  { id: "polievky", e: "stew", pic: "p_zeleninova", test: (r) => r.category === "polievky" },
  { id: "maso", e: "meat", pic: "gulas_p", test: (r) => (r.meat === "bravcove" || r.meat === "hovadzie") && r.category !== "polievky" },
  { id: "hydina", e: "poultry", pic: "stehna_p", test: (r) => r.meat === "kuracie" && r.category !== "polievky" },
  { id: "cestoviny", e: "spaghetti", pic: "penne_p", test: (r) => r.category === "cestoviny" },
  { id: "ryby", e: "fish", pic: "losos_p", test: (r) => r.meat === "ryby" },
  { id: "bezmasa", e: "salad", pic: "salat_p", test: (r) => r.meat === "bez" && r.category !== "sladke" && r.category !== "ranajky" },
  { id: "sladke", e: "pancakes", pic: "palacinky_p", test: (r) => r.category === "sladke" || r.category === "ranajky" },
  { id: "all", e: "books", pic: "x_pizza", test: () => true },
];
/** Do koľko € na porciu je jedlo „lacné“. */
export const CHEAP = 1.2;
export const RCOLS: { id: string; e: string; test: ((r: Recipe) => boolean) | null }[] = [
  { id: "rychle", e: "timer", test: (r) => r.minutes <= 30 },
  { id: "deti", e: "teddy", test: (r) => r.tags.includes("deti") },
  { id: "lacne", e: "coin", test: null },
];

/** Obrázok receptu z mockupu (fotka alebo 3D emoji na farebnom pozadí). */
export function art(r: Pick<Recipe, "id" | "name" | "mine">) {
  return r.mine ? { e: "pot", pic: null as string | null, bg: "peach" } : recipeArt(r.id, r.name);
}

/* ------------------------------------------------------------------ mám doma (v zariadení) */
const KEY = "bh.recipeHave";
type HaveMap = Record<string, Record<string, boolean>>;
const listeners = new Set<() => void>();
function load(): HaveMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as HaveMap;
  } catch {
    return {};
  }
}
let have: HaveMap = load();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Čo mám pri recepte doma (ťuk prepne). Bez ťuknutia: základné suroviny (soľ, olej…) doma, ostatné nie. */
export function useHave() {
  const map = useSyncExternalStore(subscribe, () => have);
  const isHome = useCallback((rid: string, row: Row) => map[rid]?.[row.key] ?? row.staple, [map]);
  const toggle = useCallback((rid: string, row: Row) => {
    const cur = have[rid]?.[row.key] ?? row.staple;
    have = { ...have, [rid]: { ...have[rid], [row.key]: !cur } };
    try {
      localStorage.setItem(KEY, JSON.stringify(have));
    } catch {
      /* súkromné okno – platí do zatvorenia */
    }
    listeners.forEach((l) => l());
  }, []);
  return { isHome, toggle };
}

/* ------------------------------------------------------------------ suroviny a cena */
export type IngRow = Row & { home: boolean; cost: number; plan: ReturnType<typeof buyPlan> };

/** Suroviny receptu pre daný počet porcií: čo mám doma a koľko stojí to, čo treba kúpiť. */
export function recipeRows(r: Recipe, portions: number, find: (id: string) => Recipe | undefined, est: Estimator, isHome: (rid: string, row: Row) => boolean): IngRow[] {
  return mergeIngredients([{ recipeId: r.id, portions }], find).map((row) => {
    const plan = buyPlan(row);
    const e = est.est({ name: plan.name, quantity: plan.qty, unit: plan.unit }, null);
    return { ...row, home: isHome(r.id, row), cost: e?.v ?? 0, plan };
  });
}

/** Cena za porciu a „máte všetko“ pre zoznam kariet (počíta sa raz). */
export function useRecipeFacts(householdId: string, recipes: Recipe[], find: (id: string) => Recipe | undefined) {
  const est = useEstimator(householdId);
  const { isHome } = useHave();
  const facts = useMemo(() => {
    const m = new Map<string, { cost: number; have: number; all: number }>();
    for (const r of recipes) {
      const rows = recipeRows(r, r.portions, find, est, isHome);
      const cost = rows.filter((x) => !x.staple).reduce((a, x) => a + x.cost, 0) / Math.max(1, r.portions);
      m.set(r.id, { cost, have: rows.filter((x) => x.home).length, all: rows.length });
    }
    return m;
  }, [recipes, find, est, isHome]);
  return { facts, est, isHome };
}

/** Karta receptu – rovnaká všade: obrázok, názov, čas a cena za porciu. */
export function RCard({ r, onOpen, wide, fav, fact }: { r: Recipe; onOpen: () => void; wide?: boolean; fav?: boolean; fact?: { cost: number; have: number; all: number } }) {
  const a = art(r);
  const meta = fact && fact.cost > 0 ? t("rk.cardMeta", { min: r.minutes, price: eur(fact.cost) }) : t("rk.minutes", { min: r.minutes });
  return (
    <button type="button" className={`rcard${wide ? " wide" : ""}`} onClick={onOpen}>
      <span className={`rimg${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}>
        {!a.pic && <E k={a.e} />}
        {fav && (
          <span className="rfav">
            <I n="heart" />
          </span>
        )}
        {fact && fact.all > 0 && fact.have === fact.all && <span className="rok">{t("rk.haveAll")}</span>}
      </span>
      <span className="rtxt">
        <b>{r.name}</b>
        <small>{meta}</small>
      </span>
    </button>
  );
}
