/**
 * Upozornenia v appke (banner hore, ako v prototype): keď iný člen začne alebo skončí nákup,
 * keď mi počas nákupu príde žiadosť, keď mi odpovedia na moju žiadosť, keď položku, ktorú som
 * pridal, nemali, a keď sa prečíta môj doklad. Zdroj = živý kanál domácnosti (žiadne ďalšie
 * dotazy). Ktoré upozornenia chcem, sa volí vo Viac → Upozornenia (uložené v zariadení).
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useProfiles } from "@/features/household/api";
import { listKeys, type Session, type ShoppingList } from "@/features/lists/api";
import { onHouseholdChange } from "@/features/realtime/useHouseholdRealtime";
import { getSetting, type NotifKind } from "@/lib/settings";
import { shortName } from "@/lib/shortName";
import { formatEuro, t } from "@/i18n";

type R = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function useInAppNotices(householdId: string) {
  const me = useUserId();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const names = useProfiles().data;
  const { pathname } = useLocation();
  const ctx = useRef({ names, pathname });
  ctx.current = { names, pathname };
  // Viac žiadostí naraz (jedna správa s viacerými položkami) = jeden banner.
  const pending = useRef<{ from: string; listId: string; items: string[]; timer?: ReturnType<typeof setTimeout> } | null>(null);

  // Posledný známy stav riadkov (živý kanál neposiela starý stav) – aby sa upozornenie neopakovalo.
  const seen = useRef(new Map<string, string>());

  useEffect(() => {
    /** Zmenil sa stav riadku na `to` práve teraz (nie už skôr)? */
    const changedTo = (id: unknown, to: string, prev: unknown, at: unknown) => {
      const key = str(id);
      const before = seen.current.get(key) ?? (typeof prev === "string" ? prev : undefined);
      seen.current.set(key, to);
      if (before !== undefined) return before !== to;
      // Stav predtým nepoznáme: berieme len čerstvú zmenu (poslednú minútu).
      return typeof at === "string" && Date.now() - Date.parse(at) < 60_000;
    };
    const who = (id: unknown) => shortName(ctx.current.names?.get(str(id))) || t("household.fallbackName");
    const listName = (id: unknown) =>
      qc.getQueryData<ShoppingList[]>(listKeys.lists(householdId))?.find((l) => l.id === id)?.name ?? "";
    const onList = (id: unknown) => ctx.current.pathname === `/lists/${str(id)}`;
    const amShopper = (listId: unknown) =>
      (qc.getQueryData<Session[]>(listKeys.hubSessions(householdId)) ?? []).some((s) => s.list_id === listId && s.shopper_id === me);
    const want = (k: NotifKind) => getSetting("notif")[k] !== false;
    const openList = (id: unknown) => () => navigate(`/lists/${str(id)}`);

    return onHouseholdChange(({ table, event, row, old }: { table: string; event: string; row: R; old: R }) => {
      if (table === "shopping_sessions") {
        if (event === "INSERT") seen.current.set(str(row.id), str(row.status));
        if (row.shopper_id === me) return;
        if (event === "INSERT" && row.status === "ACTIVE" && want("start")) {
          toast.notify({ title: t("notice.start", { name: who(row.shopper_id), list: listName(row.list_id) }), body: t("notice.startBody"), onOpen: openList(row.list_id) });
        } else if (event === "UPDATE" && row.status === "ENDED" && changedTo(row.id, "ENDED", old.status, row.ended_at) && want("end")) {
          toast.notify({ title: t("notice.end", { list: listName(row.list_id) }), body: t("notice.endBody", { name: who(row.shopper_id) }), onOpen: openList(row.list_id) });
        }
        return;
      }
      if (table === "addition_requests") {
        if (event === "INSERT") seen.current.set(str(row.id), str(row.status));
        if (event === "INSERT" && row.requested_for === me && row.requested_by !== me && row.status === "PENDING") {
          if (!want("request") || onList(row.list_id)) return;
          const p = pending.current;
          if (p && p.from === row.requested_by && p.listId === row.list_id) p.items.push(str(row.name));
          else {
            pending.current = { from: str(row.requested_by), listId: str(row.list_id), items: [str(row.name)] };
            const batch = pending.current;
            batch.timer = setTimeout(() => {
              pending.current = null;
              toast.notify({ title: t("notice.request", { name: who(batch.from) }), body: batch.items.join(", "), onOpen: openList(batch.listId) });
            }, 500);
          }
        } else if (event === "UPDATE" && row.requested_by === me && row.status !== "PENDING" && changedTo(row.id, str(row.status), old.status, row.decided_at ?? row.responded_at)) {
          if (!want("reply")) return;
          const item = str(row.name);
          const note = str(row.response_note);
          const title =
            row.status === "ACCEPTED" ? t("notice.replyAccepted", { item }) : row.status === "REJECTED" ? t("notice.replyRejected", { item }) : t("notice.replyExpired");
          const body = row.status === "EXPIRED" ? t("notice.replyExpiredBody", { item }) : note ? `„${note}“` : t("notice.noReply");
          toast.notify({ title, body, onOpen: openList(row.list_id) });
        }
        return;
      }
      if (table === "shopping_list_items") {
        if (event === "UPDATE" && row.added_by === me && row.status === "UNAVAILABLE" && changedTo(row.id, "UNAVAILABLE", old.status, row.updated_at) && !amShopper(row.list_id) && want("unavailable")) {
          toast.notify({ title: t("notice.unavailable", { item: str(row.name) }), body: t("notice.unavailableBody", { list: listName(row.list_id) }), onOpen: openList(row.list_id) });
        }
        return;
      }
      if (table === "receipts") {
        if (event === "INSERT") seen.current.set(str(row.id), str(row.status));
        if (event !== "UPDATE" || row.uploaded_by !== me) return;
        // Len prechod zo spracovania (PROCESSING) na hotový stav.
        const cached = qc.getQueryData<{ id: string; status: string }[]>(["receipts", householdId])?.find((r) => r.id === row.id)?.status;
        const before = seen.current.get(str(row.id)) ?? (str(old.status) || cached);
        seen.current.set(str(row.id), str(row.status));
        if (before !== "PROCESSING" || row.status === "PROCESSING" || !want("receiptRead")) return;
        const store = str(row.store_name);
        const total = typeof row.total === "number" ? formatEuro(row.total) : "";
        const open = () => navigate(`/receipts/${str(row.id)}`);
        if (row.status === "OK") toast.notify({ title: t("notice.receiptRead", { store, total }), body: t("notice.receiptReadBody"), onOpen: open });
        else if (row.status === "NEEDS_REVIEW") toast.notify({ title: t("notice.receiptReview", { store }), body: t("notice.receiptReviewBody"), onOpen: open });
      }
    });
  }, [householdId, me, qc, navigate, toast]);

  useEffect(() => () => clearTimeout(pending.current?.timer), []);
}
