import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, CornerUpLeft, Pause } from "lucide-react";
import { Avatar, Sheet, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES, categoryOrder } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { useUpdateItem, type AdditionRequest, type Item, type Session, type ShoppingList } from "./api";
import { RequestCard } from "./RequestCard";
import { qtyLabel } from "./qty";

/** Ako dlho letí kúpená položka do lišty (musí sedieť s animáciou bh-funnel). */
const FUNNEL_MS = 760;
/** Po odškrtnutí poslednej položky – čas na „Vrátiť“, kým sa nákup sám uzavrie. */
const AUTO_FINISH_MS = 1500;
const TOAST_MS = 3200;

const time = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

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
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
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

  function showToast(t: Omit<Toast, "id">) {
    const id = toastSeq.current++;
    setToast({ ...t, id });
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
          showToast({ name: "Všetko je v košíku", rest: "· uzatváram nákup", undo: item });
          autoFinish.current = window.setTimeout(() => {
            autoFinish.current = null;
            onFinishRef.current();
          }, AUTO_FINISH_MS);
        } else {
          showToast({ name: item.name, rest: "je v košíku", undo: item });
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
  const requester = request ? (request.requested_by && names?.get(request.requested_by)) || "Člen domácnosti" : "";

  return (
    <div className="fixed inset-0 z-[45] mx-auto flex max-w-2xl flex-col bg-bg pt-safe animate-rise">
      <header className="flex items-center gap-1 py-3 pl-1 pr-3">
        <button type="button" aria-label="Späť – pozastaviť alebo prerušiť" onClick={() => setSheet(true)} className="grid size-11 place-items-center rounded-xl active:bg-pressed">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">{list.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] font-medium text-text-2">
            <span className="size-[7px] rounded-full bg-success [animation:bh-pulse_1.8s_ease_infinite]" aria-hidden />
            Nakupuješ od {time(session.started_at)}
          </p>
        </div>
        <Avatar name={names?.get(me) ?? "Ja"} me />
        <button
          type="button"
          aria-label="Pozastaviť alebo prerušiť nákup"
          onClick={() => setSheet(true)}
          className="ml-1.5 grid size-11 place-items-center rounded-xl border border-line bg-elevated active:bg-pressed"
        >
          <Pause className="size-[1.125rem]" strokeWidth={2.6} aria-hidden />
        </button>
      </header>

      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-36">
        {groups.map((g) => (
          <section key={g.name} aria-label={g.name}>
            <h2 className="mb-2.5 mt-5 flex items-center gap-2 px-0.5 text-[0.8125rem] font-bold text-text-2">
              {g.name}
              <span className="h-px flex-1 bg-line" aria-hidden />
            </h2>
            {g.items.map((item) => {
              const isLeaving = leaving.has(item.id);
              const by = item.added_by && item.added_by !== me ? names?.get(item.added_by) : undefined;
              return (
                <div
                  key={item.id}
                  className={cx("grid transition-[grid-template-rows,margin] delay-[420ms] duration-300", isLeaving ? "mb-0 grid-rows-[0fr]" : "mb-2 grid-rows-[1fr]")}
                >
                  <div className="min-h-0">
                    <LongPressButton
                      onTap={() => buy(item)}
                      onLongPress={() => onEdit(item)}
                      aria-label={`Kúpené: ${item.name}, ${qtyLabel(item.quantity, item.unit)}. Podržaním upravíš.`}
                      className={cx(
                        "relative flex min-h-[4.125rem] w-full items-center gap-3.5 rounded-2xl border border-line bg-elevated px-3.5 py-3 text-left",
                        isLeaving && "pointer-events-none z-[5] [animation:bh-funnel_.78s_cubic-bezier(.5,0,.7,.25)_forwards]",
                        !isLeaving && arrived === item.id && "[animation:bh-arrive_1.2s_ease]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          "grid size-7 shrink-0 place-items-center rounded-[0.5625rem] border-2 transition-colors",
                          isLeaving ? "border-accent bg-accent text-on-accent" : "border-line-strong",
                        )}
                      >
                        <Check className={cx("size-4 transition-[opacity,transform] duration-200", isLeaving ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-tight">{item.name}</span>
                        {(by || item.note) && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-text-2">
                            {by && <span className="rounded-[0.3125rem] bg-person-soft px-1.5 py-px text-[0.6875rem] font-bold text-person">Pridal(a): {by}</span>}
                            {item.note && <span>{item.note}</span>}
                          </span>
                        )}
                        {hints?.get(item.id) && <span className="mt-0.5 block truncate text-xs text-text-3">{hints.get(item.id)}</span>}
                      </span>
                      <span className="shrink-0 text-[0.9375rem] font-bold">{qtyLabel(item.quantity, item.unit)}</span>
                    </LongPressButton>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {left === 0 && !allFlash && total > 0 && (
          <div className="mt-5 rounded-2xl border border-line bg-elevated px-5 py-6 text-center">
            <p className="text-lg font-extrabold tracking-[-0.02em]">Všetko je v košíku</p>
            <p className="mt-1.5 text-sm leading-snug text-text-2">Ťuknutím na položku dole ju vrátiš do zoznamu. Keď si hotový, stlač Dokončiť.</p>
          </div>
        )}
        {total === 0 && (
          <div className="mt-8 text-center text-text-2">Zoznam je prázdny. Prerušením sa vrátiš k plánovaniu.</div>
        )}

        {inCart.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-2.5 flex items-center gap-2 px-0.5 text-[0.8125rem] font-bold text-text-2">
              V košíku · ťuknutím vrátiš
              <span className="h-px flex-1 bg-line" aria-hidden />
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {inCart.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => back(item)}
                  aria-label={`Vrátiť do zoznamu: ${item.name}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-dashed border-line-strong pl-1.5 pr-2.5 text-[0.8125rem] font-medium text-text-2 line-through decoration-text-3 [animation:bh-tile-in_.45s_cubic-bezier(.2,.9,.3,1.3)]"
                >
                  <span className="grid size-[1.375rem] place-items-center rounded-[0.4375rem] bg-accent text-on-accent no-underline">
                    <Check className="size-3" strokeWidth={3.4} aria-hidden />
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
            "absolute inset-x-6 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[9] flex h-[2.875rem] items-center gap-2.5 overflow-hidden rounded-[0.875rem] border border-line bg-elevated pl-3 pr-1.5 text-sm shadow-[0_10px_26px_rgb(0_0_0/0.18)]",
            toast.out ? "[animation:bh-out-down_.35s_ease_forwards]" : "animate-drop",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <b>{toast.name}</b> <span className="text-text-2">{toast.rest}</span>
          </span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                back(toast.undo!);
                setToast((t) => (t ? { ...t, out: true } : t));
              }}
              className="h-[2.125rem] shrink-0 rounded-[0.5625rem] bg-primary px-3 text-[0.8125rem] font-bold text-on-primary"
            >
              Vrátiť
            </button>
          )}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent [animation:bh-shrink_3.2s_linear_forwards]" />
        </div>
      )}

      {/* Lišta – jediné miesto s počtom kúpených */}
      <div
        key={dockPulse}
        className={cx(
          "absolute inset-x-3 bottom-[calc(0.875rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-[1.375rem] py-3 pl-4 pr-2.5 shadow-[0_18px_40px_rgb(0_0_0/0.3)] transition-colors duration-500",
          allFlash ? "bg-accent text-on-accent" : "bg-primary text-on-primary",
          dockPulse > 0 && "[animation:bh-dock_.5s_ease]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[1.375rem] font-extrabold tracking-[-0.02em]">
              {done}
              <span className="opacity-50">/{total}</span>
            </span>
            <span className="truncate text-[0.8125rem] opacity-75">{left === 0 ? "všetko v košíku" : `v košíku · zostáva ${left}`}</span>
          </div>
          <Progress done={done} total={total} light={allFlash} />
        </div>
        {!allFlash && (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className={cx(
              "flex h-[2.875rem] shrink-0 items-center gap-2 rounded-[0.8125rem] px-3.5 text-sm font-bold disabled:opacity-50",
              left === 0 ? "bg-accent text-on-accent" : "border-[1.5px] border-on-primary/25",
            )}
          >
            {left === 0 ? "Dokončiť" : "Ukončiť"}
            <ArrowRight className="size-[0.9375rem]" strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </div>

      {/* Žiadosť naživo – vyjde zhora */}
      {request && !paused && (
        <div className="absolute inset-x-2.5 top-[calc(env(safe-area-inset-top)+0.625rem)] z-20 [animation:bh-slide-down_.55s_cubic-bezier(.2,.9,.3,1.15)]" role="alertdialog" aria-label="Nová žiadosť o pridanie">
          <RequestCard key={request.id} request={request} listId={list.id} who={requester} tone="ink" more={pending.length - 1} />
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Prestávka v nákupe?">
        <p className="-mt-1 mb-3 text-sm text-text-2">
          V košíku máš {done} z {total}. Nič sa nestratí.
        </p>
        <div className="flex flex-col gap-2">
          <SheetOption
            icon={<Pause className="size-[1.125rem]" strokeWidth={2.6} />}
            title="Pozastaviť"
            hint="Ostaneš tu, obrazovka počká, kým budeš pokračovať"
            onClick={() => {
              setSheet(false);
              setPaused(true);
            }}
          />
          <SheetOption
            icon={<CornerUpLeft className="size-[1.125rem]" />}
            title="Prerušiť a vrátiť sa k zoznamu"
            hint="Kúpené ostanú označené, v nákupe pokračuješ neskôr"
            onClick={() => {
              setSheet(false);
              onInterrupt();
            }}
          />
          <button type="button" onClick={() => setSheet(false)} className="mt-1 h-12 rounded-xl text-[0.9375rem] font-semibold text-text-2 active:bg-pressed">
            Pokračovať v nákupe
          </button>
        </div>
      </Sheet>

      {paused && (
        <div className="absolute inset-0 z-30 flex animate-fade flex-col items-center justify-center gap-2.5 bg-bg/90 p-8 text-center backdrop-blur-md" role="dialog" aria-label="Nákup pozastavený">
          <span className="grid size-16 place-items-center rounded-[1.25rem] bg-primary text-on-primary">
            <Pause className="size-6" strokeWidth={2.6} aria-hidden />
          </span>
          <p className="mt-1.5 text-2xl font-extrabold tracking-[-0.02em]">Nákup je pozastavený</p>
          <p className="max-w-xs text-sm leading-relaxed text-text-2">
            V košíku máš {done} z {total}. Ostatní ďalej pridávajú – ich žiadosti uvidíš po návrate.
          </p>
          <button type="button" onClick={() => setPaused(false)} className="mt-3 h-[3.25rem] rounded-[0.875rem] bg-primary px-7 text-[0.9375rem] font-bold text-on-primary active:scale-[0.98]">
            Pokračovať v nákupe
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
          <span key={i} className={cx("h-[5px] flex-1 rounded-full transition-colors duration-300", light ? "bg-on-accent" : i < done ? "bg-accent" : "bg-on-primary/15")} />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-on-primary/15" aria-hidden>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}

function SheetOption({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-bg p-3 text-left active:bg-pressed">
      <span className="grid size-[2.625rem] shrink-0 place-items-center rounded-xl bg-surface" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-bold">{title}</span>
        <span className="block text-[0.8125rem] text-text-2">{hint}</span>
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
