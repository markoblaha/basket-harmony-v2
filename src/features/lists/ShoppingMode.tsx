import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRightLeft, Camera, Check, ChevronDown, ChevronUp, Clock, Eye, FileText, Image, MoreHorizontal, Plus, Repeat, RotateCcw, TriangleAlert } from "lucide-react";
import { Avatars, BottomSheet, CatIcon, Cell, ScreenHeader, SheetHeader, Stepper, haptic, type Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { cx } from "@/components/ui";
import { category, categoryOrder } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatDateTime, formatEuro, formatNumber, t, tn } from "@/i18n";
import type { PriceHint } from "@/features/analytics/api";
import {
  useAddItem,
  useCreateList,
  useDeleteItem,
  useEndShopping,
  useSetReceiptLater,
  useUpdateItem,
  type AdditionRequest,
  type Item,
  type Session,
  type ShoppingList,
} from "./api";
import { Composer, type AddInput } from "./Composer";
import { addDays, dayLabel, isoDay, listDay } from "./dates";
import { stepOf } from "./PlanList";
import { countOf, isCountable, qtyLabel } from "./qty";
import { MyRequests, PendingRequests } from "./Requests";
import type { AddOutcome } from "./useSmartAdd";

const time = (iso: string) => formatDateTime(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * N4 – aktívny nákup (prototyp, návrh A). Celá obrazovka nad aplikáciou.
 * Ťuk na kartu = kúpené: štvorček s množstvom sa otočí na zelenú fajku, karta
 * zosvetlie a spadne do „V košíku“. Ďalšie možnosti (náhrada, kúpim inde) sú pod ⋯.
 * Kto nakup len sleduje, vidí to isté bez ovládania a pridáva žiadosti.
 */
export function ShoppingMode({
  list,
  items,
  session,
  shopper,
  me,
  names,
  people,
  hints,
  pending,
  myRequests,
  openLists,
  householdId,
  onBack,
  onAdd,
}: {
  list: ShoppingList;
  items: Item[];
  session: Session;
  /** Nakupujem ja (inak len sledujem). */
  shopper: boolean;
  me: string;
  names: Map<string, string> | undefined;
  people: Person[];
  hints?: Map<string, PriceHint>;
  pending: AdditionRequest[];
  myRequests: AdditionRequest[];
  /** Ostatné rozpracované zoznamy – pre „Kúpim inde“. */
  openLists: ShoppingList[];
  householdId: string;
  onBack: () => void;
  onAdd: (input: AddInput) => Promise<AddOutcome>;
}) {
  const [finishing, setFinishing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const [menu, setMenu] = useState<Item | null>(null);

  const since = new Date(session.started_at).getTime();
  const open = useMemo(() => items.filter((i) => i.status === "OPEN"), [items]);
  const done = useMemo(
    () =>
      items
        .filter((i) => i.status === "PURCHASED" && new Date(i.purchased_at ?? 0).getTime() >= since)
        .sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? "")),
    [items, since],
  );
  const total = open.length + done.length;
  useEffect(() => {
    if (open.length > 0) setDismissed(false);
  }, [open.length]);

  const groups = useMemo(() => {
    const byCat = new Map<string, Item[]>();
    for (const i of open) byCat.set(i.category_id, [...(byCat.get(i.category_id) ?? []), i]);
    return [...byCat.entries()].sort(([a], [b]) => categoryOrder(a) - categoryOrder(b));
  }, [open]);

  const priced = done.filter((i) => hints?.has(i.id));
  const cart = priced.reduce((sum, i) => sum + (hints?.get(i.id)?.last_price ?? 0), 0);
  const shopperName = shortName(names?.get(session.shopper_id) ?? t("household.fallbackName"));
  const autoFinish = shopper && total > 0 && open.length === 0 && !dismissed;
  const showFinish = shopper && (finishing || autoFinish);

  return (
    <div className="fixed inset-0 z-[45] mx-auto flex max-w-2xl flex-col bg-bg pt-safe animate-rise" style={{ background: "var(--bg)" }}>
      <ScreenHeader
        onBack={onBack}
        title={shopper ? t("ls.youShopIn", { name: list.name }) : t("ls.someoneShopsIn", { who: shopperName, name: list.name })}
        sub={t("ls.shopSub", { time: time(session.started_at), left: tn("shop.itemCount", open.length) })}
        right={list.is_private ? null : <Avatars people={people} />}
        sticky={false}
      />
      <ShopProgress bought={done.length} total={total} />

      {!shopper && (
        <div className="stack g-8" style={{ padding: "0 16px 4px" }}>
          <div className="row g-10 t-sm" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--violet-soft)", color: "var(--violet)" }}>
            <Eye size={16} />
            <span className="grow">{t("ls.watching", { name: shopperName })}</span>
          </div>
        </div>
      )}
      {!shopper && <Composer householdId={householdId} requestMode onAdd={onAdd} />}

      <div className="scroll">
        <div className="stack g-16 px" style={{ paddingTop: 8 }}>
          {shopper && <PendingRequests requests={pending} names={names} listId={list.id} />}
          {!shopper && <MyRequests requests={myRequests} shopperName={shopperName} />}

          {open.length === 0 ? (
            <div className="card stack center g-6" style={{ padding: 20, textAlign: "center" }}>
              <span className="t-h">{t("ls.allDone")}</span>
              <span className="t-sm t-2">{shopper ? t("ls.allDoneShopper") : t("ls.allDoneWatcher", { name: shopperName })}</span>
            </div>
          ) : (
            groups.map(([cat, group]) => (
              <section key={cat} className="stack g-6">
                <div className="ls-cat-head">
                  <CatIcon id={cat} size="sm" />
                  {category(cat).name}
                  <span className="t-3 num">{group.length}</span>
                </div>
                <div className="cells">
                  {group.map((it) => (
                    <ShopRow
                      key={it.id}
                      listId={list.id}
                      item={it}
                      by={it.added_by && it.added_by !== me ? names?.get(it.added_by) : undefined}
                      hint={hints?.get(it.id)}
                      shopper={shopper}
                      onMenu={() => setMenu(it)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {shopper && open.length > 0 && (
            <span className="t-xs t-3" style={{ textAlign: "center" }}>
              {t("ls.shopHint")}
            </span>
          )}

          {done.length > 0 && (
            <section className="stack g-6">
              <button type="button" className="section-head" style={{ minHeight: 40 }} onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
                <span className="section-title">{t("ls.inCart", { n: done.length })}</span>
                {showDone ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showDone && (
                <div className="cells">
                  {done.map((it) => (
                    <DoneRow key={it.id} listId={list.id} item={it} shopper={shopper} who={it.purchased_by ? names?.get(it.purchased_by) : undefined} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <div style={{ height: 120 }} />
      </div>

      {shopper ? (
        <div className="ls-bottombar pb-[calc(22px+env(safe-area-inset-bottom))]">
          <span className="grow stack g-2">
            <span className="t-xs t-2">{priced.length > 0 ? t("ls.cartApprox") : t("ls.cart")}</span>
            <span className="t-h num">{priced.length > 0 ? `~${formatEuro(cart)}` : tn("shop.itemCount", done.length)}</span>
          </span>
          <button type="button" className="btn btn-ink btn-lg" onClick={() => setFinishing(true)}>
            {t("ls.finishShopping")}
          </button>
        </div>
      ) : (
        <div className="ls-bottombar pb-[calc(22px+env(safe-area-inset-bottom))]">
          <span className="grow t-sm t-2">
            {priced.length > 0 ? t("ls.cartApproxInline", { amount: formatEuro(cart) }) : t("ls.cartInline", { count: tn("shop.itemCount", done.length) })}
          </span>
          <button type="button" className="btn btn-line" onClick={onBack}>
            {t("common.close")}
          </button>
        </div>
      )}

      <ItemMenu item={menu} list={list} openLists={openLists} householdId={householdId} by={menu?.added_by && menu.added_by !== me ? names?.get(menu.added_by) : undefined} onClose={() => setMenu(null)} />

      {showFinish && (
        <FinishScreen
          list={list}
          session={session}
          open={open}
          bought={done}
          pending={pending}
          names={names}
          estimate={priced.length > 0 ? cart : null}
          householdId={householdId}
          onBack={() => {
            setFinishing(false);
            setDismissed(true);
          }}
        />
      )}
    </div>
  );
}

/** Štvorček s množstvom – po kúpe sa otočí na fajku. */
function QtyToken({ item, done }: { item: Item; done: boolean }) {
  const piece = isCountable(item.unit);
  const n = formatNumber(countOf(item.quantity), { maximumFractionDigits: 2 });
  return (
    <span className={cx("ls-tok", done && "done")} aria-hidden>
      <span>
        <span className="face front">
          {piece ? (
            <b className="num">{n}×</b>
          ) : (
            <span>
              <b className="num">{n}</b>
              <small>{item.unit}</small>
            </span>
          )}
        </span>
        <span className="face back">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path className="ls-draw" d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </span>
  );
}

function ShopRow({ listId, item, by, hint, shopper, onMenu }: { listId: string; item: Item; by?: string; hint?: PriceHint; shopper: boolean; onMenu: () => void }) {
  const update = useUpdateItem(listId);
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const buy = () => {
    if (leaving || !shopper) return;
    haptic(12);
    setLeaving(true);
    setTimeout(
      () =>
        update.mutate(
          { id: item.id, patch: { status: "PURCHASED" } },
          {
            onError: (err) => {
              setLeaving(false);
              toast.show(errorMessage(err), "error");
            },
          },
        ),
      900,
    );
  };
  const qty = qtyLabel(item.quantity, item.unit);
  return (
    <div className={cx("ls-swipe ls-shop", leaving && "leaving")}>
      <div className="front">
        <div className="ls-shop-row">
          <div
            className="row g-12 grow"
            style={{ minWidth: 0, cursor: shopper ? "pointer" : "default", alignItems: "center" }}
            {...(shopper
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": t("ls.buyAria", { name: item.name, qty }),
                  onClick: buy,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      buy();
                    }
                  },
                }
              : {})}
          >
            <QtyToken item={item} done={leaving} />
            <span className="grow stack" style={{ minWidth: 0, gap: 1 }}>
              <span className="ls-sname ls-name">{item.name}</span>
              {item.note && <span className="ls-meta">{item.note}</span>}
              {hint && (
                <span className="ls-meta num">
                  <span className="t-2">~{formatEuro(hint.last_price)}</span> · {hint.last_store} {dayLabel(hint.last_date)}
                </span>
              )}
              {by && <span className="ls-meta ls-who">{t("item.addedBy", { name: shortName(by) })}</span>}
            </span>
          </div>
          {shopper && (
            <button type="button" className="ibtn" aria-label={t("ls.optionsAria", { name: item.name })} onClick={onMenu}>
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneRow({ listId, item, shopper, who }: { listId: string; item: Item; shopper: boolean; who?: string }) {
  const update = useUpdateItem(listId);
  const toast = useToast();
  const body = (
    <>
      <span className="ls-check on">
        <Check size={15} strokeWidth={2.8} />
      </span>
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-body fw-5 ellipsis strike t-2">{item.name}</span>
        <span className="t-sm t-2 ellipsis">{item.note ?? (who ? t("ls.boughtBy", { name: shortName(who) }) : t("ls.bought"))}</span>
      </span>
      {shopper && <span className="t-sm fw-6 t-3">{t("ls.putBack")}</span>}
    </>
  );
  if (!shopper)
    return (
      <div className="ls-shop-row" style={{ minHeight: 56 }}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      className="ls-shop-row"
      style={{ minHeight: 56 }}
      onClick={() => update.mutate({ id: item.id, patch: { status: "OPEN" } }, { onError: (err) => toast.show(errorMessage(err), "error") })}
    >
      {body}
    </button>
  );
}

/** Ukazovateľ postupu nákupu: čiarka za každú položku a počet vpravo. */
function ShopProgress({ bought, total }: { bought: number; total: number }) {
  const segs = Array.from({ length: total }, (_, i) => (i < bought ? "b" : "o"));
  return (
    <div className="ls-prog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={bought} aria-label={t("ls.progressAria", { done: bought, total })}>
      <div className={cx("ls-prog-segs", total > 40 && "dense")}>
        {segs.map((k, i) => (
          <span key={i} className={cx("ls-seg", k)} />
        ))}
      </div>
      <span className="ls-prog-n num">
        <b>{bought}</b>/{total}
      </span>
    </div>
  );
}

/* ================================================================== N4M – akcie položky */
function ItemMenu({
  item,
  list,
  openLists,
  householdId,
  by,
  onClose,
}: {
  item: Item | null;
  list: ShoppingList;
  openLists: ShoppingList[];
  householdId: string;
  by?: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={!!item} onClose={onClose} label={item?.name ?? ""}>
      {item && <MenuBody key={item.id} item={item} list={list} openLists={openLists} householdId={householdId} by={by} onClose={onClose} />}
    </BottomSheet>
  );
}

function MenuBody({
  item,
  list,
  openLists,
  householdId,
  by,
  onClose,
}: {
  item: Item;
  list: ShoppingList;
  openLists: ShoppingList[];
  householdId: string;
  by?: string;
  onClose: () => void;
}) {
  const update = useUpdateItem(list.id);
  const remove = useDeleteItem(list.id);
  const add = useAddItem();
  const create = useCreateList(householdId);
  const toast = useToast();
  const [mode, setMode] = useState<null | "sub" | "move">(null);
  const [sub, setSub] = useState("");
  const fail = (err: unknown) => toast.show(errorMessage(err), "error");
  const isOpen = item.status === "OPEN";
  const targets = openLists.filter((l) => l.id !== list.id);

  async function moveTo(target: ShoppingList | null) {
    onClose();
    try {
      const id = target
        ? target.id
        : await create.mutateAsync({ name: t("ls.laterList"), isPrivate: list.is_private, plannedFor: isoDay(addDays(new Date(), 1)), note: null });
      await add.mutateAsync({ listId: id, name: item.name, quantity: item.quantity, unit: item.unit, note: item.note, categoryId: item.category_id });
      await remove.mutateAsync(item.id);
      toast.show(t("ls.moved", { name: item.name, list: target?.name ?? t("ls.laterList") }));
    } catch (err) {
      fail(err);
    }
  }

  if (mode === "sub") {
    return (
      <>
        <SheetHeader title={t("ls.subFor", { name: item.name })} onClose={onClose} />
        <div className="sheet-body stack g-12">
          <input className="input" autoFocus maxLength={120} placeholder={t("ls.subPlaceholder")} value={sub} onChange={(e) => setSub(e.target.value)} />
          <button
            type="button"
            className="btn btn-ink btn-lg btn-block"
            disabled={!sub.trim()}
            onClick={() => {
              onClose();
              update.mutate(
                { id: item.id, patch: { name: sub.trim(), note: t("ls.subNote", { name: item.name }), status: "PURCHASED" } },
                { onError: fail },
              );
            }}
          >
            {t("ls.saveSub")}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode(null)}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  if (mode === "move") {
    return (
      <>
        <SheetHeader title={t("ls.buyElsewhereTitle", { name: item.name })} sub={t("ls.moveSub")} onClose={onClose} />
        <div className="sheet-body stack g-12">
          <div className="cells">
            {targets.map((l) => (
              <Cell
                key={l.id}
                icon={
                  <span className="cat-ic sm">
                    <ArrowRightLeft size={15} />
                  </span>
                }
                title={l.name}
                sub={listDay(l)}
                onClick={() => void moveTo(l)}
              />
            ))}
            <Cell
              icon={
                <span className="cat-ic sm">
                  <Plus size={15} />
                </span>
              }
              title={t("ls.newLaterList")}
              sub={t("date.tomorrow")}
              onClick={() => void moveTo(null)}
            />
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode(null)}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  const meta = [qtyLabel(item.quantity, item.unit), item.note, by ? t("item.addedBy", { name: shortName(by) }) : ""].filter(Boolean).join(" · ");
  const step = stepOf(item.unit);
  return (
    <>
      <SheetHeader title={item.name} sub={meta || undefined} onClose={onClose} />
      <div className="sheet-body stack g-12">
        {isOpen && (
          <div className="row between g-12" style={{ padding: "0 4px" }}>
            <span className="t-body fw-5">{t("edit.quantity")}</span>
            <Stepper
              value={countOf(item.quantity)}
              unit={item.unit}
              step={step}
              min={step}
              onChange={(v) => update.mutate({ id: item.id, patch: { quantity: v } }, { onError: fail })}
            />
          </div>
        )}
        <div className="cells">
          {isOpen ? (
            <Cell
              icon={
                <span className="cat-ic sm" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>
                  <Check size={15} />
                </span>
              }
              title={t("ls.bought")}
              chevron={false}
              onClick={() => {
                onClose();
                update.mutate({ id: item.id, patch: { status: "PURCHASED" } }, { onError: fail });
              }}
            />
          ) : (
            <Cell
              icon={
                <span className="cat-ic sm">
                  <RotateCcw size={15} />
                </span>
              }
              title={t("ls.backToList")}
              chevron={false}
              onClick={() => {
                onClose();
                update.mutate({ id: item.id, patch: { status: "OPEN" } }, { onError: fail });
              }}
            />
          )}
          <Cell
            icon={
              <span className="cat-ic sm">
                <Repeat size={15} />
              </span>
            }
            title={t("ls.boughtSub")}
            onClick={() => setMode("sub")}
          />
          <Cell
            icon={
              <span className="cat-ic sm">
                <ArrowRightLeft size={15} />
              </span>
            }
            title={t("ls.buyElsewhere")}
            sub={t("ls.moveSub")}
            onClick={() => setMode("move")}
          />
        </div>
      </div>
    </>
  );
}

/* ================================================================== N6 – koniec nákupu */
function FinishScreen({
  list,
  session,
  open,
  bought,
  pending,
  names,
  estimate,
  householdId,
  onBack,
}: {
  list: ShoppingList;
  session: Session;
  open: Item[];
  bought: Item[];
  pending: AdditionRequest[];
  names: Map<string, string> | undefined;
  estimate: number | null;
  householdId: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const end = useEndShopping(list.id);
  const later = useSetReceiptLater(householdId);
  const create = useCreateList(householdId);
  const add = useAddItem();
  const remove = useDeleteItem(list.id);
  const [unbought, setUnbought] = useState<"move" | "keep" | "drop">("move");
  const [busy, setBusy] = useState(false);

  async function finish(receipt: "photo" | "later") {
    if (busy) return;
    setBusy(true);
    try {
      if (open.length && unbought === "move") {
        const id = await create.mutateAsync({ name: list.name, isPrivate: list.is_private, plannedFor: isoDay(addDays(new Date(), 1)), note: list.note });
        for (const i of open) await add.mutateAsync({ listId: id, name: i.name, quantity: i.quantity, unit: i.unit, note: i.note, categoryId: i.category_id });
        for (const i of open) await remove.mutateAsync(i.id);
      } else if (open.length && unbought === "drop") {
        for (const i of open) await remove.mutateAsync(i.id);
      }
      await end.mutateAsync(session.id);
      if (receipt === "later") await later.mutateAsync({ listId: list.id, later: true });
      const moved = open.length
        ? unbought === "move"
          ? ` · ${t("ls.movedTomorrow", { count: tn("shop.itemCount", open.length) })}`
          : unbought === "keep"
            ? ` · ${t("ls.keptOnList", { count: tn("shop.itemCount", open.length) })}`
            : ""
        : "";
      if (receipt === "photo") {
        navigate(`/receipts?pridat=1&nakup=${list.id}`);
        toast.show(t("ls.savedReading", { name: list.name }) + moved);
      } else {
        navigate("/");
        toast.show(t("ls.savedLater", { name: list.name }) + moved);
      }
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  const options: ["move" | "keep" | "drop", string, string][] = [
    ["move", t("ls.optMove"), t("ls.optMoveSub")],
    ["keep", t("ls.optKeep"), t("ls.optKeepSub")],
    ["drop", t("ls.optDrop"), t("ls.optDropSub")],
  ];
  const requester = pending[0]?.requested_by ? shortName(names?.get(pending[0].requested_by) ?? "") : "";

  return (
    <div className="ls-finish" role="dialog" aria-label={t("ls.finishTitle")} style={{ zIndex: 50 }}>
      <ScreenHeader onBack={onBack} title={t("ls.finishTitle")} sticky={false} />
      <div className="scroll">
        <div className="stack g-20 px" style={{ paddingTop: 8 }}>
          <div className="stack center g-10" style={{ textAlign: "center", paddingTop: 8 }}>
            <span className="ls-done-mark">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="t-title">{list.name}</span>
            <span className="t-sm t-2 num">
              {t("ls.inCartCount", { count: tn("shop.itemCount", bought.length) })}
              {open.length ? ` · ${t("ls.unboughtCount", { n: open.length })}` : ""}
            </span>
            {estimate != null && <span className="t-big num">~{formatEuro(estimate)}</span>}
            {estimate != null && <span className="t-xs t-3">{t("ls.estimateNote")}</span>}
          </div>

          {pending.length > 0 && (
            <div className="row g-10 t-sm" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--violet-soft)", color: "var(--violet)" }}>
              <TriangleAlert size={16} />
              <span className="grow">{tn("ls.pendingWarn", pending.length, { name: requester })}</span>
            </div>
          )}

          {open.length > 0 && (
            <section className="stack g-8">
              <span className="field-label">{t("ls.unboughtList", { names: open.map((i) => i.name).join(", ") })}</span>
              <div className="cells" role="radiogroup">
                {options.map(([v, title, sub]) => (
                  <button key={v} type="button" className="cell" role="radio" aria-checked={unbought === v} onClick={() => setUnbought(v)}>
                    <span className={cx("ls-check", unbought === v && "on")}>{unbought === v && <Check size={15} strokeWidth={2.8} />}</span>
                    <span className="grow stack g-2">
                      <span className="t-body fw-5">{title}</span>
                      <span className="t-sm t-2">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="stack g-10">
            <span className="field-label">{t("trip.receipt")}</span>
            <span className="t-sm t-2" style={{ padding: "0 4px" }}>
              {t("ls.receiptWhyShort")}
            </span>
            <button type="button" className="btn btn-ink btn-lg btn-block" disabled={busy} onClick={() => void finish("photo")}>
              <Camera size={18} />
              {t("ls.takePhoto")}
            </button>
            <div className="row g-8">
              <button type="button" className="btn btn-line grow" disabled={busy} onClick={() => void finish("photo")}>
                <Image size={17} />
                {t("ls.fromGallery")}
              </button>
              <button type="button" className="btn btn-line grow" disabled={busy} onClick={() => void finish("photo")}>
                <FileText size={17} />
                PDF
              </button>
            </div>
            <button type="button" className="btn btn-soft btn-block" disabled={busy} onClick={() => void finish("later")}>
              <Clock size={17} />
              {t("ls.receiptLater")}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
              <ArrowLeft size={17} />
              {t("done.reopen")}
            </button>
          </section>
        </div>
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

