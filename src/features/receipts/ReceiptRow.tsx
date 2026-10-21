import { useRef, type PointerEvent } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronRight, FileText, Landmark, Link2, Loader2, PenLine, Unlink } from "lucide-react";
import { CatIcon, StoreBadge } from "@/components/kit";
import { category } from "@/lib/categories";
import { dayLabel } from "@/features/lists/dates";
import { cx } from "@/components/ui";
import { t, tn } from "@/i18n";
import { isNotAReceipt, isReceiptPdf, isStale, useReceiptImage, type Receipt } from "./api";
import { formatMoney, formatShortDate, nextStep, shortReason, storeHue, storeInitials } from "./format";

/** Farebný kruh s iniciálkami obchodu. Farba sa odvodí z názvu, takže je pre obchod stále rovnaká (svetlý aj tmavý režim). */
export function StoreAvatar({ name, className }: { name: string | null; className?: string }) {
  const hue = storeHue(name);
  return (
    <span
      aria-hidden
      className={cx("flex size-11 shrink-0 select-none items-center justify-center rounded-full text-footnote font-semibold", className)}
      style={{
        background: `color-mix(in oklch, var(--sunken), oklch(0.66 0.09 ${hue}) 26%)`,
        color: `color-mix(in oklch, var(--text), oklch(0.6 0.12 ${hue}) 35%)`,
      }}
    >
      {name ? storeInitials(name) : "?"}
    </span>
  );
}

/** Malý náhľad prvej strany – v režime výberu, aby bolo vidno, ktoré doklady patria k sebe. */
function Thumb({ receipt }: { receipt: Receipt }) {
  const pdf = isReceiptPdf(receipt);
  const noFile = receipt.origin !== "RECEIPT";
  const image = useReceiptImage(pdf || noFile ? undefined : receipt.image_path);
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-sunken text-text-3">
      {noFile ? (
        receipt.origin === "BANK" ? <Landmark className="size-5" aria-hidden /> : <PenLine className="size-5" aria-hidden />
      ) : pdf ? (
        <FileText className="size-5" aria-hidden />
      ) : image.data ? (
        <img src={image.data} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" />
      ) : null}
    </div>
  );
}

/** Podržanie prsta na riadku (pol sekundy) – zapne výber. Posunutie prsta (rolovanie) ho zruší. */
function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  if (!onLongPress) return { fired, handlers: {} };
  return {
    fired,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false;
        timer.current = window.setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(12);
          onLongPress();
        }, 500);
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  };
}

/** Stav dokladu vpravo pod sumou (prototyp): Ručne, Čítam, Skontrolovať, priradený k nákupu, bez nákupu. */
function StatusIcon({ r }: { r: Receipt }) {
  if (r.origin === "MANUAL")
    return (
      <span className="badge b-gray">
        <PenLine size={12} /> {t("rpage.manual")}
      </span>
    );
  if (r.origin === "BANK")
    return (
      <span className="badge b-gray">
        <Landmark size={12} /> {t("rpage.bank")}
      </span>
    );
  if (r.status === "PROCESSING" && !isStale(r))
    return (
      <span className="badge b-blue">
        <Loader2 size={12} className="spin" /> {t("rpage.reading")}
      </span>
    );
  if (r.status === "NEEDS_REVIEW" || r.status === "FAILED" || isStale(r))
    return (
      <span className={cx("badge", r.status === "FAILED" && !isNotAReceipt(r) ? "b-red" : "b-yellow")}>
        <AlertTriangle size={12} /> {isStale(r) ? t("row.stale") : shortReason(r)}
      </span>
    );
  if (r.list_id)
    return (
      <span className="t-3" title={t("rpage.attached")} aria-label={t("rpage.attached")}>
        <Link2 size={16} />
      </span>
    );
  return (
    <span className="badge b-gray">
      <Unlink size={12} /> {t("rpage.noTrip")}
    </span>
  );
}

export function ReceiptRow({
  receipt: r,
  selecting,
  order,
  attention,
  onToggle,
  onLongPress,
  itemCount,
  hint,
}: {
  receipt: Receipt;
  /** Počet položiek dokladu (ak je známy). */
  itemCount?: number;
  /** Pri hľadaní: položka, ktorá sa našla („· Mlieko“). */
  hint?: string;
  selecting: boolean;
  /** Poradie vo výbere (-1 = nevybraný). */
  order: number;
  /** Riadok v časti „Na vybavenie“: podnadpis ukazuje, čo treba spraviť. */
  attention?: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}) {
  const stale = isStale(r);
  const processing = r.status === "PROCESSING" && !stale;
  const press = useLongPress(selecting || processing ? undefined : onLongPress);
  const title = r.store_name ?? (processing ? t("row.reading") : r.status === "OK" ? t("row.receipt") : t("row.unknownStore"));
  const failed = r.status === "FAILED";
  // Ručný výdavok a platba z výpisu nemajú bloček – v zozname majú ikonu kategórie (prototyp).
  const noFile = r.origin !== "RECEIPT";
  const sub = processing
    ? t("row.readingLong")
    : attention || failed || stale
      ? stale
        ? t("row.stale")
        : nextStep(r)
      : [
          dayLabel(r.purchased_on ?? r.created_at),
          r.purchased_time?.slice(0, 5),
          noFile ? (r.category_id ? category(r.category_id).name : null) : itemCount ? tn("rpage.items", itemCount) : null,
        ]
          .filter(Boolean)
          .join(" · ") + (hint ? ` · ${hint}` : "");

  const body = (
    <>
      {selecting ? <Thumb receipt={r} /> : noFile ? <CatIcon id={r.category_id ?? "other"} size="sm" /> : <StoreBadge name={r.store_name ?? "?"} size="sm" />}
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className={cx("t-body fw-5 ellipsis", processing && "t-2")}>{title}</span>
        <span className={cx("t-xs num ellipsis", attention || failed ? "t-orange" : "t-2")}>{sub}</span>
      </span>
      <span className="stack g-4" style={{ alignItems: "flex-end", flex: "none" }}>
        {!processing && !failed && <span className="t-body fw-6 num">{formatMoney(r.total)}</span>}
        <StatusIcon r={r} />
      </span>
    </>
  );

  if (selecting) {
    return (
      <button type="button" onClick={onToggle} aria-pressed={order >= 0} className="cell" style={order >= 0 ? { background: "var(--accent-soft)" } : undefined}>
        {body}
        <span className={cx("ls-check", order >= 0 && "on")} aria-hidden>
          {order >= 0 ? <span className="t-xs fw-6">{order + 1}</span> : null}
        </span>
      </button>
    );
  }
  return (
    <Link
      to={`/receipts/${r.id}`}
      {...press.handlers}
      onClick={(e) => {
        // Po dlhom podržaní sa výber zapol – klepnutie nemá otvoriť detail.
        if (press.fired.current) {
          e.preventDefault();
          press.fired.current = false;
        }
      }}
      className="cell select-none [-webkit-touch-callout:none]"
    >
      {body}
    </Link>
  );
}

/** Riadok v časti „Na vybavenie“ (prototyp A5): ikona problému, „Obchod 15. 10. · 34,08 €“ a čo treba spraviť. */
export function AttentionRow({ receipt: r }: { receipt: Receipt }) {
  const stale = isStale(r);
  const failed = r.status === "FAILED" && !isNotAReceipt(r);
  const store = r.store_name ?? t("row.receipt");
  const day = formatShortDate(r.purchased_on ?? r.created_at.slice(0, 10));
  const title = r.total != null ? t("rpage.reviewTitle", { store, day, total: formatMoney(r.total) }) : t("rpage.failedTitle", { store, day });
  const diff = r.total != null && r.items_sum != null ? Math.round((r.total - r.items_sum) * 100) / 100 : 0;
  const sub = stale
    ? t("row.stale")
    : r.review_reason === "TOTAL_MISMATCH" && diff !== 0
      ? t("detail.mismatchTitle", { diff: formatMoney(Math.abs(diff)) })
      : nextStep(r);
  return (
    <Link to={`/receipts/${r.id}`} className="cell">
      <span className="cat-ic sm" style={{ color: failed ? "var(--red)" : "var(--yellow)" }}>
        <AlertTriangle size={16} />
      </span>
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-body fw-5 ellipsis num">{title}</span>
        <span className="t-xs t-2 ellipsis">{sub}</span>
      </span>
      <ChevronRight size={18} className="chev" />
    </Link>
  );
}
