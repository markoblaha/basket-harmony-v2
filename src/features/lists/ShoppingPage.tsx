import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { ArrowRight, Camera, Check, ChevronDown, ChevronLeft, Lock, MoreHorizontal, Play, Receipt } from "lucide-react";
import { Avatar, ErrorState, SectionTitle, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { t, tn, type Key } from "@/i18n";
import { useListPriceHints, type PriceHint } from "@/features/analytics/api";
import { formatMoney } from "@/features/receipts/format";
import { useActiveSession, useEndShopping, useItems, useLists, useRequests, useStartShopping, useUpdateItem, type Item } from "./api";
import { AddFeed, useFeed } from "./feed";
import { Composer } from "./Composer";
import { DoneScreen, type ShopSummary } from "./DoneScreen";
import { EditItemSheet } from "./EditItemSheet";
import { ListSheet } from "./ListSheet";
import { dayLabel } from "./dates";
import { PlanList } from "./PlanList";
import { QuickTiles } from "./QuickTiles";
import { RequestCard } from "./RequestCard";
import { ShoppingMode } from "./ShoppingMode";
import { qtyLabel } from "./qty";
import { useSmartAdd } from "./useSmartAdd";

/** Krátka veta s cenou z bločkov: "naposledy 1,19 € (Lidl) · lacnejšie: Tesco". */
function priceHint(h: PriceHint | undefined): string | undefined {
  if (!h) return undefined;
  const cheaper = h.cheapest_store && h.cheapest_store !== h.last_store && h.cheapest_unit < h.last_unit - 0.005;
  const price = formatMoney(h.last_price);
  return cheaper
    ? t("shop.price.lastCheaper", { price, store: h.last_store, cheaper: h.cheapest_store })
    : t("shop.price.last", { price, store: h.last_store });
}


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
 * Karta Nákup. Tri stavy jednej obrazovky:
 *  1. Plánovanie – pridávanie (pole + dlaždice), žiadosti, zoznam ako účtenka.
 *  2. Práve nakupujem – celá obrazovka (ShoppingMode).
 *  3. Nákup dokončený – súhrn s návratom k nákupu (DoneScreen).
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
  const end = useEndShopping(listId ?? "none");

  const [editing, setEditing] = useState<Item | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);
  const [summary, setSummary] = useState<ShopSummary | null>(null);
  /** Pri znovuotvorení nákupu ukážeme v košíku aj veci z pôvodného nákupu. */
  const [cartSince, setCartSince] = useState<string | null>(null);
  const feed = useFeed();

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
  // Pre automatické ukončenie: časovač musí vidieť najnovší stav, nie stav spred 1,5 s.
  const latest = useRef({ all, active, cartSince });
  latest.current = { all, active, cartSince };
  const open = useMemo(() => all.filter((i) => i.status === "OPEN").sort((a, b) => b.created_at.localeCompare(a.created_at)), [all]);
  const recent = useMemo(
    () => all.filter((i) => i.status === "PURCHASED").sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "")),
    [all],
  );
  const pendingForMe = (requests.data ?? []).filter((r) => r.status === "PENDING" && r.requested_for === me);
  const myRequests = (requests.data ?? []).filter((r) => r.requested_by === me);
  const hintMap = useMemo(() => {
    const m = new Map<string, string>();
    hints.data?.forEach((h, id) => {
      const text = priceHint(h);
      if (text) m.set(id, text);
    });
    return m;
  }, [hints.data]);

  const smartAdd = useSmartAdd({ listId: listId ?? "none", items: all, someoneElseShopping: someoneElse, onFeed: feed.push });

  async function startShopping() {
    if (iAmShopping) {
      resume();
      return;
    }
    try {
      await start.mutateAsync();
      setCartSince(null);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function finish() {
    const { all, active, cartSince } = latest.current;
    if (!active || end.isPending) return;
    const since = Math.min(new Date(active.started_at).getTime(), cartSince ? new Date(cartSince).getTime() : Infinity);
    const snapshot: ShopSummary = {
      listName: list?.name ?? "",
      startedAt: cartSince ?? active.started_at,
      endedAt: new Date().toISOString(),
      bought: all.filter((i) => i.status === "PURCHASED" && new Date(i.purchased_at ?? 0).getTime() >= since),
      unbought: all.filter((i) => i.status === "OPEN"),
    };
    try {
      await end.mutateAsync(active.id);
      writeFlag(interruptKey(active.id), false);
      setSummary(snapshot);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function reopen() {
    if (!summary) return;
    try {
      await start.mutateAsync();
      setCartSince(summary.startedAt);
      setSummary(null);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;
  // Nákup neexistuje, bol odstránený z prehľadu, alebo je súkromný cudzí → späť na prehľad.
  if (!list || !listId) return <Navigate to="/" replace />;

  if (summary) {
    return (
      <DoneScreen
        listId={listId}
        householdId={household.id}
        summary={summary}
        names={names}
        me={me}
        onReopen={reopen}
        reopening={start.isPending}
        onClose={() => {
          setSummary(null);
          setCartSince(null);
          navigate("/");
        }}
      />
    );
  }

  if (iAmShopping && active && !interrupted) {
    return (
      <>
        <ShoppingMode
          list={list}
          items={all}
          session={active}
          cartSince={cartSince}
          pending={pendingForMe}
          names={names}
          me={me}
          hints={hintMap}
          onEdit={setEditing}
          onInterrupt={interrupt}
          onFinish={finish}
          finishing={end.isPending}
        />
        <EditItemSheet key={editing?.id} item={editing} listId={listId} onClose={() => setEditing(null)} />
      </>
    );
  }

  const memberIds = names ? [...names.keys()] : [];
  const doneInSession = active ? recent.filter((i) => new Date(i.purchased_at ?? 0) >= new Date(active.started_at)).length : 0;

  return (
    <div className="pb-24">
      <header className="flex items-center gap-1 pb-3 pl-1 pr-3 pt-3">
        <button type="button" onClick={() => navigate("/")} aria-label={t("trip.backAria")} className="grid size-11 shrink-0 place-items-center rounded-xl active:bg-pressed">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} className="min-w-0 flex-1 rounded-xl px-1 text-left active:bg-pressed" aria-label={t("trip.editAria", { name: list.name })}>
          <h1 className="break-words text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em]">{list.name}</h1>
          <span className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-text-2">
            {list.is_private && (
              <span className="flex items-center gap-1 rounded-md bg-surface px-1.5 py-px text-[0.6875rem] font-bold">
                <Lock className="size-3" aria-hidden /> {t("trip.onlyMe")}
              </span>
            )}
            {list.planned_for ? dayLabel(list.planned_for) : t("trip.noDay")}
            {list.note && ` · ${list.note}`}
          </span>
        </button>
        {!list.is_private && (
          <span className="flex shrink-0" aria-label={t("trip.sharedAria", { name: household.name })}>
            {memberIds.slice(0, 3).map((id, i) => (
              <span key={id} className={cx(i > 0 && "-ml-2 rounded-lg ring-2 ring-bg")}>
                <Avatar name={names?.get(id) ?? "?"} me={id === me} />
              </span>
            ))}
          </span>
        )}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t("trip.edit")}
          className="ml-1 grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-elevated active:bg-pressed"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>

      {list.completed_at && !active && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-line bg-elevated p-3 animate-rise">
          <span className="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-success-soft text-success" aria-hidden>
            <Check className="size-[1.125rem]" strokeWidth={2.8} />
          </span>
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-text-2">
            <b className="block text-[0.9375rem] text-text">{t("trip.boughtOn", { day: dayLabel(list.completed_at) })}</b>
            {t("trip.reopenHint")}
          </p>
          {list.receipt_state === "ATTACHED" && list.receipt_id ? (
            <button type="button" onClick={() => navigate(`/receipts/${list.receipt_id}`)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-[0.625rem] bg-success-soft px-2.5 text-[0.8125rem] font-bold text-success">
              <Receipt className="size-4" aria-hidden /> {t("trip.receipt")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/receipts?pridat=1&nakup=${list.id}`)}
              className={cx("flex h-9 shrink-0 items-center gap-1.5 rounded-[0.625rem] px-2.5 text-[0.8125rem] font-bold", list.receipt_state === "LATER" ? "bg-accent-soft text-accent-text" : "border border-line")}
            >
              <Camera className="size-4" aria-hidden /> {list.receipt_state === "LATER" ? t("trip.completeReceipt") : t("trip.addReceipt")}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5 px-4">
        {iAmShopping && interrupted && active && (
          <button type="button" onClick={resume} className="flex items-center gap-3 rounded-2xl bg-primary p-2.5 pl-3 text-left text-on-primary animate-rise">
            <span className="grid size-[2.375rem] shrink-0 place-items-center rounded-[0.6875rem] bg-accent text-on-accent">
              <Play className="size-[1.125rem]" fill="currentColor" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold">{t("shop.inProgress.title")}</span>
              <span className="block text-[0.8125rem] opacity-70">
                {t("shop.inProgress.text", { done: doneInSession, left: open.length })}
              </span>
            </span>
            <ArrowRight className="mr-1 size-[1.125rem] opacity-70" aria-hidden />
          </button>
        )}
        {someoneElse && (
          <div role="status" className="flex items-center gap-3 rounded-2xl border border-person/30 bg-person-soft p-3 text-sm">
            <Avatar name={shopperName ?? "?"} />
            <p className="min-w-0 text-text-2">
              <b className="text-text">{t("shop.shopperNow", { name: shopperName ?? "" })}</b>
              <br />
              {t("shop.requestsHint")}
            </p>
          </div>
        )}

        <Composer requestMode={someoneElse} onAdd={smartAdd} />
      </div>

      {someoneElse && myRequests.length > 0 && (
        <section className="mt-5 px-4">
          <SectionTitle>{t("shop.yourRequests")}</SectionTitle>
          <div className="divide-y divide-dashed divide-line overflow-hidden rounded-2xl border border-line bg-elevated">
            {myRequests.map((r) => (
              <div key={r.id} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">
                    {r.name} <span className="font-normal text-text-2">· {qtyLabel(r.quantity, r.unit)}</span>
                  </span>
                  <RequestStatus status={r.status} />
                </div>
                {r.response_note && (
                  <p className="mt-1.5 inline-block rounded-xl rounded-bl-sm bg-person-soft px-2.5 py-1.5 text-[0.8125rem] text-text">
                    {shopperName}: {r.response_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {iAmShopping && interrupted && pendingForMe.length > 0 && (
        <section className="mt-5 px-4">
          <SectionTitle className="text-accent-text">
            <span className="size-2 rounded-full bg-accent [animation:bh-pulse_1.6s_ease_infinite]" aria-hidden />
            {t("shop.waitingApproval")}
          </SectionTitle>
          <div className="divide-y divide-dashed divide-line overflow-hidden rounded-2xl border border-line bg-elevated">
            {pendingForMe.map((r) => (
              <RequestCard key={r.id} request={r} listId={listId} who={(r.requested_by && names?.get(r.requested_by)) || t("household.fallbackName")} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 px-4">
        <SectionTitle>{t("shop.quickAdd")}</SectionTitle>
        <QuickTiles
          householdId={household.id}
          items={all}
          onFeed={feed.push}
          onAdd={(name, count) => void smartAdd({ name, quantity: count, unit: null, note: null })}
        />
      </section>

      <section className="mt-5 px-4">
        <SectionTitle
          trailing={
            <span key={open.length} className="grid h-[1.375rem] min-w-[1.375rem] place-items-center rounded-[0.4375rem] bg-surface px-1.5 text-xs font-bold text-text [animation:bh-pop_.45s_ease]">
              {open.length}
            </span>
          }
        >
          {t("shop.onList")}
        </SectionTitle>
        {items.isPending ? (
          <Spinner />
        ) : items.isError ? (
          <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} />
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-center text-sm text-text-2">
            {t("shop.emptyList")}
          </div>
        ) : (
          <PlanList listId={listId} items={open} names={names} me={me} hints={hintMap} onEdit={setEditing} />
        )}

        {recent.length > 0 && !active && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowPurchased((v) => !v)}
              aria-expanded={showPurchased}
              className="flex min-h-10 items-center gap-1 px-0.5 text-[0.8125rem] font-bold text-text-2"
            >
              {t("shop.recentlyBought", { n: recent.length })}
              <ChevronDown className={cx("size-4 transition-transform", showPurchased && "rotate-180")} aria-hidden />
            </button>
            {showPurchased && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        update.mutate(
                          { id: item.id, patch: { status: "OPEN" } },
                          {
                            onSuccess: () => feed.push({ name: item.name, tail: t("shop.backOnList") }),
                            onError: (err) => toast.show(errorMessage(err), "error"),
                          },
                        )
                      }
                      className="h-9 rounded-[0.625rem] border border-dashed border-line-strong px-2.5 text-[0.8125rem] font-medium text-text-2 line-through decoration-text-3"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-0.5 text-xs text-text-3">{t("shop.tapToRestore")}</p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Hlavná akcia obrazovky (rumelka) */}
      {(open.length > 0 || iAmShopping) && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl border-t border-line bg-bg px-4 pb-3 pt-2.5">
          {someoneElse ? (
            <div className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-elevated text-sm font-semibold text-text-2">
              <Avatar name={shopperName ?? "?"} size="sm" /> {t("shop.shopperNow", { name: shopperName ?? "" })}
            </div>
          ) : (
            <button
              type="button"
              onClick={startShopping}
              disabled={start.isPending}
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-accent pl-[1.125rem] pr-2 text-base font-bold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {iAmShopping ? t("shop.continue") : t("shop.start")}
              <span className="flex h-10 items-center gap-2 rounded-[0.6875rem] bg-black/15 px-3 text-sm font-semibold">
                {tn("shop.itemCount", open.length)}
                <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden />
              </span>
            </button>
          )}
        </div>
      )}

      <AddFeed entries={feed.entries} />
      <EditItemSheet key={editing?.id} item={editing} listId={listId} onClose={() => setEditing(null)} />
      <ListSheet
        key={`${list.id}-${settingsOpen}`}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        householdId={household.id}
        householdName={household.name}
        memberNames={memberIds.map((id) => names?.get(id) ?? "?")}
        me={me}
        recentNames={[]}
        list={list}
      />
    </div>
  );
}

function RequestStatus({ status }: { status: string }) {
  const map: Record<string, [Key, string]> = {
    PENDING: ["request.status.PENDING", "bg-warning-soft text-warning"],
    ACCEPTED: ["request.status.ACCEPTED", "bg-success-soft text-success"],
    REJECTED: ["request.status.REJECTED", "bg-danger-soft text-danger"],
    EXPIRED: ["request.status.EXPIRED", "bg-surface text-text-3"],
  };
  const [label, cls] = map[status] ?? [null, ""];
  return <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label ? t(label) : "?"}</span>;
}
