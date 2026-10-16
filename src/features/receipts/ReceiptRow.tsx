import { useRef, type PointerEvent } from "react";
import { Link } from "react-router";
import { ChevronRight, FileText, Landmark, Loader2, PenLine } from "lucide-react";
import { cx } from "@/components/ui";
import { t } from "@/i18n";
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

export function ReceiptRow({
  receipt: r,
  selecting,
  order,
  attention,
  onToggle,
  onLongPress,
}: {
  receipt: Receipt;
  selecting: boolean;
  /** Poradie vo výbere (-1 = nevybraný). */
  order: number;
  /** Riadok v schránke "Čaká na teba": podnadpis ukazuje, čo treba spraviť. */
  attention?: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}) {
  const stale = isStale(r);
  const processing = r.status === "PROCESSING" && !stale;
  const press = useLongPress(selecting || processing ? undefined : onLongPress);
  const title = r.store_name ?? (processing ? t("row.reading") : r.status === "OK" ? t("row.receipt") : t("row.unknownStore"));
  const failed = r.status === "FAILED";
  const warn = r.status === "NEEDS_REVIEW" || stale;

  const subtitle = processing ? (
    <span className="text-text-3">{t("row.readingLong")}</span>
  ) : attention || failed || stale ? (
    <span className={cx("font-medium", failed && !isNotAReceipt(r) ? "text-danger" : failed ? "text-text-2" : "text-warning")}>
      {stale ? t("row.stale") : nextStep(r)}
    </span>
  ) : (
    <span className="text-text-2">
      {formatShortDate(r.purchased_on)}
      {r.origin === "BANK" ? t("row.fromStatement") : r.origin === "MANUAL" ? t("row.manual") : ""}
    </span>
  );

  const body = (
    <>
      {selecting && <Thumb receipt={r} />}
      {!selecting && <StoreAvatar name={r.store_name} />}
      <div className="min-w-0 flex-1">
        <p className={cx("truncate font-strong", processing && "text-text-2")}>{title}</p>
        <p className="truncate text-sm">
          {subtitle}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {processing ? (
          <Loader2 className="size-5 animate-spin text-text-3" aria-label={t("row.readingAria")} />
        ) : failed ? null : (
          <span className="text-base font-strong tabular-nums">{formatMoney(r.total)}</span>
        )}
        {warn && !attention && (
          <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-xs font-strong text-warning">{shortReason(r)}</span>
        )}
      </div>
    </>
  );

  if (selecting) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={order >= 0}
        className={cx(
          "flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed",
          order >= 0 && "bg-primary-soft",
        )}
      >
        {body}
        <span
          aria-hidden
          className={cx(
            "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
            order >= 0 ? "border-primary bg-primary text-on-primary" : "border-line-strong/60 text-transparent",
          )}
        >
          {order >= 0 ? order + 1 : "·"}
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
      className="flex min-h-[4.25rem] select-none items-center gap-3 px-4 py-3 [-webkit-touch-callout:none] active:bg-pressed"
    >
      {body}
      <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
