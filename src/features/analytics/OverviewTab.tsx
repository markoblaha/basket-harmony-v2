import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, ChevronRight, Info, Loader2, Plus, Sparkles, Tag, Target, TrendingDown, TrendingUp } from "lucide-react";
import { CatIcon, Empty, StoreBadge } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { needsAttention, useReceipts } from "@/features/receipts/api";
import { readErrorMessage } from "@/features/receipts/format";
import { Receipt as ReceiptIcon } from "lucide-react";
import { formatEuro, formatNumber, t, tn } from "@/i18n";
import { useOverview, useProductNormalization, type Overview } from "./api";
import { AnalyticsTop, ChangeBadge, MonthBars, ShareRow, euro0, partialUntil, pct, toMonthBars } from "./akit";
import { BudgetSheet } from "./BudgetSheet";
import { categoryInfo, percent, storeLabel, unitLabel } from "./bits";
import { daysBetween, thisMonth, usePeriod, type Period } from "./period";
import { useAddToList } from "./useAddToList";

const MIX = [
  { id: "ovz", label: "an.mix.ovz", cats: ["produce"] },
  { id: "mlie", label: "an.mix.mlie", cats: ["dairy_eggs"] },
  { id: "maso", label: "an.mix.maso", cats: ["meat_fish"] },
  { id: "ude", label: "an.mix.ude", cats: ["deli_chilled"] },
  { id: "obil", label: "an.mix.obil", cats: ["bakery", "breakfast"] },
  { id: "slad", label: "an.mix.slad", cats: ["snacks_sweets"] },
  { id: "alk", label: "an.mix.alk", cats: ["alcohol"] },
  { id: "ost", label: "an.mix.ost", cats: ["pantry", "frozen", "groceries", "beverages"] },
] as const;
const MIX_COLORS = ["var(--mix-1)", "var(--mix-2)", "var(--mix-3)", "var(--mix-4)", "var(--mix-5)", "var(--mix-6)", "var(--mix-7)", "var(--mix-8)"];

function basketMix(cats: Overview["categories"], prev: boolean) {
  const totals = MIX.map((g) => cats.filter((c) => (g.cats as readonly string[]).includes(c.id)).reduce((a, c) => a + Math.max(0, prev ? c.prev_amount : c.amount), 0));
  const total = totals.reduce((a, b) => a + b, 0);
  return { total, shares: totals.map((v) => (total ? v / total : 0)) };
}

/**
 * A1 – Prehľad (prototyp): na vybavenie, veta o výdavkoch s veľkou sumou,
 * rozpočet, na čo a kde, čo sa zmenilo, ceny a čo dochádza, zloženie nákupu
 * potravín a stĺpce po mesiacoch.
 */
export function OverviewTab() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { period, search, setCustom } = usePeriod();
  const overview = useOverview(household.id, period);
  const normalize = useProductNormalization(household.id, overview.data?.unnormalized);
  const lists = useLists(household.id);
  const receipts = useReceipts(household.id);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const missing = (lists.data ?? []).filter((l) => l.completed_at && l.receipt_state === "LATER").length;
  const review = (receipts.data ?? []).filter(needsAttention).length;
  const todo = missing + review;

  const o = overview.data;
  return (
    <div className="stack">
      <AnalyticsTop part="overview" />
      {overview.isPending ? (
        <Spinner />
      ) : overview.isError || !o ? (
        <ErrorState error={readErrorMessage(overview.error)} onRetry={() => overview.refetch()} />
      ) : (
        <div className={cx("stack g-16", overview.isPlaceholderData && "opacity-60")} style={{ padding: "8px 16px 0" }}>
          {todo > 0 && (
            <button type="button" className="an-review" onClick={() => navigate("/receipts")}>
              <AlertTriangle size={20} />
              <span className="grow stack g-2">
                <span className="t-h">
                  {t("an.todo")}: <span className="num">{todo}</span>
                </span>
                <span className="t-sm" style={{ opacity: 0.85 }}>
                  {[missing && tn("ls.missingReceipts", missing), review && tn("an.toReview", review)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight size={18} />
            </button>
          )}
          <Normalization normalize={normalize} />

          {o.receipts === 0 && o.total === 0 ? (
            <div className="card">
              <Empty icon={ReceiptIcon} title={t("ov.emptyTitle")} text={t("ov.emptyText")} action={<button type="button" className="btn btn-soft" onClick={() => navigate("/receipts")}>{t("ov.goReceipts")}</button>} />
            </div>
          ) : (
            <>
              <Hero o={o} period={period} />
              {period.range === "month" && <Budget o={o} period={period} onEdit={() => setBudgetOpen(true)} />}
              <TopCategories o={o} onAll={() => navigate(`/analytics/categories${search}`)} onPick={(id) => navigate(`/analytics/category/${id}${search}`)} />
              <TopStores o={o} onAll={() => navigate(`/analytics/stores${search}`)} onPick={(k) => navigate(`/analytics/store/${encodeURIComponent(k)}${search}`)} />
              <Changes o={o} onPick={(id) => navigate(`/analytics/category/${id}${search}`)} />
              <Prices o={o} onPick={(id) => navigate(`/analytics/product/${id}${search}`)} />
              <Mix o={o} />
            </>
          )}

          {o.months.length > 0 && (
            <section className="card stack g-8" style={{ padding: "18px 18px 10px" }}>
              <div className="row between">
                <span className="t-h">{t("an.byMonth")}</span>
                <span className="t-xs t-3">{o.months.some((m) => m.month === thisMonth()) ? partialUntil() : ""}</span>
              </div>
              <MonthBars
                data={toMonthBars(o.months)}
                onPick={(d) => {
                  const [y, m] = d.key.split("-").map(Number) as [number, number];
                  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
                  setCustom(`${d.key}-01`, `${d.key}-${String(last).padStart(2, "0")}`);
                }}
              />
            </section>
          )}

          {o.receipts > 0 && (
            <section className="card" style={{ padding: 18 }}>
              <div className="grid grid-cols-2 gap-4">
                <Stat label={t("ov.statDays")} value={String(o.days)} />
                <Stat label={t("ov.statItems")} value={String(o.items)} />
                <Stat label={t("ov.statSaved")} value={formatEuro(o.discounts)} hint={t("ov.statSavedHint")} />
                <Stat label={t("ov.statDeposits")} value={formatEuro(o.deposits)} hint={t("ov.statDepositsHint")} />
              </div>
            </section>
          )}
          <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} overview={o} />
        </div>
      )}
      <div className="tab-space" />
    </div>
  );
}

function Normalization({ normalize }: { normalize: ReturnType<typeof useProductNormalization> }) {
  if (normalize.running)
    return (
      <div className="ls-hint">
        <Loader2 size={16} className="spin" />
        <span className="grow">
          <b>{t("ov.normRunning")}</b> {normalize.remaining ? t("ov.normRemaining", { n: normalize.remaining }) : ""}
          {t("ov.normNote")}
        </span>
      </div>
    );
  if (normalize.error)
    return (
      <div className="ls-hint" style={{ background: "var(--yellow-soft)" }}>
        <AlertTriangle size={16} color="var(--yellow)" />
        <span className="grow">
          <b>{t("ov.normFailed")}</b>{" "}
          {normalize.error instanceof Error && normalize.error.message === "GEMINI_402" ? t("ov.normCredit") : t("ov.normNumbersOk")}
        </span>
        <button type="button" className="btn btn-sm btn-line" onClick={() => void normalize.retry()}>
          {t("common.retry")}
        </button>
      </div>
    );
  return null;
}

function Hero({ o, period }: { o: Overview; period: Period }) {
  const comparable = period.current && o.prev_to_date !== null;
  const before = comparable ? o.prev_to_date! : o.prev_total;
  const days = daysBetween(period.from, period.to) + 1;
  const elapsed = o.offset_days !== null ? o.offset_days + 1 : days;
  const projection = period.current && period.range === "month" && elapsed >= 5 ? (o.total / elapsed) * days : null;
  const avg = o.receipts > 0 ? o.total / o.receipts : 0;
  const topCat = [...o.categories].filter((c) => !c.id.startsWith("_")).sort((a, b) => b.amount - a.amount)[0];
  const topStore = [...o.stores].filter((s) => s.key !== "_none").sort((a, b) => b.receipts - a.receipts)[0];

  // Veta ako v prototype: „Tento mesiac ste zatiaľ minuli…“, „Minulý mesiac…“, inak podľa obdobia.
  const amount = formatEuro(o.total);
  let s =
    period.preset === "month"
      ? t("an.sentence.month", { amount })
      : period.preset === "last"
        ? t("an.sentence.last", { amount })
        : period.preset === "custom"
          ? t("an.sentence.custom", { amount })
          : t("an.sentence.spent", { period: period.label, amount });
  if (before > 0) {
    const p = Math.round(((o.total - before) / before) * 100);
    const prev =
      period.range === "month" && comparable
        ? t("an.sentence.prevMonthSame")
        : period.range === "month"
          ? t("an.sentence.prevMonth")
          : t("an.sentence.prevPeriod");
    s += p === 0 ? t("an.sentence.same", { prev }) : t(p < 0 ? "an.sentence.less" : "an.sentence.more", { pct: Math.abs(p), prev });
  }
  s += ".";
  if (topCat) {
    s += ` ${t("an.sentence.top", { cat: categoryInfo(topCat.id).name, amount: euro0(topCat.amount) })}`;
    if (topStore) s += t("an.sentence.store", { store: storeLabel(topStore.name) });
    s += ".";
  }

  return (
    <section className="card stack g-12 anim-rise" style={{ padding: 18 }}>
      <p className="an-sentence" style={{ margin: 0 }}>
        {s}
      </p>
      <div className="row g-10 wrap" style={{ alignItems: "baseline" }}>
        <span className="an-big">{formatEuro(o.total)}</span>
        <ChangeBadge now={o.total} before={before} />
      </div>
      <span className="t-sm t-2 num">
        {tn("an.purchases", o.receipts)} · {t("an.avg", { amount: formatEuro(avg) })}
        {projection !== null ? ` · ${t("an.pace", { amount: formatEuro(projection) })}` : ""}
      </span>
    </section>
  );
}

function Budget({ o, period, onEdit }: { o: Overview; period: Period; onEdit: () => void }) {
  const total = o.budgets.find((b) => b.category_id === null);
  const cats = o.budgets.filter((b) => b.category_id !== null);
  if (!o.budgets.length)
    return (
      <button type="button" className="card row g-12" style={{ padding: 16, textAlign: "left" }} onClick={onEdit}>
        <span className="cat-ic">
          <Target size={18} />
        </span>
        <span className="grow stack g-2">
          <span className="t-h">{t("ov.budgetSet")}</span>
          <span className="t-sm t-2">{t("ov.budgetSetText")}</span>
        </span>
        <ChevronRight size={18} className="chev" />
      </button>
    );
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate() + 1;
  const bar = (label: string, spent: number, amount: number, big: boolean) => {
    const left = amount - spent;
    return (
      <div key={label} className="stack g-6">
        <div className="row between g-8">
          <span className={big ? "t-h" : "t-sm fw-5"}>{label}</span>
          <span className="t-sm t-2 num">{t("an.budgetOf", { spent: formatEuro(spent), amount: formatEuro(amount) })}</span>
        </div>
        <div className="bar" style={{ height: big ? 10 : 6 }}>
          <span style={{ width: `${Math.min(100, (spent / amount) * 100)}%`, background: left < 0 ? "var(--red)" : spent / amount > 0.85 ? "var(--orange)" : "var(--accent)" }} />
        </div>
        {big && (
          <span className="t-sm t-2 num">
            {left < 0
              ? t("ov.over", { amount: formatEuro(-left) })
              : period.current
                ? tn("ov.leftDays", daysLeft, { amount: formatEuro(left), perDay: formatEuro(left / daysLeft) })
                : t("ov.left", { amount: formatEuro(left) })}
          </span>
        )}
      </div>
    );
  };
  return (
    <section className="card stack g-12" style={{ padding: 18 }}>
      <div className="row between">
        <span className="t-h">{t("ov.budget")}</span>
        <button type="button" className="link t-sm" style={{ minHeight: 32 }} onClick={onEdit}>
          {t("ov.editBudget")}
        </button>
      </div>
      {total && bar(t("ov.budgetTotal"), total.spent, total.amount, true)}
      {cats.map((b) => bar(categoryInfo(b.category_id!).name, b.spent, b.amount, false))}
    </section>
  );
}

function TopCategories({ o, onAll, onPick }: { o: Overview; onAll: () => void; onPick: (id: string) => void }) {
  const cats = o.categories.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const sum = cats.reduce((a, c) => a + c.amount, 0) || 1;
  return (
    <section className="stack g-8">
      <div className="section-head">
        <span className="section-title">{t("an.onWhat")}</span>
        <button type="button" className="link t-sm" onClick={onAll} style={{ minHeight: 32 }}>
          {t("an.allCategories")}
        </button>
      </div>
      <div className="cells">
        {cats.slice(0, 5).map((c) => (
          <ShareRow
            key={c.id}
            icon={<CatIcon id={c.id} size="sm" />}
            title={categoryInfo(c.id).name}
            value={formatEuro(c.amount)}
            share={c.amount / sum}
            sub={t("an.shareOfSpend", { pct: pct(c.amount / sum) })}
            onClick={() => onPick(c.id)}
          />
        ))}
        {!cats.length && <div className="cell t-2">{t("an.noPurchases")}</div>}
      </div>
      {o.uncategorized > 0 && (
        <button type="button" className="row g-6 t-sm t-2" style={{ padding: "0 4px", textAlign: "left" }} onClick={() => onPick("other")}>
          <AlertTriangle size={15} color="var(--yellow)" />
          <span>
            {tn("ov.uncategorized", o.uncategorized)} <span className="link">{t("ov.sortThem")}</span>
          </span>
        </button>
      )}
    </section>
  );
}

function TopStores({ o, onAll, onPick }: { o: Overview; onAll: () => void; onPick: (key: string) => void }) {
  const stores = o.stores.filter((s) => s.amount > 0);
  if (!stores.length) return null;
  const sum = stores.reduce((a, s) => a + s.amount, 0) || 1;
  return (
    <section className="stack g-8">
      <div className="section-head">
        <span className="section-title">{t("an.where")}</span>
        <button type="button" className="link t-sm" onClick={onAll} style={{ minHeight: 32 }}>
          {t("an.allStores")}
        </button>
      </div>
      <div className="cells">
        {stores.slice(0, 3).map((s) => (
          <ShareRow
            key={s.key}
            icon={<StoreBadge name={storeLabel(s.name)} size="sm" />}
            title={storeLabel(s.name)}
            value={formatEuro(s.amount)}
            share={s.amount / sum}
            sub={`${pct(s.amount / sum)} · ${tn("an.purchases", s.receipts)} · ${t("an.avg", { amount: formatEuro(s.receipts ? s.amount / s.receipts : 0) })}`}
            onClick={() => onPick(s.key)}
          />
        ))}
      </div>
    </section>
  );
}

function Changes({ o, onPick }: { o: Overview; onPick: (id: string) => void }) {
  const ch = o.categories
    .filter((c) => !c.id.startsWith("_") && c.prev_amount > 0 && Math.abs(c.amount - c.prev_amount) >= 5)
    .map((c) => ({ ...c, diff: c.amount - c.prev_amount }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);
  if (!ch.length) return null;
  return (
    <section className="stack g-8">
      <span className="section-title">{t("an.changed")}</span>
      <div className="cells">
        {ch.map((c) => (
          <button key={c.id} type="button" className="cell" onClick={() => onPick(c.id)}>
            <span className="cat-ic sm" style={{ color: c.diff > 0 ? "var(--orange)" : "var(--accent-text)" }}>
              {c.diff > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
            <span className="grow stack g-2">
              <span className="t-body fw-5">
                {categoryInfo(c.id).name}{" "}
                <span className="num">
                  {c.diff > 0 ? "+" : "−"}
                  {euro0(Math.abs(c.diff))}
                </span>
              </span>
              <span className="t-xs t-2 num">
                {euro0(c.prev_amount)} → {euro0(c.amount)}
              </span>
            </span>
            <ChevronRight size={18} className="chev" />
          </button>
        ))}
      </div>
    </section>
  );
}

function Prices({ o, onPick }: { o: Overview; onPick: (id: string) => void }) {
  const { addToList, pending } = useAddToList();
  if (!o.price_changes.length && !o.restock.length) return null;
  return (
    <>
      {o.price_changes.length > 0 && (
        <section className="stack g-8">
          <span className="section-title">{t("ov.pricesTitle")}</span>
          <div className="cells">
            {o.price_changes.slice(0, 5).map((c) => {
              const up = c.change > 0;
              const promo = c.kind === "PROMO";
              return (
                <button key={c.product_id} type="button" className="cell" onClick={() => onPick(c.product_id)}>
                  <span className="cat-ic sm" style={{ color: promo ? "var(--accent-text)" : up ? "var(--orange)" : "var(--accent-text)" }}>
                    {promo ? <Tag size={15} /> : up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </span>
                  <span className="grow stack g-2" style={{ minWidth: 0 }}>
                    <span className="t-body fw-5 ellipsis">{c.name}</span>
                    <span className="t-xs t-2 num ellipsis">
                      {promo
                        ? t("ov.promoLine", { store: storeLabel(c.store_name), price: formatEuro(c.new_price), old: formatEuro(c.old_price), unit: unitLabel(c.basis) })
                        : t("ov.changeLine", { store: storeLabel(c.store_name), old: formatEuro(c.old_price), new: formatEuro(c.new_price), unit: unitLabel(c.basis) })}
                    </span>
                  </span>
                  <span className={cx("badge num", promo ? "b-green" : up ? "b-orange" : "b-green")}>{promo ? t("ov.promoTag") : percent(c.change)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {o.restock.length > 0 && (
        <section className="stack g-8">
          <span className="section-title row g-6">
            <Sparkles size={14} /> {t("ov.runningLow")}
          </span>
          <div className="cells">
            {o.restock.slice(0, 4).map((r) => (
              <div key={r.product_id} className="cell">
                <button type="button" className="row g-12 grow" style={{ minWidth: 0, textAlign: "left" }} onClick={() => onPick(r.product_id)}>
                  <CatIcon id={r.category_id} size="sm" />
                  <span className="grow stack g-2" style={{ minWidth: 0 }}>
                    <span className="t-body fw-5 ellipsis">{r.name}</span>
                    <span className="t-xs t-2 ellipsis">{tn("ov.restockLine", r.days_since, { interval: Math.round(r.interval_days) })}</span>
                  </span>
                </button>
                <button type="button" className="ibtn soft sm" aria-label={t("ov.addToListAria", { name: r.name })} disabled={pending} onClick={() => void addToList(r.name, r.category_id)}>
                  <Plus size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Mix({ o }: { o: Overview }) {
  const now = basketMix(o.categories, false);
  const before = basketMix(o.categories, true);
  if (now.total <= 0) return null;
  return (
    <section className="card stack g-12" style={{ padding: 18 }}>
      <div className="stack g-2">
        <span className="t-h">{t("an.mixTitle")}</span>
        <span className="t-xs t-2">{t("an.mixSub")}</span>
      </div>
      <div className="an-stack" role="img" aria-label={MIX.map((g, i) => `${t(g.label)} ${pct(now.shares[i]!)}`).join(", ")}>
        {MIX.map((g, i) => (now.shares[i]! > 0 ? <span key={g.id} style={{ width: `${now.shares[i]! * 100}%`, background: MIX_COLORS[i] }} /> : null))}
      </div>
      <div className="stack g-6">
        {MIX.map((g, i) => {
          const d = Math.round((now.shares[i]! - before.shares[i]!) * 100);
          return (
            <div key={g.id} className="row g-8 t-sm">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: MIX_COLORS[i], flex: "none" }} />
              <span className="grow">{t(g.label)}</span>
              <span className="num fw-6">{pct(now.shares[i]!)}</span>
              <span className="num t-2" style={{ width: 66, textAlign: "right" }}>
                {before.total ? (d === 0 ? t("an.noChange") : `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d))} b.`) : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <span className="row g-6 t-xs t-3" style={{ alignItems: "flex-start" }}>
        <Info size={13} style={{ flex: "none", marginTop: 2 }} />
        {t("an.mixNote")}
      </span>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stack g-2">
      <span className="t-xs t-2">{label}</span>
      <span className="t-title num">{value}</span>
      {hint && <span className="t-xs t-3">{hint}</span>}
    </div>
  );
}
