import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, Sheet, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { useDeleteItem, useUpdateItem, type Item } from "./api";

/** Úprava položky: názov, množstvo, poznámka, kategória, zmazanie. */
export function EditItemSheet({ item, listId, onClose }: { item: Item | null; listId: string; onClose: () => void }) {
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const toast = useToast();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("other");

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setQuantity(item.quantity != null ? String(item.quantity).replace(".", ",") : "");
    setUnit(item.unit ?? "");
    setNote(item.note ?? "");
    setCategoryId(item.category_id);
  }, [item]);

  if (!item) return null;

  const qtyNumber = quantity.trim() ? Number(quantity.replace(",", ".")) : null;
  const qtyInvalid = qtyNumber !== null && (!Number.isFinite(qtyNumber) || qtyNumber <= 0);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!item || !name.trim() || qtyInvalid) return;
    update.mutate(
      {
        id: item.id,
        patch: {
          name: name.trim(),
          quantity: qtyNumber,
          unit: unit.trim() || null,
          note: note.trim() || null,
          category_id: categoryId,
        },
      },
      { onError: (err) => toast.show(errorMessage(err), "error") },
    );
    onClose();
  }

  function destroy() {
    if (!item) return;
    remove.mutate(item.id, {
      onSuccess: () => toast.show(`„${item.name}“ odstránené`),
      onError: (err) => toast.show(errorMessage(err), "error"),
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Upraviť položku">
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Názov" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Množstvo"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={qtyInvalid ? "Neplatné číslo" : null}
          />
          <TextField label="Jednotka" placeholder="ks, kg, l…" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
        </div>
        <TextField label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-2">Kategória</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cx(
                  "min-h-10 rounded-full border px-3 text-sm",
                  categoryId === c.id ? "border-primary bg-primary-soft font-semibold text-primary" : "border-line bg-surface text-text-2",
                )}
              >
                <span aria-hidden>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-3">Zmenu kategórie si domácnosť zapamätá pre budúce položky s rovnakým názvom.</p>
        </fieldset>

        <Button type="submit" size="lg" block disabled={!name.trim() || qtyInvalid}>
          Uložiť
        </Button>
        <Button type="button" variant="danger" block onClick={destroy}>
          <Trash2 className="size-4" aria-hidden /> Odstrániť položku
        </Button>
      </form>
    </Sheet>
  );
}
