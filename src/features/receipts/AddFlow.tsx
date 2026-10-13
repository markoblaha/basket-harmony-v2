import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Camera, FileText, Image as ImageIcon, Landmark, PenLine, X } from "lucide-react";
import { Button, IconButton, Sheet, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CATEGORIES } from "@/lib/categories";
import { MAX_PAGES, useAddManualExpense } from "./api";
import { parseAmount, plural, readErrorMessage } from "./format";

export type PendingKind = "camera" | "files";
export type Pending = { kind: PendingKind; files: File[] };
export type PendingMode = "separate" | "one";

function MenuButton({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-4 rounded-[var(--radius-surface)] bg-surface px-4 py-3 text-left active:bg-pressed"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-text-2">{hint}</span>
      </span>
    </button>
  );
}

/** Ponuka po klepnutí na "+": odfotiť, vybrať z galérie, alebo PDF/súbor. */
export function AddMenu({
  open,
  onClose,
  onCamera,
  onGallery,
  onFile,
  onStatement,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onFile: () => void;
  onStatement: () => void;
  onManual: () => void;
}) {
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Pridať doklad">
      <div className="flex flex-col gap-2">
        <MenuButton
          icon={<Camera className="size-5" aria-hidden />}
          title="Odfotiť"
          hint="Aj dlhý doklad – odfotíš ďalšie strany, kým nie si hotový."
          onClick={pick(onCamera)}
        />
        <MenuButton
          icon={<ImageIcon className="size-5" aria-hidden />}
          title="Z galérie"
          hint="Jedna alebo viac fotiek a snímok obrazovky naraz."
          onClick={pick(onGallery)}
        />
        <MenuButton
          icon={<FileText className="size-5" aria-hidden />}
          title="PDF alebo súbor"
          hint="Faktúra alebo potvrdenie objednávky z e-mailu."
          onClick={pick(onFile)}
        />
        <p className="mt-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-3">Bez bločku</p>
        <MenuButton
          icon={<Landmark className="size-5" aria-hidden />}
          title="Z bankového výpisu"
          hint="Platby kartou bez bločku – tankovanie, reštaurácie, e-shopy, účty."
          onClick={pick(onStatement)}
        />
        <MenuButton
          icon={<PenLine className="size-5" aria-hidden />}
          title="Zadať výdavok ručne"
          hint="Napr. nájom, hotovosť na trhu, čokoľvek bez dokladu."
          onClick={pick(onManual)}
        />
      </div>
    </Sheet>
  );
}

/**
 * Okno s nazbieranými súbormi pred nahratím.
 *  - fotoaparát: všetko sú strany jedného dokladu, kým človek nepovie "Hotovo";
 *  - galéria/súbory: človek vyberie, či ide o samostatné doklady, alebo o strany jedného.
 */
export function PendingSheet({
  pending,
  mode,
  onMode,
  onAddMore,
  onRemove,
  onStart,
  onClose,
}: {
  pending: Pending | null;
  mode: PendingMode;
  onMode: (m: PendingMode) => void;
  onAddMore: () => void;
  onRemove: (index: number) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const files = pending?.files;
  const list = files ?? [];
  const camera = pending?.kind === "camera";
  const one = camera || mode === "one";
  const urls = useMemo(
    () => list.map((f) => (f.type.startsWith("image/") && !/hei[cf]/i.test(f.type) ? URL.createObjectURL(f) : null)),
    [files], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);
  const tooMany = one && list.length > MAX_PAGES;

  const option = (value: PendingMode, title: string, hint: string) => (
    <button
      type="button"
      onClick={() => onMode(value)}
      aria-pressed={mode === value}
      className={cx(
        "rounded-[var(--radius-control)] border-2 p-3 text-left",
        mode === value ? "border-primary bg-primary-soft" : "border-line-strong/40 bg-surface",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-text-2">{hint}</p>
    </button>
  );

  return (
    <Sheet
      open={pending !== null}
      onClose={onClose}
      title={camera ? `Nový doklad · ${list.length} ${plural(list.length, ["strana", "strany", "strán"])}` : `Pridať ${list.length} súborov`}
    >
      <div className="flex flex-col gap-4">
        {camera ? (
          <p className="text-sm text-text-2">Má doklad ešte ďalšiu stranu? Odfoť ju. Keď máš všetko, klepni na „Hotovo“.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {option("separate", "Každý súbor je samostatný doklad", `Vznikne ${list.length} dokladov.`)}
            {option("one", "Všetky súbory sú jeden doklad", "Napr. dlhý bloček alebo faktúra na viacerých fotkách. Prečítajú sa spolu.")}
          </div>
        )}
        <ul className="flex gap-2 overflow-x-auto pb-1 pt-2" aria-label="Vybrané súbory">
          {list.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative shrink-0">
              <div className="flex h-28 w-20 items-center justify-center overflow-hidden rounded-md bg-surface text-text-3">
                {urls[i] ? <img src={urls[i]!} alt={f.name} className="size-full object-cover object-top" /> : <FileText className="size-6" aria-hidden />}
              </div>
              {one && (
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-xs font-bold text-white">{i + 1}</span>
              )}
              <IconButton
                label={`Odstrániť ${f.name}`}
                onClick={() => onRemove(i)}
                className="absolute -right-2 -top-2 size-7 bg-elevated shadow"
              >
                <X className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
        {tooMany && <p className="text-sm text-danger">Jeden doklad môže mať najviac {MAX_PAGES} strán.</p>}
        <div className="flex flex-col gap-2">
          <Button size="lg" block disabled={list.length === 0 || tooMany} onClick={onStart}>
            {camera ? "Hotovo – prečítať doklad" : one ? "Pridať ako 1 doklad" : `Pridať ${list.length} dokladov`}
          </Button>
          <Button variant="secondary" block onClick={onAddMore}>
            {camera ? (
              <>
                <Camera className="size-5" aria-hidden /> Odfotiť ďalšiu stranu
              </>
            ) : (
              "Pridať ďalšie súbory"
            )}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Ručne zadaný výdavok bez dokladu (nájom, trh, hotovosť). */
export function ManualExpenseSheet({ open, onClose, householdId }: { open: boolean; onClose: () => void; householdId: string }) {
  return open ? <ManualExpenseForm onClose={onClose} householdId={householdId} /> : null;
}

function ManualExpenseForm({ onClose, householdId }: { onClose: () => void; householdId: string }) {
  const add = useAddManualExpense(householdId);
  const toast = useToast();
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(iso);
  const [categoryId, setCategoryId] = useState("housing");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Napíš, za čo alebo komu.");
    if (value === null || value <= 0) return setError("Suma musí byť kladné číslo, napríklad 650.");
    if (!date) return setError("Vyber dátum.");
    setError(null);
    try {
      await add.mutateAsync({ name: name.trim(), amount: value, date, categoryId });
      toast.show("Výdavok pridaný", "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open onClose={onClose} title="Zadať výdavok">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Za čo / komu" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="napr. Nájom, Trh, Kaderník" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Suma (€)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Dátum" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-category" className="text-sm font-medium text-text-2">
            Kategória
          </label>
          <select
            id="manual-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
          >
            {CATEGORIES.filter((c) => c.id !== "deposit").map((c) => (
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
        <Button type="submit" size="lg" block loading={add.isPending}>
          Pridať výdavok
        </Button>
      </form>
    </Sheet>
  );
}
