import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, Sheet, TextField, cx } from "@/components/ui";
import { CategoryGlyph } from "@/components/CategoryIcon";
import { useToast } from "@/components/toast";
import { CATEGORIES } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { normalizeUnit, unitLabel } from "@/lib/parseItem";
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
    setUnit(item.unit ? unitLabel(item.unit) : "");
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
          unit: normalizeUnit(unit.trim() || undefined),
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
      onSuccess: () => toast.show(t("item.removed", { name: item.name })),
      onError: (err) => toast.show(errorMessage(err), "error"),
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t("edit.title")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("edit.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("edit.quantity")}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={qtyInvalid ? t("edit.invalidNumber") : null}
          />
          <TextField label={t("edit.unit")} placeholder={t("edit.unitPlaceholder")} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
        </div>
        <TextField label={t("edit.note")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-2">{t("edit.category")}</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors duration-[120ms]",
                  categoryId === c.id ? "bg-primary-soft font-strong text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text-2",
                )}
              >
                <CategoryGlyph id={c.id} className="size-4" /> {c.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-3">{t("edit.categoryHint")}</p>
        </fieldset>

        <Button type="submit" size="lg" block disabled={!name.trim() || qtyInvalid}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="danger" block onClick={destroy}>
          <Trash2 className="size-4" aria-hidden /> {t("edit.delete")}
        </Button>
      </form>
    </Sheet>
  );
}
