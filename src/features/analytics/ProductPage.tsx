import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { Search, X } from "lucide-react";
import { BottomSheet, CatIcon, SheetHeader } from "@/components/kit";
import { useAddItem, useLists } from "@/features/lists/api";
import { errorMessage } from "@/lib/errors";
import { ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { CATEGORIES, normalizeName } from "@/lib/categories";
import { parseAmount, readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, formatEuro, formatNumber, t, tn } from "@/i18n";
import { unitLabel as pieceUnit } from "@/lib/parseItem";
import { useMergeProducts, usePriceProduct, useProduct, useProducts, useSetProductKind, useUpdateProduct, type Basis, type ProductDetail } from "./api";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, Back, useScrolled } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Btn, StoreTile, emojiFor, eur, storeKeyOf } from "@/mockup/kit";
import { cat } from "./money";
import { PriceChart, type Series } from "./charts";
import { When } from "./KindPage";
import { perUnit, sizeLabel, storeLabel } from "./bits";


/**
 * Výrobok vo Výdavkoch – z mockupu (money.jsx VariantScreen + ProductScreen): druh, priemer / naposledy / spolu,
 * cena za jednotku v čase a v obchodoch, najlacnejší obchod, nákupy z bločkov a Pridať do zoznamu.
 * Úprava a zlúčenie výrobku (opravy rozpoznania) ostali pod ⋯.
 */
export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useProduct(id);
  const price = usePriceProduct(id);
  const { household } = useHousehold();
  const lists = useLists(household.id);
  const add = useAddItem();
  const toast = useToast();
  const g = useTheme().style === "glass";
  const gl = g ? " glass2" : "";
  const scrolled = useScrolled();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [menu, setMenu] = useState(false);

  if (query.isPending || query.isError)
    return (
      <div className="bhm bhm-list">
        <div className="sc">
          <header className="nb">
            <Back label={t("mn.title")} onClick={() => navigate(-1)} />
          </header>
        </div>
        <div className="body">{query.isPending ? <Spinner /> : <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />}</div>
      </div>
    );
  const d = query.data;
  const p = d.product;
  const c = cat(p.category_id);
  const size = sizeLabel(p.size_value, p.size_unit);
  const pr = price.data;
  const weighed = !!pr?.weighed;
  const basis: Basis = pr?.basis ?? "ks";
  const val = (v: number) => (weighed ? perUnit(v, basis) : eur(v)) ?? eur(v);
  const target = (lists.data ?? []).filter((l) => !l.completed_at).sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999"))[0];
  const short = (x: string) => formatDateTime(new Date(`${x}T12:00:00`), { day: "numeric", month: "numeric" }).replace(/ /g, "\u00a0");
  const now = pr?.now ?? null;
  const unitLine = !now ? "" : weighed ? t("mn.byWeight") : now.unit != null && basis !== "ks" ? `${size ? `${size} · ` : ""}${perUnit(now.unit, basis)}` : (size ?? "");
  // jedno číslo len raz: kúpené raz → jedna karta; priemer a najnižšia len ak sa líšia od ceny teraz
  const once = (pr?.count ?? 0) <= 1;
  const showAvg = !!now && !once && pr!.avg != null && Math.abs(pr!.avg - now.price) >= 0.005;
  const showMin = !!now && !once && !!pr!.min && pr!.min.price < now.price - 0.005;
  const same = !!now && !once && !showAvg && !showMin;
  const lone = showAvg !== showMin ? " an-w" : "";
  const series: Series[] = [];
  for (const s of pr?.stores ?? []) {
    const pts = (pr?.series ?? []).filter((x) => x.store_key === s.key).map((x) => ({ d: x.d, v: x.v, promo: x.promo }));
    if (pts.length) series.push({ store: s.name, pts });
  }

  async function addTo() {
    if (!target) return toast.show(t("addtolist.noList"), "error");
    try {
      const res = await add.mutateAsync({ listId: target.id, name: [p.brand, p.name].filter(Boolean).join(" "), categoryId: p.category_id });
      toast.show(res.kind === "REQUEST" ? t("addtolist.request") : t("addtolist.added", { name: target.name }), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={p.kind || c.name} onClick={() => navigate(-1)} />
            <span className={`nbt${scrolled ? " sh" : ""}`}>{p.brand || p.name}</span>
            <div className="nbr">
              <IB n="dots-three" label={t("pp.edit")} onClick={() => setMenu(true)} />
            </div>
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <span className="tile lg" style={{ "--tc": c.col } as React.CSSProperties}>
              <E k={emojiFor(p.kind || p.name, p.category_id)} s={44} />
            </span>
            <div className="grow">
              <h1 className="lt">{[p.brand, p.name].filter(Boolean).join(" ")}</h1>
              <div className="meta an-cr">
                <button type="button" onClick={() => navigate("/analytics")}>
                  {t("mn.title")}
                </button>
                <I n="caret-right" w="bold" />
                <button type="button" onClick={() => navigate(`/analytics/category/${p.category_id}`)}>
                  {c.name}
                </button>
                {p.kind ? (
                  <>
                    <I n="caret-right" w="bold" />
                    <button type="button" onClick={() => navigate(`/analytics/kind/${encodeURIComponent(p.kind!)}`)}>
                      {p.kind}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          {price.isPending ? (
            <Spinner />
          ) : price.isError ? (
            <ErrorState error={readErrorMessage(price.error)} onRetry={() => price.refetch()} />
          ) : !now ? (
            <p className="vnote">
              <I n="info" />
              {t("mn.noPurchases")}
            </p>
          ) : (
            <>
              <div className="an-pcs">
                <div className={`mod an-w${gl}`}>
                  <span className="kk">
                    <I n="receipt" />
                    {t(once ? "mn.boughtOnce" : "mn.priceNow")}
                  </span>
                  <div className="an-wr">
                    <span className="v">{val(now.price)}</span>
                    {pr!.change ? (
                      <span className={`an-tag ${pr!.change.pct > 0 ? "up" : "good"}`}>
                        {pr!.change.pct > 0 ? "▲" : "▼"} {Math.round(Math.abs(pr!.change.pct) * 100)} %{pr!.change.since ? ` ${t("mn.since", { date: short(pr!.change.since) })}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <span className="d">
                    {unitLine ? `${unitLine} · ` : ""}
                    {now.store} · {now.promo ? `${t("mn.promo")} ` : ""}
                    <When d={now.date} />
                    {same ? ` · ${t("mn.samePrice", { n: tn("mn.trips", pr!.count) })}` : ""}
                  </span>
                </div>
                {showAvg && (
                <div className={`mod${lone}${gl}`}>
                  <span className="kk">
                    <I n="clock" />
                    {t("mn.avgPays")}
                  </span>
                  <span className="v">{val(pr!.avg!)}</span>
                  <span className="d">{t(weighed ? "mn.avgWeighedD" : "mn.avgPackD", { n: tn("mn.trips", pr!.avg_count) })}</span>
                </div>
                )}
                {showMin && (
                  <div className={`mod good${lone}${gl}`}>
                    <span className="kk">
                      <I n="trend-down" w="bold" />
                      {t("mn.lowest")}
                    </span>
                    <span className="v">{val(pr!.min!.price)}</span>
                    <span className="d">
                      {pr!.min!.store} · {short(pr!.min!.date)}
                      {pr!.min!.promo ? ` · ${t("mn.promo")}` : ""}
                    </span>
                  </div>
                )}
              </div>
              {once && (
                <p className="vnote">
                  <I n="info" />
                  {t("mn.onceNote")}
                </p>
              )}
              {series.length > 0 && !same && !once && <PriceChart series={series} avg={pr!.avg} fmt={val} title={weighed ? t("mn.priceDev", { per: t("mn.per1", { u: basis }) }) : t("mn.packDev")} />}
              {!once && <div className="h2 sm">{t("mn.storesPrices")}</div>}
              {!once && <div className={`lst${gl}`}>
                {pr!.stores.map((s, i) => (
                  <button type="button" className="row tap" key={s.key} onClick={() => navigate(`/analytics/store/${encodeURIComponent(s.key)}?kind=${encodeURIComponent(p.kind ?? "")}`)}>
                    <StoreTile k={storeKeyOf(s.name)} n={s.name} s={40} />
                    <div className="tx">
                      <b>{s.name}</b>
                      <span className="sub">
                        <When d={s.date} />
                        {s.min < s.price - 0.005 ? ` · ${t("mn.lowestAt", { price: val(s.min) })}` : ` · ${tn("mn.trips", s.buys)}`}
                      </span>
                    </div>
                    <div className="an-r">
                      <b className="amt">{val(s.price)}</b>
                      {s.promo ? <span className="an-tag mu">{t("mn.onlyPromo")}</span> : pr!.stores.length > 1 ? i ? <span className="an-tag up">+{Math.max(1, Math.round((s.price / pr!.stores[0]!.price - 1) * 100))} %</span> : <span className="an-tag good">{t("mn.cheapestTag")}</span> : null}
                    </div>
                    <I n="caret-right" w="bold" cls="chev" />
                  </button>
                ))}
              </div>}
              {p.kind && (
                <button type="button" className="lnk c" onClick={() => navigate(`/analytics/kind/${encodeURIComponent(p.kind!)}`)}>
                  {t("mn.compareWith", { kind: p.kind })}
                </button>
              )}
            </>
          )}
          {target && (
            <Btn cls={`pri${g ? " a" : ""}`} onClick={() => void addTo()} disabled={add.isPending}>
              <I n="plus" w="bold" />
              {t("an.addToList")}
            </Btn>
          )}
          {pr && pr.purchases.length > 0 && (
            <>
              <div className="h2 sm">{t("mn.fromReceipts")}</div>
              <div className={`lst${gl}`}>
                {pr.purchases.map((x) => (
                  <button type="button" className="row tap" key={x.item_id} onClick={() => navigate(`/receipts/${x.receipt_id}`)}>
                    <StoreTile k={storeKeyOf(x.store)} n={x.store} s={34} />
                    <div className="tx">
                      <b>
                        {short(x.date)} · {x.store}
                      </b>
                      <span className="sub">
                        {x.packs == null ? `${formatNumber(x.units, { maximumFractionDigits: 3 })} ${x.basis} × ${perUnit(x.price, x.basis)}` : `${formatNumber(x.packs)} × ${eur(x.price)}`}
                        {x.promo ? ` · ${t("mn.promo")}` : ""}
                      </span>
                    </div>
                    <b className="amt">{eur(x.line_total)}</b>
                    <I n="caret-right" w="bold" cls="chev" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} label={t("pp.edit")}>
        <div className="sh-head">
          <h2>{p.name}</h2>
        </div>
        <div className="sh-body">
          <div className="menu">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setEditing(true);
              }}
            >
              <I n="pencil-simple" />
              {t("pp.edit")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setMerging(true);
              }}
            >
              <I n="link" />
              {t("pp.mergeTitle")}
            </button>
          </div>
        </div>
      </Sheet>
      {editing && <EditProductSheet d={d} onClose={() => setEditing(false)} />}
      {merging && <MergeProductSheet d={d} onClose={() => setMerging(false)} />}
    </>
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
      navigate(`/analytics/product/${d.product.id}`, { replace: true });
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
