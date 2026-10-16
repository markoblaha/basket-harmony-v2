import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, CornerUpLeft, Pause } from "lucide-react";
import { Avatar, Sheet, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES, categoryOrder } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatDateTime, t } from "@/i18n";
import { useUpdateItem, type AdditionRequest, type Item, type Session, type ShoppingList } from "./api";
import { RequestCard } from "./RequestCard";
import { qtyLabel } from "./qty";

/** Ako dlho letí kúpená položka do lišty (musí sedieť s animáciou bh-funnel). */
const FUNNEL_MS = 420;
/** Po odškrtnutí poslednej položky – čas na „Vrátiť“, kým sa nákup sám uzavrie. */
const AUTO_FINISH_MS = 1500;
const TOAST_MS = 3200;

const time = (iso: string) => formatDateTime(iso, { hour: "2-digit", minute: "2-digit" });

type Toast = { id: number; name: string; rest: string; undo?: Item; out?: boolean };

/**
 * Aktívny nákup – celá obrazovka bez spodnej navigácie, aby nič nerušilo.
 * Ťuk na položku: zažiari, zúži sa ako do lievika a vletí do tmavej lišty dole.
 * Počet kúpených je LEN v lište (nie v hlavičke ani na tlačidle).
 */
export function ShoppingMode({
  list,
  items,
  session,
  cartSince,
  pending,
  names,
  me,
  hints,
  onEdit,
  onInterrupt,
  onFinish,
  finishing,
}: {
  list: ShoppingList;
  items: Item[];
  session: Session;
  /** Pri znovuotvorenom nákupe: od kedy rátať veci „v košíku“. */
  cartSince?: string | null;
  pending: AdditionRequest[];
  hints?: Map<string, string>;
  names: Map<string, string> | undefined;
  me: string;
  onEdit: (item: Item) => void;
  /** Prerušiť – vrátiť sa k plánovaniu, nákup ostáva otvorený. */
  onInterrupt: () => void;
  /** Ukončiť nákup (ručne alebo automaticky po poslednej položke). */
  onFinish: () => void;
  finishing: boolean;
}) {
  const update = useUpdateItem(list.id);
  const toastApi = useToast();
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [arrived, setArrived] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dockPulse, setDockPulse] = useState(0);
  const [allFlash, setAllFlash] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [paused, setPaused] = useState(false);
  const timers = useRef<number[]>([]);
  const autoFinish = useRef<number | null>(null);
  const toastSeq = useRef(1);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  // Najnovší stav pre časovače (inak by videli stav z chvíle ťuknutia).
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const since = Math.min(new Date(session.started_at).getTime(), cartSince ? new Date(cartSince).getTime() : Infinity);
  const { groups, inCart, total } = useMemo(() => {
    const open = items.filter((i) => i.status === "OPEN");
    const inCart = items
      .filter((i) => i.status === "PURCHASED" && new Date(i.purchased_at ?? 0).getTime() >= since)
      .sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
    const byCat = new Map<string, Item[]>();
    for (const i of open) byCat.set(i.category_id, [...(byCat.get(i.category_id) ?? []), i]);
    const groups = [...byCat.entries()]
      .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
      .map(([id, list]) => ({ name: (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!).name, items: list }));
    return { groups, inCart, total: open.length + inCart.length };
  }, [items, since]);
  const done = inCart.length;
  const left = total - done;

  // Nová položka od iného člena (schválená žiadosť) krátko zasvieti fialovo.
  const knownIds = useRef(new Set(items.map((i) => i.id)));
  useEffect(() => {
    for (const i of items) {
      if (!knownIds.current.has(i.id)) {
        knownIds.current.add(i.id);
        if (i.status === "OPEN") setArrived(i.id);
        cancelAutoFinish();
      }
    }
  }, [items]);

  function cancelAutoFinish() {
    if (autoFinish.current) window.clearTimeout(autoFinish.current);
    autoFinish.current = null;
    setAllFlash(false);
  }

  function showToast(entry: Omit<Toast, "id">) {
    const id = toastSeq.current++;
    setToast({ ...entry, id });
    timers.current.push(
      window.setTimeout(() => setToast((cur) => (cur?.id === id ? { ...cur, out: true } : cur)), TOAST_MS),
      window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), TOAST_MS + 350),
    );
  }

  function buy(item: Item) {
    if (leavingRef.current.has(item.id)) return;
    navigator.vibrate?.(10);
    setLeaving((s) => new Set(s).add(item.id));
    timers.current.push(
      window.setTimeout(() => {
        update.mutate(
          { id: item.id, patch: { status: "PURCHASED" } },
          {
            onError: (err) => toastApi.show(errorMessage(err), "error"),
            onSettled: () =>
              setLeaving((s) => {
                const n = new Set(s);
                n.delete(item.id);
                return n;
              }),
          },
        );
        setDockPulse((p) => p + 1);
        const remaining = itemsRef.current.filter((i) => i.status === "OPEN" && i.id !== item.id && !leavingRef.current.has(i.id)).length;
        if (remaining === 0 && !autoFinish.current) {
          setAllFlash(true);
          showToast({ name: t("mode.allInCart"), rest: t("mode.closing"), undo: item });
          autoFinish.current = window.setTimeout(() => {
            autoFinish.current = null;
            onFinishRef.current();
          }, AUTO_FINISH_MS);
        } else {
          showToast({ name: item.name, rest: t("mode.itemInCart"), undo: item });
        }
      }, FUNNEL_MS),
    );
  }

  function back(item: Item) {
    cancelAutoFinish();
    setArrived(item.id);
    update.mutate({ id: item.id, patch: { status: "OPEN" } }, { onError: (err) => toastApi.show(errorMessage(err), "error") });
  }

  const request = pending[0];
  const requester = request ? (request.requested_by && names?.get(request.requested_by)) || t("household.fallbackName") : "";

  return (
    <div className="fixed inset-0 z-[45] mx-auto flex max-w-2xl flex-col bg-bg pt-safe animate-rise">
      <header className="flex items-center gap-1 py-3 pl-1 pr-3">
        <button type="button" aria-label={t("mode.backAria")} onClick={() => setSheet(true)} className="grid size-11 place-items-center rounded-xl active:bg-pressed">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{list.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-footnote font-medium text-text-2">
            <span className="size-2 rounded-full bg-success-solid [animation:bh-pulse_1.8s_ease_infinite]" aria-hidden />
            {t("mode.since", { time: time(session.started_at) })}
          </p>
        </div>
        <Avatar name={names?.get(me) ?? t("shop.me")} me />
        <button
          type="button"
          aria-label={t("mode.pauseAria")}
          onClick={() => setSheet(true)}
          className="ml-2 grid size-11 place-items-center rounded-xl bg-surface shadow-card active:bg-pressed"
        >
          <Pause className="size-[1.125rem]" strokeWidth={2.2} aria-hidden />
        </button>
      </header>

      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-36">
        {groups.map((g) => (
          <section key={g.name} aria-label={g.name}>
            <h2 className="mb-3 mt-6 px-1 text-overline font-semibold uppercase text-text-2">{g.name}</h2>
            {g.items.map((item) => {
              const isLeaving = leaving.has(item.id);
              const by = item.added_by && item.added_by !== me ? names?.get(item.added_by) : undefined;
              return (
                <div
                  key={item.id}
                  className={cx("grid transition-[grid-template-rows,margin] delay-[260ms] duration-200", isLeaving ? "mb-0 grid-rows-[0fr]" : "mb-2 grid-rows-[1fr]")}
                >
                  <div className="min-h-0">
                    <LongPressButton
                      onTap={() => buy(item)}
                      onLongPress={() => onEdit(item)}
                      aria-label={t("mode.boughtAria", { name: item.name, qty: qtyLabel(item.quantity, item.unit) })}
                      className={cx(
                        "relative flex min-h-16 w-full items-center gap-4 rounded-2xl bg-surface px-4 py-3 text-left shadow-card",
                        isLeaving && "pointer-events-none z-[5] [animation:bh-funnel_.42s_cubic-bezier(.4,0,.2,1)_forwards]",
                        !isLeaving && arrived === item.id && "[animation:bh-arrive_.2s_ease-out]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          "grid size-7 shrink-0 place-items-center rounded-sm border-2 transition-colors duration-[120ms]",
                          isLeaving ? "border-primary bg-primary text-on-primary" : "border-line-strong",
                        )}
                      >
                        <Check className={cx("size-4 transition-[opacity,transform] duration-[120ms]", isLeaving ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={2.4} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-strong">{item.name}</span>
                        {(by || item.note) && (
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-footnote text-text-2">
                            {by && <span className="rounded-sm bg-person-soft px-2 py-px text-xs font-strong text-person">{t("item.addedBy", { name: shortName(by) })}</span>}
                            {item.note && <span>{item.note}</span>}
                          </span>
                        )}
                        {hints?.get(item.id) && <span className="mt-0.5 block truncate text-xs text-text-3">{hints.get(item.id)}</span>}
                      </span>
                      <span className="shrink-0 rounded-sm bg-sunken px-2 py-1 text-footnote font-strong text-text-2">{qtyLabel(item.quantity, item.unit)}</span>
                    </LongPressButton>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {left === 0 && !allFlash && total > 0 && (
          <div className="mt-6 rounded-2xl bg-success-soft px-6 py-6 text-center animate-rise">
            <p className="text-lg font-semibold text-success">{t("mode.allInCart")}</p>
            <p className="mt-2 text-sm text-text-2">{t("mode.allInCartHint")}</p>
          </div>
        )}
        {total === 0 && (
          <div className="mt-8 text-center text-text-2">{t("mode.emptyList")}</div>
        )}

        {inCart.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 px-1 text-overline font-semibold uppercase text-text-2">{t("mode.inCartHeading")}</h2>
            <div className="flex flex-wrap gap-2">
              {inCart.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => back(item)}
                  aria-label={t("mode.putBackAria", { name: item.name })}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface pl-2 pr-3 text-footnote font-medium text-text-2 line-through decoration-text-3 shadow-card active:bg-pressed [animation:bh-tile-in_.2s_ease-out]"
                >
                  <span className="grid size-6 place-items-center rounded-sm bg-primary text-on-primary no-underline">
                    <Check className="size-3.5" strokeWidth={2.4} aria-hidden />
                  </span>
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Toast nad lištou – sám zmizne, tenký prúžok ukazuje zostávajúci čas */}
      {toast && (
        <div
          role="status"
          key={toast.id}
          className={cx(
            "absolute inset-x-6 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[9] flex h-12 items-center gap-3 overflow-hidden rounded-lg bg-inverse pl-4 pr-1 text-sm text-on-inverse shadow-raised",
            toast.out ? "[animation:bh-out-down_.2s_ease_forwards]" : "animate-rise",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <b className="font-strong">{toast.name}</b> <span className="opacity-75">{toast.rest}</span>
          </span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                back(toast.undo!);
                setToast((cur) => (cur ? { ...cur, out: true } : cur));
              }}
              className="h-10 shrink-0 rounded-sm px-3 text-footnote font-strong text-on-inverse underline underline-offset-4 active:bg-on-inverse/10"
            >
              {t("mode.undo")}
            </button>
          )}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-on-inverse/40 [animation:bh-shrink_3.2s_linear_forwards]" />
        </div>
      )}

      {/* Lišta – jediné miesto s počtom kúpených */}
      <div
        key={dockPulse}
        className={cx(
          "absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-2xl py-3 pl-4 pr-3 shadow-raised transition-colors duration-200",
          allFlash ? "bg-primary text-on-primary" : "bg-elevated text-text",
          dockPulse > 0 && "[animation:bh-dock_.2s_ease]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">
              {done}
              <span className={allFlash ? "opacity-60" : "text-text-3"}>/{total}</span>
            </span>
            <span className={cx("truncate text-footnote", allFlash ? "opacity-80" : "text-text-2")}>{left === 0 ? t("mode.dockAll") : t("mode.dockLeft", { left })}</span>
          </div>
          <Progress done={done} total={total} light={allFlash} />
        </div>
        {!allFlash && (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className={cx(
              "flex h-12 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-strong disabled:opacity-50",
              left === 0 ? "bg-primary text-on-primary active:bg-primary-pressed" : "bg-sunken text-text active:bg-pressed",
            )}
          >
            {left === 0 ? t("mode.finish") : t("mode.end")}
            <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
          </button>
        )}
      </div>

      {/* Žiadosť naživo – vyjde zhora */}
      {request && !paused && (
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 [animation:bh-slide-down_.28s_cubic-bezier(.2,.8,.2,1)]" role="alertdialog" aria-label={t("mode.newRequest")}>
          <RequestCard key={request.id} request={request} listId={list.id} who={requester} tone="ink" more={pending.length - 1} />
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("mode.sheetTitle")}>
        <p className="-mt-1 mb-3 text-sm text-text-2">
          {t("mode.sheetCount", { done, total })}
        </p>
        <div className="flex flex-col gap-2">
          <SheetOption
            icon={<Pause className="size-[1.125rem]" strokeWidth={2.4} />}
            title={t("mode.pause")}
            hint={t("mode.pauseHint")}
            onClick={() => {
              setSheet(false);
              setPaused(true);
            }}
          />
          <SheetOption
            icon={<CornerUpLeft className="size-[1.125rem]" />}
            title={t("mode.interrupt")}
            hint={t("mode.interruptHint")}
            onClick={() => {
              setSheet(false);
              onInterrupt();
            }}
          />
          <button type="button" onClick={() => setSheet(false)} className="mt-1 h-12 rounded-xl text-callout font-strong text-text-2 active:bg-pressed">
            {t("shop.continue")}
          </button>
        </div>
      </Sheet>

      {paused && (
        <div className="absolute inset-0 z-30 flex animate-fade flex-col items-center justify-center gap-3 bg-bg/90 p-8 text-center backdrop-blur-md" role="dialog" aria-label={t("mode.pausedAria")}>
          <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
            <Pause className="size-6" strokeWidth={2.2} aria-hidden />
          </span>
          <p className="mt-2 text-2xl font-semibold">{t("mode.pausedTitle")}</p>
          <p className="max-w-xs text-sm text-text-2">
            {t("mode.pausedText", { done, total })}
          </p>
          <button type="button" onClick={() => setPaused(false)} className="mt-3 h-14 rounded-xl bg-primary px-8 text-callout font-strong text-on-primary active:scale-[0.98] active:bg-primary-pressed">
            {t("shop.continue")}
          </button>
        </div>
      )}
    </div>
  );
}

function Progress({ done, total, light }: { done: number; total: number; light: boolean }) {
  if (total > 0 && total <= 24) {
    return (
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx("h-1 flex-1 rounded-full transition-colors duration-200", light ? "bg-on-primary" : i < done ? "bg-primary" : "bg-sunken")} />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
      <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}

function SheetOption({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl bg-surface p-3 text-left shadow-card active:bg-pressed">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-text-2" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-callout font-strong">{title}</span>
        <span className="block text-footnote text-text-2">{hint}</span>
      </span>
    </button>
  );
}

/** Ťuk = kúpené, podržanie = upraviť položku. */
function LongPressButton({
  onTap,
  onLongPress,
  className,
  children,
  ...rest
}: {
  onTap: () => void;
  onLongPress: () => void;
  className?: string;
  children: ReactNode;
  "aria-label": string;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      {...rest}
      onPointerDown={() => {
        fired.current = false;
        timer.current = window.setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(12);
          onLongPress();
        }, 550);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onTap();
      }}
      className={cx("select-none transition-transform [-webkit-touch-callout:none] active:scale-[0.985]", className)}
    >
      {children}
    </button>
  );
}
