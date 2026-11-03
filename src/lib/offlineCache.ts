/**
 * Údaje pre prácu bez signálu (obchod): posledné načítané zoznamy, položky, nákupy, členovia a katalóg
 * sa uložia v telefóne (localStorage) a pri ďalšom otvorení appky sa ukážu hneď – aj bez internetu.
 * Server ostáva zdrojom pravdy: po pripojení sa všetko načíta nanovo. Pri odhlásení sa pamäť zmaže.
 */
import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const KEY = "bh.cache.v1";
/** Ktoré údaje majú zmysel bez signálu (podľa prvej časti kľúča dopytu). */
const KEEP = new Set(["lists", "items", "hub-sessions", "session", "requests", "households", "members", "profiles", "item-catalog", "frequent", "staples", "list-stats"]);
/** Staršie ako 7 dní sa nepoužijú (mohli by mýliť). */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Mapy a množiny (napr. mená členov) JSON nepozná – uložia sa ako zoznam a pri načítaní sa obnovia. */
function replace(_k: string, v: unknown) {
  if (v instanceof Map) return { __map: [...v.entries()] };
  if (v instanceof Set) return { __set: [...v.values()] };
  return v;
}
function revive(_k: string, v: unknown) {
  if (v && typeof v === "object") {
    const o = v as { __map?: [unknown, unknown][]; __set?: unknown[] };
    if (Array.isArray(o.__map)) return new Map(o.__map);
    if (Array.isArray(o.__set)) return new Set(o.__set);
  }
  return v;
}

export function restoreCache(qc: QueryClient) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw, revive) as { at: number; state: unknown };
    if (!saved?.state || Date.now() - saved.at > MAX_AGE) return localStorage.removeItem(KEY);
    hydrate(qc, saved.state);
  } catch {
    /* poškodená alebo nedostupná pamäť – appka si údaje načíta zo servera */
  }
}

export function persistCache(qc: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    try {
      const state = dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === "success" && KEEP.has(String(q.queryKey[0])),
      });
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), state }, replace));
    } catch {
      /* plná pamäť / súkromný režim – bez offline kópie */
    }
  };
  return qc.getQueryCache().subscribe((e) => {
    if (e.type !== "updated" || e.action.type !== "success") return;
    if (!KEEP.has(String(e.query.queryKey[0]))) return;
    if (!timer) timer = setTimeout(save, 1500);
  });
}

export function clearCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

/** Chyba spojenia (nie chyba pravidiel) – takú úpravu má zmysel skúsiť znova. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = String((error as { message?: unknown })?.message ?? error ?? "");
  return /failed to fetch|network|load failed|timeout|fetch failed|ERR_|aborted/i.test(m);
}
