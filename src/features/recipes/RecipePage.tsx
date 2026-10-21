import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronDown, ChevronRight, House, Play, ShoppingBasket, Timer, Trash2 } from "lucide-react";
import { BottomSheet, Empty, ProgressBar, ScreenHeader, Seg, SheetHeader, Stepper, haptic } from "@/components/kit";
import { Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn, type Key } from "@/i18n";
import { useDeleteRecipe, useRecipes } from "./api";
import { cart, useCart } from "./cart";
import { AiBadge, Cover, FavButton } from "./common";
import {
  NUTRIENTS, fmtNutrient, formatAmount, ingName, isStaple, mergeIngredients, recipeMeta, recipeNutrition, renderStep, riPct, scaleIngredients,
  type NutrientId,
} from "./logic";
import type { Recipe } from "./types";
import { useSetting } from "@/lib/settings";

const PORTION_CHIPS = [2, 4, 6, 8];

/** R4 – detail receptu s prepočtom porcií. */
export function RecipePage() {
  const { id = "" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const c = useCart(household.id);
  const del = useDeleteRecipe(household.id);
  const r = recipes.find(id);
  const inCart = c.items.find((x) => x.recipeId === id);
  const [chosen, setPortions] = useState<number | null>(null);
  const [nutri, setNutri] = useState(false);
  const [nutritionOn] = useSetting("nutrition");
  const [confirmDel, setConfirmDel] = useState(false);

  if (!r && recipes.isPending) return <Spinner />;
  if (!r) {
    return (
      <div className="stack">
        <ScreenHeader onBack={() => navigate("/recipes")} title={t("rc.recipe")} />
        <Empty title={t("rc.notFoundOne")} />
      </div>
    );
  }
  const portions = chosen ?? inCart?.portions ?? r.portions;
  const scaled = scaleIngredients(r, portions);
  const nu = recipeNutrition(r);
  const p = nu.perPortion;
  // Výber na nákup s týmto receptom (a jeho porciami) – kvôli počtu receptov a surovín.
  const selection = [...c.items.filter((x) => x.recipeId !== r.id), { recipeId: r.id, portions }];
  const nIng = mergeIngredients(selection, recipes.find).length;

  const shop = () => {
    cart.set(household.id, r.id, portions);
    haptic();
    navigate("/recipes/cart");
  };
  const remove = () => {
    setConfirmDel(false);
    del.mutate(r.id, {
      onSuccess: () => {
        cart.remove(household.id, r.id);
        toast.show(t("rc.deleted"));
        navigate("/recipes", { replace: true });
      },
      onError: (e) => toast.show(errorMessage(e), "error"),
    });
  };

  return (
    <div className="stack">
      <ScreenHeader onBack={() => navigate(-1)} title={r.name} right={<FavButton id={r.id} />} />
      <div className="stack g-20" style={{ padding: "4px 16px 0" }}>
        <Cover recipe={r} size="lg" />
        <div className="stack g-4">
          <span className="t-big">{r.name}</span>
          <span className="t-body t-2">
            {recipeMeta(r)}
            {r.meat !== "bez" ? ` · ${t(`rc.meat.${r.meat}` as Key)}` : ` · ${t("rc.meat.bez")}`}
          </span>
          <span className="row g-6 t-sm t-3">
            {t("rc.source", { source: r.mine ? r.source || t("rc.mineSource") : t("rc.catalogSource") })}
            {r.ai && <AiBadge />}
          </span>
          {r.sourceUrl && (
            <a className="t-sm link ellipsis" href={r.sourceUrl} target="_blank" rel="noreferrer noopener">
              {r.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>

        <section className="stack g-8">
          <span className="section-title">{t("rc.portionsLabel")}</span>
          <div className="row g-8">
            <div className="row g-6 grow" style={{ overflowX: "auto" }}>
              {PORTION_CHIPS.map((n) => (
                <button key={n} type="button" className={cx("chip lg num", portions === n && "on")} onClick={() => setPortions(n)} aria-pressed={portions === n}>
                  {n}
                </button>
              ))}
            </div>
            <Stepper value={portions} min={1} onChange={setPortions} />
          </div>
        </section>

        {nutritionOn && <button type="button" className="card rc-nstrip" onClick={() => setNutri(true)} aria-label={t("rc.n.perPortionAria")}>
          {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
            <span key={k} className="stack" style={{ textAlign: "left" }}>
              <span className="t-h num">{k === "kcal" ? Math.round(p.kcal) : `${Math.round(p[k])} g`}</span>
              <span className="t-xs t-2">{t(`rc.n.short.${k}`)}</span>
            </span>
          ))}
          <span className="t-xs t-3" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            {t("rc.n.perPortionApprox")} <span className="grow" /> {t("rc.n.details")} <ChevronRight size={15} />
          </span>
        </button>}

        <section className="stack g-8">
          <div className="section-head">
            <span className="section-title" style={{ padding: 0 }}>{t("rc.ingredients")}</span>
            <span className="t-sm t-2">{tn("rc.forPortions", portions)}</span>
          </div>
          <div className="cells">
            {scaled.map((ing, i) => {
              const home = isStaple(ing.food);
              return (
                <div key={i} className="cell" style={{ minHeight: 48 }}>
                  <span className="grow stack">
                    <span className={cx("t-body", home && "t-2")}>{ingName(ing)}</span>
                    {(ing.note || home) && (
                      <span className="t-xs t-3 row g-4">
                        {home && (
                          <>
                            <House size={12} /> {t("rc.usuallyHome")}
                          </>
                        )}
                        {home && ing.note ? " · " : ""}
                        {ing.note}
                      </span>
                    )}
                  </span>
                  <span className="t-body num fw-6" style={{ textAlign: "right" }}>{formatAmount(ing.qty, ing.unit)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="stack g-8">
          <span className="section-title">{t("rc.steps")}</span>
          <button type="button" className="btn btn-line btn-block" onClick={() => navigate(`/recipes/r/${r.id}/cook?p=${portions}`)}>
            <Play size={17} /> {t("rc.cookStepByStep")}
          </button>
          <div className="cells">
            {r.steps.map((st, i) => (
              <div key={i} className="rc-step">
                <span className="no num">{i + 1}</span>
                <span className="grow stack g-6">
                  <span className="t-body">{renderStep(st.text, scaled)}</span>
                  {st.timerMin ? (
                    <span className="row g-4 t-xs t-2">
                      <Timer size={13} /> {t("rc.minutes", { n: st.timerMin })}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>

        {r.mine && (
          <button type="button" className="btn btn-ghost btn-block" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(true)}>
            <Trash2 size={17} /> {t("rc.deleteRecipe")}
          </button>
        )}
      </div>
      <div style={{ height: 190 }} />
      <div className="bottom-cta fixed inset-x-0 mx-auto max-w-2xl" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <div className="stack g-8">
          <div className="rc-sel">
            <ShoppingBasket size={16} />
            <span className="grow">
              {tn("rc.selectionN", selection.length)} · <span className="num">{selection.length}</span>
            </span>
            <span className="num t-2">{tn("rc.ingredientCount", nIng)}</span>
          </div>
          <button type="button" className="btn btn-ink btn-lg btn-block" onClick={shop}>
            <ShoppingBasket size={18} /> {t("rc.buyIngredients")}
          </button>
        </div>
      </div>

      <NutritionSheet open={nutri} onClose={() => setNutri(false)} recipeId={r.id} />
      <BottomSheet open={confirmDel} onClose={() => setConfirmDel(false)} label={t("rc.deleteRecipe")}>
        <SheetHeader title={t("rc.deleteConfirm", { name: r.name })} onClose={() => setConfirmDel(false)} />
        <div className="sheet-body stack g-8">
          <span className="t-sm t-2">{t("rc.deleteText")}</span>
          <button type="button" className="btn btn-block" style={{ background: "var(--red)", color: "#fff" }} onClick={remove}>
            <Trash2 size={17} /> {t("common.delete")}
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={() => setConfirmDel(false)}>{t("common.cancel")}</button>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ================================================================== R4b – výživové hodnoty */
function NutriTable({ values, per100 }: { values: Record<NutrientId, number>; per100?: boolean }) {
  return (
    <div className="cells">
      {NUTRIENTS.map((n) => {
        const v = values[n.id];
        const pct = riPct(v, n.ri);
        return (
          <div key={n.id} className={cx("rc-nrow", n.sub && "sub")}>
            <span className="lbl t-body">{t(`rc.n.${n.id}`)}</span>
            <span className="t-body num fw-6" style={{ textAlign: "right" }}>{fmtNutrient(v, n.id)}</span>
            <span className="stack g-2">
              {pct == null ? (
                <span className="t-xs t-3" style={{ textAlign: "right" }}>{t("rc.n.noRi")}</span>
              ) : (
                <>
                  <span className="t-xs t-2 num" style={{ textAlign: "right" }}>{t("rc.n.ri", { n: Math.round(pct) })}</span>
                  <ProgressBar value={pct / 100} color={pct > 40 && !per100 && ["fat", "sat", "sugar", "salt"].includes(n.id) ? "var(--orange)" : "var(--text-3)"} />
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Výživové hodnoty receptu alebo všetkých receptov v košíku. */
export function NutritionSheet({ open, onClose, recipeId, cartMode }: { open: boolean; onClose: () => void; recipeId?: string; cartMode?: boolean }) {
  const { household } = useHousehold();
  const recipes = useRecipes(household.id);
  const c = useCart(household.id);
  const [mode, setMode] = useState<"portion" | "100">("portion");
  const [how, setHow] = useState(false);
  const [scope, setScope] = useState<"one" | "cart">(cartMode && c.items.length > 1 ? "cart" : "one");
  const ids = scope === "cart" ? c.items.map((x) => x.recipeId) : [recipeId ?? c.items[0]?.recipeId ?? ""];
  const list = ids.map((x) => recipes.find(x)).filter((x): x is Recipe => !!x);
  const data = list.map((r) => ({ r, nu: recipeNutrition(r) }));
  const key = mode === "portion" ? "perPortion" : "per100";
  const sum = Object.fromEntries(NUTRIENTS.map((n) => [n.id, data.reduce((a, d) => a + d.nu.perPortion[n.id], 0)])) as Record<NutrientId, number>;
  const unknown = [...new Set(data.flatMap((d) => d.nu.unknown))];
  const skipped = [...new Set(data.flatMap((d) => d.nu.skipped))];
  const showScope = c.items.length > 1 && (recipeId ? c.items.some((x) => x.recipeId === recipeId) : true);

  return (
    <BottomSheet open={open} onClose={onClose} label={t("rc.n.title")}>
      <SheetHeader title={t("rc.n.title")} sub={t("rc.n.sub")} onClose={onClose} />
      <div className="sheet-body stack g-16">
        {showScope && (
          <Seg options={[{ value: "one", label: t("rc.n.thisRecipe") }, { value: "cart", label: t("rc.n.allInCart", { n: c.items.length }) }]} value={scope} onChange={setScope} />
        )}
        <Seg options={[{ value: "portion", label: t("rc.n.perPortion") }, { value: "100", label: t("rc.n.per100") }]} value={mode} onChange={setMode} />

        {data.map(({ r, nu }) => (
          <section key={r.id} className="stack g-8">
            <div className="section-head">
              <span className="t-h">{r.name}</span>
              <span className="t-xs t-2 num">{mode === "portion" ? t("rc.n.portionAbout", { g: Math.round(nu.portionGrams / 10) * 10 }) : t("rc.n.per100Dish")}</span>
            </div>
            <NutriTable values={nu[key]} per100={mode !== "portion"} />
            <span className="t-xs t-3" style={{ padding: "0 4px" }}>
              {tn("rc.n.estimate", nu.known)}
              {nu.unknown.length ? ` · ${t("rc.n.noData", { names: nu.unknown.join(", ") })}` : ""}
            </span>
          </section>
        ))}

        {scope === "cart" && data.length > 1 && (
          <section className="stack g-8">
            <div className="section-head">
              <span className="t-h">{t("rc.n.together")}</span>
            </div>
            <NutriTable values={sum} />
          </section>
        )}

        <div className="cells">
          <button type="button" className="cell" onClick={() => setHow(!how)} aria-expanded={how}>
            <span className="grow t-body fw-5">{t("rc.n.how")}</span>
            <ChevronDown size={18} className="chev" style={{ transform: how ? "rotate(180deg)" : "none" }} />
          </button>
          {how && (
            <div className="stack g-8 t-sm t-2" style={{ padding: "4px 14px 14px" }}>
              <span>{t("rc.n.how1")}</span>
              <span>{t("rc.n.how2")}</span>
              <span>
                {t("rc.n.how3")}
                {skipped.length ? ` ${t("rc.n.skipped", { names: skipped.join(", ").toLowerCase() })}` : ""}
                {unknown.length ? ` ${t("rc.n.noData", { names: unknown.join(", ") })}.` : ""}
              </span>
              <span>{t("rc.n.how4")}</span>
            </div>
          )}
        </div>
        <span className="t-xs t-3">{t("rc.n.disclaimer")}</span>
      </div>
    </BottomSheet>
  );
}
