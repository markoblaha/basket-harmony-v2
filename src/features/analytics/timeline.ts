/**
 * Časová os Výdavkov: jeden stĺpec = jeden mesiac (týždeň), v Roku mesiace roka. Súčty z analytics_daily,
 * rovnaké ako veľká suma prehľadu; s filtrom kategórie alebo obchodu len ich časť.
 */
import { useMemo } from "react";
import { formatDateTime, t } from "@/i18n";
import { useDaily } from "./api";
import { addIso, periodOf, type Per } from "./money";
import { monthName, monthShort, thisMonth, todayIso } from "./period";
import type { TlItem } from "./charts";

const sumIn = (days: { d: string; a: number }[], from: string, to: string) => days.reduce((s, x) => (x.d >= from && x.d <= to ? s + x.a : s), 0);
const dayCount = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5) + 1;

export function useTimeline(householdId: string, per: Per, off: number, show: (p: Per, to?: number) => void, filter: { category?: string | null; store?: string | null } = {}) {
  const today = todayIso();
  const sel = periodOf(per, off);
  // rozsah dát: 13 mesiacov / 14 týždňov dozadu, v Roku celý zvolený rok
  const from = per === "year" ? `${sel.from.slice(0, 4)}-01-01` : periodOf(per, per === "week" ? -13 : -12).from;
  const to = per === "year" ? (sel.to < today ? sel.to : today) : today;
  const q = useDaily(householdId, from, to, filter.category ?? null, filter.store ?? null);
  const items = useMemo<TlItem[]>(() => {
    const days = q.data?.days ?? [];
    const first = q.data?.first ?? null;
    const out: TlItem[] = [];
    if (per === "year") {
      const y = Number(sel.from.slice(0, 4));
      const [cy, cm] = thisMonth().split("-").map(Number) as [number, number];
      for (let m = 1; m <= 12; m++) {
        const back = (y - cy) * 12 + (m - cm);
        const a = `${y}-${String(m).padStart(2, "0")}-01`;
        const b = addIso(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
        const v = back > 0 ? 0 : sumIn(days, a, b);
        out.push({ key: a, label: monthShort(m), v, cur: back === 0, onTap: back <= 0 && (!first || b >= first) ? () => show("month", back) : undefined, aria: t("mn.openMonth", { month: monthName(m) }) });
      }
      return out;
    }
    for (let o = 0; o > (per === "week" ? -14 : -13); o--) {
      const p = periodOf(per, o);
      if (first && p.to < first) break;
      const v = sumIn(days, p.from, p.to);
      let ghost: number | undefined;
      if (o === 0 && per === "month" && p.current) {
        const el = dayCount(p.from, today), all = new Date(Number(p.month.slice(0, 4)), Number(p.month.slice(5)), 0).getDate();
        if (el >= 3 && el < all) ghost = (v / el) * all;
      }
      const label = per === "week" ? formatDateTime(new Date(`${p.from}T12:00:00`), { day: "numeric", month: "numeric" }).replace(/\s/g, "") : monthShort(Number(p.month.slice(5)));
      out.unshift({ key: p.from, label, v, ghost, on: o === off, onTap: () => show(per, o), aria: `${label}: ${Math.round(v)} €` });
    }
    return out;
  }, [q.data, per, off, sel.from, today, show]);
  return { items, first: q.data?.first ?? null, days: q.data?.days ?? [], loading: q.isPending };
}
