import { useNavigate, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { ScreenHeader, StoreBadge } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { formatShortDate, readErrorMessage } from "@/features/receipts/format";
import { formatEuro, t, tn } from "@/i18n";
import { useKindDetail } from "./api";
import { ChangeBadge, MonthBars, PeriodChips, ShareRow, toMonthBars } from "./akit";
import { categoryInfo, perUnit, qtyLabel, sizeLabel, storeLabel, unitLabel } from "./bits";
import { usePeriod } from "./period";

/**
 * Detail druhu (Pivo, Kuracie prsia): koľko ste ho kúpili a za koľko, priemerná cena za kg/l/ks,
 * jednotlivé výrobky (značky a balenia), obchody od najlacnejšieho a nákupy z bločkov.
 */
export function KindPage() {
  const { key = "" } = useParams();
  const kindKey = decodeURIComponent(key);
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search, setCustom } = usePeriod();
  const detail = useKindDetail(household.id, kindKey, period);
  const d = detail.data;
  const info = d ? categoryInfo(d.category_id) : null;

  return (
    <div className="stack">
      <ScreenHeader title={d?.name ?? kindKey} sub={t("kd.sub")} onBack={() => navigate(-1)} />
      <div className="stack g-12" style={{ padding: "0 16px" }}>
        {info && (
          <nav className="an-crumbs" aria-label={t("an.crumbs")}>
            <button type="button" onClick={() => navigate(`/analytics/categories${search}`)}>
              {t("an.categories")}
            </button>
            <ChevronRight size={14} />
            <button type="button" onClick={() => navigate(`/analytics/category/${info.id}${search}`)}>
              {info.name}
            </button>
            <ChevronRight size={14} />
            <span>{d?.name}</span>
          </nav>
        )}
        <div style={{ margin: "0 -16px" }}>
          <PeriodChips />
        </div>
        {detail.isPending ? (
          <Spinner />
        ) : detail.isError || !d ? (
          <ErrorState error={readErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
        ) : (
          <div className={cx("stack g-12", detail.isPlaceholderData && "opacity-60")}>
            <section className="card stack g-10" style={{ padding: 18 }}>
              <p className="an-sentence" style={{ margin: 0 }}>
                {d.amount > 0
                  ? t("kd.sentence", { qty: qtyLabel(d.units, d.basis) ?? tn("kd.times", d.count), amount: formatEuro(d.amount) }) +
                    (d.avg_unit !== null ? t("kd.sentenceAvg", { price: perUnit(d.avg_unit, d.basis) ?? "" }) : ".")
                  : t("kd.nothing")}
              </p>
              <div className="row g-10" style={{ alignItems: "baseline" }}>
                <span className="an-big">{formatEuro(d.amount)}</span>
                <ChangeBadge now={d.amount} before={d.prev_amount} />
              </div>
              {d.amount > 0 && (
                <div className="row g-12" style={{ padding: 12, borderRadius: 12, background: "var(--sunken)" }}>
                  <span className="grow stack">
                    <span className="t-xs t-3">{t("kd.bought")}</span>
                    <span className="t-h num">{qtyLabel(d.units, d.basis) ?? tn("kd.times", d.count)}</span>
                  </span>
                  <span className="grow stack">
                    <span className="t-xs t-3">{t("kd.avg")}</span>
                    <span className="t-h num">{perUnit(d.avg_unit, d.basis) ?? "—"}</span>
                  </span>
                </div>
              )}
              {d.min_unit && d.max_unit && d.min_unit.price < d.max_unit.price && (
                <span className="t-sm t-2 num">
                  {t("kd.range", {
                    min: perUnit(d.min_unit.price, d.basis) ?? "",
                    minStore: storeLabel(d.min_unit.store),
                    max: perUnit(d.max_unit.price, d.basis) ?? "",
                    maxStore: storeLabel(d.max_unit.store),
                  })}
                </span>
              )}
              <MonthBars
                data={toMonthBars(d.months)}
                height={90}
                onPick={(m) => {
                  const [y, mm] = m.key.split("-").map(Number) as [number, number];
                  setCustom(`${m.key}-01`, `${m.key}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, "0")}`);
                }}
              />
            </section>

            {d.products.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{tn("kd.variants", d.products.length)}</span>
                <div className="cells">
                  {d.products.map((p) => {
                    // pri druhu na kusy (pivo) aj balenia v litroch ukážeme v kusoch
                    const qty = d.basis === "ks" && p.pieces ? qtyLabel(p.pieces, "ks") : qtyLabel(p.units, p.basis);
                    return (
                      <ShareRow
                        key={p.product_id}
                        title={[p.name, p.brand].filter(Boolean).join(" · ")}
                        value={formatEuro(p.amount)}
                        share={d.amount ? p.amount / d.amount : 0}
                        sub={[sizeLabel(p.size_value, p.size_unit), `${p.count}×`, qty, perUnit(p.avg_unit, p.basis), storeLabel(p.last_store)]
                          .filter(Boolean)
                          .join(" · ")}
                        onClick={() => navigate(`/analytics/product/${p.product_id}${search}`)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {d.stores.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{t("kd.stores", { unit: unitLabel(d.basis) })}</span>
                <div className="cells">
                  {d.stores.map((s, i) => (
                    <div key={`${s.key}-${s.name}`} className="cell">
                      <StoreBadge name={storeLabel(s.name)} size="sm" />
                      <span className="grow stack g-2" style={{ minWidth: 0 }}>
                        <span className="t-body fw-5 ellipsis">{storeLabel(s.name)}</span>
                        <span className="t-xs t-2 num">
                          {t("kd.storeSub", { n: s.count, amount: formatEuro(s.amount) })}
                        </span>
                      </span>
                      <span className="stack" style={{ alignItems: "flex-end" }}>
                        <span className="t-body fw-6 num">{perUnit(s.avg_unit, d.basis) ?? "—"}</span>
                        {i === 0 && d.stores.length > 1 && <span className="badge b-green">{t("kd.cheapest")}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {d.purchases.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{t("sp.purchases")}</span>
                <div className="cells">
                  {d.purchases.map((it) => (
                    <button key={it.item_id} type="button" className="cell" onClick={() => navigate(`/analytics/product/${it.product_id}${search}`)}>
                      <span className="grow stack g-2" style={{ minWidth: 0 }}>
                        <span className="t-body fw-5 ellipsis">{[it.name, it.brand, sizeLabel(it.size_value, it.size_unit)].filter(Boolean).join(" · ")}</span>
                        <span className="t-xs t-2 num ellipsis">
                          {formatShortDate(it.date)} · {storeLabel(it.store)}
                          {it.paid_unit !== null ? ` · ${perUnit(it.paid_unit, it.basis)}` : ""}
                          {it.discount > 0 ? ` · ${t("detail.discount", { amount: formatEuro(it.discount) })}` : ""}
                        </span>
                      </span>
                      <span className="t-body fw-6 num">{formatEuro(it.line_total)}</span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <div className="tab-space" />
    </div>
  );
}
