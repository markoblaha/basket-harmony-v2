/**
 * Obdobie Prehľadov je uložené v adrese stránky (?r=month&m=2026-10&s=all), takže
 * tlačidlo Späť vráti presne tam, kde si bol, a obdobie platí aj na detailoch.
 */
import { useSearchParams } from "react-router";

export type Range = "month" | "3m" | "year";
export type Scope = "all" | "everyday";

export type Period = {
  range: Range;
  /** Mesiac, ku ktorému sa obdobie vzťahuje (posledný mesiac obdobia): "2026-10". */
  month: string;
  scope: Scope;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
  prevLabel: string;
  /** Obdobie obsahuje dnešok (prebieha). */
  current: boolean;
  /** Ďalšie obdobie by bolo v budúcnosti. */
  isLatest: boolean;
};

const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
export const monthShort = (m: number) => MONTHS_SHORT[m - 1]!;
export const monthName = (m: number) => MONTHS[m - 1]!;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Posun mesiaca: shift(2026, 1, -2) -> [2025, 11] */
function shift(y: number, m: number, by: number): [number, number] {
  const t = y * 12 + (m - 1) + by;
  return [Math.floor(t / 12), (t % 12) + 1];
}

export function todayIso(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
export const thisMonth = () => todayIso().slice(0, 7);

export function computePeriod(range: Range, month: string, scope: Scope): Period {
  const [y, m] = month.split("-").map(Number) as [number, number];
  let from: string, to: string, prevFrom: string, prevTo: string, label: string, prevLabel: string;
  if (range === "month") {
    from = iso(y, m, 1);
    to = iso(y, m, lastDay(y, m));
    const [py, pm] = shift(y, m, -1);
    prevFrom = iso(py, pm, 1);
    prevTo = iso(py, pm, lastDay(py, pm));
    label = `${monthName(m)} ${y}`;
    prevLabel = monthName(pm);
  } else if (range === "3m") {
    const [sy, sm] = shift(y, m, -2);
    from = iso(sy, sm, 1);
    to = iso(y, m, lastDay(y, m));
    const [py, pm] = shift(y, m, -3);
    const [psy, psm] = shift(y, m, -5);
    prevFrom = iso(psy, psm, 1);
    prevTo = iso(py, pm, lastDay(py, pm));
    label = sy === y ? `${monthShort(sm)} – ${monthShort(m)} ${y}` : `${monthShort(sm)} ${sy} – ${monthShort(m)} ${y}`;
    prevLabel = "predchádzajúce 3 mesiace";
  } else {
    from = iso(y, 1, 1);
    to = iso(y, 12, 31);
    prevFrom = iso(y - 1, 1, 1);
    prevTo = iso(y - 1, 12, 31);
    label = String(y);
    prevLabel = String(y - 1);
  }
  const today = todayIso();
  return {
    range, month, scope, from, to, prevFrom, prevTo, label, prevLabel,
    current: today >= from && today <= to,
    isLatest: to >= today,
  };
}

/** O koľko mesiacov sa posunie šípka pri danom rozsahu. */
export const stepMonths = (range: Range) => (range === "month" ? 1 : range === "3m" ? 3 : 12);

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const [ny, nm] = shift(y, m, by);
  return `${ny}-${pad(nm)}`;
}

export function usePeriod() {
  const [params, setParams] = useSearchParams();
  const range = (["month", "3m", "year"] as const).find((r) => r === params.get("r")) ?? "month";
  const rawMonth = params.get("m");
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= thisMonth() ? rawMonth : thisMonth();
  const scope: Scope = params.get("s") === "everyday" ? "everyday" : "all";
  const period = computePeriod(range, month, scope);

  const update = (patch: Partial<{ r: Range; m: string; s: Scope }>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next, { replace: true });
  };
  return {
    period,
    search: params.toString() ? `?${params.toString()}` : "",
    setRange: (r: Range) => update({ r }),
    setScope: (s: Scope) => update({ s }),
    setMonth: (m: string) => update({ m: m > thisMonth() ? thisMonth() : m }),
    step: (dir: -1 | 1) => {
      const next = shiftMonth(month, dir * stepMonths(range));
      update({ m: next > thisMonth() ? thisMonth() : next });
    },
  };
}

/** Počet dní medzi dvoma dátumami "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
