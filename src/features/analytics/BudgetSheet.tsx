import { useState, type FormEvent } from "react";
import { Button, Sheet, TextField } from "@/components/ui";
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

  return (
    <Sheet open onClose={onClose} title={t("budget.title")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-text-2">{t("budget.hint")}</p>
        <TextField
          label={t("budget.total")}
          inputMode="decimal"
          value={values["*"] ?? ""}
          onChange={(e) => setValues({ ...values, "*": e.target.value })}
          hint={t("budget.sofar", { amount: formatMoney(overview.total) })}
        />
        {categories.length > 0 && <p className="text-sm font-semibold text-text-2">{t("budget.categories")}</p>}
        {categories.map((id) => {
          const info = categoryInfo(id);
          return (
            <TextField
              key={id}
              label={`${info.name} (€)`}
              inputMode="decimal"
              value={values[id] ?? ""}
              onChange={(e) => setValues({ ...values, [id]: e.target.value })}
              hint={spent.get(id) ? t("budget.sofar", { amount: formatMoney(spent.get(id)!) }) : undefined}
            />
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={save.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </Sheet>
  );
}
