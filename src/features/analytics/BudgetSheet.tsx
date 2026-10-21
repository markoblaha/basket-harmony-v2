import { useState, type FormEvent } from "react";
import { BottomSheet, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { t } from "@/i18n";
import { formatMoney, parseAmount, readErrorMessage } from "@/features/receipts/format";
import { useSetBudget, type Overview } from "./api";
import { categoryInfo } from "./bits";

/** Mesačný rozpočet: celkový a pre kategórie, v ktorých sa míňa najviac. Prázdne pole = bez rozpočtu. */
export function BudgetSheet({ open, onClose, overview }: { open: boolean; onClose: () => void; overview: Overview }) {
  return open ? <BudgetForm onClose={onClose} overview={overview} /> : null;
}

function BudgetForm({ onClose, overview }: { onClose: () => void; overview: Overview }) {
  const { household } = useHousehold();
  const save = useSetBudget(household.id);
  const toast = useToast();
  const existing = new Map(overview.budgets.map((b) => [b.category_id ?? "*", b.amount]));
  const categories = [
    ...new Set([
      ...overview.budgets.filter((b) => b.category_id).map((b) => b.category_id!),
      ...overview.categories.filter((c) => !c.id.startsWith("_") && c.amount > 0).map((c) => c.id),
    ]),
  ].slice(0, 10);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(["*", ...categories].map((k) => [k, existing.get(k) ? String(existing.get(k)) : ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const spent = new Map(overview.categories.map((c) => [c.id, c.amount]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const changes: { categoryId: string | null; amount: number | null }[] = [];
    for (const [key, text] of Object.entries(values)) {
      const amount = text.trim() === "" ? null : parseAmount(text);
      if (text.trim() !== "" && (amount === null || amount <= 0)) return setError(t("budget.invalid"));
      if ((existing.get(key) ?? null) !== amount) changes.push({ categoryId: key === "*" ? null : key, amount });
    }
    setError(null);
    try {
      await save.mutateAsync(changes);
      toast.show(t("budget.saved"), "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  const field = (key: string, label: string, hint?: string) => (
    <label key={key} className="stack g-4">
      <span className="field-label">{label}</span>
      <input className="input num" inputMode="decimal" placeholder="—" value={values[key] ?? ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
      {hint && <span className="t-xs t-3" style={{ padding: "0 4px" }}>{hint}</span>}
    </label>
  );

  return (
    <BottomSheet open onClose={onClose} label={t("budget.title")}>
      <SheetHeader title={t("budget.title")} sub={t("budget.hint")} onClose={onClose} />
      <form onSubmit={submit} className="sheet-body stack g-12">
        {field("*", t("budget.total"), t("budget.sofar", { amount: formatMoney(overview.total) }))}
        {categories.length > 0 && <span className="section-title" style={{ padding: "6px 4px 0" }}>{t("budget.categories")}</span>}
        {categories.map((id) => field(id, `${categoryInfo(id).name} (€)`, spent.get(id) ? t("budget.sofar", { amount: formatMoney(spent.get(id)!) }) : undefined))}
        {error && (
          <p role="alert" className="t-sm" style={{ color: "var(--red)", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-ink btn-lg btn-block" style={{ marginTop: 4 }} disabled={save.isPending}>
          {t("common.save")}
        </button>
      </form>
    </BottomSheet>
  );
}
