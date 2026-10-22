import { useCallback } from "react";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useAddItem, useDeleteItem, useUpdateItem, type Item } from "./api";
import { countOf, isCountable, qtyLabel, sameProduct } from "./qty";

/** Potvrdenie pridania pre bublinu hore: „Banány +3 ks · na zozname“. */
export type FeedEntry = { id: number; name: string; qty?: string; tail: string; out?: boolean; undo?: () => void };

export type AddOutcome = "ITEM" | "MERGED" | "REQUEST" | "FAILED";

/**
 * Pridanie položky z akéhokoľvek miesta (pole, dlaždica, schválená žiadosť).
 *
 * Ak rovnaký produkt (v kusoch) už na zozname je, pripočíta sa k nemu – nevznikne
 * druhý riadok „Banány“. Výnimka: keď nakupuje niekto iný, ide všetko cez add_item,
 * lebo databáza z toho musí urobiť žiadosť pre nakupujúceho.
 */
export function useSmartAdd({
  listId,
  items,
  someoneElseShopping,
  onFeed,
  onLanded,
}: {
  listId: string;
  items: Item[];
  someoneElseShopping: boolean;
  onFeed: (entry: Omit<FeedEntry, "id" | "out">) => void;
  /** Riadok, do ktorého pridanie dopadlo (nový alebo navýšený) – zoznam k nemu dôjde a zasvieti ho. */
  onLanded?: (itemId: string) => void;
}) {
  const add = useAddItem();
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const toast = useToast();
  const fail = (err: unknown) => toast.show(errorMessage(err), "error");

  return useCallback(
    async (input: {
      name: string;
      quantity?: number | null;
      unit?: string | null;
      note?: string | null;
      /** Bez bubliny – napr. diktovanie ukáže jednu súhrnnú hlášku. */
      quiet?: boolean;
    }): Promise<AddOutcome> => {
      const name = input.name.trim();
      if (!name) return "FAILED";
      const unit = input.unit ?? null;
      const label = qtyLabel(input.quantity ?? 1, unit);

      const existing = someoneElseShopping
        ? undefined
        : items.find((i) => i.status === "OPEN" && sameProduct(i.name, name) && isCountable(i.unit) && isCountable(unit));
      if (existing) {
        const quantity = countOf(existing.quantity) + countOf(input.quantity);
        try {
          await update.mutateAsync({
            id: existing.id,
            patch: { quantity, ...(input.note ? { note: input.note } : {}) },
          });
          const before = { quantity: existing.quantity, note: existing.note };
          onLanded?.(existing.id);
          if (!input.quiet)
            onFeed({
              name: existing.name,
              qty: label,
              tail: t("feed.total", { qty: qtyLabel(quantity, existing.unit) }),
              // Vrátiť = pôvodné množstvo
              undo: () => update.mutate({ id: existing.id, patch: before }, { onError: fail }),
            });
          return "MERGED";
        } catch (err) {
          toast.show(errorMessage(err), "error");
          return "FAILED";
        }
      }

      try {
        const result = await add.mutateAsync({ listId, name, quantity: input.quantity ?? null, unit, note: input.note ?? null });
        if (result.kind === "ITEM") onLanded?.(result.id);
        if (!input.quiet)
          onFeed({
            name,
            qty: label,
            tail: result.kind === "REQUEST" ? t("feed.sentForApproval") : t("ls.added"),
            // Žiadosť už odišla nakupujúcemu – tú vrátiť nejde; novú položku áno.
            undo: result.kind === "ITEM" ? () => remove.mutate(result.id, { onError: fail }) : undefined,
          });
        return result.kind;
      } catch (err) {
        toast.show(errorMessage(err), "error");
        return "FAILED";
      }
    },
    [add, update, remove, items, listId, someoneElseShopping, onFeed, onLanded, toast],
  );
}
