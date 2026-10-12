import { Check, MoreHorizontal } from "lucide-react";
import { cx, IconButton } from "@/components/ui";
import { formatQuantity } from "@/lib/parseItem";
import type { Item } from "./api";

/**
 * Jeden riadok položky. Kruh vľavo = odškrtnúť (veľký cieľ pre palec).
 * Stav nie je vyjadrený iba farbou: kúpená položka má fajku, je preškrtnutá
 * a čítačka obrazovky povie "kúpené".
 */
export function ItemRow({
  item,
  addedBy,
  large,
  onToggle,
  onEdit,
}: {
  item: Item;
  addedBy?: string;
  large?: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const purchased = item.status === "PURCHASED";
  const qty = formatQuantity(item.quantity, item.unit);
  return (
    <div className={cx("flex items-center gap-1 pr-1", purchased && "bg-success-soft/40")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={purchased}
        aria-label={`${item.name}${qty ? `, ${qty}` : ""}${purchased ? ", kúpené" : ""}`}
        onClick={onToggle}
        className={cx("flex min-w-0 flex-1 items-center gap-3 px-4 text-left active:bg-pressed", large ? "min-h-16 py-3" : "min-h-14 py-2.5")}
      >
        <span
          aria-hidden
          className={cx(
            "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            large ? "size-8" : "size-7",
            purchased ? "border-success bg-success text-white" : "border-line-strong",
          )}
        >
          {purchased && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate font-medium", large && "text-lg", purchased && "text-text-3 line-through")}>
            {item.name}
          </span>
          {(item.note || addedBy) && (
            <span className="block truncate text-sm text-text-3">
              {[item.note, addedBy && `pridal(a) ${addedBy}`].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        {qty && (
          <span className={cx("shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold tabular-nums", purchased ? "text-text-3" : "text-text-2")}>
            {qty}
          </span>
        )}
      </button>
      <IconButton label={`Upraviť ${item.name}`} onClick={onEdit}>
        <MoreHorizontal className="size-5" />
      </IconButton>
    </div>
  );
}
