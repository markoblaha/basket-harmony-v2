import { EmptyState, PageHeader } from "@/components/ui";

/**
 * Obrazovky, ktoré pribudnú v ďalších etapách. Zámerne neukazujú vymyslené
 * údaje – len poctivo hovoria, čo príde.
 */
export function ReceiptsPage() {
  return (
    <>
      <PageHeader title="Bločky" />
      <EmptyState icon="🧾" title="Pripravujeme">
        Odfotíš bloček a umelá inteligencia z neho prečíta obchod, dátum aj všetky položky s cenami. Prenesieme sem aj tvojich
        38 bločkov zo starej aplikácie.
      </EmptyState>
    </>
  );
}

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
