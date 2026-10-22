import { useRef, useState, type PointerEvent } from "react";
import { HelpCircle, Keyboard, Minus, Plus, Trash2 } from "lucide-react";
import { CatIcon, haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { qtyLabel } from "@/features/lists/qty";
import { t } from "@/i18n";
import type { DraftItem } from "./api";

/** Množstvo na karte: bez zaznetého množstva je to 1 ks (tak ho uloží aj zoznam). */
export function cardQty(it: DraftItem): string {
  return qtyLabel(it.quantity ?? 1, it.unit ?? "ks");
}

/** Rýchla voľba množstva pri tovare na váhu (mäso, syr z pultu…). */
const WEIGHTS = [
  [250, "g"],
  [500, "g"],
  [1, "kg"],
] as const;

/**
 * Jedna karta rozdiktovanej položky (ako v prototype):
 * potiahnutie doprava = +1, doľava = −1 (pri poslednom kuse odstráni),
 * ťuknutie alebo podržanie = vybrať na úpravu hlasom aj ťukom.
 * Nejasná položka je žltá s návrhmi, tovar na váhu ponúkne „Koľko?“.
 */
export function VoiceCard({
  item,
  selected,
  onSelect,
  onDelta,
  onRemove,
  onSetQty,
  onResolve,
  onRename,
}: {
  item: DraftItem;
  selected: boolean;
  onSelect: () => void;
  onDelta: (d: 1 | -1) => void;
  onRemove: () => void;
  onSetQty: (quantity: number, unit: "g" | "kg") => void;
  onResolve: (name: string) => void;
  onRename: (name: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const st = useRef<{ x: number; y: number; moved: boolean; long: boolean; t: ReturnType<typeof setTimeout> } | null>(null);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(item.name);

  function down(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, input")) return;
    st.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      long: false,
      t: setTimeout(() => {
        if (st.current && !st.current.moved) {
          st.current.long = true;
          haptic(15);
          onSelect();
        }
      }, 450),
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* nevadí */
    }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const s = st.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.moved && Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) {
      clearTimeout(s.t);
      st.current = null;
      setDx(0);
      return;
    }
    if (Math.abs(ddx) > 8) {
      s.moved = true;
      clearTimeout(s.t);
    }
    if (s.moved) setDx(Math.max(-130, Math.min(130, ddx)));
  }
  function up() {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.t);
    st.current = null;
    if (s.moved) {
      if (dx > 56) onDelta(1);
      else if (dx < -56) onDelta(-1);
    } else if (!s.long) onSelect();
    setDx(0);
  }
  function cancel() {
    if (st.current) clearTimeout(st.current.t);
    st.current = null;
    setDx(0);
  }
  function rename() {
    onRename(nameVal);
    setEditName(false);
  }

  const lastPiece = (item.quantity ?? 1) <= 1 && (item.unit ?? "ks") === "ks";
  const under = dx > 0 ? "plus" : dx < 0 ? (lastPiece ? "del" : "minus") : null;
  const unsure = item.status === "unclear";
  const weightHint = item.status === "needs_qty";
  const qty = cardQty(item);

  return (
    <div className="v-card-wrap anim-drop" data-flip={item.id}>
      {under && (
        <div className={cx("v-under", under)} aria-hidden>
          <span style={{ opacity: dx > 0 ? Math.min(1, dx / 56) : 0 }}>+1</span>
          <span style={{ opacity: dx < 0 ? Math.min(1, -dx / 56) : 0 }} className="row g-6">
            {under === "del" ? (
              <>
                <Trash2 size={18} /> {t("voice.remove")}
              </>
            ) : (
              "−1"
            )}
          </span>
        </div>
      )}
      <div
        className={cx("v-card", selected && "sel", unsure && "unsure")}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
        tabIndex={0}
        role="group"
        aria-label={`${item.name}, ${qty}`}
      >
        <div className="row g-12">
          {unsure ? (
            <span className="cat-ic v-unsure-ic">
              <HelpCircle size={18} />
            </span>
          ) : (
            <CatIcon id={item.categoryId ?? "other"} />
          )}
          <div className="grow stack g-2">
            {editName ? (
              <input
                className="input"
                autoFocus
                style={{ minHeight: 40, fontSize: 15 }}
                value={nameVal}
                maxLength={80}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rename()}
                onBlur={rename}
                aria-label={t("voice.nameAria")}
              />
            ) : (
              <span className="t-h ellipsis">{item.name}</span>
            )}
            {unsure && <span className="t-sm v-unsure-text">{t("voice.unsureAsk")}</span>}
            {!unsure && item.note && <span className="t-xs t-2 ellipsis">{item.note}</span>}
          </div>
          <span className="v-qty">{qty}</span>
        </div>

        {unsure && item.suggestions.length > 0 && (
          <div className="row g-6 wrap">
            {item.suggestions.map((o) => (
              <button key={o} type="button" className="chip" onClick={() => onResolve(o)}>
                {o}
              </button>
            ))}
          </div>
        )}
        {weightHint && (
          <div className="row g-6 wrap">
            <span className="t-xs t-2">{t("voice.howMuch")}</span>
            {WEIGHTS.map(([q, u]) => (
              <button key={`${q}${u}`} type="button" className="chip" style={{ minHeight: 32 }} onClick={() => onSetQty(q, u)}>
                {qtyLabel(q, u)}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="stack g-8 anim-pop">
            <span className="t-xs t-2">
              {t("voice.editingPrefix")} <b style={{ color: "var(--text)" }}>{item.name}</b> · {t("voice.editingSuffix")}
            </span>
            <div className="row g-8">
              <button type="button" className="btn btn-soft btn-sm grow" onClick={() => onDelta(-1)} aria-label={t("voice.less")}>
                <Minus size={17} />
              </button>
              <button type="button" className="btn btn-soft btn-sm grow" onClick={() => onDelta(1)} aria-label={t("voice.more")}>
                <Plus size={17} />
              </button>
              <button
                type="button"
                className="btn btn-soft btn-sm grow"
                onClick={() => {
                  setNameVal(item.name);
                  setEditName(true);
                }}
                aria-label={t("voice.renameAria")}
              >
                <Keyboard size={17} />
              </button>
              <button type="button" className="btn btn-danger btn-sm grow" onClick={onRemove} aria-label={t("voice.remove")}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
