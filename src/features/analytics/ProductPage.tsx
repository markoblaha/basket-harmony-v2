import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronRight, Merge, Pencil, Plus, Search, X } from "lucide-react";
import { CatIcon, ScreenHeader, StoreBadge, storeHue } from "@/components/kit";
import { useAddItem, useLists } from "@/features/lists/api";
import { dayLabel, listDay } from "@/features/lists/dates";
import { errorMessage } from "@/lib/errors";
import { Button, ErrorState, Sheet, Spinner, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { CATEGORIES, normalizeName } from "@/lib/categories";
import { formatMoney, formatShortDate, parseAmount, readErrorMessage } from "@/features/receipts/format";
import { formatEuro, formatNumber, t, tn } from "@/i18n";
import { unitLabel as pieceUnit } from "@/lib/parseItem";
import { useMergeProducts, useProduct, useProducts, useUpdateProduct, type ProductDetail } from "./api";
import { categoryInfo, sizeLabel, storeLabel, unitLabel } from "./bits";
import { usePeriod } from "./period";

/** Graf jednotkovej ceny v čase (prototyp) – bodky podľa obchodu, akcia ako dutý krúžok. */
function PriceDots({ points, unit }: { points: { key: string; date: string; v: number; store: string; promo: boolean }[]; unit: string }) {
  if (points.length < 2) return null;
  const pts = points.map((p) => ({ ...p, tm: Date.parse(p.date + "T00:00:00") })).sort((a, b) => a.tm - b.tm);
  const W = 320;
  const H = 150;
  const L = 44;
  const B = 24;
  const minT = pts[0]!.tm;
  const maxT = pts[pts.length - 1]!.tm;
  let minV = Math.min(...pts.map((p) => p.v));
  let maxV = Math.max(...pts.map((p) => p.v));
  if (maxV - minV < 0.05) {
    minV -= 0.1;
    maxV += 0.1;
  }
  const pad = (maxV - minV) * 0.15;
  minV -= pad;
  maxV += pad;
  const x = (tm: number) => L + ((tm - minT) / Math.max(1, maxT - minT)) * (W - L - 10);
  const y = (v: number) => 8 + (1 - (v - minV) / (maxV - minV)) * (H - B - 8);
  const ticks = [minV + pad, (minV + maxV) / 2, maxV - pad];
  const regular = pts.filter((p) => !p.promo);
  const path = regular.map((p, i) => `${i ? "L" : "M"}${x(p.tm).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const stores = [...new Set(pts.map((p) => p.store))];
  return (
    <div className="stack g-8">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("pp.priceTitle")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} style={{ stroke: "var(--line)", strokeWidth: 1 }} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
              {formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
        {path && <path d={path} style={{ fill: "none", stroke: "var(--line-2)", strokeWidth: 1.5 }} />}
        {pts.map((p) => (
          <circle key={p.key} cx={x(p.tm)} cy={y(p.v)} r={p.promo ? 4.5 : 4} className={cx("an-pt", p.promo && "promo")} style={{ "--h": storeHue(p.store) } as CSSProperties} />
        ))}
        <text x={L} y={H - 4} style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
          {formatShortDate(pts[0]!.date)}
        </text>
        <text x={W - 4} y={H - 4} textAnchor="end" style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
          {formatShortDate(pts[pts.length - 1]!.date)}
        </text>
      </svg>
      <div className="row wrap g-12 t-xs t-2">
        {unit && <span>{unit}</span>}
        {stores.map((st) => (
          <span key={st} className="row g-4">
            <span className="an-dot" style={{ "--h": storeHue(st) } as CSSProperties} />
            {storeLabel(st)}
          </span>
        ))}
        {pts.some((p) => p.promo) && (
          <span className="row g-4">
            <span className="an-dot" style={{ background: "transparent", boxShadow: "inset 0 0 0 2px var(--text-3)" }} />
            {t("pp.promoLegend")}
          </span>
        )}
      </div>
    </div>
  );
}

/** A3 – detail produktu (prototyp): veta, cena v čase, porovnanie obchodov, nákupy, pridať do zoznamu. */
export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useProduct(id);
  const { household } = useHousehold();
  const lists = useLists(household.id);
  const add = useAddItem();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [pick, setPick] = useState(false);

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const d = query.data;
  const p = d.product;
  const info = categoryInfo(p.category_id);
  const size = sizeLabel(p.size_value, p.size_unit);
  const last = d.purchases[0];
  const basis = last?.basis ?? "ks";
  const showUnit = basis !== "ks" || (p.size_value ?? 1) > 1;
  const unit = showUnit ? unitLabel(basis) : t("an.perPiece");
  const total = d.purchases.reduce((a, x) => a + x.line_total, 0);
  const cheapest = d.stores[0];
  const open = (lists.data ?? []).filter((l) => !l.completed_at);
  const points = d.purchases
    .filter((x) => x.basis === basis)
    .map((x) => ({
      key: x.item_id,
      date: x.date,
      v: showUnit && x.shelf_unit !== null ? x.shelf_unit : x.line_total / Math.max(1, x.quantity),
      store: x.store,
      promo: x.discount > 0,
    }));
  const sentence =
    (d.interval_days !== null ? tn("an.cadence", Math.round(d.interval_days)) : t("an.boughtTimes", { n: d.purchases.length })) +
    (d.stores.length > 1 && cheapest ? t("an.cheapestAt", { store: storeLabel(cheapest.name), price: formatEuro(cheapest.avg_unit), unit }) : ".");

  async function addTo(listId: string, listName: string) {
    setPick(false);
    try {
      const res = await add.mutateAsync({ listId, name: p.name, categoryId: p.category_id });
      toast.show(res.kind === "REQUEST" ? t("addtolist.request") : t("addtolist.added", { name: listName }), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="stack">
      <ScreenHeader title={p.name} sub={[info.name, size].filter(Boolean).join(" · ")} onBack={() => navigate(-1)} />
      <div className="stack g-16" style={{ padding: "0 16px" }}>
        <section className="card stack g-10" style={{ padding: 18 }}>
          <div className="row g-12">
            <CatIcon id={p.category_id} />
            <span className="grow stack">
              <span className="t-h">{p.name}</span>
              <span className="t-sm t-2">{[p.brand, size ? t("an.pack", { size }) : null].filter(Boolean).join(" · ") || info.name}</span>
            </span>
          </div>
          <p className="an-sentence" style={{ margin: 0 }}>
            {sentence}
          </p>
          <div className="row g-8 wrap">
            <span className="badge b-gray">{tn("an.purchases", d.purchases.length)}</span>
            <span className="badge b-gray num">{t("an.totalSpent", { amount: formatEuro(total) })}</span>
            {last && <span className="badge b-gray">{t("an.lastOn", { day: dayLabel(last.date) })}</span>}
          </div>
        </section>

        <section className="card stack g-10" style={{ padding: 18 }}>
          <span className="t-h">{t("an.priceOverTime")}</span>
          {points.length >= 2 ? <PriceDots points={points} unit={unit} /> : <span className="t-sm t-2">{t("an.needTwo")}</span>}
        </section>

        {d.stores.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{t("an.compareStores", { unit })}</span>
            <div className="cells">
              {d.stores.map((st, i) => (
                <div key={st.key} className="cell">
                  <StoreBadge name={storeLabel(st.name)} size="sm" />
                  <span className="grow stack">
                    <span className="t-body fw-5">{storeLabel(st.name)}</span>
                    <span className="t-xs t-2">{t("an.boughtN", { n: st.count })}</span>
                  </span>
                  {i === 0 && d.stores.length > 1 && <span className="badge b-green">{t("pp.cheapestTag")}</span>}
                  <span className="t-body fw-6 num">{formatEuro(st.avg_unit)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="stack g-8">
          <span className="section-title">{t("sp.purchases")}</span>
          <div className="cells">
            {d.purchases.slice(0, 20).map((x) => (
              <button key={x.item_id} type="button" className="cell" onClick={() => navigate(`/receipts/${x.receipt_id}`)}>
                <StoreBadge name={storeLabel(x.store)} size="sm" />
                <span className="grow stack">
                  <span className="t-body fw-5">
                    {storeLabel(x.store)} · {dayLabel(x.date)}
                  </span>
                  <span className="t-xs t-2 num">
                    {formatNumber(x.quantity)} ×{" "}
                    {showUnit && x.shelf_unit !== null ? `${formatEuro(x.shelf_unit)} ${unitLabel(x.basis)}` : formatEuro(x.line_total / Math.max(1, x.quantity))}
                    {x.discount > 0 ? ` · ${t("ov.promoTag")}` : ""}
                  </span>
                </span>
                <span className="t-body fw-6 num">{formatEuro(x.line_total)}</span>
                <ChevronRight size={18} className="chev" />
              </button>
            ))}
          </div>
        </section>

        {d.aliases.length > 0 && (
          <section className="stack g-6">
            <span className="section-title">{t("pp.aliases")}</span>
            <span className="t-sm t-2" style={{ padding: "0 4px" }}>
              {d.aliases.join(" · ")}
            </span>
          </section>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setMerging(true)}>
          <Merge size={16} /> {t("pp.merge")}
        </button>

        {pick && (
          <section className="card stack g-8 anim-rise" style={{ padding: 14 }}>
            <div className="row between">
              <span className="t-h">{t("an.whichList")}</span>
              <button type="button" className="ibtn sm" onClick={() => setPick(false)} aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
            {open.length ? (
              open.map((l) => (
                <button key={l.id} type="button" className="cell" style={{ padding: "8px 4px" }} onClick={() => void addTo(l.id, l.name)}>
                  <StoreBadge name={l.name} size="sm" />
                  <span className="grow t-body fw-5">
                    {l.name} · {listDay(l)}
                  </span>
                  <Plus size={18} />
                </button>
              ))
            ) : (
              <span className="t-sm t-2">{t("addtolist.noList")}</span>
            )}
          </section>
        )}
      </div>
      <div style={{ height: 180 }} />
      <div className="bottom-cta fixed inset-x-0 mx-auto max-w-2xl row g-8" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <button type="button" className="btn btn-soft" onClick={() => setEditing(true)} aria-label={t("pp.edit")}>
          <Pencil size={17} />
          {t("pp.edit")}
        </button>
        <button type="button" className="btn btn-ink grow" onClick={() => setPick(true)}>
          <Plus size={18} />
          {t("pp.toList")}
        </button>
      </div>

      {editing && <EditProductSheet d={d} onClose={() => setEditing(false)} />}
      {merging && <MergeProductSheet d={d} onClose={() => setMerging(false)} />}
    </div>
  );
}

function EditProductSheet({ d, onClose }: { d: ProductDetail; onClose: () => void }) {
  const p = d.product;
  const update = useUpdateProduct(p.id);
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [brand, setBrand] = useState(p.brand ?? "");
  // Veľkosť zobrazujeme v bežných jednotkách: 1000 ml = 1 l.
  const initialUnit = p.size_unit === "g" && (p.size_value ?? 0) >= 1000 ? "kg" : p.size_unit === "ml" && (p.size_value ?? 0) >= 1000 ? "l" : (p.size_unit ?? "");
  const initialValue =
    p.size_value == null ? "" : initialUnit === "kg" || initialUnit === "l" ? String(p.size_value / 1000) : String(p.size_value);
  const [size, setSize] = useState(initialValue.replace(".", ","));
  const [unit, setUnit] = useState<string>(initialUnit);
  const [categoryId, setCategoryId] = useState(p.category_id);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("pp.nameRequired"));
    let sizeValue: number | null = null;
    let sizeUnit: "g" | "ml" | "ks" | null = null;
    if (size.trim() !== "" || unit) {
      const n = parseAmount(size);
      if (n === null || n <= 0 || !unit) return setError(t("pp.packInvalid"));
      sizeValue = unit === "kg" || unit === "l" ? n * 1000 : n;
      sizeUnit = unit === "kg" ? "g" : unit === "l" ? "ml" : (unit as "g" | "ml" | "ks");
    }
    setError(null);
    try {
      await update.mutateAsync({ name: name.trim(), brand: brand.trim() || null, sizeValue, sizeUnit, categoryId });
      toast.show(t("pp.saved"), "success");
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "";
      toast.show(code === "PRODUCT_EXISTS" ? t("pp.exists") : readErrorMessage(err), "error");
    }
  }

  const selectClass =
    "min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-3 focus:ring-primary/20";
  return (
    <Sheet open onClose={onClose} title={t("pp.editTitle")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t("edit.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        <TextField label={t("pp.brand")} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <TextField label={t("pp.pack")} inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder={t("pp.packPlaceholder")} />
          <div className="flex flex-col gap-2">
            <label htmlFor="product-unit" className="text-sm font-medium text-text-2">
              {t("edit.unit")}
            </label>
            <select id="product-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={selectClass}>
              <option value="">—</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="ks">{pieceUnit("ks")}</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="product-category" className="text-sm font-medium text-text-2">
            {t("edit.category")}
          </label>
          <select id="product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-text-3">{t("pp.categoryNote")}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={update.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </Sheet>
  );
}

function MergeProductSheet({ d, onClose }: { d: ProductDetail; onClose: () => void }) {
  const { household } = useHousehold();
  const products = useProducts(household.id);
  const merge = useMergeProducts();
  const toast = useToast();
  const navigate = useNavigate();
  const { search } = usePeriod();
  const [query, setQuery] = useState("");
  const words = normalizeName(d.product.name).split(" ").filter((w) => w.length > 2);
  const candidates = useMemo(() => {
    const needle = normalizeName(query);
    const list = (products.data ?? []).filter((x) => x.id !== d.product.id);
    if (needle) return list.filter((x) => normalizeName(`${x.name} ${x.brand ?? ""}`).includes(needle)).slice(0, 30);
    // Bez hľadania: najprv podobné názvy.
    const score = (name: string) => words.filter((w) => normalizeName(name).includes(w)).length;
    return list
      .map((x) => ({ x, s: score(x.name) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 15)
      .map((r) => r.x);
  }, [products.data, query, d.product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(id: string, name: string) {
    if (!window.confirm(t("pp.mergeConfirm", { other: name, name: d.product.name }))) return;
    try {
      await merge.mutateAsync({ target: d.product.id, sources: [id] });
      toast.show(t("pt.merged"), "success");
      onClose();
      navigate(`/analytics/product/${d.product.id}${search}`, { replace: true });
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("pp.mergeTitle")}>
      <p className="mb-3 text-sm text-text-2">
        {t("pp.mergeText", { name: d.product.name })}
      </p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pt.searchAria")}
          aria-label={t("pt.searchAria")}
          className="min-h-11 w-full rounded-full border border-line-strong/40 bg-surface pl-10 pr-4 text-base outline-none focus:border-primary"
        />
      </div>
      {products.isPending ? (
        <Spinner />
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-2">{query ? t("pt.nothingFound") : t("pp.typePart")}</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-surface)] bg-sunken">
          {candidates.map((x) => (
            <button
              key={x.id}
              type="button"
              disabled={merge.isPending}
              onClick={() => void pick(x.id, x.name)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.name}</p>
                <p className="truncate text-xs text-text-3">
                  {[x.brand, sizeLabel(x.size_value, x.size_unit), `${x.purchases}×`, storeLabel(x.last_store)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(x.last_price)}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
