import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { PersonAvatar, Stepper, haptic, type Person } from "@/components/kit";
import { CategoryGlyph } from "@/components/CategoryIcon";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { category, categoryOrder } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatEuro, t } from "@/i18n";
import type { PriceHint } from "@/features/analytics/api";
import { useAddItem, useDeleteItem, useUpdateItem, type Item } from "./api";
import { countOf, qtyLabel } from "./qty";

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
 * Položky zoznamu pri plánovaní (prototyp N3): po kategóriách, každý riadok
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

  const groups = new Map<string, Item[]>();
  for (const i of items) groups.set(i.category_id, [...(groups.get(i.category_id) ?? []), i]);
  const ordered = [...groups.entries()].sort((a, b) => categoryOrder(a[0]) - categoryOrder(b[0]));

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
      {ordered.map(([cat, group]) => (
        <section key={cat} className="stack g-6">
          <div className="ls-cat-head">
            <CategoryGlyph id={cat} className="size-[15px]" />
            {category(cat).name}
            <span className="t-3 num">{group.length}</span>
          </div>
          <div className="cells">
            {group.map((it) => (
              <ItemRow
                key={it.id}
                listId={listId}
                item={it}
                fresh={fresh.has(it.id)}
                by={it.added_by && it.added_by !== me ? { id: it.added_by, name: names?.get(it.added_by) ?? t("household.fallbackName") } : undefined}
                hint={hints?.get(it.id)}
                onEdit={() => onEdit(it)}
                onSwiped={seen}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ItemRow({
  listId,
  item,
  fresh,
  by,
  hint,
  onEdit,
  onSwiped,
}: {
  listId: string;
  item: Item;
  fresh: boolean;
  by?: Person;
  hint?: PriceHint;
  onEdit: () => void;
  onSwiped: () => void;
}) {
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const restore = useRestoreItem();
  const toast = useToast();
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const [edit, setEdit] = useState(false);
  const st = useRef<{ x: number; y: number; moved: boolean; horiz: boolean | null; id: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(idle.current), []);

  const qty = countOf(item.quantity);
  const step = stepOf(item.unit);
  const atMin = qty - step < step - 1e-9;
  const width = box.current?.offsetWidth || 340;
  const delZone = atMin && dx <= -width * 0.42;

  const setQty = (v: number) =>
    update.mutate({ id: item.id, patch: { quantity: round(Math.max(step, v)) } }, { onError: (err) => toast.show(errorMessage(err), "error") });
  const change = (d: number) => {
    haptic(10);
    setQty(qty + d);
    onSwiped();
  };
  const del = () => {
    haptic(30);
    setGone(true);
    onSwiped();
    // Riadok sa po odstránení odpojí – hlášku preto viažeme na sľub, nie na callback mutate.
    setTimeout(
      () =>
        remove
          .mutateAsync(item.id)
          .then(() => toast.show(t("item.removed", { name: item.name }), "info", { undo: () => restore(item) }))
          .catch((err) => {
            setGone(false);
            toast.show(errorMessage(err), "error");
          }),
      420,
    );
  };
  const armIdle = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setEdit(false), 4000);
  };

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      st.current = { x: e.clientX, y: e.clientY, moved: false, horiz: null, id: e.pointerId };
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
      if (c.horiz) {
        const max = atMin ? width * 0.7 : 120;
        const next = Math.max(-max, Math.min(120, ddx));
        if (atMin && next <= -width * 0.42 !== dx <= -width * 0.42) haptic(8);
        setDx(next);
      }
    },
    onPointerUp() {
      const c = st.current;
      st.current = null;
      if (!c) return;
      if (!c.moved) {
        setDx(0);
        onEdit();
        return;
      }
      if (c.horiz && dx >= 64) change(step);
      else if (c.horiz && dx <= -64) {
        if (!atMin) change(-step);
        else if (dx <= -width * 0.42) {
          del();
          return;
        }
      }
      setDx(0);
    },
    onPointerCancel() {
      st.current = null;
      setDx(0);
    },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEdit();
      }
    },
  };

  const label = qtyLabel(item.quantity, item.unit);
  const stepLabel = item.unit && item.unit !== "ks" && item.unit !== "bal" ? qtyLabel(step, item.unit) : "1";
  return (
    <div className={cx("ls-swipe ls-item", gone && "gone")} ref={box}>
      <div className="under ok" style={{ opacity: dx > 10 ? 1 : 0 }}>
        <span className={cx("ls-step", dx >= 64 && "on")}>
          <Plus size={16} strokeWidth={2.6} /> {stepLabel}
        </span>
      </div>
      <div className={cx("under", atMin ? "del" : "minus", delZone && "armed")} style={{ opacity: dx < -10 ? 1 : 0 }}>
        {atMin ? (
          <span className="ls-step">
            <Trash2 size={delZone ? 20 : 17} /> {delZone ? t("ls.releaseToDelete") : t("ls.pullToDelete")}
          </span>
        ) : (
          <span className={cx("ls-step", dx <= -64 && "on")}>
            <Minus size={16} strokeWidth={2.6} /> {stepLabel}
          </span>
        )}
      </div>
      <div
        className={cx("front", fresh && "anim-flash")}
        style={{ transform: gone ? "translateX(-110%)" : `translateX(${dx}px)`, transition: dx && !gone ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1)" }}
      >
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
}

/** „Vrátiť“ po odstránení: položka sa pridá znova s rovnakým množstvom, upresnením a kategóriou. */
export function useRestoreItem() {
  const add = useAddItem();
  const toast = useToast();
  return (item: Item) =>
    add
      .mutateAsync({ listId: item.list_id, name: item.name, quantity: item.quantity, unit: item.unit, note: item.note, categoryId: item.category_id })
      .catch((err) => toast.show(errorMessage(err), "error"));
}
