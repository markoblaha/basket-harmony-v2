import { ChefHat } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { t } from "@/i18n";

/** Karta Recepty – zatiaľ len úvod; recepty, nákup surovín a varenie pribudnú v ďalšej etape. */
export function RecipesPage() {
  return (
    <>
      <PageHeader title={t("recipes.title")} />
      <EmptyState icon={<ChefHat />} title={t("recipes.soon.title")}>
        {t("recipes.soon.body")}
      </EmptyState>
    </>
  );
}
