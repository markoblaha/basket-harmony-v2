import { useRef } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { formatNumber, t } from "@/i18n";
import { useDeleteItem, useUpdateItem, type Item } from "./api";
import { countOf, isCountable, qtyLabel } from "./qty";

/**
 * Zoznam pri plánovaní – „účtenka“: riadky oddelené prerušovanou čiarou,
 * dole perforovaný okraj. Vpravo pri každej položke − počet +; pri 1 ks sa
 * mínus zmení na kôš (ďalšie ťuknutie by položku odstránilo, tak to ukážeme vopred).
 * Novo pridaný riadok krátko zasvieti.
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
  hints?: Map<string, string>;
  onEdit: (item: Item) => void;
}) {
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const toast = useToast();

  // Ktoré riadky sú „nové“ (pribudli po otvorení obrazovky) – tie zasvietia.
  const known = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (known.current === null) known.current = new Set(items.map((i) => i.id));
  else for (const i of items) if (!known.current.has(i.id)) fresh.add(i.id);
  queueMicrotask(() => items.forEach((i) => known.current?.add(i.id)));

  function change(item: Item, delta: number) {
    const next = countOf(item.quantity) + delta;
    if (next <= 0) {
      remove.mutate(item.id, {
        onSuccess: () => toast.show(t("item.removed", { name: item.name })),
        onError: (err) => toast.show(errorMessage(err), "error"),
      });
      return;
    }
    update.mutate({ id: item.id, patch: { quantity: next } }, { onError: (err) => toast.show(errorMessage(err), "error") });
  }

  return (
    <div>
      <div className="overflow-hidden rounded-t-[0.375rem] bg-elevated">
        {items.map((item, idx) => {
          const by = item.added_by && item.added_by !== me ? names?.get(item.added_by) : undefined;
          const countable = isCountable(item.unit);
          const n = countOf(item.quantity);
          return (
            <div
              key={item.id}
              className={cx(
                "flex min-h-[3.625rem] items-center gap-2.5 py-2 pl-3.5 pr-2",
                idx > 0 && "border-t border-dashed border-line",
                fresh.has(item.id) && "[animation:bh-flash_.9s_ease]",
              )}
            >
              <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left" aria-label={t("item.edit", { name: item.name })}>
                <span className="block truncate text-[0.96875rem] font-semibold leading-tight">{item.name}</span>
                {(by || item.note) && (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.78125rem] text-text-2">
                    {by && <span className="rounded-[0.3125rem] bg-person-soft px-1.5 py-px text-[0.6875rem] font-bold text-person">{t("item.addedBy", { name: by })}</span>}
                    {item.note && <span className="truncate">{item.note}</span>}
                  </span>
                )}
                {hints?.get(item.id) && <span className="mt-0.5 block truncate text-xs text-text-3">{hints.get(item.id)}</span>}
              </button>
              {countable ? (
                <div className="flex shrink-0 items-center rounded-[0.6875rem] border border-line bg-bg">
                  <button
                    type="button"
                    aria-label={n === 1 ? t("item.remove", { name: item.name }) : t("item.fewer", { name: item.name })}
                    onClick={() => change(item, -1)}
                    className={cx("grid size-10 place-items-center rounded-[0.625rem] transition-transform active:scale-[0.85] active:bg-pressed", n === 1 && "text-danger")}
                  >
                    {n === 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-[0.9375rem]" strokeWidth={2.6} aria-hidden />}
                  </button>
                  <Bump value={n} />
                  <button
                    type="button"
                    aria-label={t("item.more", { name: item.name })}
                    onClick={() => change(item, 1)}
                    className="grid size-10 place-items-center rounded-[0.625rem] transition-transform active:scale-[0.85] active:bg-pressed"
                  >
                    <Plus className="size-[0.9375rem]" strokeWidth={2.6} aria-hidden />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => onEdit(item)} className="shrink-0 rounded-[0.6875rem] border border-line bg-bg px-3 py-2 text-sm font-bold">
                  {qtyLabel(item.quantity, item.unit)}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {/* perforovaný okraj účtenky */}
      <div
        aria-hidden
        className="h-2.5"
        style={{
          background: "radial-gradient(circle at 7px 10px, var(--bg) 5px, var(--elevated) 5.5px) repeat-x",
          backgroundSize: "14px 10px",
        }}
      />
    </div>
  );
}

/** Číslo, ktoré pri zmene krátko „pulzne“ (pri prvom zobrazení nie). */
export function Bump({ value, className }: { value: number; className?: string }) {
  const first = useRef(value);
  const changed = first.current !== value;
  return (
    <span key={value} className={cx("min-w-8 text-center text-[0.9375rem] font-bold", changed && "[animation:bh-pop_.35s_ease]", className)}>
      {formatNumber(value, { maximumFractionDigits: 2 })}
    </span>
  );
}
