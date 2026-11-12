/**
 * Obchod vo Výdavkoch – z mockupu (money.jsx StoreScreen): spolu a počet nákupov, čo tu kupujete (kategórie)
 * a bločky z tohto obchodu za obdobie.
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, useScrolled } from "@/mockup/ui";
import { StoreTile, eur, storeKeyOf } from "@/mockup/kit";
import { usePriceStore, useStoreDetail } from "./api";
import { cat, usePer } from "./money";
import { perUnit } from "./bits";
import { Timeline } from "./charts";
import { useTimeline } from "./timeline";
import { Seg } from "@/mockup/ui";
import { emojiFor } from "@/mockup/kit";

export function StorePage() {
  const { key = "_none" } = useParams();
  const storeKey = decodeURIComponent(key);
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const { per, off, show, period, qs, title } = usePer();
  const [params] = useSearchParams();
  const hl = params.get("kind");
  const q = useStoreDetail(household.id, storeKey, period);
  const [tab, setTab] = useState<"kinds" | "cats" | "rcpt">("kinds");
  const prices = usePriceStore(household.id, storeKey, tab === "kinds");
  const tl = useTimeline(household.id, per, off, show, { store: storeKey });
  const gl = g ? " glass2" : "";
  const rows = prices.data ?? [];
  const win = rows.filter((r) => !r.best_key || r.best_key === storeKey).length;
  const d = q.data;
  const name = d?.name || storeKey;
  const cats = (d?.categories ?? []).filter((c) => c.amount > 0 && !c.id.startsWith("_")).sort((a, b) => b.amount - a.amount);
  const max = Math.max(1, ...cats.map((c) => c.amount));
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={t("mn.title")} onClick={() => navigate(-1)} />
            <span className="nbt">{name}</span>
            <span className="ibs" />
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <StoreTile k={storeKeyOf(name)} n={name} s={60} />
            <div className="grow">
              <h1 className="lt">{name}</h1>
              <div className="meta">{title}</div>
            </div>
          </div>
          {q.isPending ? (
            <Spinner />
          ) : q.isError || !d ? (
            <ErrorState error={readErrorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <>
              <div className={`card match${g ? " mg" : ""}`}>
                <div>
                  <div className="k">{t("mn.total")}</div>
                  <div className="price">{eur(d.amount)}</div>
                </div>
                <div className="ra">
                  <div className="k">{t("mn.trips2")}</div>
                  <div className="price mut">{d.receipts}</div>
                  <div className="meta sm">{t("mn.avgPer", { avg: eur(d.amount / Math.max(1, d.receipts)) })}</div>
                </div>
              </div>
              {tl.items.length > 0 && <Timeline title={per === "week" ? t("mn.tlWeeks") : t("mn.tlMonths")} items={tl.items} legendTap={per === "year" ? t("mn.tlTap") : undefined} />}
              <Seg<"kinds" | "cats" | "rcpt">
                items={[
                  ["kinds", t("mn.storeProducts")],
                  ["cats", t("mn.lensCats")],
                  ["rcpt", t("mn.receipts")],
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === "kinds" && (
                <div key="k" className="an-z an-fade">
                  {prices.isPending ? (
                    <Spinner />
                  ) : rows.length === 0 ? (
                    <p className="vnote">
                      <I n="info" />
                      {t("mn.storeNoPrices")}
                    </p>
                  ) : (
                    <>
                      <div className={`card insight${gl}`}>
                        <span className="tile">
                          <E k={win * 2 >= rows.length ? "moneybag" : "coin"} />
                        </span>
                        <div className="grow">
                          <div className="ib-t">{t("mn.storeWins", { n: win, total: rows.length })}</div>
                          <div className="meta">{t("mn.storeWinsD")}</div>
                        </div>
                      </div>
                      <div className={`lst${gl}`}>
                        {rows.map((r) => {
                          const cheaper = r.best_key && r.best_key !== storeKey && r.best_unit != null && r.best_unit < r.unit * 0.98;
                          return (
                            <button type="button" key={r.kind_key} className={`row tap${hl && hl.toLowerCase() === r.name.toLowerCase() ? " hl" : ""}`} onClick={() => navigate(`/analytics/kind/${encodeURIComponent(r.name)}`)}>
                              <span className="th">
                                <E k={emojiFor(r.name, r.category_id)} />
                              </span>
                              <div className="tx">
                                <b>{r.name}</b>
                                <span className="sub">{r.promo ? t("mn.onlyPromo") : cat(r.category_id).name}</span>
                              </div>
                              <div className="an-r">
                                <b className="amt">{perUnit(r.unit, r.basis)}</b>
                                {cheaper ? <span className="an-tag up">{t("mn.cheaperAt", { store: r.best_store ?? "", pct: Math.max(1, Math.round((1 - r.best_unit! / r.unit) * 100)) })}</span> : null}
                              </div>
                              <I n="caret-right" w="bold" cls="chev" />
                            </button>
                          );
                        })}
                      </div>
                      <p className="src-note">{t("mn.storePricesNote")}</p>
                    </>
                  )}
                </div>
              )}
              {tab === "cats" && cats.length > 0 && (
                <div key="c" className="an-z an-fade">
                  <div className={`card cats${gl}`}>
                    {cats.map((x) => {
                      const c = cat(x.id);
                      return (
                        <button type="button" key={x.id} className="cat" onClick={() => navigate(`/analytics/category/${x.id}${qs}`)}>
                          <span className="tile" style={{ "--tc": c.col } as React.CSSProperties}>
                            <E k={c.e} />
                          </span>
                          <div className="g1">
                            <div className="cr">
                              <span>{c.name}</span>
                              <em>{eur(x.amount)}</em>
                            </div>
                            <div className="ln">
                              <i style={{ width: `${(x.amount / max) * 100}%`, background: c.col }} />
                            </div>
                          </div>
                          <I n="caret-right" w="bold" cls="chev" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {tab === "rcpt" && (
                <div key="r" className={`lst an-fade${gl}`}>
                  {d.receipt_list.map((r) => (
                    <button type="button" key={r.receipt_id} className="row tap" onClick={() => navigate(`/receipts/${r.receipt_id}`)}>
                      <span className="th">
                        <E k="receipt" />
                      </span>
                      <div className="tx">
                        <b>
                          {formatDateTime(new Date(`${r.date}T00:00`), { day: "numeric", month: "numeric" })} {r.time?.slice(0, 5) ?? ""}
                        </b>
                        {r.status === "NEEDS_REVIEW" && <span className="sub">{t("mn.toCheck")}</span>}
                      </div>
                      <b className="amt">{eur(r.amount)}</b>
                      <I n="caret-right" w="bold" cls="chev" />
                    </button>
                  ))}
                  {!d.receipt_list.length && <p className="meta pad">{tn("mn.trips", 0)}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
