/**
 * Druh vo Výdavkoch – z mockupu (money.jsx KindScreen): koľko, za koľko a priemer za kg/l/ks; najlacnejšie
 * a najdrahšie; podľa značky; výrobky (značka + balenie); kde je najlacnejší; jednotlivé nákupy.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, formatNumber, t } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, Seg, useScrolled } from "@/mockup/ui";
import { StoreTile, emojiFor, eur, storeKeyOf } from "@/mockup/kit";
import { useKindDetail, type KindDetail } from "./api";
import { PerUnit, perUnit, qtyLabel, sizeLabel } from "./bits";
import { cat, usePer } from "./money";
import { computePeriod, monthName, shiftMonth, thisMonth } from "./period";

type Mo = "now" | "prev" | "q";
const short = (d: string) => formatDateTime(new Date(`${d}T00:00`), { day: "numeric", month: "numeric" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function KindPage() {
  const { key = "" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const { per } = usePer();
  const [mo, setMo] = useState<Mo>(per === "year" ? "q" : "now");
  const m = thisMonth();
  const period = mo === "q" ? computePeriod("3m", m, "all") : computePeriod("month", mo === "prev" ? shiftMonth(m, -1) : m, "all");
  const q = useKindDetail(household.id, decodeURIComponent(key), period);
  const d = q.data;
  const name = d?.name || decodeURIComponent(key);
  const c = cat(d?.category_id ?? "other");
  const B = d?.basis ?? "ks";
  const brands = d ? brandRows(d) : [];
  const bmax = brands[0]?.amount ?? 1;
  const hasBrands = brands.some((b) => b.brand !== null);
  const pu = (v: number | null) => perUnit(v, B);
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={c.name} onClick={() => navigate(-1)} />
            <span className="nbt">{name}</span>
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
              <div className="meta">{t("mn.kindSub", { cat: c.name })}</div>
            </div>
          </div>
          <Seg<Mo>
            items={[
              ["now", cap(monthName(Number(m.slice(5))))],
              ["prev", cap(monthName(Number(shiftMonth(m, -1).slice(5))))],
              ["q", t("mn.threeMonths")],
            ]}
            value={mo}
            onChange={setMo}
          />
          {q.isPending ? (
            <Spinner />
          ) : q.isError || !d ? (
            <ErrorState error={readErrorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : !d.count ? (
            <p className="vnote">
              <I n="info" />
              {t("mn.kindNone")}
            </p>
          ) : (
            <>
              <div className={`card kstat${g ? " glass2" : ""}`}>
                <div>
                  <div className="k">{t("mn.total")}</div>
                  <div className="price">{eur(d.amount)}</div>
                  <div className="meta sm">{t("mn.times", { n: d.count })}</div>
                </div>
                <div>
                  <div className="k">{t("mn.boughtQty")}</div>
                  <div className="price">{qtyLabel(d.units, B) ?? "–"}</div>
                </div>
                <div>
                  <div className="k">{t("mn.avg")}</div>
                  <div className="price">
                    <PerUnit price={d.avg_unit} basis={B} />
                  </div>
                </div>
              </div>
              {d.min_unit && d.max_unit && d.max_unit.price > d.min_unit.price + 0.005 && (
                <div className={`card insight${g ? " glass2" : ""}`}>
                  <span className="tile">
                    <E k="moneybag" />
                  </span>
                  <div className="grow">
                    <div className="ib-t">{t("mn.cheapest", { price: pu(d.min_unit.price) ?? "" })}</div>
                    <div className="meta">
                      {d.min_unit.store} {short(d.min_unit.date)}
                      <br />
                      {t("mn.priciest", { price: pu(d.max_unit.price) ?? "", store: d.max_unit.store })}
                    </div>
                  </div>
                </div>
              )}
              {hasBrands && (
                <>
                  <div className="h2 sm">{t("mn.byBrand")}</div>
                  <div className={`lst${g ? " glass2" : ""}`}>
                    {brands.map((b) => (
                      <div key={b.brand ?? "-"} className="row">
                        <div className="tx">
                          <b>{b.brand ?? t("mn.noBrand")}</b>
                          <span className="sub">{[`${Math.round((b.amount / d.amount) * 100)} %`, qtyLabel(b.units, B), pu(b.units ? b.amount / b.units : null)].filter(Boolean).join(" · ")}</span>
                          <span className="ln">
                            <i style={{ width: `${(b.amount / bmax) * 100}%`, background: c.col }} />
                          </span>
                        </div>
                        <b className="amt">{eur(b.amount)}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="h2 sm">{t("mn.products")}</div>
              <div className={`lst${g ? " glass2" : ""}`}>
                {d.products.map((v) => (
                  <button type="button" key={v.product_id} className="row tap" onClick={() => navigate(`/analytics/product/${v.product_id}`)}>
                    <div className="tx">
                      <b>{[v.brand, v.name].filter(Boolean).join(" ")}</b>
                      <span className="sub">{[sizeLabel(v.size_value, v.size_unit), `${v.count}×`, qtyLabel(v.units, v.basis), perUnit(v.avg_unit, v.basis)].filter(Boolean).join(" · ")}</span>
                      <span className="sub">{t("mn.lastAt", { store: v.last_store, date: short(v.last_date) })}</span>
                    </div>
                    <b className="amt">{eur(v.amount)}</b>
                    <I n="caret-right" w="bold" cls="chev" />
                  </button>
                ))}
              </div>
              {d.stores.length > 0 && (
                <>
                  <div className="h2 sm">{t("mn.whereCheapest", { basis: B })}</div>
                  <div className={`lst${g ? " glass2" : ""}`}>
                    {[...d.stores]
                      .sort((a, b) => (a.avg_unit ?? 99) - (b.avg_unit ?? 99))
                      .map((s, i) => (
                        <div key={s.key} className="row">
                          <StoreTile k={storeKeyOf(s.name)} n={s.name} s={34} />
                          <div className="tx">
                            <b>{s.name}</b>
                            <span className="sub">{t("mn.storeSum", { n: s.count, sum: eur(s.amount) })}</span>
                          </div>
                          <div className="kra">
                            <b className="amt">{pu(s.avg_unit) ?? "–"}</b>
                            {i === 0 && d.stores.length > 1 && <span className="okb">{t("mn.cheapestTag")}</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
              <div className="h2 sm">{t("mn.purchases")}</div>
              <div className={`lst${g ? " glass2" : ""}`}>
                {d.purchases.map((l) => (
                  <button type="button" key={l.item_id} className="row tap" onClick={() => navigate(`/receipts/${l.receipt_id}`)}>
                    <StoreTile k={storeKeyOf(l.store)} n={l.store} s={34} />
                    <div className="tx">
                      <b>
                        {[l.brand, l.name].filter(Boolean).join(" ")}
                        {l.size_value ? ` · ${sizeLabel(l.size_value, l.size_unit)}` : ""}
                      </b>
                      <span className="sub">
                        {short(l.date)} · {l.store} · {formatNumber(l.quantity, { maximumFractionDigits: 3 })} {l.basis === "kg" ? "kg" : t("unit.ks")}
                        {l.paid_unit ? ` · ${perUnit(l.paid_unit, l.basis)}` : ""}
                      </span>
                    </div>
                    <b className="amt">{eur(l.line_total)}</b>
                    <I n="caret-right" w="bold" cls="chev" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Súčty podľa značky (bez značky spolu). */
function brandRows(d: KindDetail) {
  const m = new Map<string | null, { brand: string | null; amount: number; units: number }>();
  for (const p of d.products) {
    const x = m.get(p.brand) ?? { brand: p.brand, amount: 0, units: 0 };
    x.amount += p.amount;
    x.units += p.units ?? 0;
    m.set(p.brand, x);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}
