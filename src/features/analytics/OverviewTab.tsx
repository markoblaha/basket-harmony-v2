import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, ChevronDown, Loader2, Plus, Receipt as ReceiptIcon, Sparkles, Tag, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Banner, Button, ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { StoreAvatar } from "@/features/receipts/ReceiptRow";
import { formatMoney, readErrorMessage } from "@/features/receipts/format";
import { t, tn } from "@/i18n";
import { useOverview, useProductNormalization, type Overview } from "./api";
import { BudgetSheet } from "./BudgetSheet";
import { BarChart, CumulativeChart, ShareBar } from "./charts";
import { Card, Delta, CategoryBadge, MoreLink, categoryColor, SectionTitle, ShareRow, Stat, categoryInfo, percent, storeLabel, unitLabel } from "./bits";
import { daysBetween, monthShort, todayIso, usePeriod, type Period } from "./period";
import { useAddToList } from "./useAddToList";
import { groupByArea } from "./areas";

const TOP_CATEGORIES = 6;

export function OverviewTab() {
  const { household } = useHousehold();
  const { period, search, setMonth, setRange } = usePeriod();
  const overview = useOverview(household.id, period);
  const normalize = useProductNormalization(household.id, overview.data?.unnormalized);

  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorState error={readErrorMessage(overview.error)} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const empty = o.receipts === 0 && o.total === 0;

  return (
    <div className={cx("mt-2 flex flex-col gap-6 transition-opacity", overview.isPlaceholderData && "opacity-60")}>
      <Notices o={o} normalize={normalize} />

      {empty ? (
        <Section>
          <Card className="py-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sunken text-text-2" aria-hidden>
              <ReceiptIcon className="size-6" />
            </span>
            <p className="mt-2 font-semibold">{t("ov.emptyTitle")}</p>
            <p className="mt-1 text-sm text-text-2">{t("ov.emptyText")}</p>
            <Link to="/receipts" className="mt-3 inline-block text-sm font-semibold text-primary">
              {t("ov.goReceipts")}
            </Link>
          </Card>
        </Section>
      ) : (
        <>
          <Hero o={o} period={period} />
          {period.range === "month" && <Budgets o={o} current={period.current} />}
          <Insights o={o} search={search} />
          <Categories o={o} search={search} period={period} />
          <Stores o={o} search={search} />
        </>
      )}

      <Section>
        <SectionTitle title={t("ov.last12")} />
        <Card>
          <BarChart
            label={t("ov.monthsChart")}
            data={o.months.map((m) => ({ key: m.month, label: monthShort(Number(m.month.slice(5))), value: m.amount }))}
            activeKey={period.range === "month" ? period.month : null}
            onSelect={(key) => {
              setRange("month");
              setMonth(key);
            }}
          />
          <p className="mt-2 text-center text-xs text-text-3">{t("ov.tapMonth")}</p>
        </Card>
      </Section>

      {!empty && (
        <Section>
          <SectionTitle title={t("ov.details")} />
          <Card className="grid grid-cols-2 gap-4">
            <Stat label={t("ov.statDays")} value={o.days} />
            <Stat label={t("ov.statItems")} value={o.items} />
            <Stat label={t("ov.statSaved")} value={formatMoney(o.discounts)} hint={t("ov.statSavedHint")} />
            <Stat label={t("ov.statDeposits")} value={formatMoney(o.deposits)} hint={t("ov.statDepositsHint")} />
          </Card>
        </Section>
      )}
    </div>
  );
}

function Notices({ o, normalize }: { o: Overview; normalize: ReturnType<typeof useProductNormalization> }) {
  const items = [];
  if (normalize.running) {
    items.push(
      <Banner key="norm" tone="info" title={t("ov.normRunning")}>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {normalize.remaining ? t("ov.normRemaining", { n: normalize.remaining }) : ""}{t("ov.normNote")}
        </span>
      </Banner>,
    );
  } else if (normalize.error) {
    items.push(
      <Banner
        key="norm-err"
        tone="warning"
        title={t("ov.normFailed")}
        action={
          <Button variant="secondary" onClick={() => void normalize.retry()}>
            {t("common.retry")}
          </Button>
        }
      >
        {normalize.error instanceof Error && normalize.error.message === "GEMINI_402"
          ? t("ov.normCredit")
          : t("ov.normNumbersOk")}
      </Banner>,
    );
  }
  if (o.pending_review > 0) {
    items.push(
      <Banner key="review" tone="warning" title={tn("ov.review", o.pending_review)}>
        {t("ov.reviewText")}{" "}
        <Link to="/receipts" className="font-semibold underline">
          {t("ov.reviewLink")}
        </Link>
      </Banner>,
    );
  }
  if (o.suspect_dates > 0) {
    items.push(
      <Banner key="dates" tone="info" title={tn("ov.dates", o.suspect_dates)}>
        {t("ov.datesText")}{" "}
        <Link to="/receipts" className="font-semibold underline">
          {t("ov.datesLink")}
        </Link>
      </Banner>,
    );
  }
  if (items.length === 0) return null;
  return <Section className="flex flex-col gap-2">{items}</Section>;
}

function Hero({ o, period }: { o: Overview; period: Period }) {
  const comparable = period.current && o.prev_to_date !== null;
  const before = comparable ? o.prev_to_date! : o.prev_total;
  const days = daysBetween(period.from, period.to) + 1;
  const elapsed = o.offset_days !== null ? o.offset_days + 1 : days;
  const projection = period.current && period.range === "month" && elapsed >= 5 ? (o.total / elapsed) * days : null;
  const avg = o.receipts > 0 ? o.total / o.receipts : 0;
  return (
    <Section>
      <Card>
        <p className="text-sm text-text-2">{period.scope === "everyday" ? t("ov.spentEveryday") : t("ov.spentAll")}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(o.total)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {before > 0 && <Delta now={o.total} before={before} />}
          {before > 0 && (
            <span className="text-sm text-text-3">
              {comparable ? t("ov.vsSameDay", { label: period.prevLabel }) : t("ov.vsPeriod", { label: period.prevLabel })}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-text-2">
          {tn("ov.purchases", o.receipts, { avg: formatMoney(avg) })}
        </p>
        {projection !== null && (
          <p className="mt-0.5 text-sm text-text-2">
            {t("ov.pace1")} <span className="font-semibold text-text">{formatMoney(projection)}</span> {t("ov.pace2")}
          </p>
        )}
        <div className="mt-4">
          <CumulativeChart
            from={period.from}
            to={period.to}
            prevFrom={period.prevFrom}
            daily={o.daily}
            prevDaily={o.prev_daily}
            untilToday={period.current ? todayIso() : null}
          />
          <div className="mt-1 flex justify-center gap-4 text-xs text-text-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-4 rounded-sm bg-primary" aria-hidden /> {t("ov.thisPeriod")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0 w-4 border-t-2 border-dashed border-text-3" aria-hidden /> {period.prevLabel}
            </span>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function Budgets({ o, current }: { o: Overview; current: boolean }) {
  const [open, setOpen] = useState(false);
  const total = o.budgets.find((b) => b.category_id === null);
  const cats = o.budgets.filter((b) => b.category_id !== null);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate() + 1;
  return (
    <Section>
      {o.budgets.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-[var(--radius-surface)] bg-surface p-4 text-left shadow-card active:bg-pressed"
        >
          <Target className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-strong">{t("ov.budgetSet")}</span>
            <span className="block text-sm text-text-2">{t("ov.budgetSetText")}</span>
          </span>
        </button>
      ) : (
        <>
          <SectionTitle
            title={t("ov.budget")}
            action={
              <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-primary">
                {t("ov.editBudget")}
              </button>
            }
          />
          <Card className="flex flex-col gap-4">
            {total && <BudgetBar label={t("ov.budgetTotal")} spent={total.spent} amount={total.amount} daysLeft={current ? daysLeft : undefined} big />}
            {cats.map((b) => {
              const info = categoryInfo(b.category_id!);
              return <BudgetBar key={b.category_id} label={info.name} spent={b.spent} amount={b.amount} />;
            })}
          </Card>
        </>
      )}
      <BudgetSheet open={open} onClose={() => setOpen(false)} overview={o} />
    </Section>
  );
}

function BudgetBar({ label, spent, amount, daysLeft, big }: { label: string; spent: number; amount: number; daysLeft?: number; big?: boolean }) {
  const ratio = spent / amount;
  const left = amount - spent;
  const tone = ratio >= 1 ? "bg-danger-solid" : ratio >= 0.85 ? "bg-warning-solid" : "bg-primary";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cx("truncate", big ? "font-semibold" : "text-sm font-medium")}>{label}</p>
        <p className="shrink-0 text-sm tabular-nums text-text-2">
          <span className="font-semibold text-text">{formatMoney(spent)}</span> {t("ov.of", { amount: formatMoney(amount) })}
        </p>
      </div>
      <div className={cx("mt-2 overflow-hidden rounded-full bg-sunken", big ? "h-3" : "h-2")}>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className={cx("mt-1 text-xs", left < 0 ? "font-semibold text-danger" : "text-text-3")}>
        {left < 0
          ? t("ov.over", { amount: formatMoney(-left) })
          : daysLeft
            ? tn("ov.leftDays", daysLeft, { amount: formatMoney(left), perDay: formatMoney(left / daysLeft) })
            : t("ov.left", { amount: formatMoney(left) })}
      </p>
    </div>
  );
}

function Insights({ o, search }: { o: Overview; search: string }) {
  const { addToList, pending } = useAddToList();
  if (o.price_changes.length === 0 && o.restock.length === 0) return null;
  return (
    <Section>
      <SectionTitle title={t("ov.pricesTitle")} />
      <div className="flex flex-col gap-3">
        {o.price_changes.length > 0 && (
          <Group>
            {o.price_changes.slice(0, 6).map((c) => {
              const up = c.change > 0;
              const promo = c.kind === "PROMO";
              return (
                <Link key={c.product_id} to={`/analytics/product/${c.product_id}${search}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      up ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
                    )}
                  >
                    {promo ? <Tag className="size-4" /> : up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-text-2">
                      {promo
                        ? t("ov.promoLine", { store: storeLabel(c.store_name), price: formatMoney(c.new_price), old: formatMoney(c.old_price), unit: unitLabel(c.basis) })
                        : t("ov.changeLine", { store: storeLabel(c.store_name), old: formatMoney(c.old_price), new: formatMoney(c.new_price), unit: unitLabel(c.basis) })}
                    </p>
                  </div>
                  <span className={cx("shrink-0 text-sm font-semibold tabular-nums", up ? "text-warning" : "text-success")}>
                    {promo ? t("ov.promoTag") : percent(c.change)}
                  </span>
                </Link>
              );
            })}
          </Group>
        )}
        {o.restock.length > 0 && (
          <Card className="p-0">
            <p className="flex items-center gap-2 px-4 pb-1 pt-4 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden /> {t("ov.runningLow")}
            </p>
            <div className="divide-y divide-line">
              {o.restock.slice(0, 4).map((r) => {
                const info = categoryInfo(r.category_id);
                return (
                  <div key={r.product_id} className="flex items-center gap-3 px-4 py-3">
                    <Link to={`/analytics/product/${r.product_id}${search}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <CategoryBadge id={info.id} color={info.color} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-text-3">
                          {tn("ov.restockLine", r.days_since, { interval: Math.round(r.interval_days) })}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={t("ov.addToListAria", { name: r.name })}
                      title={t("ov.addToList")}
                      disabled={pending}
                      onClick={() => void addToList(r.name, r.category_id)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary active:bg-pressed disabled:opacity-55"
                    >
                      <Plus className="size-5" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}

function Categories({ o, search, period }: { o: Overview; search: string; period: Period }) {
  const [params, setParams] = useSearchParams();
  const view = params.get("v") === "cat" ? "cat" : "area";
  const setView = (v: "cat" | "area") => {
    const next = new URLSearchParams(params);
    next.set("v", v);
    setParams(next, { replace: true });
  };
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = o.categories.filter((c) => c.amount !== 0);
  const positive = list.filter((c) => c.amount > 0);
  const areas = groupByArea(list);
  if (list.length === 0) return null;
  const compareNote = period.current ? t("ov.compareSameDay", { label: period.prevLabel }) : t("ov.comparePeriod", { label: period.prevLabel });
  const itemsText = (c: { id: string; items: number }) =>
    c.id.startsWith("_")
      ? t("ov.itemsDiff")
      : c.items > 0
        ? tn("shop.itemCount", c.items)
        : t("ov.noReceiptPayments");

  const categoryRow = (c: (typeof list)[number], top: number, nested = false) => {
    const info = categoryInfo(c.id);
    const share = o.total > 0 ? c.amount / o.total : 0;
    return (
      <ShareRow
        key={c.id}
        to={`/analytics/category/${c.id}${search}`}
        icon={nested ? <span className="w-2" /> : <CategoryBadge id={info.id} color={info.color} />}
        title={info.name}
        subtitle={t("ov.catLine", { share: t("fmt.percent", { value: Math.round(share * 100) }), text: itemsText(c) })}
        amount={c.amount}
        share={c.amount / top}
        color={info.color}
        prev={c.prev_amount}
      />
    );
  };

  const shown = all ? list : list.slice(0, TOP_CATEGORIES);
  const topCat = positive[0]?.amount ?? 1;
  const topArea = areas[0]?.amount || 1;

  return (
    <Section>
      <SectionTitle
        title={t("ov.whereMoney")}
        action={
          <div role="radiogroup" aria-label={t("ov.viewAria")} className="flex rounded-xl bg-sunken p-1">
            {(["area", "cat"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cx(
                  "min-h-11 rounded-lg px-3 text-footnote font-strong transition-colors duration-200",
                  view === v ? "bg-elevated text-text shadow-card" : "text-text-2",
                )}
              >
                {v === "area" ? t("ov.viewAreas") : t("ov.viewCategories")}
              </button>
            ))}
          </div>
        }
      />
      <Card className="p-0">
        <div className="px-4 pb-1 pt-4">
          <ShareBar
            label={t("ov.shareAria")}
            segments={
              view === "area"
                ? areas.filter((a) => a.amount > 0).map((a) => ({ id: a.area.id, value: a.amount, color: categoryColor(a.area.hue) }))
                : positive.map((c) => ({ id: c.id, value: c.amount, color: categoryInfo(c.id).color }))
            }
          />
          <p className="mt-2 text-xs text-text-3">{compareNote}</p>
        </div>
        <div className="divide-y divide-line">
          {view === "cat"
            ? shown.map((c) => categoryRow(c, topCat))
            : areas.map((a) => {
                const color = categoryColor(a.area.hue);
                const share = o.total > 0 ? a.amount / o.total : 0;
                const single = a.categories.length === 1 ? a.categories[0]! : null;
                const subtitle = t("ov.catLine", {
                  share: t("fmt.percent", { value: Math.round(share * 100) }),
                  text: `${a.categories
                    .slice(0, 3)
                    .map((c) => categoryInfo(c.id).name.toLowerCase())
                    .join(", ")}${a.categories.length > 3 ? "…" : ""}`,
                });
                if (single) {
                  return (
                    <ShareRow
                      key={a.area.id}
                      to={`/analytics/category/${single.id}${search}`}
                      icon={<CategoryBadge id={a.area.id} color={color} />}
                      title={a.area.name}
                      subtitle={subtitle}
                      amount={a.amount}
                      share={a.amount / topArea}
                      color={color}
                      prev={a.prev}
                    />
                  );
                }
                const isOpen = open === a.area.id;
                return (
                  <div key={a.area.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : a.area.id)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed"
                    >
                      <CategoryBadge id={a.area.id} color={color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate font-medium">{a.area.name}</p>
                          <p className="shrink-0 font-semibold tabular-nums">{formatMoney(a.amount)}</p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (a.amount / topArea) * 100))}%`, background: color }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-3">
                          <span className="truncate">{subtitle}</span>
                          <Delta now={a.amount} before={a.prev} className="!text-xs" compact />
                        </div>
                      </div>
                      <ChevronDown className={cx("size-4 shrink-0 text-text-3 transition-transform", isOpen && "rotate-180")} aria-hidden />
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-line border-t border-line bg-sunken/50">
                        {a.categories.sort((x, y) => y.amount - x.amount).map((c) => categoryRow(c, a.categories[0]!.amount || 1, true))}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
        {view === "cat" && list.length > TOP_CATEGORIES && (
          <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-3 text-sm font-semibold text-primary active:bg-pressed">
            {all ? t("ov.showLess") : t("ov.allCategories", { n: list.length })}
          </button>
        )}
      </Card>
      {o.uncategorized > 0 && (
        <Link to={`/analytics/category/other${search}`} className="mt-2 flex items-center gap-2 px-1 text-sm text-text-2">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            {tn("ov.uncategorized", o.uncategorized)}{" "}
            <span className="font-semibold text-primary">{t("ov.sortThem")}</span>
          </span>
        </Link>
      )}
    </Section>
  );
}

function Stores({ o, search }: { o: Overview; search: string }) {
  const top = o.stores[0]?.amount ?? 1;
  if (o.stores.length === 0) return null;
  return (
    <Section>
      <SectionTitle title={t("ov.whereShopped")} action={o.stores.length > 5 ? <MoreLink to={`/analytics/stores${search}`}>{t("ov.allStores")}</MoreLink> : undefined} />
      <Group>
        {o.stores.slice(0, 5).map((s) => (
          <ShareRow
            key={s.key}
            to={`/analytics/store/${encodeURIComponent(s.key)}${search}`}
            icon={<StoreAvatar name={s.key === "_none" ? null : s.name} className="!size-10" />}
            title={storeLabel(s.name)}
            subtitle={t("ov.storeLine", { count: s.receipts, avg: formatMoney(s.receipts ? s.amount / s.receipts : 0) })}
            amount={s.amount}
            share={s.amount / top}
            color={`var(--primary)`}
            prev={s.prev_amount}
          />
        ))}
      </Group>
    </Section>
  );
}
