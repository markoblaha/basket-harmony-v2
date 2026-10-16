import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Merge, Search } from "lucide-react";
import { Button, ErrorState, Group, Section, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { normalizeName } from "@/lib/categories";
import { formatMoney, formatShortDate, readErrorMessage } from "@/features/receipts/format";
import { t, tn, type Key } from "@/i18n";
import { useMergeProducts, useProducts, type ProductSummary } from "./api";
import { Card, CategoryBadge, categoryInfo, percent, sizeLabel, storeLabel, unitLabel } from "./bits";
import { usePeriod } from "./period";

type Sort = "frequent" | "spent" | "change" | "recent";
const SORTS: { id: Sort; label: Key }[] = [
  { id: "frequent", label: "pt.sort.frequent" },
  { id: "spent", label: "pt.sort.spent" },
  { id: "change", label: "pt.sort.change" },
  { id: "recent", label: "pt.sort.recent" },
];
const PAGE = 60;

/** Katalóg produktov: všetko, čo ste kedy kúpili, s poslednou cenou a zmenou ceny. */
export function ProductsTab() {
  const { household } = useHousehold();
  const { search } = usePeriod();
  const products = useProducts(household.id);
  const merge = useMergeProducts();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("frequent");
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const list = useMemo(() => {
    const needle = normalizeName(query);
    const filtered = (products.data ?? []).filter(
      (p) => !needle || normalizeName(`${p.name} ${p.brand ?? ""} ${p.last_store}`).includes(needle),
    );
    const by: Record<Sort, (a: ProductSummary, b: ProductSummary) => number> = {
      frequent: (a, b) => b.purchases - a.purchases || b.last_date.localeCompare(a.last_date),
      spent: (a, b) => b.spent - a.spent,
      change: (a, b) =>
        Number(a.price_kind === "PROMO") - Number(b.price_kind === "PROMO") || Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0),
      recent: (a, b) => b.last_date.localeCompare(a.last_date),
    };
    const sorted = [...filtered].sort(by[sort]);
    return sort === "change" ? sorted.filter((p) => p.change !== null && Math.abs(p.change) >= 0.01) : sorted;
  }, [products.data, query, sort]);

  async function doMerge() {
    const [target, ...sources] = picked;
    const names = (products.data ?? []).filter((p) => picked.includes(p.id)).map((p) => p.name);
    if (!target || sources.length === 0) return;
    if (!window.confirm(tn("pt.mergeConfirm", picked.length, { name: names[0] ?? "" }))) return;
    try {
      await merge.mutateAsync({ target, sources });
      toast.show(t("pt.merged"), "success");
      setSelecting(false);
      setPicked([]);
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  if (products.isPending) return <Spinner />;
  if (products.isError) return <ErrorState error={readErrorMessage(products.error)} onRetry={() => products.refetch()} />;
  const all = products.data;

  return (
    <div className="mt-3 flex flex-col gap-3 pb-24">
      <Section>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={t("pt.searchPlaceholder")}
            aria-label={t("pt.searchAria")}
            className="min-h-12 w-full rounded-[var(--radius-control)] border border-transparent bg-sunken pl-10 pr-4 text-base outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-3 focus:border-primary focus:bg-elevated focus:ring-3 focus:ring-primary/20"
          />
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("pt.sortAria")}>
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cx(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-strong transition-colors duration-[120ms]",
                sort === s.id ? "bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text-2 active:bg-pressed",
              )}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 px-1 text-sm text-text-2">
          <span>
            {list.length !== all.length ? tn("pt.countOf", list.length, { total: all.length }) : tn("pt.count", list.length)}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelecting((v) => !v);
              setPicked([]);
            }}
            className="font-semibold text-primary"
          >
            {selecting ? t("pt.cancelSelect") : t("pt.mergeSame")}
          </button>
        </div>
        {selecting && (
          <p className="mt-1 px-1 text-xs text-text-3">
            {t("pt.mergeHint")}
          </p>
        )}
      </Section>

      {all.length === 0 ? (
        <Section>
          <Card className="py-8 text-center text-text-2">{t("pt.empty")}</Card>
        </Section>
      ) : list.length === 0 ? (
        <p className="px-6 py-8 text-center text-text-2">
          {sort === "change" && !query ? t("pt.noCompare") : t("pt.nothingFound")}
        </p>
      ) : (
        <Section>
          <Group>
            {list.slice(0, limit).map((p) => (
              <ProductRow
                key={p.id}
                p={p}
                search={search}
                sort={sort}
                selecting={selecting}
                order={picked.indexOf(p.id)}
                onToggle={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
              />
            ))}
          </Group>
          {list.length > limit && (
            <Button variant="secondary" block className="mt-2" onClick={() => setLimit(limit + PAGE)}>
              {t("pt.more", { n: list.length - limit })}
            </Button>
          )}
        </Section>
      )}

      {selecting && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
          <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-3">
            <Button block size="lg" className="shadow-raised" disabled={picked.length < 2} loading={merge.isPending} onClick={doMerge}>
              <Merge className="size-5" aria-hidden /> {picked.length < 2 ? t("pt.pickTwo") : tn("pt.mergeN", picked.length)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  p,
  search,
  sort,
  selecting,
  order,
  onToggle,
}: {
  p: ProductSummary;
  search: string;
  sort: Sort;
  selecting: boolean;
  order: number;
  onToggle: () => void;
}) {
  const info = categoryInfo(p.category_id);
  const meta = [p.brand, sizeLabel(p.size_value, p.size_unit)].filter(Boolean).join(" · ");
  const body = (
    <>
      <CategoryBadge id={info.id} color={info.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-strong">{p.name}</p>
        <p className="truncate text-xs text-text-3">
          {meta ? `${meta} · ` : ""}
          {t("pt.rowLine", { count: p.purchases, date: formatShortDate(p.last_date), store: storeLabel(p.last_store) })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        {sort === "spent" ? (
          <>
            <span className="font-semibold tabular-nums">{formatMoney(p.spent)}</span>
            <span className="text-xs text-text-3">{t("pt.spentTotal", { n: p.purchases })}</span>
          </>
        ) : (
          <span className="font-semibold tabular-nums">{formatMoney(p.last_price)}</span>
        )}
        {sort === "spent" ? null : p.price_kind === "PROMO" && p.change !== null ? (
          <span className="text-xs font-semibold text-success">{t("pt.promoUsual", { price: formatMoney(p.usual_price) })}</span>
        ) : p.change !== null && Math.abs(p.change) >= 0.01 ? (
          <span className={cx("text-xs font-semibold tabular-nums", p.change > 0 ? "text-warning" : "text-success")}>
            {p.change > 0 ? "▲" : "▼"} {percent(p.change)}
          </span>
        ) : p.unit_price !== null && (p.basis !== "ks" || (p.size_value ?? 1) > 1) ? (
          <span className="text-xs tabular-nums text-text-3">
            {formatMoney(p.unit_price)} {unitLabel(p.basis)}
          </span>
        ) : null}
      </div>
    </>
  );
  if (selecting) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={order >= 0}
        className={cx("flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed", order >= 0 && "bg-primary-soft")}
      >
        {body}
        <span
          aria-hidden
          className={cx(
            "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
            order >= 0 ? "border-primary bg-primary text-on-primary" : "border-line-strong/60 text-transparent",
          )}
        >
          {order >= 0 ? order + 1 : "·"}
        </span>
      </button>
    );
  }
  return (
    <Link to={`/analytics/product/${p.id}${search}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pressed">
      {body}
      <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
