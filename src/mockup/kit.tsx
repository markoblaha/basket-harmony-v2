/**
 * Pomocníci mockupu pre skutočné dáta: ikona položky (3D emoji podľa názvu a kategórie), dlaždica obchodu,
 * avatary členov, dni a sumy ako v mockupe (prototyp/src/ui.jsx, logic.js, data.js).
 */
import type { ReactNode } from "react";
import { formatDateTime, formatEuro, formatNumber, t } from "@/i18n";
import { CATS, PRODUCTS, RECIPES, STORES as MOCK_STORES } from "./catalog";

/** Obchody z mockupu + ďalšie, ktoré domácnosti bežne používajú (rovnaký tvar dlaždice). */
export const STORES: Record<string, { n: string; s: string; c1: string; c2: string }> = {
  ...MOCK_STORES,
  teta: { n: "Teta", s: "T", c1: "#3fa36b", c2: "#1f7046" },
  coop: { n: "Coop Jednota", s: "C", c1: "#e5583f", c2: "#a8301d" },
};

/** Text bez diakritiky, malými písmenami. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Entry = { words: string[]; e: string };
const INDEX: Entry[] = PRODUCTS.map((p) => ({ words: [...new Set(norm(`${p.n} ${p.syn}`).split(" ").filter((w) => w.length >= 3))], e: p.e }));
const cache = new Map<string, string>();

/**
 * 3D emoji k položke: podľa slov názvu porovnaných s produktmi mockupu (rovnaké slovo alebo iná koncovka,
 * napr. „mlieka“ = „mlieko“), inak podľa kategórie, inak košík.
 */
export function emojiFor(name: string, categoryId?: string | null): string {
  const key = `${name}|${categoryId ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const words = norm(name).split(" ").filter((w) => w.length >= 3);
  let best: { score: number; e: string } | null = null;
  for (const entry of INDEX) {
    let score = 0;
    words.forEach((w, i) => {
      const stem = w.slice(0, Math.max(4, w.length - 2));
      if (entry.words.includes(w)) score += i === 0 ? 3 : 2;
      else if (entry.words.some((x) => x.length >= 4 && x.startsWith(stem))) score += i === 0 ? 2 : 1;
    });
    if (score > (best?.score ?? 0)) best = { score, e: entry.e };
  }
  const e = best?.e ?? (categoryId && CATS[categoryId] ? CATS[categoryId].e : "basket");
  cache.set(key, e);
  return e;
}

/** Kľúč obchodu z mockupu podľa názvu zoznamu alebo obchodu („Lidl · sobota“ → lidl). */
export function storeKeyOf(name: string | null | undefined): string | null {
  const n = norm(name ?? "");
  if (!n) return null;
  return Object.keys(STORES).find((k) => n.split(" ").includes(norm(STORES[k]!.n)) || n.startsWith(norm(STORES[k]!.n))) ?? null;
}
export const storeName = (k: string | null) => (k && STORES[k] ? STORES[k].n : null);

/** Dlaždica obchodu (farebný štvorec so skratkou) – pri neznámom obchode prvé písmeno názvu. */
export function StoreTile({ k, n, s = 46 }: { k: string | null; n?: string; s?: number }) {
  const st = (k && STORES[k]) || { s: (n || "?").trim().charAt(0).toUpperCase() || "?", c1: "#9a9488", c2: "#6b665c" };
  return (
    <span
      className="stile"
      style={{ width: s, height: s, borderRadius: Math.round(s * 0.32), fontSize: st.s.length > 1 ? s * 0.34 : s * 0.4, background: `linear-gradient(160deg, ${st.c1}, ${st.c2})` }}
    >
      {st.s}
    </span>
  );
}

/** Farba člena domácnosti (stabilná podľa id). */
const COLS = ["#d98a6e", "#7f8fd8", "#6fb36a", "#c39ad6", "#e0b54f", "#5fb3b3"];
export function memberColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLS[h % COLS.length]!;
}

/** Avatary členov (začiatočné písmená). */
export function Avatars({ people, sm }: { people: { id: string; name: string }[]; sm?: boolean }) {
  return (
    <span className={`avs${sm ? " sm" : ""}`}>
      {people.map((p) => (
        <i key={p.id} style={{ background: memberColor(p.id) }}>
          {p.name.trim().charAt(0).toUpperCase() || "?"}
        </i>
      ))}
    </span>
  );
}

/** Tlačidlo mockupu (.btn pri / soft / ok, sm). */
export function Btn({ cls = "", onClick, children, label, disabled }: { cls?: string; onClick?: (e: React.MouseEvent) => void; children: ReactNode; label?: string; disabled?: boolean }) {
  return (
    <button type="button" className={`btn ${cls}`} onClick={onClick} aria-label={label} disabled={disabled}>
      {children}
    </button>
  );
}

/** „dnes“, „zajtra“, „včera“, „piatok“ (do týždňa), inak „so 18. 10.“ – ako relDay v mockupe. */
export function relDay(value: string | Date): string {
  const d = typeof value === "string" ? (value.length > 10 ? new Date(value) : new Date(`${value}T00:00:00`)) : value;
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  if (diff > 1 && diff < 7) return formatDateTime(d, { weekday: "long" });
  return formatDateTime(d, { weekday: "short", day: "numeric", month: "numeric" });
}

/** Suma zaokrúhlená na celé eurá („29 €“) a presná („0,81 €“). */
export const eur0 = (v: number) => formatNumber(Math.round(v), { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 });
export const eur = (v: number) => formatEuro(v);

/** Recept z mockupu (3D emoji, fotka) podľa kľúča alebo názvu receptu v appke. */
export function recipeArt(key: string, name: string): { e: string; pic: string | null; bg: string } {
  const n = norm(name);
  const r = RECIPES.find((x) => x.id === key) ?? RECIPES.find((x) => norm(x.n) === n) ?? RECIPES.find((x) => n.includes(norm(x.n).split(" ").pop()!));
  return r ? { e: r.e, pic: r.pic, bg: r.bg } : { e: "pot", pic: null, bg: "peach" };
}
