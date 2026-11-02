import { useCallback, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Camera, Check, Receipt } from "lucide-react";
import { ErrorState, Spinner } from "@/components/ui";
import type { Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useRecipePlans } from "@/features/recipes/api";
import { storeKeyOf } from "@/mockup/kit";
import { useActiveSession, useHubSessions, useItems, useLists, useRequests, useStartShopping, type ShoppingList } from "./api";
import type { FeedEntry } from "./useSmartAdd";
import { ListView } from "./ListView";
import { dayLabel } from "./dates";
import { MyRequests } from "./Requests";
import { FollowScreen, ShopScreen } from "./ShopScreen";
import { useEstimator } from "./estimate";
import { E, IB } from "@/mockup/ui";
import { Btn } from "@/mockup/kit";
import { useSmartAdd } from "./useSmartAdd";

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
  const estimator = useEstimator(household.id);
  const session = useActiveSession(listId);
  const requests = useRequests(listId, session.data?.id);
  const names = useProfiles().data;
  const start = useStartShopping(listId ?? "none");

  const [search, setSearch] = useSearchParams();
  const listShown = useRef(false);
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


  const all = items.data ?? [];
  const pendingForMe = (requests.data ?? []).filter((r) => r.status === "PENDING" && r.requested_for === me);
  const myRequests = (requests.data ?? []).filter((r) => r.requested_by === me);
  // Posledné pridanie: zoznam k riadku dôjde a zasvieti ho (n = aj opakované pridanie toho istého).
  const [landed, setLanded] = useState<{ id: string; n: number } | null>(null);
  const onLanded = useCallback((id: string) => setLanded((l) => ({ id, n: (l?.n ?? 0) + 1 })), []);
  const smartAdd = useSmartAdd({ listId: listId ?? "none", items: all, someoneElseShopping: someoneElse, onFeed: feedPush, onLanded });

  async function startShopping() {
    if (iAmShopping) return;
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
    return <EmptyScreen title={t("ls.listGone")} text={t("ls.listGoneText")} action={t("ls.toLists")} onBack={() => navigate("/lists")} onAction={() => navigate("/lists")} />;
  }

  const people: Person[] = names ? [...names.entries()].map(([id, name]) => ({ id, name })) : [];
  const openLists = (lists.data ?? [])
    .filter((l) => !l.completed_at)
    .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") || b.created_at.localeCompare(a.created_at));
  // Nakupujem práve v inom zozname → najprv ten treba dokončiť.
  const mySessionElsewhere = (hubSessions.data ?? []).find((s) => s.shopper_id === me && s.list_id !== list.id);
  const elsewhereList = mySessionElsewhere ? lists.data?.find((l) => l.id === mySessionElsewhere.list_id) : undefined;

  const storeKey = storeKeyOf(list.name);
  // Nákup / sledovanie začaté priamo na zozname vyjde zdola; pri príchode rovno do nákupu ho už posunie prechod obrazovky.
  const enter = listShown.current;
  if (active && iAmShopping) {
    return (
      <ShopScreen
        list={list}
        items={all}
        session={active}
        names={names}
        householdId={household.id}
        storeKey={storeKey}
        estimator={estimator}
        pending={pendingForMe}
        onClosed={() => undefined}
        enter={enter}
      />
    );
  }
  if (active && someoneElse && watching) {
    return (
      <FollowScreen
        list={list}
        items={all}
        session={active}
        names={names}
        me={me}
        storeKey={storeKey}
        estimator={estimator}
        onBack={() => setSearch({}, { replace: true })}
        onAsk={smartAdd}
        enter={enter}
      />
    );
  }

  // Sledovaný nákup medzitým skončil → prázdny stav s cestou do histórie.
  if (watching && !active && !session.isPending) {
    return (
      <EmptyScreen
        title={t("sp.ended")}
        text={t("ls.shopEndedText")}
        action={t("sp.history")}
        onBack={() => setSearch({}, { replace: true })}
        onAction={() => navigate("/history")}
      />
    );
  }

  const others = openLists.filter((l) => l.id !== list.id);
  listShown.current = true;
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
          {someoneElse && <MyRequests requests={myRequests} shopperName={shopperName ?? ""} />}
        </>
      }
      itemsState={items.isPending ? "loading" : items.isError ? "error" : "ok"}
      itemsError={items.isError ? <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} /> : null}
      smartAdd={smartAdd}
      landed={landed}
      otherLists={others}
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
        <button type="button" className="btn btn-sm btn-soft" onClick={() => navigate(`/scan?nakup=${list.id}`)}>
          <Camera size={15} /> {list.receipt_state === "LATER" ? t("trip.completeReceipt") : t("trip.addReceipt")}
        </button>
      )}
    </div>
  );
}

/** Prázdna obrazovka z mockupu (Empty): zoznam zmizol, sledovaný nákup skončil. */
function EmptyScreen({ title, text, action, onBack, onAction }: { title: string; text: string; action: string; onBack: () => void; onAction: () => void }) {
  return (
    <div className="bhm bhm-full">
      <div className="scr">
        <div className="sc">
          <header className="nb">
            <IB n="caret-left" label={t("sp.back")} onClick={onBack} />
            <span className="ibs" />
          </header>
          <div className="empty">
            <E k="basket" s={64} />
            <b>{title}</b>
            <p>{text}</p>
            <Btn cls="soft" onClick={onAction}>
              {action}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
