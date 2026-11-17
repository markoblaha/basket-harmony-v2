/**
 * Upozornenia domácnosti v appke (mockup prototyp/src/notif.js) – jeden zdroj pre zoznam vo Viac
 * aj pre červenú bodku na avatare. Nič sa neukladá do databázy: počíta sa z toho, čo appka už má
 * (prebiehajúce nákupy, kto pridal položky, chýbajúce bločky, zmeny cien). „Prečítané“ si pamätá zariadenie.
 */
import { useSyncExternalStore } from "react";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { useHubSessions, useListStats, useLists } from "@/features/lists/api";
import { useOverview } from "@/features/analytics/api";
import { computePeriod, thisMonth } from "@/features/analytics/period";
import { t } from "@/i18n";
import { eur } from "@/mockup/kit";

export type Notif = { id: string; av?: { id: string; name: string }; e?: string; title: string; sub: string; to: string };

const MONTH_MS = 30 * 86_400_000;

export function useNotifications(): Notif[] {
  const { household } = useHousehold();
  const me = useUserId();
  const names = useProfiles().data;
  const lists = useLists(household.id).data ?? [];
  const stats = useListStats(household.id).data;
  const sessions = useHubSessions(household.id).data ?? [];
  const ov = useOverview(household.id, computePeriod("month", thisMonth(), "all")).data;
  const who = (id: string) => ({ id, name: names?.get(id) ?? t("household.fallbackName") });
  const out: Notif[] = [];
  for (const s of sessions.filter((x) => x.shopper_id !== me)) {
    const l = lists.find((x) => x.id === s.list_id);
    if (!l) continue;
    const st = stats?.get(l.id);
    out.push({
      id: `live:${s.id}`,
      av: who(s.shopper_id),
      title: t("nt.live", { name: who(s.shopper_id).name, list: l.name }),
      sub: st ? t("nt.liveSub", { done: st.bought, all: st.bought + st.open }) : "",
      to: `/lists/${l.id}?sledovat=1`,
    });
  }
  for (const l of lists.filter((x) => !x.completed_at)) {
    const others = (stats?.get(l.id)?.adders ?? []).filter((a) => a !== me);
    if (!others.length) continue;
    out.push({
      id: `add:${l.id}:${others.join(",")}:${stats?.get(l.id)?.open ?? 0}`,
      av: who(others[0]!),
      title: t("nt.added", { name: others.map((a) => who(a).name).join(", ") }),
      sub: t("nt.addedSub", { list: l.name }),
      to: `/lists/${l.id}`,
    });
  }
  const now = Date.now();
  const miss = lists.filter((l) => l.completed_at && l.receipt_state === "LATER" && now - new Date(l.completed_at).getTime() <= MONTH_MS).length;
  if (miss) out.push({ id: `miss:${miss}`, e: "receipt", title: t("nt.miss", { n: miss }), sub: t("nt.missSub"), to: "/analytics" });
  const pc = ov?.price_changes.find((x) => x.kind === "CHANGE");
  if (pc) {
    const pct = Math.round(pc.change * 100);
    out.push({
      id: `price:${pc.product_id}:${pc.purchased_on}`,
      e: pct > 0 ? "coin" : "moneybag",
      title: pct > 0 ? t("mn.insUp", { name: pc.name, pct }) : t("mn.insDown", { name: pc.name, pct: -pct }),
      sub: t("mn.insPrice", { store: pc.store_name, old: eur(pc.old_price), now: eur(pc.new_price) }),
      to: `/analytics/product/${pc.product_id}`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ prečítané (v zariadení) */
const KEY = "bh.notifSeen";
const listeners = new Set<() => void>();
let seen = (() => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
})();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const signature = (n: Notif[]) => n.map((x) => x.id).join("|");
export function markSeen(sig: string) {
  if (sig === seen) return;
  seen = sig;
  try {
    localStorage.setItem(KEY, sig);
  } catch {
    /* súkromné okno */
  }
  listeners.forEach((l) => l());
}
/** Sú upozornenia, ktoré ešte nikto v tomto zariadení nevidel? (bodka na avatare) */
export function useUnread() {
  const n = useNotifications();
  const s = useSyncExternalStore(subscribe, () => seen);
  const known = new Set(s.split("|"));
  return n.some((x) => !known.has(x.id));
}
