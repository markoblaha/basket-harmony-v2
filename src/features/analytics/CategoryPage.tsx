/**
 * Kategória vo Výdavkoch – z mockupu (money.jsx CategoryScreen): suma za obdobie oproti minulému a druhy
 * (Pivo, Kuracie prsia…), ktoré spájajú značky a balenia. Ťuk na druh → detail druhu.
 */
import { useNavigate, useParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { readErrorMessage } from "@/features/receipts/format";
import { t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, Back, useScrolled } from "@/mockup/ui";
import { eur, emojiFor } from "@/mockup/kit";
import { useCategoryDetail } from "./api";
import { perUnit, qtyLabel } from "./bits";
import { cat, usePer } from "./money";

export function CategoryPage() {
  const { id = "other" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();
  const { period, qs, title, prevTitle } = usePer();
  const q = useCategoryDetail(household.id, id, period);
  const c = cat(id);
  const d = q.data;
  const kinds = d?.kinds ? [...d.kinds].sort((a, b) => b.amount - a.amount) : [];
  const max = kinds[0]?.amount ?? 1;
  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={t("mn.title")} onClick={() => navigate(-1)} />
            <span className="nbt">{c.name}</span>
            <span className="ibs" />
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <span className="tile lg" style={{ "--tc": c.col } as React.CSSProperties}>
              <E k={c.e} s={40} />
            </span>
            <div className="grow">
              <h1 className="lt">{c.name}</h1>
              <div className="meta">
                {title} · {tn("mn.kinds", kinds.length)}
              </div>
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
                  <div className="k">{title}</div>
                  <div className="price">{eur(d.amount)}</div>
                </div>
                <div className="ra">
                  <div className="k">{prevTitle}</div>
                  <div className="price mut">{eur(d.prev_amount)}</div>
                  {d.prev_amount > 0 && (
                    <div className={`trend sm ${d.amount > d.prev_amount ? "up" : "dn"}`}>
                      <I n={d.amount > d.prev_amount ? "trend-up" : "trend-down"} w="bold" />
                      {t(d.amount > d.prev_amount ? "mn.byMore" : "mn.byLess", { amount: eur(Math.abs(d.amount - d.prev_amount)) })}
                    </div>
                  )}
                </div>
              </div>
              <div className="h2 sm">{t("mn.bought")}</div>
              <div className={`lst${g ? " glass2" : ""}`}>
                {kinds.map((x) => (
                  <button type="button" key={x.key} className="row tap" onClick={() => navigate(`/analytics/kind/${encodeURIComponent(x.key)}${qs}`)}>
                    <span className="th">
                      <E k={emojiFor(x.name, id)} />
                    </span>
                    <div className="tx">
                      <b>{x.name}</b>
                      <span className="sub">{[`${x.count}×`, qtyLabel(x.units, x.basis), perUnit(x.avg_unit, x.basis)].filter(Boolean).join(" · ")}</span>
                      {(x.brands.length > 0 || x.products > 1) && (
                        <span className="sub br">
                          {x.brands.slice(0, 3).join(", ")}
                          {x.brands.length > 3 ? "…" : ""}
                          {x.products > 1 ? `${x.brands.length ? " · " : ""}${tn("mn.variants", x.products)}` : ""}
                        </span>
                      )}
                      <span className="ln">
                        <i style={{ width: `${(x.amount / max) * 100}%`, background: c.col }} />
                      </span>
                    </div>
                    <b className="amt">{eur(x.amount)}</b>
                    <I n="caret-right" w="bold" cls="chev" />
                  </button>
                ))}
                {!kinds.length && <p className="meta pad">{t("mn.catNothing")}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
