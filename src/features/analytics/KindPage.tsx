/**
 * Produkt vo Výdavkoch (druh: Maslo, Pivo…) – Výdavky 2.0. Ceny sú vždy k dnešku za posledné 3 mesiace
 * (DB analytics_price_kind): priemerne platíš (peniaze ÷ množstvo), najlacnejšie a najdrahšie teraz (obchod
 * a konkrétny výrobok), koľko ušetríš, vývoj ceny po obchodoch, obchody a ceny, značky a balenia, nákupy.
 */
import { useNavigate, useParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, formatNumber, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, useScrolled } from "@/mockup/ui";
import { StoreTile, emojiFor, eur, storeKeyOf } from "@/mockup/kit";
import { usePriceKind, type Basis, type PriceKind } from "./api";
import { perUnit, sizeLabel } from "./bits";
import { cat } from "./money";
import { PriceChart, type Series } from "./charts";

const short = (d: string) => formatDateTime(new Date(`${d}T12:00:00`), { day: "numeric", month: "numeric" });
const ago = (d: string) => Math.round((Date.now() - new Date(`${d}T12:00:00`).getTime()) / 864e5);
/** Dátum ceny; staršia ako 6 týždňov je označená. */
export function When({ d }: { d: string }) {
  const n = ago(d);
  return n > 45 ? <span className="an-old">{t("mn.monthsAgo", { n: Math.round(n / 30) })}</span> : <>{short(d)}</>;
}
const qty = (v: number, b: Basis) =>
  b === "ks" ? `${formatNumber(v, { maximumFractionDigits: 0 })} ks` : v < 1 ? `${formatNumber(v * 1000, { maximumFractionDigits: 0 })} ${b === "kg" ? "g" : "ml"}` : `${formatNumber(v, { maximumFractionDigits: 2 })} ${b}`;
/** „9,47 €/kg“ s menšou jednotkou */
function VU({ v, b }: { v: number; b: Basis }) {
  const s = perUnit(v, b) ?? "–";
  const i = s.search(/\s/);
  return (
    <>
      {i > 0 ? s.slice(0, i) : s}
      {i > 0 ? <small>{s.slice(i)}</small> : null}
    </>
  );
}

export function KindPage() {
  const { key = "" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const q = usePriceKind(household.id, decodeURIComponent(key));
  const d = q.data;
  const name = d?.name || decodeURIComponent(key);
  const c = cat(d?.category_id ?? "other");
  const gl = g ? " glass2" : "";
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={c.name} onClick={() => navigate(-1)} />
            <span className={`nbt${scrolled ? " sh" : ""}`}>{name}</span>
            <span className="ibs" />
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <span className="tile lg" style={{ "--tc": c.col } as React.CSSProperties}>
              <E k={emojiFor(name, d?.category_id)} s={40} />
            </span>
            <div className="grow">
              <h1 className="lt">{name}</h1>
              <div className="meta an-cr">
                <button type="button" onClick={() => navigate("/analytics")}>
                  {t("mn.title")}
                </button>
                <I n="caret-right" w="bold" />
                <button type="button" onClick={() => navigate(`/analytics/category/${d?.category_id ?? "other"}`)}>
                  {c.name}
                </button>
              </div>
            </div>
          </div>
          {q.isPending ? <Spinner /> : q.isError || !d ? <ErrorState error={readErrorMessage(q.error)} onRetry={() => q.refetch()} /> : <Body d={d} gl={gl} />}
        </div>
      </div>
    </>
  );
}

function Body({ d, gl }: { d: PriceKind; gl: string }) {
  const navigate = useNavigate();
  const B = d.basis;
  const unitWord = B === "ks" ? t("mn.per1ks") : t("mn.per1", { u: B });
  const cheapest = d.stores[0] ?? null;
  const regular = d.stores.filter((s) => !s.promo);
  const priciest = regular.length > 1 ? regular[regular.length - 1]! : null;
  const offer = (s: PriceKind["stores"][number]) => `${s.name} · ${s.brand || s.product}${s.size_value ? ` ${sizeLabel(s.size_value, s.size_unit)}` : ""} ${t("mn.for")} ${eur(s.price)}`;
  const trend = d.trend == null ? null : Math.abs(d.trend) >= 0.03 ? d.trend : 0;
  const maxU = Math.max(1e-9, ...d.stores.map((s) => s.unit));
  const series: Series[] = [];
  for (const s of d.stores) {
    const pts = d.series.filter((x) => x.store_key === s.key).map((x) => ({ d: x.d, v: x.v, promo: x.promo }));
    if (pts.length) series.push({ store: s.name, pts });
  }
  return (
    <>
      {d.avg_unit != null ? (
        <div className="an-pcs">
          <div className={`mod an-w${gl}`}>
            <span className="kk">
              <I n="receipt" />
              {t("mn.avgPays")}
            </span>
            <div className="an-wr">
              <span className="v">
                <VU v={d.avg_unit} b={B} />
              </span>
              {trend == null ? null : trend === 0 ? <span className="an-tag mu">{t("mn.trendFlat")}</span> : <span className={`an-tag ${trend > 0 ? "up" : "good"}`}>{t(trend > 0 ? "mn.trendUp" : "mn.trendDown", { pct: Math.round(Math.abs(trend) * 100) })}</span>}
            </div>
            <span className="d">{t("mn.avgPaysD", { n: tn("mn.trips", d.sized_count ?? 0), qty: qty(d.qty ?? 0, B), paid: eur(d.paid ?? 0) })}</span>
          </div>
          {cheapest && (
            <button type="button" className={`mod good${gl}`} onClick={() => navigate(`/analytics/product/${cheapest.product_id}`)}>
              <span className="kk">
                <I n="trend-down" w="bold" />
                {t("mn.cheapestNow")}
              </span>
              <span className="v">
                <VU v={cheapest.unit} b={B} />
              </span>
              <span className="d">
                {offer(cheapest)} · {cheapest.promo ? `${t("mn.promo")} ` : ""}
                <When d={cheapest.date} />
              </span>
            </button>
          )}
          {priciest && (
            <button type="button" className={`mod${gl}`} onClick={() => navigate(`/analytics/product/${priciest.product_id}`)}>
              <span className="kk">
                <I n="trend-up" w="bold" />
                {t("mn.priciestNow")}
              </span>
              <span className="v">
                <VU v={priciest.unit} b={B} />
              </span>
              <span className="d">
                {offer(priciest)} · <When d={priciest.date} />
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="an-pcs">
          <div className={`mod an-w${gl}`}>
            <span className="kk">
              <I n="receipt" />
              {t("mn.spent3m")}
            </span>
            <span className="v">
              {formatNumber(d.spent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <small>€</small>
            </span>
            <span className="d">
              {tn("mn.trips", d.count)} · {B === "ks" ? t("mn.noUnitCompare") : t("mn.needSize")}
            </span>
          </div>
        </div>
      )}
      {d.save && (
        <div className={`card insight${gl}`}>
          <span className="tile">
            <E k="moneybag" />
          </span>
          <div className="grow">
            <div className="ib-t">{t("mn.saveAt", { store: d.save.store, amount: eur(d.save.amount) })}</div>
            <div className="meta">{t("mn.saveAtD", { qty: qty(d.save.monthly_qty, B) })}</div>
          </div>
        </div>
      )}
      {d.unknown > 0 && B !== "ks" && (
        <button type="button" className={`card insight tapc${gl}`} onClick={() => navigate("/analytics/sizes")}>
          <span className="tile">
            <E k="tag" />
          </span>
          <div className="grow">
            <div className="ib-t">{tn("mn.unknownSize", d.unknown)}</div>
            <div className="meta">{t("mn.unknownSizeD", { per: unitWord })}</div>
          </div>
          <I n="caret-right" w="bold" cls="chev" />
        </button>
      )}
      {series.length > 0 && <PriceChart series={series} avg={d.avg_unit} fmt={(v) => perUnit(v, B) ?? eur(v)} title={t("mn.priceDev", { per: unitWord })} note={t("mn.cheapestProduct")} />}
      {d.stores.length > 0 && (
        <>
          <div className="h2 sm">{t("mn.storesPrices")}</div>
          <div className={`lst${gl}`}>
            {d.stores.map((s, i) => (
              <button type="button" key={s.key} className="row tap" onClick={() => navigate(`/analytics/product/${s.product_id}`)}>
                <StoreTile k={storeKeyOf(s.name)} n={s.name} s={40} />
                <div className="tx">
                  <b>{s.name}</b>
                  <span className="sub w2">
                    {s.brand || s.product}
                    {s.size_value ? ` ${sizeLabel(s.size_value, s.size_unit)}` : ""} · {eur(s.price)} · {s.promo ? `${t("mn.promo")} ` : ""}
                    <When d={s.date} />
                  </span>
                  <span className="ln">
                    <i style={{ width: `${((s.unit / maxU) * 100).toFixed(1)}%`, background: i || s.promo ? "color-mix(in srgb, var(--fg) 40%, transparent)" : "var(--ok)" }} />
                  </span>
                </div>
                <div className="an-r">
                  <b className="amt">{perUnit(s.unit, B)}</b>
                  {s.promo ? <span className="an-tag mu">{t("mn.onlyPromo")}</span> : d.stores.length > 1 ? i ? <span className="an-tag up">+{Math.max(1, Math.round((s.unit / d.stores[0]!.unit - 1) * 100))} %</span> : <span className="an-tag good">{t("mn.cheapestTag")}</span> : null}
                </div>
                <I n="caret-right" w="bold" cls="chev" />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="h2 sm">{t("mn.brandsPacks")}</div>
      <div className={`lst${gl}`}>
        {d.products.map((p) => (
          <button type="button" key={p.product_id} className="row tap" onClick={() => navigate(p.size_missing ? "/analytics/sizes" : `/analytics/product/${p.product_id}`)}>
            <span className="th">
              <E k={emojiFor(d.name, d.category_id)} />
            </span>
            <div className="tx">
              <b className="w2">{[p.brand, p.name].filter(Boolean).join(" ")}</b>
              <span className="sub">{[sizeLabel(p.size_value, p.size_unit), p.stores.join(", ")].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="an-r">
              <b className="amt">{eur(p.price)}</b>
              {p.size_missing ? <span className="an-tag up">{t("mn.addSize")}</span> : p.unit != null && B !== "ks" ? <span className="sub">{perUnit(p.unit, B)}</span> : null}
            </div>
            <I n="caret-right" w="bold" cls="chev" />
          </button>
        ))}
      </div>
      {d.purchases.length > 0 && (
        <>
          <div className="h2 sm">{t("mn.lastBuys")}</div>
          <div className={`lst${gl}`}>
            {d.purchases.map((x) => {
              const size = sizeLabel(x.size_value, x.size_unit);
              const q = x.packs == null ? qty(x.units, x.basis) : x.packs > 1 ? `${formatNumber(x.packs)} × ${size ?? "1 ks"}` : (size ?? "1 ks");
              return (
                <button type="button" key={x.item_id} className="row tap" onClick={() => navigate(`/receipts/${x.receipt_id}`)}>
                  <StoreTile k={storeKeyOf(x.store)} n={x.store} s={34} />
                  <div className="tx">
                    <b>{[x.brand, x.name].filter(Boolean).join(" ")}</b>
                    <span className="sub">
                      {short(x.date)} · {x.store} · {q}
                      {x.promo ? ` · ${t("mn.promo")}` : ""}
                    </span>
                  </div>
                  <div className="an-r">
                    <b className="amt">{eur(x.line_total)}</b>
                    {x.unit != null && B !== "ks" ? <span className="sub">{perUnit(x.unit, B)}</span> : null}
                  </div>
                  <I n="caret-right" w="bold" cls="chev" />
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className="src-note">{t("mn.pricesNote")}</p>
    </>
  );
}
