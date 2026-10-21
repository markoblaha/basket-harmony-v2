import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { ScreenHeader, Seg, StoreBadge } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { formatShortDate, readErrorMessage } from "@/features/receipts/format";
import { formatEuro, formatNumber, t, tn } from "@/i18n";
import { useCategoryDetail } from "./api";
import { ChangeBadge, MonthBars, PeriodChips, ShareRow, euro0, pct, toMonthBars } from "./akit";
import { categoryInfo, storeLabel } from "./bits";
import { usePeriod } from "./period";

/**
 * A2 – kategória (úroveň 2–3 prototypu): veta, suma so zmenou, stĺpce po mesiacoch,
 * produkty (zoradenie Najviac € / Najčastejšie), obchody a jednotlivé nákupy.
 */
export function CategoryPage() {
  const { id = "other" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search, setCustom } = usePeriod();
  const detail = useCategoryDetail(household.id, id, period);
  const info = categoryInfo(id);
  const pseudo = id.startsWith("_");
  const [sort, setSort] = useState<"total" | "count">("total");
  const d = detail.data;
  const products = d ? [...d.products].sort((a, b) => (sort === "count" ? b.count - a.count : b.amount - a.amount)) : [];

  return (
    <div className="stack">
      <ScreenHeader title={info.name} sub={t("an.categorySub")} onBack={() => navigate(-1)} />
      <div className="stack g-12" style={{ padding: "0 16px" }}>
        <nav className="an-crumbs" aria-label={t("an.crumbs")}>
          <button type="button" onClick={() => navigate(`/analytics/categories${search}`)}>
            {t("an.categories")}
          </button>
          <ChevronRight size={14} />
          <span>{info.name}</span>
        </nav>
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
                  ? t("an.catDetailSentence", { name: info.name, amount: formatEuro(d.amount) }) +
                    (products[0]?.name ? t("an.catDetailTop", { name: products[0].name, amount: euro0(products[0].amount) }) : ".")
                  : t("an.catNothing")}
              </p>
              {info.hint && <span className="t-sm t-2">{info.hint}</span>}
              <div className="row g-10" style={{ alignItems: "baseline" }}>
                <span className="an-big">{formatEuro(d.amount)}</span>
                <ChangeBadge now={d.amount} before={d.prev_amount} invert={id === "_receipt_discount"} />
              </div>
              {d.liters !== null && d.liters > 0 && (
                <div className="row g-12" style={{ padding: 12, borderRadius: 12, background: "var(--sunken)" }}>
                  <span className="grow stack">
                    <span className="t-xs t-3">{t("cp.fueled")}</span>
                    <span className="t-h num">{formatNumber(d.liters)} l</span>
                  </span>
                  <span className="grow stack">
                    <span className="t-xs t-3">{t("cp.avgPrice")}</span>
                    <span className="t-h num">{formatNumber(d.per_liter ?? 0, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} € / l</span>
                  </span>
                </div>
              )}
              <MonthBars
                data={toMonthBars(d.months.map((m) => ({ month: m.month, amount: Math.abs(m.amount) })))}
                height={90}
                onPick={(m) => {
                  const [y, mm] = m.key.split("-").map(Number) as [number, number];
                  setCustom(`${m.key}-01`, `${m.key}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, "0")}`);
                }}
              />
            </section>

            {!pseudo && products.length > 0 && (
              <section className="stack g-8">
                <div className="row between g-8">
                  <span className="section-title">{tn("an.productsCount", products.length)}</span>
                  <Seg
                    value={sort}
                    onChange={setSort}
                    style={{ width: 210 }}
                    options={[
                      { value: "total", label: t("an.sortTotal") },
                      { value: "count", label: t("an.sortCount") },
                    ]}
                  />
                </div>
                <div className="cells">
                  {products.map((p) => (
                    <ShareRow
                      key={p.product_id ?? p.name}
                      title={p.name ?? t("cp.untitled")}
                      value={formatEuro(p.amount)}
                      share={d.amount ? p.amount / d.amount : 0}
                      sub={`${pct(d.amount ? p.amount / d.amount : 0)} · ${t("cp.countInPeriod", { n: p.count })}`}
                      onClick={p.product_id ? () => navigate(`/analytics/product/${p.product_id}${search}`) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {!pseudo && d.stores.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{t("cp.where")}</span>
                <div className="cells">
                  {d.stores.map((s) => (
                    <ShareRow
                      key={s.key}
                      icon={<StoreBadge name={storeLabel(s.name)} size="sm" />}
                      title={storeLabel(s.name)}
                      value={formatEuro(s.amount)}
                      share={d.amount ? s.amount / d.amount : 0}
                      sub={tn("shop.itemCount", s.count)}
                      onClick={() => navigate(`/analytics/store/${encodeURIComponent(s.key)}${search}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {d.receipts.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{pseudo ? t("cp.receipts") : t("cp.noReceiptPayments")}</span>
                <div className="cells">
                  {d.receipts.map((r) => (
                    <button key={r.receipt_id} type="button" className="cell" onClick={() => navigate(`/receipts/${r.receipt_id}`)}>
                      <StoreBadge name={storeLabel(r.store)} size="sm" />
                      <span className="grow stack g-2" style={{ minWidth: 0 }}>
                        <span className="t-body fw-5 ellipsis">{storeLabel(r.store)}</span>
                        <span className="t-xs t-2 num">
                          {formatShortDate(r.date)} ·{" "}
                          {r.origin === "BANK" ? t("cp.originBank") : r.origin === "MANUAL" ? t("cp.originManual") : t("cp.originNoItems")}
                        </span>
                      </span>
                      <span className="t-body fw-6 num">{formatEuro(r.amount)}</span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  ))}
                </div>
                {pseudo && (
                  <span className="t-xs t-3" style={{ padding: "0 4px" }}>
                    {t("cp.fillHint")}
                  </span>
                )}
              </section>
            )}

            {!pseudo && d.items.length > 0 && (
              <section className="stack g-8">
                <span className="section-title">{t("sp.purchases")}</span>
                <div className="cells">
                  {d.items.map((it) => (
                    <button
                      key={it.item_id}
                      type="button"
                      className="cell"
                      onClick={() => navigate(it.product_id ? `/analytics/product/${it.product_id}${search}` : `/receipts/${it.receipt_id}`)}
                    >
                      <span className="grow stack g-2" style={{ minWidth: 0 }}>
                        <span className="t-body fw-5 ellipsis">{it.name}</span>
                        <span className="t-xs t-2 num ellipsis">
                          {formatShortDate(it.date)} · {storeLabel(it.store)}
                          {it.discount > 0 ? ` · ${t("detail.discount", { amount: formatEuro(it.discount) })}` : ""}
                        </span>
                      </span>
                      <span className="t-body fw-6 num">{formatEuro(it.line_total)}</span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  ))}
                </div>
                {id === "other" && (
                  <span className="t-xs t-3" style={{ padding: "0 4px" }}>
                    {t("cp.otherHint")}
                  </span>
                )}
              </section>
            )}
          </div>
        )}
      </div>
      <div className="tab-space" />
    </div>
  );
}

