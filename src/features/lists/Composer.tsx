import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Minus, PenLine, Plus } from "lucide-react";
import { cx } from "@/components/ui";
import { t } from "@/i18n";
import { parseItemInput } from "@/lib/parseItem";
import { qtyLabel } from "./qty";
import type { AddOutcome } from "./useSmartAdd";

/**
 * Pridanie položky: názov, vedľa počet kusov (− 1 +), pod tým detail.
 * Funguje aj rýchly zápis „3 rožky“ alebo „jablká 1,5 kg“ – vtedy má prednosť
 * množstvo z textu. Po pridaní ostane kurzor v poli, dá sa hneď písať ďalej.
 */
export function Composer({
  onAdd,
  requestMode,
}: {
  onAdd: (input: { name: string; quantity: number | null; unit: string | null; note: string | null }) => Promise<AddOutcome>;
  /** Nakupuje niekto iný – pridanie sa pošle ako žiadosť. */
  requestMode?: boolean;
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const parsed = parseItemInput(text);
    if (!parsed.name || busy) return;
    const before = { text, note, qty };
    setBusy(true);
    setText("");
    setNote("");
    setQty(1);
    input.current?.focus();
    const outcome = await onAdd({
      name: parsed.name,
      quantity: parsed.quantity ?? qty,
      unit: parsed.quantity ? parsed.unit : null,
      note: note.trim() || null,
    });
    setBusy(false);
    if (outcome === "FAILED") {
      // nič sa nestratí – text vrátime do polí
      setText(before.text);
      setNote(before.note);
      setQty(before.qty);
    }
  }

  const empty = !text.trim();

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-card">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("composer.label")}</span>
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={requestMode ? t("composer.placeholderRequest") : t("composer.placeholder")}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={120}
            className="h-12 w-full rounded-[var(--radius-control)] border border-transparent bg-sunken px-4 text-base outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-3 focus:border-primary focus:bg-elevated focus:ring-3 focus:ring-primary/20"
          />
        </label>
        <div className="flex h-12 shrink-0 items-center rounded-[var(--radius-control)] bg-sunken">
          <StepButton label={t("composer.fewer")} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
            <Minus className="size-4" strokeWidth={2.2} />
          </StepButton>
          <span className="min-w-6 text-center text-base font-semibold" aria-live="polite" aria-label={qtyLabel(qty, null)}>
            {qty}
          </span>
          <StepButton label={t("composer.more")} onClick={() => setQty((q) => Math.min(99, q + 1))}>
            <Plus className="size-4" strokeWidth={2.2} />
          </StepButton>
        </div>
      </div>
      <label className="relative block">
        <span className="sr-only">{t("composer.noteLabel")}</span>
        <PenLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("composer.notePlaceholder")}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={300}
          className="h-11 w-full rounded-[var(--radius-control)] border border-transparent bg-transparent pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-text-3 focus:border-primary focus:bg-elevated"
        />
      </label>
      <button
        type="submit"
        disabled={empty}
        className="h-12 rounded-[var(--radius-control)] bg-primary text-callout font-strong text-on-primary transition-[transform,opacity,background-color] active:scale-[0.98] active:bg-primary-pressed disabled:bg-sunken disabled:text-text-3 disabled:active:scale-100"
      >
        {requestMode ? t("composer.submitRequest") : qty > 1 ? t("composer.submitMany", { n: qty }) : t("composer.submit")}
      </button>
    </form>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx("grid h-12 w-11 place-items-center rounded-lg transition-transform active:scale-90 active:bg-pressed disabled:opacity-35")}
    >
      {children}
    </button>
  );
}
