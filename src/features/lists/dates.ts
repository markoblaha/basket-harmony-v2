/** Dátumy pre nákupy: „dnes“, „zajtra“, „so 18. 10.“ – bez časových zón (YYYY-MM-DD v miestnom čase). */
import { formatDateTime, t } from "@/i18n";

export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Najbližšia sobota (ak je dnes sobota, tak dnes). */
export function nextSaturday(from = new Date()): Date {
  return addDays(from, (6 - from.getDay() + 7) % 7);
}

function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** „dnes“, „zajtra“, „včera“, „so 18. 10.“ */
export function dayLabel(value: string | Date): string {
  // „2026-10-13“ je deň (bez zóny); časová pečiatka sa prepočíta na miestny čas.
  const d = typeof value === "string" ? (value.length > 10 ? new Date(value) : parseDay(value)) : value;
  const today = new Date();
  const diff = Math.round((parseDay(isoDay(d)).getTime() - parseDay(isoDay(today)).getTime()) / 86_400_000);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  return formatDateTime(d, { weekday: "short", day: "numeric", month: "numeric" });
}

/** Plánovaný deň je v minulosti (a nákup ešte nie je hotový). */
export function isOverdue(value: string): boolean {
  return value.slice(0, 10) < isoDay(new Date());
}

/** Deň nákupu na karte: „dnes“, „so 18. 10.“ alebo „bez dňa“. */
export function listDay(list: { planned_for: string | null }): string {
  return list.planned_for ? dayLabel(list.planned_for) : t("trip.noDay");
}
