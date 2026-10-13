import { EmptyState, PageHeader } from "@/components/ui";

/** Prehľady pribudnú v ďalšej etape; zatiaľ poctivo hovoria, čo príde (žiadne vymyslené údaje). */
export function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Prehľady" />
      <EmptyState icon="📊" title="Pripravujeme">
        Výdavky podľa mesiacov, kategórií a obchodov, historické a priemerné ceny produktov a ich zmeny v čase.
      </EmptyState>
    </>
  );
}
