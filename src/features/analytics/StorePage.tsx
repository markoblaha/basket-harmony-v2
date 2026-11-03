/**
 * Obchod vo Výdavkoch – z mockupu (money.jsx StoreScreen): spolu a počet nákupov, čo tu kupujete (kategórie)
 * a bločky z tohto obchodu za obdobie.
 */
import { useNavigate, useParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { formatDateTime, t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, useScrolled } from "@/mockup/ui";
import { StoreTile, eur, storeKeyOf } from "@/mockup/kit";
import { useStoreDetail } from "./api";
import { cat, usePer } from "./money";

export function StorePage() {
  const { key = "_none" } = useParams();
  const storeKey = decodeURIComponent(key);
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const { period, qs, title } = usePer();
  const q = useStoreDetail(household.id, storeKey, period);
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
              {cats.length > 0 && (
                <>
                  <div className="h2 sm">{t("mn.buyHere")}</div>
                  <div className={`card cats${g ? " glass2" : ""}`}>
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
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="h2 sm">{t("mn.receipts")}</div>
              <div className={`lst${g ? " glass2" : ""}`}>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
