import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Mic, Trash2 } from "lucide-react";
import { category } from "@/lib/categories";
import { cx } from "@/components/ui";
import { qtyLabel } from "@/features/lists/qty";
import { formatNumber, t } from "@/i18n";
import { unitLabel } from "@/lib/parseItem";
import type { DraftItem } from "./api";
import { buzz } from "./useSpeech";
import { stepOf } from "./engine";

/** „250“ + „g“ zvlášť – číslo je veľké, jednotka malá pod ním. */
export function qtyParts(it: DraftItem): [string, string] {
  // Bez množstva = 1 kus (tak ho uloží aj zoznam); pri tovare na váhu sa pýtame.
  if (it.quantity == null) return it.status === "needs_qty" ? ["—", t("voice.howMuchShort")] : ["1", unitLabel(it.unit ?? "ks")];
  const label = qtyLabel(it.quantity, it.unit);
  const i = label.lastIndexOf(" ");
  return i > 0 ? [label.slice(0, i), label.slice(i + 1)] : [label, ""];
}

const ARM = 72;

export type RowAnim = { fall: boolean; push: "a" | "b" | null; bump: "a" | "b" | null; glow: "a" | "b" | null };

/**
 * Jeden riadok rozdiktovaného zoznamu.
 * Potiahnutie doprava = +1 krok, doľava = −1 krok (pri poslednom kuse ponúkne zmazanie),
 * podržanie = zmazanie s 3-sekundovým odpočtom, ťuknutie = úprava hlasom.
 */
export function VoiceRow({
  item,
  anim,
  editing,
  confirming,
  leaving,
  onStep,
  onAskDelete,
  onDelete,
  onTap,
  onResolve,
}: {
  item: DraftItem;
  anim: RowAnim;
  editing: boolean;
  confirming: boolean;
  leaving: boolean;
  onStep: (dir: 1 | -1) => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onTap: () => void;
  onResolve: (patch: Partial<DraftItem> | "remove" | "voice") => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pd = useRef<{ x: number; y: number; moved: boolean; armed: boolean } | null>(null);
  const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);
  const st = stepOf(item.unit);
  const [num, unit] = qtyParts(item);
  const lastPiece = item.quantity != null && item.quantity - st < st;
  const hue = category(item.categoryId ?? "other").hue;

  function down(e: PointerEvent<HTMLButtonElement>) {
    suppress.current = false;
    if (confirming) return;
    pd.current = { x: e.clientX, y: e.clientY, moved: false, armed: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* nevadí */
    }
    lp.current = setTimeout(() => {
      if (pd.current && !pd.current.moved) {
        pd.current = null;
        suppress.current = true;
        onAskDelete();
      }
    }, 520);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const p = pd.current;
    if (!p) return;
    const mx = e.clientX - p.x;
    const my = e.clientY - p.y;
    if (!p.moved) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        if (lp.current) clearTimeout(lp.current);
        pd.current = null;
        return;
      }
      if (Math.abs(mx) > 8) {
        p.moved = true;
        setDragging(true);
        if (lp.current) clearTimeout(lp.current);
      }
    }
    if (p.moved) {
      const v = Math.max(-140, Math.min(140, mx * 0.82));
      if (!p.armed && Math.abs(v) > ARM) {
        p.armed = true;
        buzz(6);
      } else if (p.armed && Math.abs(v) < ARM) p.armed = false;
      setDx(v);
    }
  }
  function up() {
    const p = pd.current;
    pd.current = null;
    if (lp.current) clearTimeout(lp.current);
    if (!p?.moved) return;
    suppress.current = true;
    setDragging(false);
    const v = dx;
    setDx(0);
    if (v > ARM) onStep(1);
    else if (v < -ARM) onStep(-1);
  }

  const rOp = Math.min(1, Math.max(0, dx / ARM));
  const lOp = Math.min(1, Math.max(0, -dx / ARM));
  const issue = item.status !== "ok";
  const stepLabel = st === 1 ? "1" : `${formatNumber(st)} ${item.unit ? unitLabel(item.unit) : ""}`.trim();

  return (
    <li
      className={cx(
        "relative mb-2 max-h-72 list-none",
        leaving ? "vo-gone" : anim.fall ? "vo-fall" : anim.push && `vo-push-${anim.push}`,
      )}
    >
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 flex items-center justify-between rounded-2xl px-6 text-footnote font-semibold transition-colors",
          dx > ARM ? "bg-success-solid text-on-success-solid" : dx < -ARM ? "bg-primary text-on-primary" : "text-text-2",
        )}
      >
        <span style={{ opacity: rOp }} className={dx > ARM ? "" : "text-success"}>
          {item.quantity == null ? t("voice.fill") : `+${stepLabel}`}
        </span>
        <span style={{ opacity: lOp }}>{lastPiece ? t("voice.lastPiece") : `−${stepLabel}`}</span>
      </div>

      <button
        type="button"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (suppress.current) {
            suppress.current = false;
            return;
          }
          onTap();
        }}
        aria-label={t("voice.rowAria", { name: item.name, qty: `${num} ${unit}` })}
        style={{ transform: `translateX(${Math.round(dx)}px)`, touchAction: "pan-y" }}
        className={cx(
          "relative flex min-h-16 w-full select-none items-center gap-4 overflow-hidden py-3 pl-2 pr-4 text-left",
          !dragging && "vo-snap",
          issue ? "rounded-t-2xl bg-warning-soft" : "rounded-2xl bg-surface",
          editing && "shadow-[inset_0_0_0_1.5px_var(--primary)]",
        )}
      >
        {anim.glow && <span aria-hidden className={cx("pointer-events-none absolute inset-0 bg-success-solid opacity-0", `vo-glow-${anim.glow}`)} />}
        <span className={cx("flex w-14 shrink-0 flex-col items-center gap-0.5 transition-opacity", confirming && "opacity-30")}>
          <span
            className={cx(
              "inline-block text-2xl font-semibold leading-none",
              item.quantity == null && item.status === "needs_qty" && "text-warning",
              anim.bump && `vo-bump-${anim.bump}`,
            )}
          >
            {num}
          </span>
          <span className="text-xs text-text-2">{unit}</span>
        </span>
        <span className={cx("min-w-0 flex-1 transition-opacity", confirming && "opacity-30")}>
          <span className={cx("block truncate text-lg font-semibold", editing && "text-primary")}>{item.name}</span>
          <span className="mt-0.5 flex items-center gap-2 text-footnote text-text-2">
            <span aria-hidden className="inline-block size-[7px] rounded-full" style={{ background: `oklch(0.64 0.12 ${hue})` }} />
            {category(item.categoryId ?? "other").name.toLowerCase()}
          </span>
        </span>
      </button>

      {confirming && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("voice.deleteAria", { name: item.name })}
          className="absolute right-3 top-2.5 grid size-11 animate-drop place-items-center rounded-full bg-primary text-on-primary"
        >
          <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0" aria-hidden>
            <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <circle className="vo-ring" cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 22 22)" />
          </svg>
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
      )}

      {issue && (
        <div className="rounded-b-2xl bg-warning-soft pb-4 pl-[4.5rem] pr-4">
          <p className="mb-3 text-footnote font-semibold text-warning">
            {item.status === "needs_qty" ? t("voice.needsQty") : t("voice.unclearAsk")}
          </p>
          <div className="flex flex-wrap gap-2">
            {item.status === "needs_qty"
              ? (
                  [
                    ["250 g", 250, "g"],
                    ["500 g", 500, "g"],
                    ["1 kg", 1, "kg"],
                  ] as const
                ).map(([label, q, u]) => (
                  <Chip key={label} onClick={() => onResolve({ quantity: q, unit: u, status: "ok" })}>
                    {label}
                  </Chip>
                ))
              : item.suggestions.map((s) => (
                  <Chip key={s} onClick={() => onResolve({ name: s, status: "ok", suggestions: [] })}>
                    {s}
                  </Chip>
                ))}
            <Chip voice onClick={() => onResolve("voice")}>
              <Mic className="size-3.5" aria-hidden /> {item.status === "needs_qty" ? t("voice.say") : t("voice.repeat")}
            </Chip>
            {item.status === "unclear" && <Chip onClick={() => onResolve("remove")}>{t("voice.discard")}</Chip>}
          </div>
        </div>
      )}
    </li>
  );
}

function Chip({ children, onClick, voice }: { children: ReactNode; onClick: () => void; voice?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-semibold active:scale-[0.97]",
        voice ? "border-primary text-primary" : "border-line",
      )}
    >
      {children}
    </button>
  );
}
