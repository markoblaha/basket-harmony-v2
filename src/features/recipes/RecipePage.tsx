import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { setNextTransition } from "@/components/navMotion";
import { ChevronDown } from "lucide-react";
import { BottomSheet, ProgressBar, Seg as KitSeg, SheetHeader } from "@/components/kit";
import { Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useEstimator } from "@/features/lists/estimate";
import { errorMessage } from "@/lib/errors";
import { t, tn, type Key } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, Back, Seg, Stepper, useScrolled } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Sheet } from "@/mockup/Sheet";
import { Btn, eur } from "@/mockup/kit";
import { useDeleteRecipe, useFavorites, useRecipes, useToggleFavorite } from "./api";
import { NUTRIENTS, fmtNutrient, formatAmount, recipeNutrition, renderStep, riPct, scaleIngredients, type NutrientId } from "./logic";
import { RCATS, art, recipeRows, useHave } from "./mk";
import { AddRecipeSheet, PlanSheet } from "./sheets";
import { BookIngredients, BookInfo, BookSteps, duration } from "./book";
import { PhotoSwiper } from "./Photos";
import { useCart } from "./cart";
import type { Recipe } from "./types";
import { useSetting } from "@/lib/settings";

/**
 * Detail receptu – prenesený z mockupu 1:1 (prototyp/src/cookbook.jsx RecipeScreen): fotka, čas, kcal, cena
 * za porciu, Naplánovať, Variť krok po kroku, porcie, suroviny s „mám doma“ (ťuk prepne), postup,
 * listovanie medzi receptmi a dole „Kúpiť N surovín“ → Pridať.
 */
export function RecipePage() {
  const { id = "" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const g = useTheme().style === "glass";
  const recipes = useRecipes(household.id);
  const favs = useFavorites(household.id).data;
  const toggleFav = useToggleFavorite(household.id);
  const del = useDeleteRecipe(household.id);
  const est = useEstimator(household.id);
  const { isHome, toggle } = useHave();
  const [nutritionOn] = useSetting("nutrition");
  const scrolled = useScrolled(220);
  const ids = ((location.state as { ids?: string[] } | null)?.ids ?? [id]).filter(Boolean);
  const idx = Math.max(0, ids.indexOf(id));
  const r = recipes.find(id);
  const [por, setPor] = useState(r?.portions ?? 4);
  const [tab, setTab] = useState<"ing" | "steps">("ing");
  const [sheet, setSheet] = useState<null | "add" | "plan" | "nutri" | "del">(null);
  useEffect(() => {
    if (r) setPor(r.portions);
    setTab("ing");
    window.scrollTo({ top: 0 });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r && recipes.isPending) return <Spinner />;
  if (!r) {
    return (
      <div className="bhm bhm-list">
        <div className="sc">
          <header className="nb">
            <Back label={t("recipes.title")} onClick={() => navigate("/recipes")} />
          </header>
        </div>
        <div className="empty">
          <E k="cooking" s={64} />
          <b>{t("rc.notFoundOne")}</b>
        </div>
      </div>
    );
  }
  const go = (d: number) => {
    const n = ids[idx + d];
    if (!n) return;
    // Ďalší recept prichádza sprava, predchádzajúci zľava (ako listovanie).
    setNextTransition(d > 0 ? "push" : "pop");
    navigate(`/recipes/r/${encodeURIComponent(n)}`, { replace: true, state: { ids } });
  };
  const a = art(r);
  const rows = recipeRows(r, por, recipes.find, est, isHome);
  const missing = rows.filter((x) => !x.home);
  const mcost = missing.reduce((s, x) => s + x.cost, 0);
  const perPortion = rows.filter((x) => !x.staple).reduce((s, x) => s + x.cost, 0) / Math.max(1, por);
  const scaled = scaleIngredients(r, por);
  const kcal = Math.round(recipeNutrition(r).perPortion.kcal);
  const fav = !!favs?.has(r.id);
  const cat = RCATS.find((c) => c.id !== "all" && c.test(r));
  const prev = ids[idx - 1] ? recipes.find(ids[idx - 1]!) : undefined;
  const next = ids[idx + 1] ? recipes.find(ids[idx + 1]!) : undefined;
  const cook = () => navigate(`/recipes/r/${encodeURIComponent(r.id)}/cook?p=${por}`);
  const share = () => {
    const txt =
      `${r.name} (${tn("rk.portions", por)})\n\n${t("rc.ingredients")}:\n` +
      scaled.map((x) => `• ${rows.find((y) => y.food === x.food)?.name ?? x.food} – ${formatAmount(x.qty, x.unit)}`).join("\n") +
      `\n\n${t("rc.steps")}:\n` +
      r.steps.map((st, i) => `${i + 1}. ${renderStep(st.text, scaled)}`).join("\n");
    try {
      void navigator.clipboard.writeText(txt).then(
        () => toast.show(t("rk.copied"), "success"),
        () => toast.show(t("lm.copyBlocked"), "error"),
      );
    } catch {
      toast.show(t("lm.copyBlocked"), "error");
    }
  };
  const swipe = { x: 0 };

  return (
    <>
      <div className="bhm bhm-top bhm-over">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb over">
            <Back label={t("recipes.title")} onClick={() => navigate(-1)} cls={g && !scrolled ? "wg" : ""} />
            <span className="nbt">{r.name}</span>
            <div className="nbr">
              <HelpBtn screen="recipe" cls={g && !scrolled ? "wg" : ""} />
              <IB n="export" cls={g && !scrolled ? "wg" : ""} label={t("rk.share")} onClick={share} />
              <IB
                n="heart"
                w={fav ? "fill" : "bold"}
                cls={`${g && !scrolled ? "wg" : ""}${fav ? " faved" : ""}`}
                label={fav ? t("rc.favRemove") : t("rc.favAdd")}
                onClick={() => {
                  toggleFav.mutate({ id: r.id, on: !fav }, { onError: (e) => toast.show(errorMessage(e), "error") });
                  toast.show(fav ? t("rc.favRemoved") : t("rk.favSaved"));
                }}
              />
            </div>
          </header>
        </div>
      </div>
      <div className="bhm bhm-list bhm-recipe">
        {r.book ? (
          <div key={r.id} className="rhero2 rgal rbook">
            <PhotoSwiper r={r} />
            {ids.length > 1 && (
              <span className="rpos">
                {idx + 1} / {ids.length}
              </span>
            )}
          </div>
        ) : (
        <div
          key={r.id}
          className={`rhero2${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => (swipe.x = e.clientX)}
          onPointerUp={(e) => {
            const d = e.clientX - swipe.x;
            if (d < -60) go(1);
            else if (d > 60) go(-1);
          }}
        >
          {!a.pic && <E k={a.e} />}
          {ids.length > 1 && (
            <span className="rpos">
              {idx + 1} / {ids.length}
            </span>
          )}
        </div>
        )}
        <div className="body rbody" key={`b${r.id}`}>
          <div>
            <div className="date">{[cat && t(`rk.cat.${cat.id}` as Key), r.book?.cuisine ?? (r.mine ? r.source || t("rk.srcMine") : t("rk.srcBook"))].filter(Boolean).join(" · ")}</div>
            <h1 className="lt rt">{r.name}</h1>
          </div>
          <div className="facts">
            <span>
              <I n="clock" />
              {r.book ? t("kb.work", { act: r.book.active, total: duration(r.minutes) }) : t("rk.minutes", { min: r.minutes })}
            </span>
            {r.book?.wait && <span>+ {r.book.wait}</span>}
            {r.book && <span>{t(`rc.diff.${r.difficulty}` as Key)}</span>}
            {kcal > 0 && (
              <span role={nutritionOn ? "button" : undefined} onClick={() => nutritionOn && setSheet("nutri")}>
                <I n="flame" />
                {kcal} kcal
              </span>
            )}
            {perPortion > 0 && <span className="gr">{t("rk.perPortion", { price: eur(perPortion) })}</span>}
          </div>
          <div className="acts2">
            <button type="button" onClick={() => setSheet("plan")}>
              <I n="calendar-blank" />
              {t("rk.planBtn")}
            </button>
            <button type="button" onClick={cook}>
              <I n="play" />
              {t("rc.cookStepByStep")}
            </button>
          </div>
          <Seg<"ing" | "steps">
            items={[
              ["ing", t("rk.tabIng", { n: r.book ? r.ingredients.length : rows.length })],
              ["steps", t("rk.tabSteps", { n: r.steps.length })],
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "ing" ? (
            <>
              <div className="portion">
                <span className="meta">{t("rk.forHowMany")}</span>
                <Stepper label={tn("rk.portions", por)} minDisabled={por <= 1} onMinus={() => setPor(Math.max(1, por - 1))} onPlus={() => setPor(Math.min(Math.max(12, r.portions * 2), por + 1))} />
              </div>
              {r.book ? (
                <BookIngredients r={r} portions={por} rows={rows} est={est} onToggle={(x) => toggle(r.id, x)} />
              ) : (
              <div className="ings">
                {rows.map((x) => (
                  <div key={x.key} className={`ing${x.home ? " home" : ""}${x.staple && !x.home ? " nohome" : ""}`} onClick={() => toggle(r.id, x)} role="button" aria-pressed={x.home}>
                    <span className="th">
                      <E k={est.emoji(x.name, x.cat)} />
                    </span>
                    <div className="tx">
                      <b>{x.name}</b>
                      <span className="sub">
                        {formatAmount(x.qty, x.unit)}
                        {x.home ? ` · ${t("rk.haveHome")}` : x.staple ? ` · ${t("rk.noHome")}` : x.cost ? ` · ~${eur(x.cost)}` : ""}
                      </span>
                    </div>
                    <span className={`cbx${x.home ? " on" : ""}`} aria-hidden="true">
                      <I n="check" w="bold" />
                    </span>
                  </div>
                ))}
              </div>
              )}
              <p className="hint">{t("rk.haveHint")}</p>
            </>
          ) : r.book ? (
            <BookSteps r={r} portions={por} />
          ) : (
            <ol className="steps">
              {r.steps.map((st, i) => (
                <li key={i}>
                  <span className="n">{i + 1}</span>
                  <p>
                    {renderStep(st.text, scaled)}
                    {st.timerMin ? <em> · {t("rk.minutes", { min: st.timerMin })}</em> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <BookInfo r={r} />
          {r.mine && (
            <Btn cls="danger soft full" onClick={() => setSheet("del")}>
              <I n="trash" />
              {t("rc.deleteRecipe")}
            </Btn>
          )}
          {ids.length > 1 && (
            <div className="pager">
              <button type="button" onClick={() => go(-1)} disabled={!prev}>
                <I n="caret-left" w="bold" />
                <span>
                  <small>{t("rk.prev")}</small>
                  {prev?.name ?? ""}
                </span>
              </button>
              <button type="button" onClick={() => go(1)} disabled={!next}>
                <span>
                  <small>{t("rk.next")}</small>
                  {next?.name ?? ""}
                </span>
                <I n="caret-right" w="bold" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="bhm bhm-dock">
        <div className="dock">
          {missing.length ? (
            <div className={`card dockc${g ? " glass2" : ""}`}>
              <div className="grow">
                <div className="t1">{t("rk.buyN", { items: tn("rk.ingredientsAcc", missing.length) })}</div>
                <div className="meta">{t("rk.buyMeta", { price: eur(mcost) })}</div>
              </div>
              <Btn cls={`pri sm${g ? " a" : ""}`} onClick={() => setSheet("add")}>
                <I n="basket" />
                {t("rk.add")}
              </Btn>
            </div>
          ) : (
            <div className={`card dockc allok${g ? " glass2" : ""}`}>
              <I n="check-circle" />
              <div className="grow">
                <div className="t1">{t("rk.allHomeT")}</div>
                <div className="meta">{t("rk.allHomeS")}</div>
              </div>
              <Btn cls={`pri sm${g ? " a" : ""}`} onClick={cook}>
                <I n="play" />
                {t("rk.cook")}
              </Btn>
            </div>
          )}
        </div>
      </div>
      <AddRecipeSheet open={sheet === "add"} onClose={() => setSheet(null)} r={r} portions={por} />
      <PlanSheet open={sheet === "plan"} onClose={() => setSheet(null)} rid={r.id} />
      <NutritionSheet open={sheet === "nutri"} onClose={() => setSheet(null)} recipeId={r.id} />
      <Sheet open={sheet === "del"} onClose={() => setSheet(null)} label={t("rc.deleteRecipe")}>
        <div className="sh-head">
          <h2>{t("rc.deleteConfirm", { name: r.name })}</h2>
        </div>
        <div className="sh-body">
          <p className="meta">{t("rc.deleteText")}</p>
          <div className="sh-act">
            <Btn cls="soft" onClick={() => setSheet(null)}>
              {t("common.cancel")}
            </Btn>
            <Btn
              cls="danger"
              onClick={() =>
                del.mutate(r.id, {
                  onSuccess: () => {
                    toast.show(t("rc.deleted"));
                    navigate("/recipes?t=mine", { replace: true });
                  },
                  onError: (e) => toast.show(errorMessage(e), "error"),
                })
              }
            >
              {t("common.delete")}
            </Btn>
          </div>
        </div>
      </Sheet>
    </>
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
          <KitSeg options={[{ value: "one", label: t("rc.n.thisRecipe") }, { value: "cart", label: t("rc.n.allInCart", { n: c.items.length }) }]} value={scope} onChange={setScope} />
        )}
        <KitSeg options={[{ value: "portion", label: t("rc.n.perPortion") }, { value: "100", label: t("rc.n.per100") }]} value={mode} onChange={setMode} />

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
