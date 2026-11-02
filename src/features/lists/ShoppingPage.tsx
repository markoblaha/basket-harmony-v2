import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Camera, Check, ChevronLeft, Receipt, ShoppingCart } from "lucide-react";
import { ErrorState, Spinner } from "@/components/ui";
import { Empty, type Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useListPriceHints } from "@/features/analytics/api";
import { useRecipePlans } from "@/features/recipes/api";
import { storeKeyOf } from "@/mockup/kit";
import { useActiveSession, useHubSessions, useItems, useLists, useRequests, useStartShopping, type ShoppingList } from "./api";
import type { FeedEntry } from "./useSmartAdd";
import { ListActionsSheet } from "./ListActionsSheet";
import { ListView } from "./ListView";
import { dayLabel } from "./dates";
import { MyRequests, PendingRequests } from "./Requests";
import { ShoppingMode } from "./ShoppingMode";
import { useSmartAdd } from "./useSmartAdd";

/** Prerušený nákup si pamätáme v tomto okne prehliadača (po zatvorení aplikácie sa obnoví režim nákupu). */
const interruptKey = (sessionId: string) => `bh.interrupted.${sessionId}`;
function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* súkromné okno – nevadí */
  }
}

/**
 * Zoznam. Dva stavy jednej obrazovky:
 *  1. Plánovanie – obrazovka z mockupu (ListView): položky, odhad, pole na pridávanie.
 *  2. Práve nakupujem – celá obrazovka N4 (ShoppingMode); šípka späť ju len zavrie,
 *     nákup beží ďalej a tu sa ukáže „Pokračovať v nákupe“. Kto nakup sleduje
 *     (?sledovat=1), vidí N4 bez ovládania.
 */
export function ShoppingPage() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const lists = useLists(household.id);
  const listId = lists.data?.find((l) => l.id === params.listId)?.id;
  const list = lists.data?.find((l) => l.id === listId);

  const items = useItems(listId);
  const hints = useListPriceHints(listId);
  const session = useActiveSession(listId);
  const requests = useRequests(listId, session.data?.id);
  const names = useProfiles().data;
  const start = useStartShopping(listId ?? "none");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [search, setSearch] = useSearchParams();
  const watching = search.get("sledovat") === "1";
  const plans = useRecipePlans(household.id);
  const hubSessions = useHubSessions(household.id);
  // Potvrdenie pridania: bublina hore, ktorá sa sama rozplynie.
  const feedPush = useCallback(
    (e: Omit<FeedEntry, "id" | "out">) => toast.added({ title: e.name, qty: e.qty ? `+${e.qty}` : undefined, note: e.tail, undo: e.undo }),
    [toast],
  );

  const active = session.data ?? null;
  const iAmShopping = !!active && active.shopper_id === me;
  const someoneElse = !!active && !iAmShopping;
  const shopperName = active ? (names?.get(active.shopper_id) ?? t("household.fallbackName")) : null;

  const [interrupted, setInterrupted] = useState(false);
  useEffect(() => {
    setInterrupted(active ? readFlag(interruptKey(active.id)) : false);
  }, [active?.id]);
  const interrupt = useCallback(() => {
    if (active) writeFlag(interruptKey(active.id), true);
    setInterrupted(true);
  }, [active]);
  const resume = useCallback(() => {
    if (active) writeFlag(interruptKey(active.id), false);
    setInterrupted(false);
  }, [active]);

  const all = items.data ?? [];
  const pendingForMe = (requests.data ?? []).filter((r) => r.status === "PENDING" && r.requested_for === me);
  const myRequests = (requests.data ?? []).filter((r) => r.requested_by === me);
  // Posledné pridanie: zoznam k riadku dôjde a zasvieti ho (n = aj opakované pridanie toho istého).
  const [landed, setLanded] = useState<{ id: string; n: number } | null>(null);
  const onLanded = useCallback((id: string) => setLanded((l) => ({ id, n: (l?.n ?? 0) + 1 })), []);
  const smartAdd = useSmartAdd({ listId: listId ?? "none", items: all, someoneElseShopping: someoneElse, onFeed: feedPush, onLanded });

  async function startShopping() {
    if (iAmShopping) {
      resume();
      return;
    }
    try {
      await start.mutateAsync();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;
  // Nákup neexistuje, bol odstránený z prehľadu, alebo je súkromný cudzí → späť na prehľad.
  // Zoznam zmizol (dokončený alebo zmazaný niekým iným) – prototyp ukáže prázdny stav s cestou späť.
  if (!list || !listId) {
    if (!params.listId) return <Navigate to="/lists" replace />;
    return (
      <div className="stack">
        <header className="hdr with-back">
          <button type="button" className="ibtn" onClick={() => navigate("/lists")} aria-label={t("trip.backAria")}>
            <ChevronLeft size={24} />
          </button>
          <div className="grow stack" style={{ minWidth: 0 }}>
            <span className="ttl ellipsis">{t("ls.listTitle")}</span>
          </div>
        </header>
        <Empty
          icon={ShoppingCart}
          title={t("ls.listGone")}
          text={t("ls.listGoneText")}
          action={
            <button type="button" className="btn btn-soft" onClick={() => navigate("/lists")}>
              {t("ls.toLists")}
            </button>
          }
        />
      </div>
    );
  }

  const people: Person[] = names ? [...names.entries()].map(([id, name]) => ({ id, name })) : [];
  const openLists = (lists.data ?? [])
    .filter((l) => !l.completed_at)
    .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") || b.created_at.localeCompare(a.created_at));
  // Nakupujem práve v inom zozname → najprv ten treba dokončiť.
  const mySessionElsewhere = (hubSessions.data ?? []).find((s) => s.shopper_id === me && s.list_id !== list.id);
  const elsewhereList = mySessionElsewhere ? lists.data?.find((l) => l.id === mySessionElsewhere.list_id) : undefined;

  if (active && ((iAmShopping && !interrupted) || (someoneElse && watching))) {
    return (
      <ShoppingMode
        list={list}
        items={all}
        session={active}
        shopper={iAmShopping}
        me={me}
        names={names}
        people={people}
        hints={hints.data}
        pending={pendingForMe}
        myRequests={myRequests}
        openLists={openLists}
        householdId={household.id}
        onBack={iAmShopping ? interrupt : () => setSearch({}, { replace: true })}
        onAdd={smartAdd}
      />
    );
  }

  // Sledovaný nákup medzitým skončil → prázdny stav s cestou do histórie (prototyp N4).
  if (watching && !active && !session.isPending) {
    return (
      <div className="stack">
        <header className="hdr with-back">
          <button type="button" className="ibtn" onClick={() => setSearch({}, { replace: true })} aria-label={t("trip.backAria")}>
            <ChevronLeft size={24} />
          </button>
          <div className="grow stack" style={{ minWidth: 0 }}>
            <span className="ttl ellipsis">{t("ls.shopTitle")}</span>
          </div>
        </header>
        <Empty
          icon={ShoppingCart}
          title={t("ls.shopEnded")}
          text={t("ls.shopEndedText")}
          action={
            <button type="button" className="btn btn-soft" onClick={() => navigate("/history")}>
              {t("ls.history")}
            </button>
          }
        />
      </div>
    );
  }

  const storeKey = storeKeyOf(list.name);
  const others = openLists.filter((l) => l.id !== list.id);
  return (
    <ListView
      list={list}
      items={all}
      householdId={household.id}
      me={me}
      names={names}
      people={people}
      storeKey={storeKey}
      recipePlans={(plans.data ?? []).filter((p) => p.list_id === list.id && p.status === "PENDING")}
      active={!!active}
      someoneElse={someoneElse}
      iAmShopping={iAmShopping}
      shopperName={shopperName}
      startPending={start.isPending}
      onShop={() => void startShopping()}
      onWatch={() => setSearch({ sledovat: "1" })}
      elsewhere={!iAmShopping && mySessionElsewhere ? { id: mySessionElsewhere.list_id, name: elsewhereList?.name ?? "" } : null}
      requestsTop={
        <>
          {list.completed_at && !active && <CompletedCard list={list} />}
          {iAmShopping && interrupted && <PendingRequests requests={pendingForMe} names={names} listId={listId} />}
          {someoneElse && <MyRequests requests={myRequests} shopperName={shopperName ?? ""} />}
        </>
      }
      itemsState={items.isPending ? "loading" : items.isError ? "error" : "ok"}
      itemsError={items.isError ? <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} /> : null}
      smartAdd={smartAdd}
      landed={landed}
      otherLists={others}
      onActions={() => setActionsOpen(true)}
      actionsSheet={<ListActionsSheet list={actionsOpen ? list : null} onClose={() => setActionsOpen(false)} onDeleted={() => navigate("/lists")} />}
    />
  );
}

/** Kúpený zoznam (otvorený z histórie): kedy a bloček. */
function CompletedCard({ list }: { list: ShoppingList }) {
  const navigate = useNavigate();
  return (
    <div className="card row g-12 anim-rise" style={{ padding: 12 }}>
      <span className="cat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>
        <Check size={18} strokeWidth={2.4} />
      </span>
      <span className="grow stack g-2">
        <span className="t-h">{t("trip.boughtOn", { day: dayLabel(list.completed_at!) })}</span>
        <span className="t-xs t-2">{t("trip.reopenHint")}</span>
      </span>
      {list.receipt_state === "ATTACHED" && list.receipt_id ? (
        <button type="button" className="btn btn-sm btn-accent" onClick={() => navigate(`/receipts/${list.receipt_id}`)}>
          <Receipt size={15} /> {t("trip.receipt")}
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-soft" onClick={() => navigate(`/receipts?pridat=1&nakup=${list.id}`)}>
          <Camera size={15} /> {list.receipt_state === "LATER" ? t("trip.completeReceipt") : t("trip.addReceipt")}
        </button>
      )}
    </div>
  );
}
