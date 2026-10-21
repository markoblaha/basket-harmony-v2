import { useNavigate } from "react-router";
import { CatIcon } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatEuro, t, tn } from "@/i18n";
import { useOverview } from "./api";
import { AnalyticsTop, ShareRow, pct } from "./akit";
import { categoryInfo } from "./bits";
import { usePeriod } from "./period";

/** A2 – Kategórie (úroveň 1): všetky kategórie obdobia s podielom; ťuk otvorí kategóriu. */
export function CategoriesTab() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search } = usePeriod();
  const overview = useOverview(household.id, period);
  const cats = (overview.data?.categories ?? []).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = cats.reduce((a, c) => a + c.amount, 0);
  return (
    <div className="stack">
      <AnalyticsTop part="categories" />
      {overview.isPending ? (
        <Spinner />
      ) : overview.isError ? (
        <ErrorState error={readErrorMessage(overview.error)} onRetry={() => overview.refetch()} />
      ) : (
        <div className={cx("stack g-12", overview.isPlaceholderData && "opacity-60")} style={{ padding: "8px 16px 0" }}>
          <p className="an-sentence" style={{ margin: "0 4px" }}>
            {cats.length ? t("an.catSentence", { amount: formatEuro(total), cats: tn("an.inCategories", cats.length) }) : t("an.noPurchases")}
          </p>
          <div className="cells">
            {cats.map((c) => (
              <ShareRow
                key={c.id}
                icon={<CatIcon id={c.id} />}
                title={categoryInfo(c.id).name}
                value={formatEuro(c.amount)}
                share={total ? c.amount / total : 0}
                sub={pct(total ? c.amount / total : 0)}
                onClick={() => navigate(`/analytics/category/${c.id}${search}`)}
              />
            ))}
          </div>
        </div>
      )}
      <div className="tab-space" />
    </div>
  );
}
