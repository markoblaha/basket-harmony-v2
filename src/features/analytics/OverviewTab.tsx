import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { Banner, Button, ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { StoreAvatar } from "@/features/receipts/ReceiptRow";
import { formatMoney, plural, readErrorMessage } from "@/features/receipts/format";
import { useOverview, useProductNormalization, type Overview } from "./api";
import { BudgetSheet } from "./BudgetSheet";
import { BarChart, CumulativeChart, ShareBar } from "./charts";
import { Card, Delta, EmojiBadge, MoreLink, SectionTitle, ShareRow, Stat, categoryInfo, percent, unitLabel } from "./bits";
import { daysBetween, monthShort, todayIso, usePeriod, type Period } from "./period";
import { useAddToList } from "./useAddToList";

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
    <div className={cx("mt-2 flex flex-col gap-5 transition-opacity", overview.isPlaceholderData && "opacity-60")}>
      <Notices o={o} normalize={normalize} />

      {empty ? (
        <Section>
          <Card className="py-8 text-center">
            <p className="text-3xl" aria-hidden>
              🧾
            </p>
            <p className="mt-2 font-semibold">V tomto období nie sú žiadne doklady</p>
            <p className="mt-1 text-sm text-text-2">Prepni obdobie šípkami hore alebo pridaj bločky.</p>
            <Link to="/receipts" className="mt-3 inline-block text-sm font-semibold text-primary">
              Prejsť na bločky
            </Link>
          </Card>
        </Section>
      ) : (
        <>
          <Hero o={o} period={period} />
          {period.range === "month" && <Budgets o={o} current={period.current} />}
          <Insights o={o} search={search} />
          <Categories o={o} search={search} />
          <Stores o={o} search={search} />
        </>
      )}

      <Section>
        <SectionTitle title="Posledných 12 mesiacov" />
        <Card>
          <BarChart
            label="Výdavky po mesiacoch"
            data={o.months.map((m) => ({ key: m.month, label: monthShort(Number(m.month.slice(5))), value: m.amount }))}
            activeKey={period.range === "month" ? period.month : null}
            onSelect={(key) => {
              setRange("month");
              setMonth(key);
            }}
          />
          <p className="mt-2 text-center text-xs text-text-3">Klepni na mesiac a zobrazí sa jeho prehľad.</p>
        </Card>
      </Section>

      {!empty && (
        <Section>
          <SectionTitle title="Podrobnosti" />
          <Card className="grid grid-cols-2 gap-4">
            <Stat label="Dní s nákupom" value={o.days} />
            <Stat label="Položiek" value={o.items} />
            <Stat label="Ušetrené na zľavách" value={formatMoney(o.discounts)} hint="zľavy pri položkách" />
            <Stat label="Zálohy na obaly" value={formatMoney(o.deposits)} hint="nerátajú sa do výdavkov" />
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
      <Banner key="norm" tone="info" title="Zjednocujem produkty z bločkov…">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {normalize.remaining ? `Zostáva ${normalize.remaining}. ` : ""}Ceny a kategórie sa priebežne spresňujú.
        </span>
      </Banner>,
    );
  } else if (normalize.error) {
    items.push(
      <Banner
        key="norm-err"
        tone="warning"
        title="Produkty sa nepodarilo zjednotiť"
        action={
          <Button variant="secondary" onClick={() => void normalize.retry()}>
            Skúsiť znova
          </Button>
        }
      >
        {normalize.error instanceof Error && normalize.error.message === "GEMINI_402"
          ? "Na účte Gemini došiel kredit. Čísla sú správne, len porovnanie cien a kategórie budú presnejšie po zjednotení."
          : "Čísla sú správne, len porovnanie cien a kategórie budú presnejšie po zjednotení."}
      </Banner>,
    );
  }
  if (o.pending_review > 0) {
    items.push(
      <Banner key="review" tone="warning" title={`${o.pending_review} ${plural(o.pending_review, ["doklad čaká", "doklady čakajú", "dokladov čaká"])} na kontrolu`}>
        Rátajú sa už teraz, ale po kontrole sa čísla ešte môžu mierne zmeniť.{" "}
        <Link to="/receipts" className="font-semibold underline">
          Skontrolovať
        </Link>
      </Banner>,
    );
  }
  if (o.suspect_dates > 0) {
    items.push(
      <Banner key="dates" tone="info" title={`${o.suspect_dates} ${plural(o.suspect_dates, ["doklad má", "doklady majú", "dokladov má"])} podozrivý dátum`}>
        Kým dátum nepotvrdíš, nerátajú sa do žiadneho obdobia.{" "}
        <Link to="/receipts" className="font-semibold underline">
          Opraviť
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
        <p className="text-sm text-text-2">Minuté {period.scope === "everyday" ? "na potraviny a domácnosť" : "spolu"}</p>
        <p className="mt-0.5 text-4xl font-bold tracking-tight tabular-nums">{formatMoney(o.total)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {before > 0 && <Delta now={o.total} before={before} />}
          {before > 0 && (
            <span className="text-sm text-text-3">
              {comparable ? `oproti rovnakému dňu (${period.prevLabel})` : `oproti obdobiu ${period.prevLabel}`}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-text-2">
          {o.receipts} {plural(o.receipts, ["nákup", "nákupy", "nákupov"])} · priemerne {formatMoney(avg)}
        </p>
        {projection !== null && (
          <p className="mt-0.5 text-sm text-text-2">
            Pri tomto tempe približne <span className="font-semibold text-text">{formatMoney(projection)}</span> do konca mesiaca
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
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-primary" aria-hidden /> toto obdobie
            </span>
            <span className="inline-flex items-center gap-1.5">
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
          className="flex w-full items-center gap-3 rounded-[var(--radius-surface)] border-2 border-dashed border-line-strong/40 p-3.5 text-left active:bg-pressed"
        >
          <Target className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Nastaviť mesačný rozpočet</span>
            <span className="block text-sm text-text-2">Celkový alebo pre vybrané kategórie. Uvidíš, koľko ti zostáva.</span>
          </span>
        </button>
      ) : (
        <>
          <SectionTitle
            title="Rozpočet"
            action={
              <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-primary">
                Upraviť
              </button>
            }
          />
          <Card className="flex flex-col gap-4">
            {total && <BudgetBar label="Celkom" spent={total.spent} amount={total.amount} daysLeft={current ? daysLeft : undefined} big />}
            {cats.map((b) => {
              const info = categoryInfo(b.category_id!);
              return <BudgetBar key={b.category_id} label={`${info.emoji} ${info.name}`} spent={b.spent} amount={b.amount} />;
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
  const tone = ratio >= 1 ? "bg-danger" : ratio >= 0.85 ? "bg-warning" : "bg-success";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cx("truncate", big ? "font-semibold" : "text-sm font-medium")}>{label}</p>
        <p className="shrink-0 text-sm tabular-nums text-text-2">
          <span className="font-semibold text-text">{formatMoney(spent)}</span> z {formatMoney(amount)}
        </p>
      </div>
      <div className={cx("mt-1.5 overflow-hidden rounded-full bg-surface", big ? "h-3" : "h-2")}>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className={cx("mt-1 text-xs", left < 0 ? "font-semibold text-danger" : "text-text-3")}>
        {left < 0
          ? `Prekročené o ${formatMoney(-left)}`
          : `Zostáva ${formatMoney(left)}${daysLeft ? ` na ${daysLeft} ${plural(daysLeft, ["deň", "dni", "dní"])} (${formatMoney(left / daysLeft)} na deň)` : ""}`}
      </p>
    </div>
  );
}

function Insights({ o, search }: { o: Overview; search: string }) {
  const { addToList, pending } = useAddToList();
  if (o.price_changes.length === 0 && o.restock.length === 0) return null;
  return (
    <Section>
      <SectionTitle title="Čo sa zmenilo" />
      <div className="flex flex-col gap-3">
        {o.price_changes.length > 0 && (
          <Group>
            {o.price_changes.slice(0, 5).map((c) => {
              const up = c.change > 0;
              return (
                <Link key={c.product_id} to={`/analytics/product/${c.product_id}${search}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      up ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
                    )}
                  >
                    {up ? "▲" : "▼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-text-2">
                      {c.store_name} · {formatMoney(c.old_price)} → {formatMoney(c.new_price)} {unitLabel(c.basis)}
                    </p>
                  </div>
                  <span className={cx("shrink-0 text-sm font-semibold tabular-nums", up ? "text-warning" : "text-success")}>{percent(c.change)}</span>
                </Link>
              );
            })}
          </Group>
        )}
        {o.restock.length > 0 && (
          <Card className="p-0">
            <p className="flex items-center gap-2 px-4 pb-1 pt-3 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden /> Možno ti dochádza
            </p>
            <div className="divide-y divide-line">
              {o.restock.slice(0, 4).map((r) => {
                const info = categoryInfo(r.category_id);
                return (
                  <div key={r.product_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Link to={`/analytics/product/${r.product_id}${search}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <EmojiBadge emoji={info.emoji} color={info.color} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-text-3">
                          každých ~{Math.round(r.interval_days)} dní · pred {r.days_since} {plural(r.days_since, ["dňom", "dňami", "dňami"])}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Pridať ${r.name} do zoznamu`}
                      title="Pridať do zoznamu"
                      disabled={pending}
                      onClick={() => void addToList(r.name, r.category_id)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary active:bg-pressed disabled:opacity-55"
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

function Categories({ o, search }: { o: Overview; search: string }) {
  const [all, setAll] = useState(false);
  const list = o.categories.filter((c) => c.amount !== 0);
  const positive = list.filter((c) => c.amount > 0);
  const top = positive[0]?.amount ?? 1;
  const shown = all ? list : list.slice(0, TOP_CATEGORIES);
  if (list.length === 0) return null;
  return (
    <Section>
      <SectionTitle title="Na čo išli peniaze" />
      <Card className="p-0">
        <div className="px-4 pb-1 pt-4">
          <ShareBar
            label="Podiel kategórií na výdavkoch"
            segments={positive.map((c) => ({ id: c.id, value: c.amount, color: categoryInfo(c.id).color }))}
          />
        </div>
        <div className="divide-y divide-line">
          {shown.map((c) => {
            const info = categoryInfo(c.id);
            const share = o.total > 0 ? c.amount / o.total : 0;
            return (
              <ShareRow
                key={c.id}
                to={`/analytics/category/${c.id}${search}`}
                icon={<EmojiBadge emoji={info.emoji} color={info.color} />}
                title={info.name}
                subtitle={
                  c.id.startsWith("_")
                    ? "rozdiel medzi sumou dokladov a položkami"
                    : `${Math.round(share * 100)} % · ${c.items} ${plural(c.items, ["položka", "položky", "položiek"])}`
                }
                amount={c.amount}
                share={c.amount / top}
                color={info.color}
                prev={c.prev_amount}
              />
            );
          })}
        </div>
        {list.length > TOP_CATEGORIES && (
          <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-3 text-sm font-semibold text-primary active:bg-pressed">
            {all ? "Zobraziť menej" : `Všetky kategórie (${list.length})`}
          </button>
        )}
      </Card>
      {o.uncategorized > 0 && (
        <Link to={`/analytics/category/other${search}`} className="mt-2 flex items-center gap-2 px-1 text-sm text-text-2">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
          <span>
            {o.uncategorized} {plural(o.uncategorized, ["položka je", "položky sú", "položiek je"])} v kategórii Ostatné –{" "}
            <span className="font-semibold text-primary">zaradiť</span>
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
      <SectionTitle title="Kde ste nakupovali" action={o.stores.length > 5 ? <MoreLink to={`/analytics/stores${search}`}>Všetky</MoreLink> : undefined} />
      <Group>
        {o.stores.slice(0, 5).map((s) => (
          <ShareRow
            key={s.key}
            to={`/analytics/store/${encodeURIComponent(s.key)}${search}`}
            icon={<StoreAvatar name={s.key === "_none" ? null : s.name} className="!size-10" />}
            title={s.name}
            subtitle={`${s.receipts}× · priemer ${formatMoney(s.receipts ? s.amount / s.receipts : 0)}`}
            amount={s.amount}
            share={s.amount / top}
            color={`var(--color-primary)`}
            prev={s.prev_amount}
          />
        ))}
      </Group>
    </Section>
  );
}
