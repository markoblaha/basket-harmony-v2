/**
 * Výdavky – prenesené z mockupu 1:1 (prototyp/src/money.jsx Money): chýbajúce bločky, Odfotiť / Všetky bločky,
 * obdobie Týždeň / mesiac / Rok, súčet s prstencom a porovnaním, rozpočet, týždne (mesiace), kam peniaze
 * odišli (kategórie), obchody a „Oplatí sa vedieť“. V téme Fotky a sklo veľké číslo a dlaždice ako v mockupe.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { ErrorState } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, MkHeader, Seg } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Btn, StoreTile, eur, eur0, storeKeyOf } from "@/mockup/kit";
import { useOverview, type Overview } from "./api";
import { BudgetSheet, CatRows, Donut, MissingReceipts, cat, perTitle, usePer, type Per } from "./money";
import { monthName, monthShort, thisMonth } from "./period";

/** O koľko mesiacov dozadu je daný mesiac („2026-09“ v novembri = −2). */
const monthsBack = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const [cy, cm] = thisMonth().split("-").map(Number) as [number, number];
  return Math.min(0, (y - cy) * 12 + (mo - cm));
};

/** Súčty po týždňoch mesiaca (1.–7., 8.–14. …) z denných súm. */
function weeks(daily: { d: string; a: number }[]) {
  const out = [0, 0, 0, 0, 0];
  for (const x of daily) out[Math.min(4, Math.floor((Number(x.d.slice(8, 10)) - 1) / 7))]! += x.a;
  const labels = ["1.–7.", "8.–14.", "15.–21.", "22.–28.", "29.–"];
  return out.map((v, i) => ({ label: labels[i]!, v })).filter((w, i) => i < 4 || w.v > 0);
}

/** „Oplatí sa vedieť“: zdraženia/zlacnenia a čo sa asi míňa (pravidelne kupované). */
function insights(o: Overview) {
  const out: { key: string; e: string; t: string; d: string; to: string }[] = [];
  for (const p of o.price_changes.filter((x) => x.kind === "CHANGE").slice(0, 2)) {
    const pct = Math.round(p.change * 100);
    out.push({
      key: `c${p.product_id}`,
      e: pct > 0 ? "coin" : "moneybag",
      t: pct > 0 ? t("mn.insUp", { name: p.name, pct }) : t("mn.insDown", { name: p.name, pct: -pct }),
      d: t("mn.insPrice", { store: p.store_name, old: eur(p.old_price), now: eur(p.new_price) }),
      to: `/analytics/product/${p.product_id}`,
    });
  }
  for (const r of o.restock.slice(0, 2)) {
    out.push({
      key: `r${r.product_id}`,
      e: cat(r.category_id).e,
      t: t("mn.insRestock", { name: r.name }),
      d: t("mn.insRestockD", { every: r.interval_days, since: r.days_since }),
      to: `/analytics/product/${r.product_id}`,
    });
  }
  return out;
}

export function MoneyPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const { per, off, set, go, show, period, qs, title, prevTitle } = usePer();
  const ov = useOverview(household.id, period);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const o = ov.data;
  const cats = (o?.categories ?? []).filter((c) => !c.id.startsWith("_")).map((c) => ({ id: c.id, amount: c.amount }));
  const total = o?.total ?? 0;
  const budget = o?.budgets.find((b) => b.category_id === null)?.amount ?? null;
  const used = per === "month" && budget ? total / budget : null;
  const prev = o?.prev_to_date ?? o?.prev_total ?? 0;
  const diff = prev > 0 ? (total - prev) / prev : null;
  const stores = (o?.stores ?? []).slice(0, 6);
  const topCat = [...cats].sort((a, b) => b.amount - a.amount)[0];
  const openCat = (id: string) => navigate(`/analytics/category/${id}${qs}`);
  const openStore = (key: string) => navigate(`/analytics/store/${encodeURIComponent(key)}${qs}`);
  const wk = o ? weeks(o.daily) : [];
  const wmax = Math.max(1, ...wk.map((w) => w.v));
  const months = (o?.months ?? []).filter((m) => m.amount > 0);
  const mmax = Math.max(1, ...months.map((m) => m.amount));
  const ins = o ? insights(o) : [];
  const trendTxt = diff == null ? null : t(diff > 0 ? "mn.more" : "mn.less", { pct: Math.abs(Math.round(diff * 100)), prev: prevTitle });

  const rbtns = (
    <div className="rbtns">
      <Btn cls={`pri grow${g ? " a" : ""}`} onClick={() => navigate("/scan")}>
        <I n="camera" />
        {t("sp.photo")}
      </Btn>
      <Btn cls={`soft grow${g ? " gl" : ""}`} onClick={() => navigate("/receipts")}>
        <I n="receipt" />
        {t("mn.allReceipts")}
      </Btn>
    </div>
  );
  const seg = (
    <Seg<Per>
      items={[
        ["week", t("mn.week")],
        ["month", perTitle("month", per === "month" ? off : 0)],
        ["year", t("mn.year")],
      ]}
      value={per}
      onChange={set}
    />
  );
  // Listovanie obdobím: ‹ predchádzajúci mesiac / týždeň / rok · › späť k novšiemu (najďalej po aktuálne).
  const perNav = (
    <div className="pernav">
      <button type="button" className="ib" onClick={() => go(-1)} aria-label={t("mn.prevPer")}>
        <I n="caret-left" w="bold" />
      </button>
      <b aria-live="polite">{title}</b>
      <button type="button" className="ib" onClick={() => go(1)} disabled={off === 0} aria-label={t("mn.nextPer")}>
        <I n="caret-right" w="bold" />
      </button>
    </div>
  );
  const empty = o && !total && (
    <div className="empty">
      <E k="receipt" s={64} />
      <b>{t("mn.emptyT", { per: title.toLowerCase() })}</b>
      <p>{t("mn.emptyS")}</p>
      <Btn cls={`pri sm${g ? " a" : ""}`} onClick={() => navigate("/scan")}>
        <I n="camera" />
        {t("sp.photo")}
      </Btn>
    </div>
  );
  const budgetLine = budget
    ? budget - total >= 0
      ? t("mn.budgetLeft", { left: eur0(budget - total) })
      : t("mn.budgetOver", { over: eur0(total - budget) })
    : t("mn.budgetSet");

  const rest = (
    <>
      {empty || (
        <>
          <div className="h2">{t("mn.whereMoney")}</div>
          <CatRows cats={cats} onOpen={openCat} g={g} />
          {stores.length > 0 && (
            <>
              <div className="h2">{t("mn.stores")}</div>
              <div className="storeg">
                {stores.map((s) => (
                  <button type="button" key={s.key} className={`card stc tapc${g ? " glass2" : ""}`} onClick={() => openStore(s.key)}>
                    <StoreTile k={storeKeyOf(s.name)} n={s.name} s={40} />
                    <b>{s.name}</b>
                    <span className="v">{eur0(s.amount)}</span>
                    <small>{tn("mn.trips", s.receipts)}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {ins.length > 0 && (
        <>
          <div className="h2">{t("mn.worthKnowing")}</div>
          {ins.map((x) => (
            <button type="button" key={x.key} className={`card insight tapc${g ? " glass2" : ""}`} onClick={() => navigate(x.to)}>
              <span className="tile">
                <E k={x.e} />
              </span>
              <div className="grow">
                <div className="ib-t">{x.t}</div>
                <div className="meta">{x.d}</div>
              </div>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
          ))}
        </>
      )}
      <p className="src-note">{t("mn.srcNote")}</p>
    </>
  );

  const header = (
    <MkHeader
      title={g ? t("mn.titleG", { per: title }) : t("mn.title")}
      right={
        <>
          <IB n="camera" label={t("sp.photo")} onClick={() => navigate("/scan")} />
          <HelpBtn screen="money" />
        </>
      }
      style={g ? { display: "none" } : undefined}
    >
      {null}
    </MkHeader>
  );

  return (
    <div className="stack">
      {header}
      <div className="bhm bhm-list">
        <div className="body">
          {ov.isError && <ErrorState error={errorMessage(ov.error)} onRetry={() => ov.refetch()} />}
          {g && (
            <div className="wx">
              <span className="place">{title}</span>
              <span className="temp">
                {eur0(total).replace(/\s?€/, "")}
                <small>€</small>
              </span>
              {trendTxt && <span className="cond">{trendTxt}</span>}
              {used != null && (
                <button type="button" className="cond bud" onClick={() => setBudgetOpen(true)}>
                  {t("mn.budgetShort", { budget: eur0(budget!) })} · {budgetLine}
                </button>
              )}
            </div>
          )}
          <MissingReceipts g={g} />
          {rbtns}
          {seg}
          {perNav}
          {!g && total > 0 && (
            <button type="button" className="card sum tapc" onClick={() => per === "month" && setBudgetOpen(true)}>
              <Donut cats={cats} center={used != null ? `${Math.round(used * 100)} %` : eur0(total)} sub={used != null ? t("mn.ofBudget", { budget: eur0(budget!) }) : title.toLowerCase()} />
              <div className="grow">
                <div className="meta">{t("mn.spent")}</div>
                <div className="price xl">{eur(total)}</div>
                {diff != null && (
                  <div className={`trend ${diff > 0 ? "up" : "dn"}`}>
                    <I n={diff > 0 ? "trend-up" : "trend-down"} w="bold" />
                    {trendTxt}
                  </div>
                )}
              </div>
            </button>
          )}
          {!g && per === "month" && (
            <button type="button" className="budl" onClick={() => setBudgetOpen(true)}>
              <span>{budget ? t("mn.budgetShort", { budget: eur0(budget) }) : t("mn.budget")}</span>
              <span className={budget && budget - total < 0 ? "over" : ""}>{budgetLine}</span>
            </button>
          )}
          {per === "month" && total > 0 &&
            (g ? (
              <div className="card glass2 wkc">
                <span className="kk">
                  <I n="calendar-blank" />
                  {t("mn.weeksIn", { month: title })}
                </span>
                <div className="wk">
                  {wk.map((w) => (
                    <div key={w.label}>
                      <span>{w.label}</span>
                      <span className="tr">
                        <i style={{ width: `${Math.max(2, (w.v / wmax) * 100)}%` }} />
                      </span>
                      <em>{eur0(w.v)}</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card wkc">
                <div className="k">{t("mn.weeksIn", { month: title })}</div>
                <div className="bars">
                  {wk.map((w) => (
                    <div key={w.label}>
                      <span className="bv">{eur0(w.v)}</span>
                      <span className="bb">
                        <i style={{ height: `${Math.max(3, (w.v / wmax) * 100)}%` }} />
                      </span>
                      <span className="bl">{w.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          {per === "year" && months.length > 0 && (
            <div className={`card wkc${g ? " glass2" : ""}`}>
              <span className="kk">
                <I n="calendar-blank" />
                {t("mn.months")}
              </span>
              <div className="wk">
                {months.map((m) => (
                  // ťuk na mesiac ho otvorí
                  <button type="button" key={m.month} className="wkrow" onClick={() => show("month", monthsBack(m.month))} aria-label={t("mn.openMonth", { month: monthName(Number(m.month.slice(5, 7))) })}>
                    <span>{monthShort(Number(m.month.slice(5, 7)))}</span>
                    <span className="tr">
                      <i style={{ width: `${Math.max(2, (m.amount / mmax) * 100)}%` }} />
                    </span>
                    <em>{eur0(m.amount)}</em>
                  </button>
                ))}
              </div>
            </div>
          )}
          {g && total > 0 && (
            <div className="mods">
              {topCat && (
                <button type="button" className="mod glass2" onClick={() => openCat(topCat.id)}>
                  <span className="kk">
                    <E k={cat(topCat.id).e} s={16} />
                    {t("mn.most")}
                  </span>
                  <span className="v">{eur0(topCat.amount)}</span>
                  <span className="d">{cat(topCat.id).name}</span>
                </button>
              )}
              {stores[0] && (
                <button type="button" className="mod glass2" onClick={() => openStore(stores[0]!.key)}>
                  <span className="kk">
                    <I n="storefront" />
                    {t("mn.store")}
                  </span>
                  <span className="v">{eur0(stores[0].amount)}</span>
                  <span className="d">
                    {stores[0].name} · {tn("mn.trips", stores[0].receipts)}
                  </span>
                </button>
              )}
              <button type="button" className="mod glass2" onClick={() => navigate("/receipts")}>
                <span className="kk">
                  <I n="receipt" />
                  {t("mn.receipts")}
                </span>
                <span className="v">{o?.receipts ?? 0}</span>
                <span className="d">{t("mn.avgTrip", { avg: eur0(total / Math.max(1, o?.receipts ?? 1)) })}</span>
              </button>
              <button type="button" className="mod glass2" onClick={() => setBudgetOpen(true)}>
                <span className="kk">
                  <I n="target" />
                  {t("mn.budget")}
                </span>
                <span className="v">{used != null ? `${Math.round(used * 100)} %` : budget ? eur0(budget) : "–"}</span>
                <span className="d">{used != null ? t("mn.ofMonth", { budget: eur0(budget!) }) : t("mn.monthly")}</span>
              </button>
            </div>
          )}
          {rest}
        </div>
      </div>
      <BudgetSheet key={String(budget)} open={budgetOpen} onClose={() => setBudgetOpen(false)} budget={budget} spent={per === "month" ? total : 0} />
    </div>
  );
}
