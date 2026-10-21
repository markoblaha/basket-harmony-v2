import { useNavigate, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { CatIcon, ScreenHeader, StoreBadge } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { formatShortDate, readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, formatEuro, t, tn } from "@/i18n";
import { useStoreDetail } from "./api";
import { ChangeBadge, PeriodChips, ShareRow, WeekdayBars, pct } from "./akit";
import { categoryInfo, storeLabel } from "./bits";
import { usePeriod } from "./period";

/** A4D – detail obchodu: veta, suma so zmenou, kedy tu nakupujete, čo tu kupujete, produkty a doklady. */
export function StorePage() {
  const { key = "_none" } = useParams();
  const storeKey = decodeURIComponent(key);
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search } = usePeriod();
  const detail = useStoreDetail(household.id, storeKey, period);
  const d = detail.data;
  const name = d ? storeLabel(d.name) : t("sp.fallbackName");
  const peak = d ? d.weekdays.indexOf(Math.max(...d.weekdays)) : -1;
  const peakName = peak >= 0 ? formatDateTime(new Date(Date.UTC(2024, 0, 1 + peak, 12)), { weekday: "long" }) : "";

  return (
    <div className="stack">
      <ScreenHeader title={name} sub={t("an.storeSub")} onBack={() => navigate(-1)} />
      <div style={{ margin: "0 0 8px" }}>
        <PeriodChips />
      </div>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError || !d ? (
        <ErrorState error={readErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : (
        <div className={cx("stack g-16", detail.isPlaceholderData && "opacity-60")} style={{ padding: "0 16px" }}>
          <section className="card stack g-10" style={{ padding: 18 }}>
            <div className="row g-12">
              <StoreBadge name={name} size="lg" />
              <p className="an-sentence grow" style={{ margin: 0 }}>
                {d.receipts
                  ? t("an.storeDetailSentence", { store: name, count: d.receipts, amount: formatEuro(d.amount) }) +
                    (d.weekdays[peak] ? t("an.storePeak", { day: peakName }) : ".")
                  : t("an.storeNothing", { store: name })}
              </p>
            </div>
            <div className="row g-10 wrap" style={{ alignItems: "baseline" }}>
              <span className="an-big">{formatEuro(d.amount)}</span>
              <ChangeBadge now={d.amount} before={d.prev_amount} />
            </div>
            <span className="t-sm t-2 num">
              {tn("an.purchases", d.receipts)} · {t("an.avgPurchase", { amount: formatEuro(d.receipts ? d.amount / d.receipts : 0) })}
            </span>
          </section>

          {d.receipts > 0 && (
            <>
              {d.weekdays.some((n) => n > 0) && (
                <section className="card stack g-8" style={{ padding: "18px 18px 10px" }}>
                  <span className="t-h">{t("sp.weekdaysTitle")}</span>
                  <WeekdayBars wd={d.weekdays} />
                </section>
              )}

              {d.categories.length > 0 && (
                <section className="stack g-8">
                  <span className="section-title">{t("sp.buyHere")}</span>
                  <div className="cells">
                    {d.categories.slice(0, 6).map((c) => (
                      <ShareRow
                        key={c.id}
                        icon={<CatIcon id={c.id} size="sm" />}
                        title={categoryInfo(c.id).name}
                        value={formatEuro(c.amount)}
                        share={d.amount ? c.amount / d.amount : 0}
                        sub={t("an.shareHere", { pct: pct(d.amount ? c.amount / d.amount : 0) })}
                        onClick={() => navigate(`/analytics/category/${c.id}${search}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {d.products.length > 0 && (
                <section className="stack g-8">
                  <span className="section-title">{t("sp.topProducts")}</span>
                  <div className="cells">
                    {d.products.slice(0, 10).map((p) => (
                      <button
                        key={p.product_id ?? p.name}
                        type="button"
                        className="cell"
                        disabled={!p.product_id}
                        onClick={() => p.product_id && navigate(`/analytics/product/${p.product_id}${search}`)}
                      >
                        <span className="grow t-body fw-5 ellipsis">{p.name}</span>
                        <span className="t-sm t-2 num">{p.count}×</span>
                        <span className="t-sm fw-6 num">{formatEuro(p.amount)}</span>
                        <ChevronRight size={18} className="chev" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {d.receipt_list.length > 0 && (
                <section className="stack g-8">
                  <span className="section-title">{t("tab.receipts")}</span>
                  <div className="cells">
                    {d.receipt_list.slice(0, 12).map((r) => (
                      <button key={r.receipt_id} type="button" className="cell" onClick={() => navigate(`/receipts/${r.receipt_id}`)}>
                        <span className="grow stack g-2">
                          <span className="t-body fw-5">
                            {formatShortDate(r.date)}
                            {r.time ? ` · ${r.time.slice(0, 5)}` : ""}
                          </span>
                          {r.status === "NEEDS_REVIEW" && <span className="t-xs t-2">{t("sp.needsReview")}</span>}
                        </span>
                        <span className="t-body fw-6 num">{formatEuro(r.amount)}</span>
                        <ChevronRight size={18} className="chev" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
      <div className="tab-space" />
    </div>
  );
}
