import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, Sheet, TextField } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES, guessCategory } from "@/lib/categories";
import { useRemoveReceiptItem, useSaveReceiptItem, type ReceiptItem } from "./api";
import { parseAmount, readErrorMessage } from "./format";

/** Úprava jednej položky dokladu (alebo pridanie novej). Súčet a stav dokladu prepočíta databáza. */
export function ItemSheet({
  receiptId,
  item,
  suggestedPrice,
  onClose,
}: {
  receiptId: string;
  /** Upravovaná položka; bez nej sa pridáva nová. */
  item: ReceiptItem | null;
  /** Predvyplnená cena pri novej položke (napr. chýbajúci rozdiel). */
  suggestedPrice?: number | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveReceiptItem(receiptId);
  const remove = useRemoveReceiptItem();
  const [name, setName] = useState(item?.raw_name ?? "");
  const [price, setPrice] = useState(item ? String(item.line_total) : suggestedPrice ? String(suggestedPrice) : "");
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : "1");
  const [discount, setDiscount] = useState(item && item.discount > 0 ? String(item.discount) : "");
  const [categoryId, setCategoryId] = useState<string>(item?.category_id ?? "other");
  const [categoryTouched, setCategoryTouched] = useState(item !== null);
  const [error, setError] = useState<string | null>(null);

  function changeName(value: string) {
    setName(value);
    // Pri novej položke navrhneme kategóriu podľa názvu, kým ju človek sám nezmení.
    if (!categoryTouched) setCategoryId(guessCategory(value));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lineTotal = parseAmount(price);
    const qty = quantity.trim() === "" ? 1 : parseAmount(quantity);
    const disc = discount.trim() === "" ? 0 : parseAmount(discount);
    if (!name.trim()) return setError("Napíš názov položky.");
    if (lineTotal === null) return setError("Cena musí byť číslo, napríklad 1,49.");
    if (qty === null || qty <= 0) return setError("Množstvo musí byť číslo väčšie ako 0.");
    if (disc === null || disc < 0) return setError("Zľava musí byť číslo (0 alebo viac).");
    setError(null);
    try {
      await save.mutateAsync({ id: item?.id, name: name.trim(), lineTotal, quantity: qty, discount: disc, categoryId });
      toast.show(item ? "Položka uložená" : "Položka pridaná", "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  async function onRemove() {
    if (!item) return;
    try {
      await remove.mutateAsync(item.id);
      toast.show("Položka zmazaná", "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open onClose={onClose} title={item ? "Upraviť položku" : "Pridať položku"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Názov" value={name} onChange={(e) => changeName(e.target.value)} maxLength={200} autoFocus={!item} />
        <TextField
          label="Cena za riadok (€) – po zľave, ako si zaplatil"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Množstvo" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextField label="Zľava (€)" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="item-category" className="text-sm font-medium text-text-2">
            Kategória
          </label>
          <select
            id="item-category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryTouched(true);
            }}
            className="min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" block loading={save.isPending}>
            Uložiť
          </Button>
          {item && (
            <Button type="button" variant="danger" block loading={remove.isPending} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden /> Zmazať položku
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
