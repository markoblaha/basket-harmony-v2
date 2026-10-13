import { useEffect, useMemo, type ReactNode } from "react";
import { Camera, FileText, Image as ImageIcon, X } from "lucide-react";
import { Button, IconButton, Sheet, cx } from "@/components/ui";
import { MAX_PAGES } from "./api";
import { plural } from "./format";

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
}: {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onFile: () => void;
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
