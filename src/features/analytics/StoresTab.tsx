import { useNavigate } from "react-router";
import { StoreBadge, storeHue } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatEuro, t, tn } from "@/i18n";
import { useOverview } from "./api";
import { AnalyticsTop, ChangeBadge, ShareRow, pct } from "./akit";
import { storeLabel } from "./bits";
import { usePeriod } from "./period";

/** A4 – Obchody v zvolenom období: podiel, zmena oproti minulému obdobiu, počet nákupov. */
export function StoresTab() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search } = usePeriod();
  const overview = useOverview(household.id, period);
  const stores = (overview.data?.stores ?? []).filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = stores.reduce((a, s) => a + s.amount, 0);
  const top = stores[0];
  return (
    <div className="stack">
      <AnalyticsTop part="stores" />
      {overview.isPending ? (
        <Spinner />
      ) : overview.isError ? (
        <ErrorState error={readErrorMessage(overview.error)} onRetry={() => overview.refetch()} />
      ) : (
        <div className={cx("stack g-12", overview.isPlaceholderData && "opacity-60")} style={{ padding: "8px 16px 0" }}>
          <p className="an-sentence" style={{ margin: "0 4px" }}>
            {top
              ? t("an.storeSentence", { store: storeLabel(top.name), pct: pct(total ? top.amount / total : 0), count: tn("an.purchases", top.receipts) })
              : t("an.noPurchases")}
          </p>
          {stores.length > 0 && (
            <div className="cells">
              {stores.map((s) => (
                <ShareRow
                  key={s.key}
                  icon={<StoreBadge name={storeLabel(s.name)} />}
                  title={
                    <span className="row g-8">
                      <span className="ellipsis">{storeLabel(s.name)}</span>
                      <ChangeBadge now={s.amount} before={s.prev_amount} />
                    </span>
                  }
                  value={formatEuro(s.amount)}
                  share={total ? s.amount / total : 0}
                  color={`hsl(${storeHue(storeLabel(s.name))} 55% 48%)`}
                  sub={`${pct(total ? s.amount / total : 0)} · ${tn("an.purchases", s.receipts)} · ${t("an.avg", { amount: formatEuro(s.receipts ? s.amount / s.receipts : 0) })}`}
                  onClick={() => navigate(`/analytics/store/${encodeURIComponent(s.key)}${search}`)}
                />
              ))}
            </div>
          )}
          <span className="t-xs t-3" style={{ padding: "0 4px" }}>
            {t("an.storesNote")}
          </span>
        </div>
      )}
      <div className="tab-space" />
    </div>
  );
}
