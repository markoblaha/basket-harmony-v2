import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { listKeys, useAddItem, useDeleteItem, useUpdateItem, type Item } from "./api";
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
 *
 * Rýchle ťukanie (bublina 3×): nová položka sa ukáže hneď ako dočasný riadok. Ťuky, kým server
 * neodpovie, sa pripočítajú k dočasnému riadku a po odpovedi sa zapíšu jednou úpravou – inak by
 * vznikli dva riadky, lebo prvá položka ešte nemá ID.
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
  const qc = useQueryClient();
  /** Ťuky na položku, ktorej pridanie ešte beží (kľúč = client_op_id dočasného riadku). */
  const queued = useRef(new Map<string, number>());
  /** Dočasný riadok, ktorého pridanie už prebehlo (client_op_id → skutočné ID), kým ho nenahradí riadok zo servera. */
  const realOf = useRef(new Map<string, string>());
  const fail = (err: unknown) => toast.show(errorMessage(err), "error");

  return useCallback(
    async (input: {
      name: string;
      quantity?: number | null;
      unit?: string | null;
      note?: string | null;
      /** Kategória z katalógu domácnosti (inak ju odhadne databáza podľa názvu). */
      categoryId?: string | null;
      /** Bez bubliny – napr. diktovanie ukáže jednu súhrnnú hlášku. */
      quiet?: boolean;
      /** Nová položka sa v zozname ukáže hneď, ešte pred odpoveďou servera. */
      instant?: boolean;
    }): Promise<AddOutcome> => {
      const name = input.name.trim();
      if (!name) return "FAILED";
      const unit = input.unit ?? null;
      const label = qtyLabel(input.quantity ?? 1, unit);
      const key = listKeys.items(listId);
      // vždy najnovší stav (aj s dočasnými riadkami) – pri rýchlych ťukoch props ešte nemusia byť prekreslené
      const fresh = qc.getQueryData<Item[]>(key) ?? items;

      const existing = someoneElseShopping
        ? undefined
        : fresh.find((i) => i.status === "OPEN" && sameProduct(i.name, name) && isCountable(i.unit) && isCountable(unit));
      if (existing?.id.startsWith("tmp-") && existing.client_op_id) {
        // pridanie ešte beží: pripočítať k dočasnému riadku, zapíše sa po odpovedi servera
        const op = existing.client_op_id;
        const extra = countOf(input.quantity);
        const total = countOf(existing.quantity) + extra;
        qc.setQueryData<Item[]>(key, (xs) => xs?.map((i) => (i.id === existing.id ? { ...i, quantity: total } : i)));
        const real = realOf.current.get(op);
        if (real) update.mutate({ id: real, patch: { quantity: total } }, { onError: fail });
        else queued.current.set(op, (queued.current.get(op) ?? 0) + extra);
        return "MERGED";
      }
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

      const opId = crypto.randomUUID();
      try {
        const result = await add.mutateAsync({
          listId,
          name,
          quantity: input.quantity ?? null,
          unit,
          note: input.note ?? null,
          categoryId: input.categoryId ?? null,
          opId,
          optimistic: !!input.instant && !someoneElseShopping,
        });
        const extra = queued.current.get(opId);
        queued.current.delete(opId);
        if (result.kind === "ITEM") {
          realOf.current.set(opId, result.id);
          setTimeout(() => realOf.current.delete(opId), 30_000);
          if (extra) {
            const tmp = qc.getQueryData<Item[]>(key)?.find((i) => i.client_op_id === opId && i.id.startsWith("tmp-"));
            update.mutate({ id: result.id, patch: { quantity: tmp ? countOf(tmp.quantity) : countOf(input.quantity) + extra } }, { onError: fail });
          }
        }
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
        queued.current.delete(opId);
        toast.show(errorMessage(err), "error");
        return "FAILED";
      }
    },
    [add, update, remove, items, listId, someoneElseShopping, onFeed, onLanded, toast, qc],
  );
}
