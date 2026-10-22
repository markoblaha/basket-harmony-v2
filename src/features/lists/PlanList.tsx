import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { PersonAvatar, Stepper, haptic, type Person } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { animateOut, useFlip } from "@/components/motion";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatEuro, t } from "@/i18n";
import type { PriceHint } from "@/features/analytics/api";
import { useAddItem, useDeleteItem, useUpdateItem, type Item } from "./api";
import { countOf, qtyLabel } from "./qty";
import { useSetting } from "@/lib/settings";

/** Krok a minimum podľa jednotky: kusy po 1, gramy po 100, kilá a litre po 0,1. */
export const stepOf = (u: string | null) => (u === "g" || u === "ml" ? 100 : u === "kg" || u === "l" ? 0.1 : 1);
const round = (v: number) => Math.round(v * 1000) / 1000;

const HINT_KEY = "bh.swipeHint";
function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}
function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* súkromné okno – nevadí */
  }
}

/**
 * Položky zoznamu pri plánovaní: jednoduchý zoznam, najnovšie hore (kategórie až v nákupe), každý riadok
 * potiahnutím doprava +1, doľava −1; pri poslednom kuse dlhší ťah doľava odstráni.
 * Ťuk na riadok = úprava, ťuk na množstvo = − / + na pár sekúnd.
 */
export function PlanList({
  listId,
  items,
  names,
  me,
  hints,
  onEdit,
}: {
  listId: string;
  items: Item[];
  names: Map<string, string> | undefined;
  me: string;
  hints?: Map<string, PriceHint>;
  onEdit: (item: Item) => void;
}) {
  const [showHint, setShowHint] = useState(() => !hintSeen());
  const [prices] = useSetting("prices");
  const seen = () => {
    if (showHint) {
      markHintSeen();
      setShowHint(false);
    }
  };

  // Ktoré riadky sú „nové“ (pribudli po otvorení obrazovky) – tie zasvietia.
  const known = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (known.current === null) known.current = new Set(items.map((i) => i.id));
  else for (const i of items) if (!known.current.has(i.id)) fresh.add(i.id);
  queueMicrotask(() => items.forEach((i) => known.current?.add(i.id)));

  // Stabilné odkazy, aby sa riadky (memo) neprekresľovali pri každej zmene rodiča.
  const editRef = useRef(onEdit);
  editRef.current = onEdit;
  const seenRef = useRef(seen);
  seenRef.current = seen;
  const editItem = useCallback((it: Item) => editRef.current(it), []);
  const swiped = useCallback(() => seenRef.current(), []);
  const box = useRef<HTMLDivElement>(null);
  useFlip(box);

  return (
    <>
      {showHint && (
        <div className="ls-hint">
          <span className="ls-hint-demo" aria-hidden>
            <span />
          </span>
          <span className="grow">
            {t("ls.swipeHint1")} <b>+1</b>, {t("ls.swipeHint2")} <b>−1</b>. {t("ls.swipeHint3")}
          </span>
          <button type="button" className="ibtn sm" aria-label={t("ls.hideHint")} onClick={seen}>
            <X size={16} />
          </button>
        </div>
      )}
      {/* Pri plánovaní jednoduchý zoznam v poradí pridania (najnovšie hore) – kategórie až pri nákupe. */}
      <div ref={box} className="ls-flat">
        {items.map((it) => (
          <ItemRow
            key={it.id}
            listId={listId}
            item={it}
            fresh={fresh.has(it.id)}
            by={it.added_by && it.added_by !== me ? { id: it.added_by, name: names?.get(it.added_by) ?? t("household.fallbackName") } : undefined}
            hint={prices ? hints?.get(it.id) : undefined}
            onEdit={editItem}
            onSwiped={swiped}
          />
        ))}
      </div>
    </>
  );
}

type RowProps = {
  listId: string;
  item: Item;
  fresh: boolean;
  by?: Person;
  hint?: PriceHint;
  onEdit: (item: Item) => void;
  onSwiped: () => void;
};

/** Pásmo pod kartou počas ťahu: čo sa stane po pustení. */
type Zone = "none" | "right" | "plus" | "left" | "minus" | "del";

/**
 * Jeden riadok. Počas ťahania sa karta posúva priamo (style.transform v requestAnimationFrame),
 * bez prekresľovania Reactu pri každom pohybe prsta – React sa ozve len pri prekročení hranice
 * (+1 / −1 / odstrániť), aby sa zmenil popis pod kartou.
 */
const ItemRow = memo(function ItemRow({ listId, item, fresh, by, hint, onEdit, onSwiped }: RowProps) {
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const restore = useRestoreItem();
  const toast = useToast();
  const [zone, setZone] = useState<Zone>("none");
  const [edit, setEdit] = useState(false);
  const st = useRef<{ x: number; y: number; moved: boolean; horiz: boolean | null; id: number; dx: number; w: number; raf: number } | null>(null);
  const front = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(idle.current), []);

  const qty = countOf(item.quantity);
  const step = stepOf(item.unit);
  const atMin = qty - step < step - 1e-9;

  const setQty = (v: number) =>
    update.mutate({ id: item.id, patch: { quantity: round(Math.max(step, v)) } }, { onError: (err) => toast.show(errorMessage(err), "error") });
  const change = (d: number) => {
    haptic(10);
    setQty(qty + d);
    onSwiped();
  };
  const del = () => {
    haptic(30);
    onSwiped();
    // Karta najprv odíde (grafickým čipom), až potom zmizne z dát – ostatné sa k sebe dokĺžu.
    animateOut(front.current, -1, () =>
      remove
        .mutateAsync(item.id)
        .then(() => toast.show(t("item.removed", { name: item.name }), "info", { undo: () => restore(item) }))
        .catch((err) => {
          front.current?.getAnimations().forEach((a) => a.cancel());
          toast.show(errorMessage(err), "error");
        }),
    );
  };
  const armIdle = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setEdit(false), 4000);
  };

  const zoneOf = (dx: number, w: number): Zone =>
    dx >= 64 ? "plus" : dx > 10 ? "right" : atMin && dx <= -w * 0.42 ? "del" : dx <= -64 && !atMin ? "minus" : dx < -10 ? "left" : "none";
  const place = (dx: number, animate: boolean) => {
    const el = front.current;
    if (!el) return;
    el.style.transition = animate ? "transform 260ms cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
  };

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      st.current = { x: e.clientX, y: e.clientY, moved: false, horiz: null, id: e.pointerId, dx: 0, w: row.current?.offsetWidth || 340, raf: 0 };
    },
    onPointerMove(e: React.PointerEvent) {
      const c = st.current;
      if (!c) return;
      const ddx = e.clientX - c.x;
      const ddy = e.clientY - c.y;
      if (c.horiz === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
        c.horiz = Math.abs(ddx) > Math.abs(ddy);
        c.moved = true;
        if (c.horiz) (e.currentTarget as HTMLElement).setPointerCapture?.(c.id);
      }
      if (!c.horiz) return;
      const max = atMin ? c.w * 0.7 : 120;
      const next = Math.max(-max, Math.min(120, ddx));
      const z = zoneOf(next, c.w);
      if (z !== zoneOf(c.dx, c.w)) {
        if (z === "plus" || z === "minus" || z === "del") haptic(8);
        setZone(z);
      }
      c.dx = next;
      if (!c.raf) c.raf = requestAnimationFrame(() => {
        c.raf = 0;
        place(c.dx, false);
      });
    },
    onPointerUp() {
      const c = st.current;
      st.current = null;
      if (!c) return;
      cancelAnimationFrame(c.raf);
      if (!c.moved) {
        onEdit(item);
        return;
      }
      setZone("none");
      if (c.horiz && c.dx >= 64) change(step);
      else if (c.horiz && c.dx <= -64) {
        if (!atMin) change(-step);
        else if (c.dx <= -c.w * 0.42) {
          place(c.dx, false);
          del();
          return;
        }
      }
      place(0, true);
    },
    onPointerCancel() {
      const c = st.current;
      st.current = null;
      if (c) cancelAnimationFrame(c.raf);
      setZone("none");
      place(0, true);
    },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEdit(item);
      }
    },
  };

  const label = qtyLabel(item.quantity, item.unit);
  const stepLabel = item.unit && item.unit !== "ks" && item.unit !== "bal" ? qtyLabel(step, item.unit) : "1";
  const right = zone === "right" || zone === "plus";
  const left = zone === "left" || zone === "minus" || zone === "del";
  return (
    <div className="ls-swipe ls-item" ref={row} data-flip={item.id}>
      <div className="under ok" style={{ opacity: right ? 1 : 0 }}>
        <span className={cx("ls-step", zone === "plus" && "on")}>
          <Plus size={16} strokeWidth={2.6} /> {stepLabel}
        </span>
      </div>
      <div className={cx("under", atMin ? "del" : "minus", zone === "del" && "armed")} style={{ opacity: left ? 1 : 0 }}>
        {atMin ? (
          <span className="ls-step">
            <Trash2 size={zone === "del" ? 20 : 17} /> {zone === "del" ? t("ls.releaseToDelete") : t("ls.pullToDelete")}
          </span>
        ) : (
          <span className={cx("ls-step", zone === "minus" && "on")}>
            <Minus size={16} strokeWidth={2.6} /> {stepLabel}
          </span>
        )}
      </div>
      <div ref={front} className={cx("front", fresh && "anim-flash")}>
        <div className="ls-row ls-row2">
          <div
            className="grow stack g-2"
            role="button"
            tabIndex={0}
            aria-label={t("ls.rowAria", { name: item.name, qty: label, step: stepLabel })}
            {...handlers}
            style={{ minHeight: 44, justifyContent: "center", cursor: "pointer", touchAction: "pan-y" }}
          >
            <span className="t-body fw-5 ls-name">{item.name}</span>
            {(item.note || hint) && (
              <span className="row g-6" style={{ minWidth: 0 }}>
                {item.note && (
                  <span className="t-sm t-2 ellipsis" style={{ flex: "0 1 auto" }}>
                    {item.note}
                    {hint ? " ·" : ""}
                  </span>
                )}
                {hint && (
                  <span className="ls-pl num">
                    <b>~{formatEuro(hint.last_price)}</b>
                    <span className="t-3"> · {t("ls.lastAt", { store: hint.last_store })}</span>
                  </span>
                )}
              </span>
            )}
            {by && (
              <span className="row g-6 wrap ls-tags">
                <span className="row g-4 t-xs t-violet fw-5" title={t("item.addedBy", { name: by.name })}>
                  <PersonAvatar person={by} size="sm" />
                  {shortName(by.name)}
                </span>
              </span>
            )}
          </div>
          {edit ? (
            <div className="anim-pop" onPointerDown={armIdle}>
              <Stepper
                small
                value={qty}
                step={step}
                min={step}
                unit={item.unit && item.unit !== "ks" && item.unit !== "bal" ? item.unit : undefined}
                onChange={(v) => {
                  setQty(v);
                  armIdle();
                }}
                onRemove={del}
              />
            </div>
          ) : (
            <button
              type="button"
              className="ls-qty num"
              onClick={() => {
                setEdit(true);
                armIdle();
              }}
              aria-label={t("ls.qtyAria", { qty: label })}
            >
              <span key={qty} className="ls-qty-n">
                {label}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, (a, b) =>
  a.item === b.item && a.fresh === b.fresh && a.hint === b.hint && a.listId === b.listId && a.by?.id === b.by?.id && a.by?.name === b.by?.name &&
  a.onEdit === b.onEdit && a.onSwiped === b.onSwiped,
);

/** „Vrátiť“ po odstránení: položka sa pridá znova s rovnakým množstvom, upresnením a kategóriou. */
export function useRestoreItem() {
  const add = useAddItem();
  const toast = useToast();
  return (item: Item) =>
    add
      .mutateAsync({ listId: item.list_id, name: item.name, quantity: item.quantity, unit: item.unit, note: item.note, categoryId: item.category_id })
      .catch((err) => toast.show(errorMessage(err), "error"));
}
