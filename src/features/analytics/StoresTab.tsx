import { ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { StoreAvatar } from "@/features/receipts/ReceiptRow";
import { formatMoney, readErrorMessage } from "@/features/receipts/format";
import { t, tn } from "@/i18n";
import { useOverview } from "./api";
import { Card, ShareRow, storeLabel } from "./bits";
import { usePeriod } from "./period";

/** Všetky obchody v období: koľko, ako často a aký je priemerný nákup. */
export function StoresTab() {
  const { household } = useHousehold();
  const { period, search } = usePeriod();
  const overview = useOverview(household.id, period);
  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorState error={readErrorMessage(overview.error)} onRetry={() => overview.refetch()} />;
  const stores = overview.data.stores;
  const top = stores[0]?.amount ?? 1;
  const total = stores.reduce((s, x) => s + x.amount, 0);

  return (
    <div className={cx("mt-2 flex flex-col gap-4", overview.isPlaceholderData && "opacity-60")}>
      {stores.length === 0 ? (
        <Section>
          <Card className="py-8 text-center text-text-2">{t("stores.empty")}</Card>
        </Section>
      ) : (
        <Section>
          <p className="mb-2 px-1 text-sm text-text-2">
            {tn("stores.summary", stores.length, { total: formatMoney(total) })}
          </p>
          <Group>
            {stores.map((s) => (
              <ShareRow
                key={s.key}
                to={`/analytics/store/${encodeURIComponent(s.key)}${search}`}
                icon={<StoreAvatar name={s.key === "_none" ? null : s.name} className="!size-10" />}
                title={storeLabel(s.name)}
                subtitle={t("stores.rowLine", { share: t("fmt.percent", { value: Math.round((s.amount / (total || 1)) * 100) }), count: s.receipts, avg: formatMoney(s.receipts ? s.amount / s.receipts : 0) })}
                amount={s.amount}
                share={s.amount / top}
                color="var(--primary)"
                prev={s.prev_amount}
              />
            ))}
          </Group>
        </Section>
      )}
    </div>
  );
}
