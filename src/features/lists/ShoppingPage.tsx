import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Camera, Check, ChevronDown, PackageX, ChevronLeft, ChevronUp, Ellipsis, Plus, Receipt, ShoppingCart } from "lucide-react";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { BottomSheet, Empty, SheetHeader, StoreBadge, type Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatEuro, t, tn } from "@/i18n";
import { useListPriceHints } from "@/features/analytics/api";
import { useRecipePlans } from "@/features/recipes/api";
import {
  useActiveSession,
  useDeleteItem,
  useHubSessions,
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
import { Composer, useKeyboardInset } from "./Composer";
import { EditItemSheet } from "./EditItemSheet";
import { ListActionsSheet } from "./ListActionsSheet";
import { dayLabel, listDay } from "./dates";
import { PlanList } from "./PlanList";
import { QuickDock } from "./QuickDock";
import { MyRequests, PendingRequests } from "./Requests";
import { ShoppingMode } from "./ShoppingMode";
import { sameProduct } from "./qty";
import { useSmartAdd } from "./useSmartAdd";
import { useSetting } from "@/lib/settings";

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
  const [showEstimate] = useSetting("estimate");
  const session = useActiveSession(listId);
  const requests = useRequests(listId, session.data?.id);
  const names = useProfiles().data;
  const update = useUpdateItem(listId ?? "none");
  const start = useStartShopping(listId ?? "none");

  const [editing, setEditing] = useState<Item | null>(null);
  const [switching, setSwitching] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);
  // Písanie: pole sa prilepí ku klávesnici, dok s dlaždicami aj spodná lišta sa schovajú.
  const [typing, setTyping] = useState(false);
  const kb = useKeyboardInset(typing);
  useEffect(() => {
    document.body.classList.toggle("kb-typing", typing);
    return () => document.body.classList.remove("kb-typing");
  }, [typing]);
  // Dok je pevne dole – pod zoznamom necháme toľko miesta, koľko zaberá.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(260);
  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const swipeX = useRef<number | null>(null);
  const [search, setSearch] = useSearchParams();
  const watching = search.get("sledovat") === "1";
  const stats = useListStats(household.id);
  const remove = useDeleteItem(listId ?? "none");
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
  const open = useMemo(() => all.filter((i) => i.status === "OPEN").sort((a, b) => b.created_at.localeCompare(a.created_at)), [all]);
  const recent = useMemo(
    () => all.filter((i) => i.status !== "OPEN").sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "")),
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
  // Zoznam zmizol (dokončený alebo zmazaný niekým iným) – prototyp ukáže prázdny stav s cestou späť.
  if (!list || !listId) {
    if (!params.listId) return <Navigate to="/" replace />;
    return (
      <div className="stack">
        <header className="hdr with-back">
          <button type="button" className="ibtn" onClick={() => navigate("/")} aria-label={t("trip.backAria")}>
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
            <button type="button" className="btn btn-soft" onClick={() => navigate("/")}>
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
  const idx = openLists.findIndex((l) => l.id === list.id);
  // Recepty, pre ktoré sa nakupuje (hlavička „· pre: Segedínsky guláš“).
  const recipeNames = [...new Set((plans.data ?? []).filter((p) => p.list_id === list.id && p.status === "PENDING").map((p) => p.recipe_name))];
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

  const goRel = (d: number) => {
    const n = openLists[idx + d];
    if (n) navigate(`/lists/${n.id}`, { replace: true });
  };
  const priced = open.filter((i) => hints.data?.has(i.id));
  const estimate = priced.reduce((sum, i) => sum + (hints.data?.get(i.id)?.last_price ?? 0), 0);

  return (
    <div className="stack">
      <div className="sticky top-[env(safe-area-inset-top)] z-20">
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
            <span className="sub ellipsis" style={{ display: "block" }}>
              {openLists.length > 1 && idx >= 0 ? t("ls.listOf", { n: idx + 1, total: openLists.length }) : tn("shop.itemCount", open.length)}
              {recipeNames.length > 0 ? t("ls.forRecipes", { names: recipeNames.join(", ") }) : ""}
            </span>
          </button>
          {someoneElse ? (
            <button type="button" className="hdr-go live" onClick={() => setSearch({ sledovat: "1" })} aria-label={t("ls.watchShopper", { name: shortName(shopperName ?? "") })}>
              <span className="live" />
              {t("ls.watchShort")}
            </button>
          ) : !iAmShopping && mySessionElsewhere ? (
            <button type="button" className="hdr-go soft" onClick={() => navigate(`/lists/${mySessionElsewhere.list_id}`)} aria-label={t("ls.finishFirst", { name: elsewhereList?.name ?? "" })}>
              <ShoppingCart size={16} />
              {t("ls.otherTrip")}
            </button>
          ) : (
            <button
              type="button"
              className="hdr-go"
              disabled={start.isPending || (!iAmShopping && !open.length)}
              onClick={startShopping}
              aria-label={iAmShopping ? t("shop.continue") : t("ls.startWith", { count: tn("shop.itemCount", open.length) })}
            >
              <ShoppingCart size={16} />
              {iAmShopping ? t("ls.continueShort") : t("ls.shopShort")}
              {!iAmShopping && open.length > 0 && <span className="num">{open.length}</span>}
            </button>
          )}
          <button type="button" className="ibtn" aria-label={t("trip.edit")} onClick={() => setActionsOpen(true)}>
            <Ellipsis size={20} />
          </button>
        </header>
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

        {recent.length > 0 && (
          <section className="stack g-6">
            <button type="button" className="section-head" onClick={() => setShowPurchased((v) => !v)} style={{ width: "100%" }} aria-expanded={showPurchased}>
              <span className="section-title">
                {t("ls.inCart", { n: recent.filter((i) => i.status === "PURCHASED").length })}
                {recent.some((i) => i.status === "UNAVAILABLE") ? ` · ${t("ls.naCount", { n: recent.filter((i) => i.status === "UNAVAILABLE").length })}` : ""}
              </span>
              {showPurchased ? <ChevronUp size={16} className="t-3" /> : <ChevronDown size={16} className="t-3" />}
            </button>
            {showPurchased && (
              <div className="cells">
                {recent.map((it) =>
                  active ? (
                    <div key={it.id} className="cell" style={{ minHeight: 48 }}>
                      {it.status === "UNAVAILABLE" ? <PackageX size={16} className="t-orange" /> : <Check size={16} className="t-accent" />}
                      <span className={cx("grow t-body t-2 ellipsis", it.status === "PURCHASED" && "strike")}>{it.name}</span>
                    </div>
                  ) : (
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
                    {it.status === "UNAVAILABLE" ? <PackageX size={16} className="t-orange" /> : <Check size={16} className="t-accent" />}
                    <span className={cx("grow t-body t-2 ellipsis", it.status === "PURCHASED" && "strike")}>{it.name}</span>
                    <span className="t-sm fw-6 t-3">{t("ls.putBack")}</span>
                  </button>
                  ),
                )}
              </div>
            )}
          </section>
        )}

        {showEstimate && priced.length > 0 && (
          <div className="stack center g-2" style={{ padding: "4px 0 8px" }}>
            <span className="t-h num">{t("ls.estimate", { amount: formatEuro(estimate) })}</span>
            <span className="t-xs t-3 num">{t("ls.estimateHint", { priced: priced.length, count: open.length })}</span>
          </div>
        )}
      </div>
      <div style={{ height: dockH + 24 }} />

      <div
        ref={dockRef}
        className={cx("ls-dock fixed inset-x-0 mx-auto max-w-2xl", typing && "typing")}
        style={typing ? { bottom: kb } : undefined}
      >
        {!typing && <QuickDock householdId={household.id} items={all} onAdd={(name, count) => smartAdd({ name, quantity: count, unit: null, note: null })} />}
        <Composer
          key={list.id}
          householdId={household.id}
          items={all}
          requestMode={someoneElse}
          typing={typing}
          onTyping={setTyping}
          onAdd={smartAdd}
          onRemove={(name) => {
            const it = open.find((i) => sameProduct(i.name, name) || normalizeName(i.name).startsWith(normalizeName(name)));
            if (it) remove.mutate(it.id, { onSuccess: () => toast.show(t("item.removed", { name: it.name })), onError: (err) => toast.show(errorMessage(err), "error") });
          }}
        />
      </div>

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
