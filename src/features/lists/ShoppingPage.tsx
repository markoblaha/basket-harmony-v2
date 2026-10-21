import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Camera, Check, ChevronDown, ChevronLeft, ChevronUp, Ellipsis, Lock, Plus, Receipt, ShoppingCart } from "lucide-react";
import { ErrorState, Spinner } from "@/components/ui";
import { Avatars, BottomSheet, Empty, SheetHeader, StoreBadge, type Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatEuro, t, tn } from "@/i18n";
import { useListPriceHints } from "@/features/analytics/api";
import {
  useActiveSession,
  useDeleteItem,
  useItems,
  useListStats,
  useLists,
  useRequests,
  useStartShopping,
  useUpdateItem,
  type Item,
  type ListStats,
  type ShoppingList,
} from "./api";
import type { FeedEntry } from "./useSmartAdd";
import { Composer } from "./Composer";
import { EditItemSheet } from "./EditItemSheet";
import { ListActionsSheet } from "./ListActionsSheet";
import { dayLabel, listDay } from "./dates";
import { PlanList } from "./PlanList";
import { QuickTiles } from "./QuickTiles";
import { MyRequests, PendingRequests } from "./Requests";
import { ShoppingMode } from "./ShoppingMode";
import { sameProduct } from "./qty";
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
 * N3 – zoznam (prototyp). Dva stavy jednej obrazovky:
 *  1. Plánovanie – pole na pridávanie, dlaždice, položky po kategóriách.
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
  const update = useUpdateItem(listId ?? "none");
  const start = useStartShopping(listId ?? "none");

  const [editing, setEditing] = useState<Item | null>(null);
  const [switching, setSwitching] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);
  const swipeX = useRef<number | null>(null);
  const [search, setSearch] = useSearchParams();
  const watching = search.get("sledovat") === "1";
  const stats = useListStats(household.id);
  const remove = useDeleteItem(listId ?? "none");
  // Potvrdenie pridania: bublina hore, ktorá sa sama rozplynie.
  const feedPush = useCallback(
    (e: Omit<FeedEntry, "id" | "out">) => toast.added({ title: e.name, qty: e.qty ? `+${e.qty}` : undefined, note: e.tail }),
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
  const open = useMemo(() => all.filter((i) => i.status === "OPEN").sort((a, b) => b.created_at.localeCompare(a.created_at)), [all]);
  const recent = useMemo(
    () => all.filter((i) => i.status === "PURCHASED").sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "")),
    [all],
  );
  const pendingForMe = (requests.data ?? []).filter((r) => r.status === "PENDING" && r.requested_for === me);
  const myRequests = (requests.data ?? []).filter((r) => r.requested_by === me);
  const smartAdd = useSmartAdd({ listId: listId ?? "none", items: all, someoneElseShopping: someoneElse, onFeed: feedPush });

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
  if (!list || !listId) return <Navigate to="/" replace />;

  const people: Person[] = names ? [...names.entries()].map(([id, name]) => ({ id, name })) : [];
  const openLists = (lists.data ?? [])
    .filter((l) => !l.completed_at)
    .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") || b.created_at.localeCompare(a.created_at));
  const idx = openLists.findIndex((l) => l.id === list.id);

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

  const goRel = (d: number) => {
    const n = openLists[idx + d];
    if (n) navigate(`/lists/${n.id}`, { replace: true });
  };
  const priced = open.filter((i) => hints.data?.has(i.id));
  const estimate = priced.reduce((sum, i) => sum + (hints.data?.get(i.id)?.last_price ?? 0), 0);

  return (
    <div className="stack">
      <div className="sticky top-0 z-20">
        <header
          className="hdr with-back"
          onPointerDown={(e) => {
            swipeX.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeX.current == null) return;
            const d = e.clientX - swipeX.current;
            swipeX.current = null;
            if (d < -60) goRel(1);
            else if (d > 60) goRel(-1);
          }}
        >
          <button type="button" className="ibtn" onClick={() => navigate("/")} aria-label={t("trip.backAria")}>
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="grow stack"
            style={{ minWidth: 0, minHeight: 44, justifyContent: "center", textAlign: "left" }}
            onClick={() => setSwitching(true)}
            aria-label={t("ls.switchList")}
          >
            <span className="row g-4">
              <span className="ttl ellipsis" style={{ fontSize: 15.5 }}>
                {list.name} · <span className="fw-5 t-2">{listDay(list)}</span>
              </span>
              <ChevronDown size={16} className="t-3" style={{ flex: "none" }} />
            </span>
            <span className="sub">
              {openLists.length > 1 && idx >= 0 ? t("ls.listOf", { n: idx + 1, total: openLists.length }) : tn("shop.itemCount", open.length)}
            </span>
          </button>
          {list.is_private ? (
            <span className="badge b-gray">
              <Lock size={11} />
              {t("trip.onlyMe")}
            </span>
          ) : (
            <Avatars people={people} max={3} />
          )}
          <button type="button" className="ibtn" aria-label={t("trip.edit")} onClick={() => setActionsOpen(true)}>
            <Ellipsis size={20} />
          </button>
        </header>
        <Composer
          key={list.id}
          householdId={household.id}
          requestMode={someoneElse}
          onAdd={smartAdd}
          onRemove={(name) => {
            const it = open.find((i) => sameProduct(i.name, name) || normalizeName(i.name).startsWith(normalizeName(name)));
            if (it) remove.mutate(it.id, { onSuccess: () => toast.show(t("item.removed", { name: it.name })), onError: (err) => toast.show(errorMessage(err), "error") });
          }}
        />
      </div>

      <div className="stack g-20 px" style={{ paddingTop: 14 }}>
        {list.completed_at && !active && (
          <div className="card row g-12 anim-rise" style={{ padding: 12 }}>
            <span className="cat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>
              <Check size={18} strokeWidth={2.4} />
            </span>
            <span className="grow stack g-2">
              <span className="t-h">{t("trip.boughtOn", { day: dayLabel(list.completed_at) })}</span>
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
        )}
        {someoneElse && (
          <div className="row g-10" style={{ padding: "10px 12px", borderRadius: 14, background: "var(--violet-soft)", color: "var(--violet)" }}>
            <span className="live" />
            <span className="t-sm fw-5 grow">{t("ls.requestBanner", { name: shortName(shopperName ?? "") })}</span>
          </div>
        )}
        {iAmShopping && interrupted && <PendingRequests requests={pendingForMe} names={names} listId={listId} />}

        <QuickTiles
          householdId={household.id}
          items={all}
          onFeed={feedPush}
          onAdd={(name, count) => void smartAdd({ name, quantity: count, unit: null, note: null })}
        />

        {someoneElse && <MyRequests requests={myRequests} shopperName={shopperName ?? ""} />}

        {items.isPending ? (
          <Spinner />
        ) : items.isError ? (
          <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} />
        ) : open.length === 0 && recent.length === 0 ? (
          <Empty icon={ShoppingCart} title={t("ls.listEmpty")} text={t("ls.listEmptyText")} />
        ) : (
          <PlanList listId={listId} items={open} names={names} me={me} hints={hints.data} onEdit={setEditing} />
        )}

        {recent.length > 0 && !active && (
          <section className="stack g-6">
            <button type="button" className="section-head" onClick={() => setShowPurchased((v) => !v)} style={{ width: "100%" }} aria-expanded={showPurchased}>
              <span className="section-title">{t("ls.inCart", { n: recent.length })}</span>
              {showPurchased ? <ChevronUp size={16} className="t-3" /> : <ChevronDown size={16} className="t-3" />}
            </button>
            {showPurchased && (
              <div className="cells">
                {recent.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="cell"
                    style={{ minHeight: 48 }}
                    onClick={() =>
                      update.mutate(
                        { id: it.id, patch: { status: "OPEN" } },
                        {
                          onSuccess: () => toast.added({ title: it.name, note: t("shop.backOnList") }),
                          onError: (err) => toast.show(errorMessage(err), "error"),
                        },
                      )
                    }
                  >
                    <Check size={16} className="t-accent" />
                    <span className="grow t-body t-2 strike ellipsis">{it.name}</span>
                    <span className="t-sm fw-6 t-3">{t("ls.putBack")}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {priced.length > 0 && (
          <div className="stack center g-2" style={{ padding: "4px 0 8px" }}>
            <span className="t-h num">{t("ls.estimate", { amount: formatEuro(estimate) })}</span>
            <span className="t-xs t-3 num">{t("ls.estimateHint", { priced: priced.length, count: open.length })}</span>
          </div>
        )}
      </div>
      <div style={{ height: 180 }} />

      {(open.length > 0 || active) && (
        <div className="bottom-cta fixed inset-x-0 mx-auto max-w-2xl" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
          {someoneElse ? (
            <button type="button" className="btn btn-lg btn-block" style={{ background: "var(--violet-soft)", color: "var(--violet)" }} onClick={() => setSearch({ sledovat: "1" })}>
              <span className="live" />
              {t("ls.watchShopper", { name: shortName(shopperName ?? "") })}
            </button>
          ) : (
            <button type="button" className="btn btn-ink btn-lg btn-block" disabled={start.isPending || (!iAmShopping && !open.length)} onClick={startShopping}>
              <ShoppingCart size={19} />
              {iAmShopping ? t("shop.continue") : t("ls.startWith", { count: tn("shop.itemCount", open.length) })}
            </button>
          )}
        </div>
      )}

      <EditItemSheet
        item={editing}
        listId={listId}
        onClose={() => setEditing(null)}
        addedBy={editing?.added_by && editing.added_by !== me ? names?.get(editing.added_by) : undefined}
        hint={editing ? hints.data?.get(editing.id) : undefined}
      />
      <SwitchListSheet open={switching} onClose={() => setSwitching(false)} lists={openLists} current={list.id} stats={stats.data} />
      <ListActionsSheet list={actionsOpen ? list : null} onClose={() => setActionsOpen(false)} onDeleted={() => navigate("/")} />
    </div>
  );
}

/** N3S – prepnúť zoznam. */
function SwitchListSheet({
  open,
  onClose,
  lists,
  current,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  lists: ShoppingList[];
  current: string;
  stats?: Map<string, ListStats>;
}) {
  const navigate = useNavigate();
  return (
    <BottomSheet open={open} onClose={onClose} label={t("ls.switchList")}>
      <SheetHeader title={t("ls.switchList")} sub={t("ls.switchListSub")} onClose={onClose} />
      <div className="sheet-body stack g-12">
        <div className="cells">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              className="cell"
              onClick={() => {
                onClose();
                navigate(`/lists/${l.id}`, { replace: true });
              }}
            >
              <StoreBadge name={l.name} size="sm" />
              <span className="grow stack">
                <span className="t-body fw-5">{l.name}</span>
                <span className="t-sm t-2">
                  {listDay(l)} · {tn("shop.itemCount", stats?.get(l.id)?.open ?? 0)}
                </span>
              </span>
              {l.id === current && <Check size={18} className="t-accent" />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-soft btn-block"
          onClick={() => {
            onClose();
            navigate("/?novy=1");
          }}
        >
          <Plus size={18} />
          {t("ls.newList")}
        </button>
      </div>
    </BottomSheet>
  );
}
