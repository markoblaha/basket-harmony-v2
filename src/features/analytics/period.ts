/**
 * Obdobie Prehľadov je uložené v adrese stránky (?r=month&m=2026-10&s=all), takže
 * tlačidlo Späť vráti presne tam, kde si bol, a obdobie platí aj na detailoch.
 */
import { useSearchParams } from "react-router";
import { formatCalendarDate, t } from "@/i18n";

export type Range = "month" | "3m" | "year" | "custom";
/** Čipy obdobia ako v prototype. */
export type Preset = "month" | "last" | "q" | "year" | "custom";
export const PRESETS: Preset[] = ["month", "last", "q", "year", "custom"];
export type Scope = "all" | "everyday";

export type Period = {
  range: Range;
  preset: Preset;
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

const pad = (n: number) => String(n).padStart(2, "0");

/** Názvy mesiacov dodáva Intl podľa jazyka rozhrania ("marec" / "March", "mar" / "Mar"). */
const monthDate = (m: number) => `2000-${pad(m)}-01`;
export const monthShort = (m: number) => formatCalendarDate(monthDate(m), { month: "short" }).replace(/\.$/, "").replace(/^Sept$/, "Sep");
export const monthName = (m: number) => formatCalendarDate(monthDate(m), { month: "long" });

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

/** Vlastné obdobie od–do; porovnáva sa s rovnako dlhým obdobím tesne predtým. */
export function customPeriod(from: string, to: string, scope: Scope): Period {
  if (from > to) [from, to] = [to, from];
  const len = daysBetween(from, to) + 1;
  const prevTo = addIso(from, -1);
  const prevFrom = addIso(from, -len);
  const today = todayIso();
  return {
    range: "custom", preset: "custom", month: to.slice(0, 7), scope, from, to, prevFrom, prevTo,
    label: `${formatCalendarDate(from, { day: "numeric", month: "numeric" })} – ${formatCalendarDate(to, { day: "numeric", month: "numeric", year: "numeric" })}`,
    prevLabel: t("period.prevSame"),
    current: today >= from && today <= to,
    isLatest: to >= today,
  };
}

function addIso(day: string, n: number): string {
  const d = new Date(Date.parse(day + "T00:00:00Z") + n * 86_400_000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function computePeriod(range: Exclude<Range, "custom">, month: string, scope: Scope, preset?: Preset): Period {
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
    prevLabel = t("period.prev3m");
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
    range, preset: preset ?? (range === "3m" ? "q" : range === "year" ? "year" : month === thisMonth() ? "month" : "last"),
    month, scope, from, to, prevFrom, prevTo, label, prevLabel,
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
  const scope: Scope = params.get("s") === "everyday" ? "everyday" : "all";
  const preset = (PRESETS as string[]).includes(params.get("p") ?? "") ? (params.get("p") as Preset) : "month";
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const period =
    preset === "custom"
      ? customPeriod(valid(params.get("f")) ?? addIso(todayIso(), -30), valid(params.get("t")) ?? todayIso(), scope)
      : preset === "last"
        ? computePeriod("month", shiftMonth(thisMonth(), -1), scope, "last")
        : preset === "q"
          ? computePeriod("3m", thisMonth(), scope, "q")
          : preset === "year"
            ? computePeriod("year", thisMonth(), scope, "year")
            : computePeriod("month", thisMonth(), scope, "month");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  return {
    period,
    search: params.toString() ? `?${params.toString()}` : "",
    setPreset: (p: Preset) =>
      update(p === "custom" ? { p, f: params.get("f") ?? addIso(todayIso(), -30), t: params.get("t") ?? todayIso() } : { p, f: null, t: null }),
    setCustom: (from: string, to: string) => update({ p: "custom", f: from, t: to }),
    setScope: (s: Scope) => update({ s }),
  };
}

/** Počet dní medzi dvoma dátumami "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
