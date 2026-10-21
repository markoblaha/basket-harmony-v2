import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Camera, FileText, Image as ImageIcon, Landmark, PenLine, X } from "lucide-react";
import { Button, IconButton, Sheet, cx } from "@/components/ui";
import { BottomSheet, Cell, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { CATEGORIES } from "@/lib/categories";
import { formatEuro, t, tn } from "@/i18n";
import { MAX_PAGES, useAddManualExpense } from "./api";
import { parseAmount, readErrorMessage } from "./format";

export type PendingKind = "camera" | "files";
export type Pending = { kind: PendingKind; files: File[] };
export type PendingMode = "separate" | "one";

/** A5ADD – pridať doklad (prototyp): fotka, galéria, PDF; bez bločku ručný výdavok alebo bankový výpis. */
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
  const ic = (node: ReactNode) => <span className="cat-ic sm">{node}</span>;
  return (
    <BottomSheet open={open} onClose={onClose} label={t("add.title")}>
      <SheetHeader title={t("add.title")} sub={t("add.sub")} onClose={onClose} />
      <div className="sheet-body stack g-12">
        <div className="cells">
          <Cell icon={ic(<Camera size={16} />)} title={t("add.camera")} sub={t("add.cameraHint")} onClick={pick(onCamera)} />
          <Cell icon={ic(<ImageIcon size={16} />)} title={t("add.gallery")} sub={t("add.galleryHint")} onClick={pick(onGallery)} />
          <Cell icon={ic(<FileText size={16} />)} title={t("add.file")} sub={t("add.fileHint")} onClick={pick(onFile)} />
        </div>
        <div className="cells">
          <Cell icon={ic(<PenLine size={16} />)} title={t("add.manual")} sub={t("add.manualHint")} onClick={pick(onManual)} />
          <Cell icon={ic(<Landmark size={16} />)} title={t("add.statement")} sub={t("add.statementHint")} onClick={pick(onStatement)} />
        </div>
      </div>
    </BottomSheet>
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
        "rounded-[var(--radius-control)] p-3 text-left transition-colors duration-[120ms]",
        mode === value ? "bg-primary-soft shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken",
      )}
    >
      <p className="font-strong">{title}</p>
      <p className="text-sm text-text-2">{hint}</p>
    </button>
  );

  return (
    <Sheet
      open={pending !== null}
      onClose={onClose}
      title={camera ? tn("add.newReceipt", list.length) : tn("add.files", list.length)}
    >
      <div className="flex flex-col gap-4">
        {camera ? (
          <p className="text-sm text-text-2">{t("add.pageHint")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {option("separate", t("add.separate"), tn("add.separateHint", list.length))}
            {option("one", t("add.together"), t("add.togetherHint"))}
          </div>
        )}
        <ul className="flex gap-2 overflow-x-auto pb-1 pt-2" aria-label={t("add.selectedFiles")}>
          {list.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative shrink-0">
              <div className="flex h-28 w-20 items-center justify-center overflow-hidden rounded-sm bg-sunken text-text-3">
                {urls[i] ? <img src={urls[i]!} alt={f.name} className="size-full object-cover object-top" /> : <FileText className="size-6" aria-hidden />}
              </div>
              {one && (
                <span className="absolute left-1 top-1 rounded-full bg-inverse/85 px-2 text-xs font-strong text-on-inverse">{i + 1}</span>
              )}
              <IconButton
                label={t("add.removeFile", { name: f.name })}
                onClick={() => onRemove(i)}
                className="absolute -right-2 -top-2 size-7 bg-surface shadow"
              >
                <X className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
        {tooMany && <p className="text-sm text-danger">{t("add.tooMany", { max: MAX_PAGES })}</p>}
        <div className="flex flex-col gap-2">
          <Button size="lg" block disabled={list.length === 0 || tooMany} onClick={onStart}>
            {camera ? t("add.readReceipt") : one ? t("add.asOne") : tn("add.receipts", list.length)}
          </Button>
          <Button variant="secondary" block onClick={onAddMore}>
            {camera ? (
              <>
                <Camera className="size-5" aria-hidden /> {t("add.anotherPage")}
              </>
            ) : (
              t("add.moreFiles")
            )}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** A5MAN – ručný výdavok bez dokladu (trh, nájom, hotovosť). */
export function ManualExpenseSheet({ open, onClose, householdId }: { open: boolean; onClose: () => void; householdId: string }) {
  return (
    <BottomSheet open={open} onClose={onClose} label={t("manual.title")}>
      {open && <ManualExpenseForm onClose={onClose} householdId={householdId} />}
    </BottomSheet>
  );
}

function ManualExpenseForm({ onClose, householdId }: { onClose: () => void; householdId: string }) {
  const add = useAddManualExpense(householdId);
  const toast = useToast();
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(iso);
  const [categoryId, setCategoryId] = useState("groceries");
  const value = parseAmount(amount);
  const ok = !!name.trim() && value !== null && value > 0 && !!date;

  async function submit() {
    if (!ok || value === null) return;
    try {
      await add.mutateAsync({ name: name.trim(), amount: value, date, categoryId });
      toast.show(t("manual.added"), "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <>
      <SheetHeader title={t("manual.title")} sub={t("manual.sub")} onClose={onClose} />
      <div className="sheet-body stack g-16">
        <label className="stack g-6">
          <span className="field-label">{t("manual.name")}</span>
          <input className="input" autoFocus maxLength={120} placeholder={t("manual.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row g-8">
          <label className="grow stack g-6">
            <span className="field-label">{t("manual.amount")}</span>
            <input className="input num" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="grow stack g-6">
            <span className="field-label">{t("manual.date")}</span>
            <input className="input" type="date" max={iso} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="stack g-6">
          <span className="field-label">{t("edit.category")}</span>
          <div className="row wrap g-8" role="radiogroup" aria-label={t("edit.category")}>
            {CATEGORIES.filter((c) => c.id !== "deposit").map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={categoryId === c.id} className={cx("chip", categoryId === c.id && "on")} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-ink btn-block btn-lg" disabled={!ok || add.isPending} onClick={() => void submit()}>
          {t("manual.submit")}
          {value && value > 0 ? ` ${formatEuro(value)}` : ""}
        </button>
      </div>
    </>
  );
}
