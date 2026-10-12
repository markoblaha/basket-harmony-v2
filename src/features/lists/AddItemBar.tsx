import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { parseItemInput } from "@/lib/parseItem";
import { useAddItem } from "./api";

/**
 * Pole na pridanie položky. Stačí napísať "2 mlieko" a potvrdiť.
 * Po pridaní ostane kurzor v poli, takže sa dá hneď písať ďalšia položka.
 */
export function AddItemBar({ listId, shopperName }: { listId: string; shopperName?: string | null }) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = useAddItem();
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const original = value;
    const parsed = parseItemInput(value);
    if (!parsed.name) return;
    setValue("");
    input.current?.focus();
    try {
      const result = await add.mutateAsync({ listId, ...parsed });
      if (result.kind === "REQUEST") {
        toast.show(`Odoslané ako žiadosť – nakupuje ${shopperName ?? "iný člen"}.`, "info");
      }
    } catch (err) {
      setValue(original); // nič sa nestratí – text vrátime do poľa
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="add-item">
        Pridať položku
      </label>
      <input
        ref={input}
        id="add-item"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={shopperName ? "Napíš, čo ešte treba kúpiť…" : "Pridať položku, napr. 2 mlieko"}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={120}
        className="min-h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3.5 text-base outline-none placeholder:text-text-3 focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
      <button
        type="submit"
        aria-label="Pridať"
        disabled={!value.trim()}
        className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary text-on-primary active:bg-primary-pressed disabled:opacity-40"
      >
        <Plus className="size-6" />
      </button>
    </form>
  );
}
