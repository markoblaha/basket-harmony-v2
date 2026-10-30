import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronRight, Merge, Pencil, Plus, Search, X } from "lucide-react";
import { BottomSheet, CatIcon, ScreenHeader, SheetHeader, StoreBadge, storeHue } from "@/components/kit";
import { useAddItem, useLists } from "@/features/lists/api";
import { dayLabel, listDay } from "@/features/lists/dates";
import { errorMessage } from "@/lib/errors";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { CATEGORIES, normalizeName } from "@/lib/categories";
import { formatShortDate, parseAmount, readErrorMessage } from "@/features/receipts/format";
import { formatEuro, formatNumber, t, tn, type Key } from "@/i18n";
import { unitLabel as pieceUnit } from "@/lib/parseItem";
import { useMergeProducts, useProduct, useProducts, useSetProductKind, useUpdateProduct, type Basis, type ProductDetail } from "./api";
import { categoryInfo, sizeLabel, storeLabel, unitLabel } from "./bits";
import { usePeriod } from "./period";

const EUR_PER: Record<Basis, Key> = { kg: "an.eurPer.kg", l: "an.eurPer.l", ks: "an.eurPer.ks" };

/** Graf jednotkovej ceny v čase (prototyp) – bodky podľa obchodu, akcia ako dutý krúžok. */
function PriceDots({ points, unit }: { points: { key: string; date: string; v: number; store: string; promo: boolean }[]; unit: string }) {
  // Ťuk na bodku ukáže cenu, obchod a dátum toho nákupu.
  const [sel, setSel] = useState<string | null>(null);
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
  const selected = pts.find((p) => p.key === sel);
  return (
    <div className="stack g-8">
      <svg className="an-price" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("pp.priceTitle")} onClick={() => setSel(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} style={{ stroke: "var(--line)", strokeWidth: 1 }} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
              {formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
        {path && <path d={path} pathLength={1} style={{ fill: "none", stroke: "var(--line-2)", strokeWidth: 1.5 }} />}
        {pts.map((p, i) => (
          <g key={p.key} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSel(sel === p.key ? null : p.key); }}>
            <circle cx={x(p.tm)} cy={y(p.v)} r={12} style={{ fill: "transparent" }} />
            <circle
              cx={x(p.tm)}
              cy={y(p.v)}
              r={sel === p.key ? 6 : p.promo ? 4.5 : 4}
              className={cx("an-pt", p.promo && "promo")}
              style={{ "--h": storeHue(p.store), animationDelay: `${Math.min(i * 30, 400)}ms` } as CSSProperties}
            />
          </g>
        ))}
        <text x={L} y={H - 4} style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
          {formatShortDate(pts[0]!.date)}
        </text>
        <text x={W - 4} y={H - 4} textAnchor="end" style={{ fill: "var(--text-3)", fontSize: 10.5 }}>
          {formatShortDate(pts[pts.length - 1]!.date)}
        </text>
      </svg>
      {selected && (
        <div className="row g-8 t-sm anim-pop" style={{ padding: "8px 12px", borderRadius: 12, background: "var(--sunken)" }}>
          <span className="an-dot" style={{ "--h": storeHue(selected.store) } as CSSProperties} />
          <span className="grow">
            {storeLabel(selected.store)} · {formatShortDate(selected.date)}
            {selected.promo ? ` · ${t("an.promo")}` : ""}
          </span>
          <span className="fw-6 num">
            {formatNumber(selected.v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {unit}
          </span>
        </div>
      )}
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
            {t("an.promo")}
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
  const { search } = usePeriod();

  if (query.isPending || query.isError)
    return (
      <div className="stack">
        <ScreenHeader title={t("an.searchProduct")} onBack={() => navigate(-1)} />
        {query.isPending ? <Spinner /> : <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />}
      </div>
    );
  const d = query.data;
  const p = d.product;
  const info = categoryInfo(p.category_id);
  const size = sizeLabel(p.size_value, p.size_unit);
  const last = d.purchases[0];
  const basis = last?.basis ?? "ks";
  const showUnit = basis !== "ks" || (p.size_value ?? 1) > 1;
  const unit = showUnit ? unitLabel(basis) : t("an.perPiece");
  const eurUnit = showUnit ? t(EUR_PER[basis]) : t("an.perPiece");
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
          {/* Druh spája značky a balenia (Pivo, Kuracie prsia) – detail ukáže všetky výrobky spolu. */}
          <button
            type="button"
            className="cell"
            style={{ padding: "10px 12px", borderRadius: 12, background: "var(--sunken)" }}
            onClick={() => navigate(`/analytics/kind/${encodeURIComponent(p.kind ?? p.name)}${search}`)}
          >
            <span className="grow stack g-2" style={{ minWidth: 0 }}>
              <span className="t-xs t-3">{t("kd.kind")}</span>
              <span className="t-body fw-6 ellipsis">{p.kind ?? p.name}</span>
            </span>
            <span className="t-sm t-2">{t("kd.allVariants")}</span>
            <ChevronRight size={18} className="chev" />
          </button>
          <div className="row g-8 wrap">
            <span className="badge b-gray">{tn("an.purchases", d.purchases.length)}</span>
            <span className="badge b-gray num">{t("an.totalSpent", { amount: formatEuro(total) })}</span>
            {last && <span className="badge b-gray">{t("an.lastOn", { day: dayLabel(last.date) })}</span>}
          </div>
        </section>

        <section className="card stack g-10" style={{ padding: 18 }}>
          <span className="t-h">{t("an.priceOverTime")}</span>
          {points.length >= 2 ? <PriceDots points={points} unit={eurUnit} /> : <span className="t-sm t-2">{t("an.needTwo")}</span>}
        </section>

        {d.stores.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{t("an.compareStores", { unit: eurUnit })}</span>
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
                    {x.discount > 0 ? ` · ${t("an.promo")}` : ""}
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
          <section ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" })} className="card stack g-8 anim-rise" style={{ padding: 14 }}>
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
          {t("an.addToList")}
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
  const setKind = useSetProductKind(p.id);
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [kind, setKindText] = useState(p.kind ?? "");
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
      if (kind.trim() !== (p.kind ?? "")) await setKind.mutateAsync(kind.trim() || null);
      toast.show(t("pp.saved"), "success");
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "";
      toast.show(code === "PRODUCT_EXISTS" ? t("pp.exists") : readErrorMessage(err), "error");
    }
  }

  return (
    <BottomSheet open onClose={onClose} label={t("pp.editTitle")}>
      <SheetHeader title={t("pp.editTitle")} onClose={onClose} />
      <form onSubmit={submit} className="sheet-body stack g-12">
        <label className="stack g-4">
          <span className="field-label">{t("edit.name")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </label>
        <label className="stack g-4">
          <span className="field-label">{t("kd.kind")}</span>
          <input className="input" value={kind} onChange={(e) => setKindText(e.target.value)} maxLength={60} placeholder={name} />
          <span className="t-xs t-3" style={{ padding: "0 4px" }}>{t("kd.kindHint")}</span>
        </label>
        <label className="stack g-4">
          <span className="field-label">{t("pp.brand")}</span>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
        </label>
        <div className="row g-8" style={{ alignItems: "flex-end" }}>
          <label className="grow stack g-4">
            <span className="field-label">{t("pp.pack")}</span>
            <input className="input num" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder={t("pp.packPlaceholder")} />
          </label>
          <label className="stack g-4" style={{ width: 96 }}>
            <span className="field-label">{t("edit.unit")}</span>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">—</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="ks">{pieceUnit("ks")}</option>
            </select>
          </label>
        </div>
        <label className="stack g-4">
          <span className="field-label">{t("edit.category")}</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="t-xs t-3" style={{ padding: "0 4px" }}>{t("pp.categoryNote")}</span>
        </label>
        {error && (
          <p role="alert" className="t-sm" style={{ color: "var(--red)", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-ink btn-lg btn-block" style={{ marginTop: 4 }} disabled={update.isPending || setKind.isPending}>
          {t("common.save")}
        </button>
      </form>
    </BottomSheet>
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
    <BottomSheet open onClose={onClose} label={t("pp.mergeTitle")}>
      <SheetHeader title={t("pp.mergeTitle")} sub={t("pp.mergeText", { name: d.product.name })} onClose={onClose} />
      <div className="sheet-body stack g-12">
        <div className="row g-8 input" style={{ paddingRight: 6 }}>
          <Search size={18} color="var(--text-3)" />
          <input
            autoFocus
            className="grow"
            style={{ minHeight: 46, fontSize: 16 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pt.searchAria")}
            aria-label={t("pt.searchAria")}
          />
          {query && (
            <button type="button" className="ibtn sm" onClick={() => setQuery("")} aria-label={t("an.clear")}>
              <X size={16} />
            </button>
          )}
        </div>
        {products.isPending ? (
          <Spinner />
        ) : candidates.length === 0 ? (
          <p className="t-sm t-2" style={{ textAlign: "center", padding: "24px 0", margin: 0 }}>
            {query ? t("pt.nothingFound") : t("pp.typePart")}
          </p>
        ) : (
          <div className="cells">
            {candidates.map((x) => (
              <button key={x.id} type="button" className="cell" disabled={merge.isPending} onClick={() => void pick(x.id, x.name)}>
                <CatIcon id={x.category_id} size="sm" />
                <span className="grow stack" style={{ minWidth: 0 }}>
                  <span className="t-body fw-5 ellipsis">{x.name}</span>
                  <span className="t-xs t-2 num ellipsis">
                    {[x.brand, sizeLabel(x.size_value, x.size_unit), `${x.purchases}×`, storeLabel(x.last_store)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="t-body fw-6 num">{formatEuro(x.last_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
