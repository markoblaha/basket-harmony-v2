/**
 * Výdavky 2.0 – podľa náhľadu prototyp/vydavky-navrh.html: súhrn s porovnaním k rovnakému dňu, Týždeň / Mesiac / Rok,
 * časová os (stĺpec = obdobie, ťuk ho vyberie), priebeh mesiaca s rozpočtom, kam peniaze odišli (prstenec +
 * kategórie, obchody), Oplatí sa vedieť a bločky. Všetky čísla počíta databáza (analytics_*), tu sa len zobrazia.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ErrorState } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { formatCalendarDate, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, MkHeader, Seg } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Btn, StoreTile, eur, eur0, storeKeyOf } from "@/mockup/kit";
import { useMissingSizes, useOverview, type Overview } from "./api";
import { BudgetSheet, CatRows, MissingReceipts, cat, perTitle, usePer, type Per } from "./money";
import { DaysCard, Donut, PaceCard, Timeline } from "./charts";
import { useTimeline } from "./timeline";
import { monthName } from "./period";

/** „Oplatí sa vedieť“: zdraženie / zlacnenie, čo asi dochádza a výrobky bez veľkosti balenia. */
function insights(o: Overview, missing: number) {
  const out: { key: string; e: string; t: string; d: string; to: string }[] = [];
  for (const p of o.price_changes.filter((x) => x.kind === "CHANGE").slice(0, 2)) {
    const pct = Math.round(p.change * 100);
    out.push({
      key: `c${p.product_id}`,
      e: pct > 0 ? "up" : "down",
      t: pct > 0 ? t("mn.insUp", { name: p.name, pct }) : t("mn.insDown", { name: p.name, pct: -pct }),
      d: t("mn.insPrice", { store: p.store_name, old: eur(p.old_price), now: eur(p.new_price) }),
      to: `/analytics/product/${p.product_id}`,
    });
  }
  for (const r of o.restock.slice(0, 1)) {
    out.push({
      key: `r${r.product_id}`,
      e: cat(r.category_id).e,
      t: t("mn.insRestock", { name: r.name }),
      d: t("mn.insRestockD", { every: r.interval_days, since: r.days_since }),
      to: `/analytics/product/${r.product_id}`,
    });
  }
  if (missing > 0) out.push({ key: "sizes", e: "tag", t: tn("mn.insSizes", missing), d: t("mn.insSizesD"), to: "/analytics/sizes" });
  return out.slice(0, 3);
}

export function MoneyPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const { per, off, set, go, show, period, qs, title } = usePer();
  const ov = useOverview(household.id, period);
  const tl = useTimeline(household.id, per, off, show);
  const missing = useMissingSizes(household.id).data?.length ?? 0;
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [lens, setLens] = useState<"cat" | "store">("cat");
  const [dsel, setDsel] = useState<string | null>(null);
  const [allCats, setAllCats] = useState(false);
  const o = ov.data;
  const cats = (o?.categories ?? []).filter((c) => !c.id.startsWith("_") && c.amount > 0.5).sort((a, b) => b.amount - a.amount);
  const total = o?.total ?? 0;
  const budget = o?.budgets.find((b) => b.category_id === null)?.amount ?? null;
  const stores = o?.stores ?? [];
  const openCat = (id: string) => navigate(`/analytics/category/${id}${qs}`);
  const openStore = (key: string) => navigate(`/analytics/store/${encodeURIComponent(key)}${qs}`);
  const ins = o && off === 0 ? insights(o, missing) : [];

  // Porovnanie: rovnaké dni minulého obdobia; bez neho, kým v minulom období ešte neboli bločky.
  const noCompare = !!tl.first && tl.first > period.prevFrom;
  const prev = o?.prev_to_date ?? o?.prev_total ?? 0;
  const prevLabel = o?.prev_to_date != null && o.prev_cut ? t("mn.toDay", { date: formatCalendarDate(o.prev_cut, { day: "numeric", month: "numeric" }) }) : per === "month" ? monthName(Number(period.prevFrom.slice(5, 7))) : per === "year" ? period.prevFrom.slice(0, 4) : t("mn.weekBefore");
  const d = total - prev;
  const cmp = !o ? null : noCompare ? { dir: 0, txt: t("mn.cmpNone", { date: formatCalendarDate(tl.first!, { day: "numeric", month: "numeric", year: "numeric" }) }) } : Math.abs(d) < 1 ? { dir: 0, txt: t("mn.cmpSame", { prev: prevLabel }) } : { dir: d > 0 ? 1 : -1, amt: eur0(Math.abs(d)), txt: t(d > 0 ? "mn.cmpUp" : "mn.cmpDown", { prev: prevLabel }) };

  // Priebeh mesiaca: denné súčty tohto a minulého mesiaca z časovej osi
  const pace = useMemo(() => {
    if (per !== "month") return null;
    const y = Number(period.month.slice(0, 4)), m = Number(period.month.slice(5));
    const days = new Date(y, m, 0).getDate();
    const byDay = new Map(tl.days.map((x) => [x.d, x.a]));
    const series = (from: string, n: number, to: string) => {
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const dd = new Date(`${from}T12:00:00`);
        dd.setDate(dd.getDate() + i);
        const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
        if (iso > to) break;
        out.push(byDay.get(iso) ?? 0);
      }
      return out;
    };
    const pm = new Date(y, m - 1, 0);
    const prevDays = pm.getDate();
    const prevFrom = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, "0")}-01`;
    return {
      days,
      daily: series(period.from, days, period.to),
      prevDaily: tl.first && tl.first <= prevFrom ? series(prevFrom, prevDays, `${prevFrom.slice(0, 8)}${String(prevDays).padStart(2, "0")}`) : null,
      prevDays,
      prevName: monthName(pm.getMonth() + 1),
    };
  }, [per, period.month, period.from, period.to, tl.days, tl.first]);

  const weekDays = useMemo(() => {
    if (per !== "week") return null;
    const byDay = new Map(tl.days.map((x) => [x.d, x.a]));
    const names = [t("mn.dow0"), t("mn.dow1"), t("mn.dow2"), t("mn.dow3"), t("mn.dow4"), t("mn.dow5"), t("mn.dow6")];
    return names.map((label, i) => {
      const dd = new Date(`${period.from}T12:00:00`);
      dd.setDate(dd.getDate() + i);
      const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
      return { label, v: iso <= period.to ? (byDay.get(iso) ?? 0) : 0, cur: iso === period.to && period.current };
    });
  }, [per, period.from, period.to, period.current, tl.days]);

  // potiahnutie po súhrne = predchádzajúce / novšie obdobie
  const sw = useRef<{ x: number; y: number } | null>(null);
  const canPrev = !tl.first || period.from > tl.first;
  const swipe = {
    onPointerDown: (e: React.PointerEvent) => (sw.current = { x: e.clientX, y: e.clientY }),
    onPointerUp: (e: React.PointerEvent) => {
      const s = sw.current;
      sw.current = null;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 48 && Math.abs(dy) < 40) {
        if (dx > 0 && canPrev) go(-1);
        if (dx < 0 && off < 0) go(1);
      }
    },
  };

  const left = budget != null ? budget - total : null;
  const perNav = (
    <div className="an-per">
      <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label={t("mn.prevPer")}>
        <I n="caret-left" w="bold" />
      </button>
      <span className="place" aria-live="polite">
        {title}
      </span>
      <button type="button" onClick={() => go(1)} disabled={off === 0} aria-label={t("mn.nextPer")}>
        <I n="caret-right" w="bold" />
      </button>
    </div>
  );
  const cond = cmp ? (
    cmp.dir ? (
      <span className={`cond ${cmp.dir > 0 ? "up" : "dn"}`}>
        <b>
          {cmp.dir > 0 ? "▲" : "▼"} {cmp.amt}
        </b>{" "}
        {cmp.txt}
      </span>
    ) : (
      <span className="cond">{cmp.txt}</span>
    )
  ) : null;
  const budgetLine =
    per === "month" && budget ? (
      <button type="button" className="cond bud" onClick={() => setBudgetOpen(true)}>
        {t("mn.budgetShort", { budget: eur0(budget) })} · {left! >= 0 ? t(period.current ? "mn.budgetLeft" : "mn.budgetKept", { left: eur0(left!) }) : t("mn.budgetOver", { over: eur0(-left!) })}
      </button>
    ) : per === "month" ? (
      <button type="button" className="cond bud" onClick={() => setBudgetOpen(true)}>
        {t("mn.budgetSetup")}
      </button>
    ) : null;

  const hero = g ? (
    <div className="wx an-hero" {...swipe}>
      {perNav}
      <span className="temp">
        {eur0(total).replace(/\s?€/, "")}
        <small>€</small>
      </span>
      {cond}
      {budgetLine}
    </div>
  ) : (
    <div {...swipe} className="an-z">
      {perNav}
      <div className="card an-sum">
        <div>
          <div className="k">{t("mn.spent")}</div>
          <div className="an-big">
            {eur0(total).replace(/\s?€/, "")}
            <small>€</small>
          </div>
        </div>
        <div className="an-sumr">
          {cmp && cmp.dir ? (
            <span className={`an-tag ${cmp.dir > 0 ? "up" : "good"}`}>
              {cmp.dir > 0 ? "▲" : "▼"} {cmp.amt}
            </span>
          ) : null}
          <span>{cmp?.txt}</span>
          {budgetLine}
        </div>
      </div>
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

  return (
    <div className="stack">
      <MkHeader
        title={g ? title : t("mn.title")}
        style={g ? { display: "none" } : undefined}
        right={
          <>
            <IB n="magnifying-glass" label={t("mn.search")} onClick={() => navigate("/analytics/products")} />
            <IB n="camera" label={t("sp.photo")} onClick={() => navigate("/scan")} />
            <HelpBtn screen="money" />
          </>
        }
      >
        {null}
      </MkHeader>
      <div className="bhm bhm-list">
        <div className="body">
          {ov.isError && <ErrorState error={errorMessage(ov.error)} onRetry={() => ov.refetch()} />}
          {hero}
          <Seg<Per>
            items={[
              ["week", t("mn.week")],
              ["month", t("mn.month")],
              ["year", t("mn.year")],
            ]}
            value={per}
            onChange={(p) => {
              setDsel(null);
              set(p);
            }}
          />
          {tl.items.length > 0 && <Timeline title={per === "week" ? t("mn.tlWeeks") : t("mn.tlMonths")} items={tl.items} budget={per === "month" ? budget : null} legendTap={per === "year" ? t("mn.tlTap") : undefined} />}
          <MissingReceipts g={g} />
          {pace && total > 0 && (
            <PaceCard
              from={period.from}
              days={pace.days}
              daily={pace.daily}
              prevDaily={pace.prevDaily}
              prevDays={pace.prevDays}
              partial={period.current}
              budget={budget}
              total={total}
              monthName={monthName(Number(period.month.slice(5)))}
              prevName={pace.prevName}
              onBudget={() => setBudgetOpen(true)}
            />
          )}
          {weekDays && total > 0 && <DaysCard items={weekDays} />}
          {empty || (
            <>
              <div className="h2">{t("mn.whereMoney")}</div>
              <Seg<"cat" | "store">
                items={[
                  ["cat", t("mn.lensCats")],
                  ["store", t("mn.stores")],
                ]}
                value={lens}
                onChange={setLens}
              />
              {lens === "cat" ? (
                <div key="cat" className="an-z an-fade">
                  {cats.length > 1 && (
                    <div className={`card cats${g ? " glass2" : ""}`}>
                      <Donut rows={cats} sel={dsel} onSel={setDsel} onOpen={(id) => (id === "_rest" ? (setAllCats(true), setDsel(null)) : openCat(id))} />
                    </div>
                  )}
                  <CatRows cats={cats} onOpen={openCat} g={g} sel={dsel} all={allCats} onAll={setAllCats} />
                </div>
              ) : (
                <div key="store" className="an-z an-fade">
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
                </div>
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
          <div className={`lst${g ? " glass2" : ""}`}>
            <button type="button" className="row tap" onClick={() => navigate("/receipts")}>
              <span className="th">
                <E k="receipt" />
              </span>
              <div className="tx">
                <b>{t("mn.receipts")}</b>
                <span className="sub">
                  {tn("mn.receiptsN", o?.receipts ?? 0)} · {perTitle(per, off).toLowerCase()}
                </span>
              </div>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
          </div>
          <p className="src-note">{t("mn.srcNote")}</p>
        </div>
      </div>
      <BudgetSheet key={String(budget)} open={budgetOpen} onClose={() => setBudgetOpen(false)} budget={budget} spent={per === "month" ? total : 0} />
    </div>
  );
}
