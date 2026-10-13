import { useCallback } from "react";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { useAddItem, useUpdateItem, type Item } from "./api";
import { countOf, isCountable, qtyLabel, sameProduct } from "./qty";
import type { FeedEntry } from "./feed";

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
}: {
  listId: string;
  items: Item[];
  someoneElseShopping: boolean;
  onFeed: (entry: Omit<FeedEntry, "id" | "out">) => void;
}) {
  const add = useAddItem();
  const update = useUpdateItem(listId);
  const toast = useToast();

  return useCallback(
    async (input: { name: string; quantity?: number | null; unit?: string | null; note?: string | null }): Promise<AddOutcome> => {
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
          onFeed({ name: existing.name, qty: label, tail: `spolu ${qtyLabel(quantity, existing.unit)}` });
          return "MERGED";
        } catch (err) {
          toast.show(errorMessage(err), "error");
          return "FAILED";
        }
      }

      try {
        const result = await add.mutateAsync({ listId, name, quantity: input.quantity ?? null, unit, note: input.note ?? null });
        onFeed({ name, qty: label, tail: result.kind === "REQUEST" ? "poslané na schválenie" : "na zozname" });
        return result.kind;
      } catch (err) {
        toast.show(errorMessage(err), "error");
        return "FAILED";
      }
    },
    [add, update, items, listId, someoneElseShopping, onFeed, toast],
  );
}
