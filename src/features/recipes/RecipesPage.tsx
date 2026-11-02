/**
 * Recepty – prenesené z mockupu 1:1 (prototyp/src/cookbook.jsx Recipes): Kniha receptov (hľadanie, kategórie,
 * rýchly výber, odporúčané, zdroje), Moje (pridať vlastný, obľúbené, pridané vami, naposledy varené)
 * a Plán týždňa (7 dní; chýbajúce suroviny jedným ťuknutím do nákupu).
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProducts } from "@/features/analytics/api";
import { useLists } from "@/features/lists/api";
import { addDays, isoDay } from "@/features/lists/dates";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn, type Key } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, MkHeader, Seg } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Btn } from "@/mockup/kit";
import { useFavorites, usePlanRecipes, useRecipePlans, useRecipes } from "./api";
import { VoiceSearch } from "./common";
import { ImportSheet } from "./ImportSheet";
import { interpretQuery, matchesFilters, matchesTerms, recommendations, toListEntry } from "./logic";
import { CHEAP, RCATS, RCOLS, RCard, art, recipeRows, useRecipeFacts } from "./mk";
import { PlanSheet } from "./sheets";
import type { Recipe } from "./types";

type Tab = "discover" | "mine" | "plan";

export function RecipesPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const g = useTheme().style === "glass";
  const [params, setParams] = useSearchParams();
  const sec = (params.get("t") as Tab | null) ?? "discover";
  const setSec = (v: Tab) => setParams(v === "discover" ? {} : { t: v }, { replace: true });
  const recipes = useRecipes(household.id);
  const favs = useFavorites(household.id).data ?? new Set<string>();
  const plans = useRecipePlans(household.id).data ?? [];
  const lists = useLists(household.id).data ?? [];
  const products = useProducts(household.id).data;
  const planRecipes = usePlanRecipes(household.id);
  const { facts, est, isHome } = useRecipeFacts(household.id, recipes.all, recipes.find);
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [more, setMore] = useState(0);
  const [voice, setVoice] = useState(false);
  const [importing, setImporting] = useState<"photo" | "link" | null>(null);
  const [planDay, setPlanDay] = useState<string | null>(null);

  const open = (r: Recipe, list: Recipe[]) => navigate(`/recipes/r/${encodeURIComponent(r.id)}`, { state: { ids: list.map((x) => x.id) } });
  const card = (r: Recipe, list: Recipe[], wide?: boolean) => <RCard key={r.id} r={r} wide={wide} fav={favs.has(r.id)} fact={facts.get(r.id)} onOpen={() => open(r, list)} />;

  // Hľadanie v knihe: „niečo rýchle s kuracím“ → filtre + slová. Appka si recepty nevymýšľa.
  const results = useMemo(() => {
    if (!query.trim()) return null;
    const { terms, filters } = interpretQuery(query);
    const strong = recipes.all.filter((r) => matchesFilters(r, filters) && matchesTerms(r, terms));
    if (strong.length) return { miss: false, list: strong.slice(0, 4 + more * 4), total: strong.length };
    const loose = recipes.all.filter((r) => matchesFilters(r, filters) || terms.some((w) => matchesTerms(r, [w])));
    return { miss: true, list: loose.slice(0, 4), total: loose.length };
  }, [query, more, recipes.all]);
  const run = (v: string) => {
    setQuery(v.trim());
    setMore(0);
  };

  // Plán týždňa
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const k = isoDay(d);
    const p = plans.find((x) => x.status === "PENDING" && x.planned_on === k);
    return { d, k, i, p, r: p ? recipes.find(p.recipe_key) : undefined };
  });
  const target = lists
    .filter((l) => !l.completed_at)
    .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999"))[0];
  const planned = days.filter((x) => x.r);
  const missingRows = planned.flatMap((x) => recipeRows(x.r!, x.p!.portions, recipes.find, est, isHome).filter((row) => !row.home));
  const addPlanned = () => {
    if (!target) return;
    planRecipes.mutate(
      {
        listId: target.id,
        newList: null,
        items: missingRows.map(toListEntry),
        recipes: planned.map((x) => ({ key: x.r!.id, name: x.r!.name, portions: x.p!.portions, day: x.k })),
      },
      {
        onSuccess: () => {
          toast.show(t("rk.planAdded", { items: tn("rk.ingredients", missingRows.length), name: target.name }), "success");
          navigate("/lists", { state: { highlight: target.id } });
        },
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );
  };

  const recom = useMemo(
    () => recommendations(recipes.catalog, (products ?? []).slice(0, 80).map((p) => p.name), 6).map((x) => x.recipe),
    [recipes.catalog, products],
  );
  const favList = recipes.all.filter((r) => favs.has(r.id));
  const cooked = [...new Map(plans.filter((p) => p.status === "COOKED").sort((a, b) => (b.cooked_at ?? "").localeCompare(a.cooked_at ?? "")).map((p) => [p.recipe_key, p])).values()]
    .map((p) => recipes.find(p.recipe_key))
    .filter((r): r is Recipe => !!r)
    .slice(0, 6);
  const sources = [...new Set(recipes.mine.map((r) => r.source || t("rk.srcMine")))];
  const count = (test: ((r: Recipe) => boolean) | null) => (test ? recipes.catalog.filter(test).length : recipes.catalog.filter((r) => (facts.get(r.id)?.cost ?? 99) <= CHEAP).length);

  return (
    <div className="stack">
      <MkHeader title={t("recipes.title")} right={<HelpBtn screen="recipes" />}>
        <Seg<Tab>
          items={[
            ["discover", t("rk.book")],
            ["mine", t("rk.mine")],
            ["plan", t("rk.plan")],
          ]}
          value={sec}
          onChange={setSec}
        />
      </MkHeader>
      <div className="bhm bhm-list">
        <div className="body">
          {sec === "discover" && (
            <>
              <form
                className={`search${g ? " glass2" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(q);
                  e.currentTarget.querySelector("input")?.blur();
                }}
              >
                <I n="magnifying-glass" w="bold" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("rk.searchPh")} enterKeyHint="search" autoComplete="off" aria-label={t("rk.searchAria")} />
                {q ? (
                  <button
                    type="button"
                    className="m soft"
                    onClick={() => {
                      setQ("");
                      run("");
                    }}
                    aria-label={t("rk.clear")}
                  >
                    <I n="x" w="bold" />
                  </button>
                ) : (
                  <button type="button" className="m" onClick={() => setVoice(true)} aria-label={t("rc.voiceSearch")}>
                    <I n="microphone" />
                  </button>
                )}
              </form>
              {results ? (
                <>
                  <div className="h2">
                    {results.miss ? t("rk.similar") : t("rk.results")}
                    <button
                      type="button"
                      className="a"
                      onClick={() => {
                        setQ("");
                        run("");
                      }}
                    >
                      {t("rk.backToBook")}
                    </button>
                  </div>
                  {results.miss && (
                    <div className="card wish">
                      <span className="wi">
                        <I n="book-open-text" />
                      </span>
                      <div className="grow">
                        <div className="t1">{t("rk.missT", { q: query })}</div>
                        <p className="meta">{t("rk.missText")}</p>
                      </div>
                    </div>
                  )}
                  <div className="rgrid2">
                    {results.list.map((r, i) => (
                      <div key={r.id} className="rin" style={{ "--d": `${(i % 4) * 90}ms` } as React.CSSProperties}>
                        {card(r, results.list)}
                      </div>
                    ))}
                  </div>
                  {!results.miss && results.total > results.list.length && (
                    <Btn cls="soft full" onClick={() => setMore((m) => m + 1)}>
                      <I n="magnifying-glass" />
                      {t("rk.more")}
                    </Btn>
                  )}
                </>
              ) : (
                <>
                  <button type="button" className="tentry" onClick={() => navigate("/recipes/taste")}>
                    <span className="te-ph">
                      <i className="pic-gulas_p" />
                      <i className="pic-palacinky_p" />
                      <i className="pic-rizoto_p" />
                    </span>
                    <span className="te-tx">
                      <b>{t("rk.tasteT")}</b>
                      <small>{t("rk.tasteS")}</small>
                    </span>
                    <span className="te-go">
                      <I n="play" />
                    </span>
                  </button>
                  <div className="h2">{t("rk.cats")}</div>
                  <div className="cgrid">
                    {RCATS.map((c) => (
                      <button type="button" key={c.id} className={`ctile pic-${c.pic}`} onClick={() => navigate(`/recipes/c/cat/${c.id}`)}>
                        <span>
                          <b>{t(`rk.cat.${c.id}` as Key)}</b>
                          <small>{tn("rk.recipes", recipes.all.filter(c.test).length)}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="h2">{t("rk.quick")}</div>
                  <div className="chips">
                    {RCOLS.map((c) => (
                      <button type="button" key={c.id} className="chip" onClick={() => navigate(`/recipes/c/col/${c.id}`)}>
                        <E k={c.e} />
                        {t(`rk.col.${c.id}` as Key)}
                        <span className="cn">{count(c.test)}</span>
                      </button>
                    ))}
                  </div>
                  {recom.length > 0 && (
                    <>
                      <div className="h2">{t("rk.recommend")}</div>
                      <div className="rrow">{recom.map((r) => card(r, recom, true))}</div>
                    </>
                  )}
                  <div className="h2">{t("rk.sources")}</div>
                  <div className={`lst${g ? " glass2" : ""}`}>
                    <button type="button" className="row tap" onClick={() => navigate("/recipes/c/cat/all")}>
                      <span className="th ic">
                        <I n="books" />
                      </span>
                      <div className="tx">
                        <b>{t("rk.srcBook")}</b>
                        <span className="sub">{tn("rk.recipes", recipes.catalog.length)}</span>
                      </div>
                      <I n="caret-right" w="bold" cls="chev" />
                    </button>
                    {sources.map((s) => (
                      <button type="button" key={s} className="row tap" onClick={() => navigate(`/recipes/c/src/${encodeURIComponent(s)}`)}>
                        <span className="th ic">
                          <I n={s.includes(".") ? "globe" : "cooking-pot"} />
                        </span>
                        <div className="tx">
                          <b>{s}</b>
                          <span className="sub">{tn("rk.recipes", recipes.mine.filter((r) => (r.source || t("rk.srcMine")) === s).length)}</span>
                        </div>
                        <I n="caret-right" w="bold" cls="chev" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {sec === "mine" && (
            <>
              <div className={`card addrec${g ? " glass2" : ""}`}>
                <div className="t1">{t("rk.addOwn")}</div>
                <div className="ar3">
                  <button type="button" onClick={() => setImporting("photo")}>
                    <I n="camera" />
                    {t("rk.addPhoto")}
                    <small>{t("rk.addPhotoS")}</small>
                  </button>
                  <button type="button" onClick={() => setImporting("link")}>
                    <I n="link" />
                    {t("rk.addLink")}
                    <small>{t("rk.addLinkS")}</small>
                  </button>
                  <button type="button" onClick={() => setImporting("link")}>
                    <I n="microphone" />
                    {t("rk.addVoice")}
                    <small>{t("rk.addVoiceS")}</small>
                  </button>
                </div>
              </div>
              <div className="h2">
                {t("rk.favs")} <span className="cnt">{favList.length}</span>
              </div>
              {favList.length ? (
                <div className="rgrid2">{favList.map((r) => card(r, favList))}</div>
              ) : (
                <p className="vnote">
                  <I n="heart" />
                  {t("rk.favsEmpty")}
                </p>
              )}
              <div className="h2">
                {t("rk.own")} <span className="cnt">{recipes.mine.length}</span>
              </div>
              {recipes.mine.length ? (
                <div className="rgrid2">{recipes.mine.map((r) => card(r, recipes.mine))}</div>
              ) : (
                <p className="vnote">
                  <I n="info" />
                  {t("rk.ownEmpty")}
                </p>
              )}
              {cooked.length > 0 && (
                <>
                  <div className="h2">{t("rk.cooked")}</div>
                  <div className="rgrid2">{cooked.map((r) => card(r, cooked))}</div>
                </>
              )}
            </>
          )}

          {sec === "plan" && (
            <>
              <p className="meta">{t("rk.planIntro")}</p>
              <div className={`lst weekl${g ? " glass2" : ""}`}>
                {days.map((x) => {
                  const a = x.r ? art(x.r) : null;
                  const rows = x.r ? recipeRows(x.r, x.p!.portions, recipes.find, est, isHome) : [];
                  const miss = rows.filter((r) => !r.home).length;
                  return (
                    <button
                      type="button"
                      key={x.k}
                      className="row tap"
                      onClick={() =>
                        x.r ? navigate(`/recipes/r/${encodeURIComponent(x.r.id)}`, { state: { ids: planned.map((y) => y.r!.id) } }) : setPlanDay(x.k)
                      }
                    >
                      <span className="dayc">
                        <b>{x.i === 0 ? t("rk.today") : formatDateTime(x.d, { weekday: "short" })}</b>
                        <small>{x.d.getDate()}.</small>
                      </span>
                      {x.r && a ? (
                        <>
                          <span className={`th${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}>{!a.pic && <E k={a.e} />}</span>
                          <div className="tx">
                            <b>{x.r.name}</b>
                            <span className="sub">{t("rk.dayMeta", { min: x.r.minutes, state: miss ? t("rk.missN", { n: miss }) : t("rk.allHome") })}</span>
                          </div>
                        </>
                      ) : (
                        <div className="tx">
                          <span className="sub plan-empty">
                            <I n="plus" w="bold" />
                            {t("rk.pick")}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {missingRows.length > 0 && target && (
                <div className={`card dockc${g ? " glass2" : ""}`}>
                  <div className="grow">
                    <div className="t1">{t("rk.planMissing", { items: tn("rk.ingredients", missingRows.length) })}</div>
                    <div className="meta">{t("rk.planTo", { name: target.name })}</div>
                  </div>
                  <Btn cls="pri sm" onClick={addPlanned} disabled={planRecipes.isPending}>
                    {t("rk.add")}
                  </Btn>
                </div>
              )}
              {missingRows.length === 0 && planned.length > 0 && (
                <p className="vnote">
                  <I n="check-circle" />
                  {t("rk.planAllHome")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {voice && (
        <VoiceSearch
          onClose={() => setVoice(false)}
          onResult={(v) => {
            setVoice(false);
            setQ(v);
            run(v);
          }}
        />
      )}
      <ImportSheet open={!!importing} source={importing ?? "photo"} onClose={() => setImporting(null)} />
      <PlanSheet open={!!planDay} day={planDay} onClose={() => setPlanDay(null)} />
    </div>
  );
}
