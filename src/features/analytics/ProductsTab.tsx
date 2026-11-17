import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Search, X } from "lucide-react";
import { CatIcon, Empty, ScreenHeader } from "@/components/kit";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { normalizeName } from "@/lib/categories";
import { formatShortDate, readErrorMessage } from "@/features/receipts/format";
import { formatEuro, t, type Key } from "@/i18n";
import { useProducts, type ProductSummary } from "./api";
import { categoryInfo, percent, storeLabel } from "./bits";
import { usePeriod } from "./period";

type Sort = "frequent" | "spent" | "change" | "recent";
const SORTS: { id: Sort; label: Key }[] = [
  { id: "frequent", label: "pt.sort.frequent" },
  { id: "spent", label: "pt.sort.spent" },
  { id: "change", label: "pt.sort.change" },
  { id: "recent", label: "pt.sort.recent" },
];
const PAGE = 80;

/** AS – hľadanie produktu v histórii nákupov (prototyp), so zoradením. */
export function ProductsTab() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const { search } = usePeriod();
  const products = useProducts(household.id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("frequent");
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    const needle = normalizeName(query);
    const filtered = (products.data ?? []).filter(
      (p) => !needle || normalizeName(`${p.name} ${p.brand ?? ""} ${p.last_store} ${categoryInfo(p.category_id).name}`).includes(needle),
    );
    const by: Record<Sort, (a: ProductSummary, b: ProductSummary) => number> = {
      frequent: (a, b) => b.purchases - a.purchases || b.last_date.localeCompare(a.last_date),
      spent: (a, b) => b.spent - a.spent,
      change: (a, b) => Number(a.price_kind === "PROMO") - Number(b.price_kind === "PROMO") || Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0),
      recent: (a, b) => b.last_date.localeCompare(a.last_date),
    };
    const sorted = [...filtered].sort(by[sort]);
    return sort === "change" ? sorted.filter((p) => p.change !== null && Math.abs(p.change) >= 0.01) : sorted;
  }, [products.data, query, sort]);

  return (
    <div className="stack">
      <ScreenHeader title={t("an.searchProduct")} onBack={() => navigate(-1)} />
      <div className="px stack g-10" style={{ paddingBottom: 10 }}>
        <div className="row g-8 input" style={{ paddingRight: 6 }}>
          <Search size={18} color="var(--text-3)" />
          <input
            autoFocus
            className="grow"
            style={{ minHeight: 46, fontSize: 16 }}
            placeholder={t("an.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("an.searchProduct")}
          />
          {query && (
            <button type="button" className="ibtn sm" onClick={() => setQuery("")} aria-label={t("an.clear")}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="chips" role="radiogroup" aria-label={t("pt.sortAria")}>
          {SORTS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} className={cx("chip", sort === s.id && "on")} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="px">
        {products.isPending ? (
          <Spinner />
        ) : products.isError ? (
          <ErrorState error={readErrorMessage(products.error)} onRetry={() => products.refetch()} />
        ) : list.length ? (
          <div className="cells">
            {list.slice(0, limit).map((p) => (
              <button key={p.id} type="button" className="cell" onClick={() => navigate(`/analytics/product/${p.id}${search}`)}>
                <CatIcon id={p.category_id} size="sm" />
                <span className="grow stack" style={{ minWidth: 0 }}>
                  <span className="t-body fw-5 ellipsis">{p.name}</span>
                  <span className="t-xs t-2 num ellipsis">
                    {t("an.productLine", { n: p.purchases, price: formatEuro(p.last_price), store: storeLabel(p.last_store), date: formatShortDate(p.last_date) })}
                  </span>
                </span>
                {p.change !== null && Math.abs(p.change) >= 0.01 && (
                  <span className={cx("badge num", p.price_kind === "PROMO" ? "b-green" : p.change > 0 ? "b-orange" : "b-green")}>
                    {p.price_kind === "PROMO" ? t("ov.promoTag") : percent(p.change)}
                  </span>
                )}
                <ChevronRight size={18} className="chev" />
              </button>
            ))}
          </div>
        ) : (
          <Empty icon={Search} title={t("an.nothingFound")} text={t("an.nothingFoundText")} />
        )}
        {list.length > limit && (
          <button type="button" className="btn btn-soft btn-block" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>
            {t("an.showMore")}
          </button>
        )}
      </div>
      <div className="tab-space" />
    </div>
  );
}
