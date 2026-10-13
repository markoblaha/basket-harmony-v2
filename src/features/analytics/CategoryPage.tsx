import { Link, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { StoreAvatar } from "@/features/receipts/ReceiptRow";
import { formatMoney, formatShortDate, plural, readErrorMessage } from "@/features/receipts/format";
import { useCategoryDetail } from "./api";
import { BackHeader, PeriodBar } from "./AnalyticsLayout";
import { BarChart } from "./charts";
import { Card, Delta, EmojiBadge, SectionTitle, ShareRow, categoryInfo } from "./bits";
import { monthShort, usePeriod } from "./period";

/** Detail kategórie: vývoj, produkty, obchody a jednotlivé nákupy (s preklikom na bloček). */
export function CategoryPage() {
  const { id = "other" } = useParams();
  const { household } = useHousehold();
  const { period, search, setMonth, setRange } = usePeriod();
  const detail = useCategoryDetail(household.id, id, period);
  const info = categoryInfo(id);
  const pseudo = id.startsWith("_");

  return (
    <div className="pb-10">
      <BackHeader fallback={`/analytics${search}`} title="Prehľady" />
      <Section className="mt-1">
        <div className="flex items-center gap-3">
          <EmojiBadge emoji={info.emoji} color={info.color} />
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{info.name}</h1>
        </div>
        {info.hint && <p className="mt-2 text-sm text-text-2">{info.hint}</p>}
      </Section>
      <PeriodBar />

      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorState error={readErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : (
        <div className={cx("mt-2 flex flex-col gap-5", detail.isPlaceholderData && "opacity-60")}>
          <Section>
            <Card>
              <p className="text-sm text-text-2">{period.label}</p>
              <p className="text-3xl font-bold tabular-nums">{formatMoney(detail.data.amount)}</p>
              {detail.data.prev_amount > 0 && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-text-3">
                  <Delta now={detail.data.amount} before={detail.data.prev_amount} invert={id === "_receipt_discount"} />
                  {period.current ? `oproti rovnakému dňu (${period.prevLabel})` : `oproti obdobiu ${period.prevLabel}`}:{" "}
                  {formatMoney(detail.data.prev_amount)}
                </p>
              )}
              {detail.data.liters !== null && detail.data.liters > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-control)] bg-surface p-3">
                  <div>
                    <p className="text-xs text-text-3">Natankované</p>
                    <p className="text-lg font-semibold tabular-nums">{detail.data.liters.toLocaleString("sk-SK")} l</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-3">Priemerná cena</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {(detail.data.per_liter ?? 0).toLocaleString("sk-SK", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} € / l
                    </p>
                  </div>
                  <p className="col-span-2 text-xs text-text-3">Z bločkov z pumpy. Platby z výpisu litre neobsahujú.</p>
                </div>
              )}
              <div className="mt-4">
                <BarChart
                  label={`${info.name} po mesiacoch`}
                  height={110}
                  data={detail.data.months.map((m) => ({ key: m.month, label: monthShort(Number(m.month.slice(5))), value: Math.abs(m.amount) }))}
                  activeKey={period.range === "month" ? period.month : null}
                  onSelect={(key) => {
                    setRange("month");
                    setMonth(key);
                  }}
                />
              </div>
            </Card>
          </Section>

          {pseudo ? (
            <Section>
              <SectionTitle title="Doklady" />
              {detail.data.receipts.length === 0 ? (
                <p className="px-1 text-sm text-text-2">V tomto období nič.</p>
              ) : (
                <Group>
                  {detail.data.receipts.map((r) => (
                    <Link key={r.receipt_id} to={`/receipts/${r.receipt_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                      <StoreAvatar name={r.store} className="!size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.store}</p>
                        <p className="text-xs text-text-3">
                          {formatShortDate(r.date)} · doklad {formatMoney(r.total)}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                      <ChevronRight className="size-4 text-text-3" aria-hidden />
                    </Link>
                  ))}
                </Group>
              )}
              <p className="mt-2 px-1 text-xs text-text-3">Otvor doklad a doplň chýbajúce položky – rozdiel sa zmenší.</p>
            </Section>
          ) : (
            <>
              {detail.data.products.length > 0 && (
                <Section>
                  <SectionTitle title="Produkty" />
                  <Group>
                    {detail.data.products.map((p) => {
                      const top = detail.data.products[0]!.amount || 1;
                      return (
                        <ShareRow
                          key={p.product_id ?? p.name}
                          to={p.product_id ? `/analytics/product/${p.product_id}${search}` : "#"}
                          icon={null}
                          title={p.name ?? "Bez názvu"}
                          subtitle={`${p.count}× v tomto období`}
                          amount={p.amount}
                          share={p.amount / top}
                          color={info.color}
                        />
                      );
                    })}
                  </Group>
                </Section>
              )}

              {detail.data.stores.length > 0 && (
                <Section>
                  <SectionTitle title="Kde" />
                  <Group>
                    {detail.data.stores.map((s) => (
                      <ShareRow
                        key={s.key}
                        to={`/analytics/store/${encodeURIComponent(s.key)}${search}`}
                        icon={<StoreAvatar name={s.key === "_none" ? null : s.name} className="!size-10" />}
                        title={s.name}
                        subtitle={`${s.count} ${plural(s.count, ["položka", "položky", "položiek"])}`}
                        amount={s.amount}
                        share={s.amount / (detail.data.amount || 1)}
                        color={info.color}
                      />
                    ))}
                  </Group>
                </Section>
              )}

              {detail.data.receipts.length > 0 && (
                <Section>
                  <SectionTitle title="Platby bez bločku" />
                  <Group>
                    {detail.data.receipts.map((r) => (
                      <Link key={r.receipt_id} to={`/receipts/${r.receipt_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                        <StoreAvatar name={r.store} className="!size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{r.store}</p>
                          <p className="text-xs text-text-3">
                            {formatShortDate(r.date)} · {r.origin === "BANK" ? "z výpisu" : r.origin === "MANUAL" ? "zadané ručne" : "bez rozpisu položiek"}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                        <ChevronRight className="size-4 text-text-3" aria-hidden />
                      </Link>
                    ))}
                  </Group>
                </Section>
              )}

              {detail.data.items.length > 0 && (
                <Section>
                  <SectionTitle title="Nákupy" />
                  <Group>
                    {detail.data.items.map((it) => (
                      <Link
                        key={it.item_id}
                        to={it.product_id ? `/analytics/product/${it.product_id}${search}` : `/receipts/${it.receipt_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 active:bg-pressed"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{it.name}</p>
                          <p className="text-xs text-text-3">
                            {formatShortDate(it.date)} · {it.store}
                            {it.discount > 0 ? ` · zľava ${formatMoney(it.discount)}` : ""}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">{formatMoney(it.line_total)}</span>
                        <ChevronRight className="size-4 text-text-3" aria-hidden />
                      </Link>
                    ))}
                  </Group>
                  {id === "other" && (
                    <p className="mt-2 px-1 text-xs text-text-3">
                      Klepni na položku a v detaile produktu jej zmeň kategóriu („Upraviť“). Zmena platí pre všetky nákupy toho produktu, aj budúce.
                    </p>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
