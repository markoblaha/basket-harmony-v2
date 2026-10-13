import { Link, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { StoreAvatar } from "@/features/receipts/ReceiptRow";
import { formatMoney, formatShortDate, plural, readErrorMessage } from "@/features/receipts/format";
import { useStoreDetail } from "./api";
import { BackHeader, PeriodBar } from "./AnalyticsLayout";
import { BarChart, ShareBar } from "./charts";
import { Card, Delta, EmojiBadge, SectionTitle, ShareRow, Stat, categoryInfo } from "./bits";
import { monthShort, usePeriod } from "./period";

const WEEKDAYS = ["po", "ut", "st", "št", "pi", "so", "ne"];

/** Detail obchodu: koľko, ako často, v ktoré dni, čo tam kupujete a zoznam nákupov. */
export function StorePage() {
  const { key = "_none" } = useParams();
  const storeKey = decodeURIComponent(key);
  const { household } = useHousehold();
  const { period, search, setMonth, setRange } = usePeriod();
  const detail = useStoreDetail(household.id, storeKey, period);
  const d = detail.data;

  return (
    <div className="pb-10">
      <BackHeader fallback={`/analytics/stores${search}`} title="Obchody" />
      <Section className="mt-1">
        <div className="flex items-center gap-3">
          <StoreAvatar name={storeKey === "_none" ? null : (d?.name ?? null)} className="!size-12" />
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{d?.name ?? "Obchod"}</h1>
        </div>
      </Section>
      <PeriodBar />

      {detail.isPending ? (
        <Spinner />
      ) : detail.isError || !d ? (
        <ErrorState error={readErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : (
        <div className={cx("mt-2 flex flex-col gap-5", detail.isPlaceholderData && "opacity-60")}>
          <Section>
            <Card>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Minuté" value={formatMoney(d.amount)} />
                <Stat label="Nákupy" value={d.receipts} />
                <Stat label="Priemerný nákup" value={formatMoney(d.receipts ? d.amount / d.receipts : 0)} />
              </div>
              {d.prev_amount > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-text-3">
                  <Delta now={d.amount} before={d.prev_amount} /> oproti obdobiu {period.prevLabel} ({d.prev_receipts}×)
                </p>
              )}
              <div className="mt-4">
                <BarChart
                  label={`${d.name} po mesiacoch`}
                  height={100}
                  data={d.months.map((m) => ({ key: m.month, label: monthShort(Number(m.month.slice(5))), value: m.amount }))}
                  activeKey={period.range === "month" ? period.month : null}
                  onSelect={(k) => {
                    setRange("month");
                    setMonth(k);
                  }}
                />
              </div>
            </Card>
          </Section>

          {d.weekdays.some((n) => n > 0) && (
            <Section>
              <SectionTitle title="V ktoré dni sem chodíte" />
              <Card>
                <BarChart
                  label="Nákupy podľa dňa v týždni (posledný rok)"
                  height={70}
                  data={d.weekdays.map((n, i) => ({ key: String(i), label: WEEKDAYS[i]!, value: n }))}
                  activeKey={String(d.weekdays.indexOf(Math.max(...d.weekdays)))}
                  formatValue={(v) => `${v} ${plural(v, ["nákup", "nákupy", "nákupov"])}`}
                />
              </Card>
            </Section>
          )}

          {d.categories.length > 0 && (
            <Section>
              <SectionTitle title="Čo tu kupujete" />
              <Card className="p-0">
                <div className="px-4 pb-1 pt-4">
                  <ShareBar
                    label="Kategórie v tomto obchode"
                    segments={d.categories.map((c) => ({ id: c.id, value: c.amount, color: categoryInfo(c.id).color }))}
                  />
                </div>
                <div className="divide-y divide-line">
                  {d.categories.slice(0, 6).map((c) => {
                    const info = categoryInfo(c.id);
                    return (
                      <ShareRow
                        key={c.id}
                        to={`/analytics/category/${c.id}${search}`}
                        icon={<EmojiBadge emoji={info.emoji} color={info.color} />}
                        title={info.name}
                        amount={c.amount}
                        share={c.amount / (d.categories[0]!.amount || 1)}
                        color={info.color}
                      />
                    );
                  })}
                </div>
              </Card>
            </Section>
          )}

          {d.products.length > 0 && (
            <Section>
              <SectionTitle title="Najčastejšie produkty" />
              <Group>
                {d.products.slice(0, 10).map((p) => (
                  <Link
                    key={p.product_id ?? p.name}
                    to={p.product_id ? `/analytics/product/${p.product_id}${search}` : "#"}
                    className="flex items-center gap-3 px-4 py-2.5 active:bg-pressed"
                  >
                    <p className="min-w-0 flex-1 truncate">{p.name}</p>
                    <span className="text-sm text-text-3">{p.count}×</span>
                    <span className="w-20 text-right font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                    <ChevronRight className="size-4 text-text-3" aria-hidden />
                  </Link>
                ))}
              </Group>
            </Section>
          )}

          {d.receipt_list.length > 0 && (
            <Section>
              <SectionTitle title="Nákupy" />
              <Group>
                {d.receipt_list.map((r) => (
                  <Link key={r.receipt_id} to={`/receipts/${r.receipt_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{formatShortDate(r.date)}</p>
                      <p className="text-xs text-text-3">
                        {r.time ? r.time.slice(0, 5) : ""}
                        {r.status === "NEEDS_REVIEW" ? `${r.time ? " · " : ""}čaká na kontrolu` : ""}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                    <ChevronRight className="size-4 text-text-3" aria-hidden />
                  </Link>
                ))}
              </Group>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
