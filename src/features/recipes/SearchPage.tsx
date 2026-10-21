import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronDown, Mic, Search, Sparkles, X } from "lucide-react";
import { Empty, ScreenHeader } from "@/components/kit";
import { cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn, type Key } from "@/i18n";
import { createRecipe, useFavorites, useRecipes } from "./api";
import { loadDraft, saveDraft } from "./cart";
import { MEATS } from "./catalog";
import { CartBar, RecipeRow, VoiceSearch } from "./common";
import { categoryName, interpretQuery, matchesFilters, matchesTerms, type Filters } from "./logic";
import type { Recipe } from "./types";

const TIMES = [20, 40, 60];
const PASTA_MEAT = ["bravcove", "hovadzie", "bez"] as const;

/** R2 – výsledky hľadania a filtrovania. Najprv moje recepty, potom katalóg. */
export function SearchPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const recipes = useRecipes(household.id);
  const favs = useFavorites(household.id);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState<string | null>(params.get("cat"));
  const [meat, setMeat] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [taste, setTaste] = useState<Filters["taste"]>(null);
  const [open, setOpen] = useState<"meat" | "time" | "taste" | null>(null);
  const [voice, setVoice] = useState(false);
  const [ai, setAi] = useState<"thinking" | string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (params.get("focus")) input.current?.focus();
  }, [params]);
  useEffect(() => setAi(null), [query]);

  const mode = params.get("similar") ? "similar" : params.get("favs") ? "favs" : "search";
  const similarTo = mode === "similar" ? loadDraft()?.recipe : null;
  const { terms, filters: implied, implied: impliedLabels } = interpretQuery(query);
  const f: Filters = { cat: cat || implied.cat, meat: meat || implied.meat, time: time || implied.time, taste: taste || implied.taste };

  let pool: Recipe[] = recipes.all;
  if (mode === "similar") pool = recipes.catalog.filter((r) => similarTo && r.category === similarTo.category && (r.meat === similarTo.meat || similarTo.meat === "bez"));
  if (mode === "favs") pool = pool.filter((r) => favs.data?.has(r.id));
  const results = pool.filter((r) => matchesTerms(r, terms) && matchesFilters(r, f));
  const mine = results.filter((r) => r.mine);
  const catalog = results.filter((r) => !r.mine);

  const title = mode === "similar" ? t("rc.similar") : mode === "favs" ? t("rc.favorites") : cat ? categoryName(cat) : t("rc.search");

  const makeAi = async () => {
    setAi("thinking");
    try {
      const recipe = await createRecipe(query.trim());
      saveDraft({ recipe, from: "ai" });
      navigate("/recipes/check");
    } catch (e) {
      setAi(errorMessage(e));
    }
  };

  const FilterChip = ({ id, label, value }: { id: "meat" | "time" | "taste"; label: string; value: string | null }) => (
    <button type="button" className={cx("chip", value && "on")} onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
      {value || label} <ChevronDown size={15} />
    </button>
  );

  return (
    <div className="stack">
      <ScreenHeader onBack={() => navigate(-1)} title={title} sub={similarTo?.name} />
      <div className="stack g-10" style={{ padding: "0 16px 8px" }}>
        {mode === "search" && (
          <form
            className="rc-search"
            onSubmit={(e) => {
              e.preventDefault();
              input.current?.blur();
            }}
          >
            <Search size={20} color="var(--text-3)" />
            <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rc.searchPlaceholder")} aria-label={t("rc.searchAria")} enterKeyHint="search" />
            {query && (
              <button type="button" className="ibtn sm" onClick={() => setQuery("")} aria-label={t("an.clear")}>
                <X size={18} />
              </button>
            )}
            <button type="button" className="ibtn" onClick={() => setVoice(true)} aria-label={t("rc.voiceSearch")}>
              <Mic size={21} />
            </button>
          </form>
        )}
        <div className="chips">
          {cat && (
            <button type="button" className="chip on" onClick={() => setCat(null)} aria-label={t("rc.clearFilter", { name: categoryName(cat) })}>
              {categoryName(cat)} <X size={15} />
            </button>
          )}
          <FilterChip id="meat" label={t("rc.f.meat")} value={meat && t(`rc.meat.${meat}` as Key)} />
          <FilterChip id="time" label={t("rc.f.time")} value={time ? t("rc.upTo", { n: time }) : null} />
          <FilterChip id="taste" label={t("rc.f.taste")} value={taste ? t(`rc.taste.${taste}` as Key) : null} />
        </div>
        {open && (
          <div className="row wrap g-8 anim-drop">
            {open === "meat" &&
              MEATS.map((k) => (
                <button key={k} type="button" className={cx("chip soft", meat === k && "on")} onClick={() => { setMeat(meat === k ? null : k); setOpen(null); }}>
                  {t(`rc.meat.${k}` as Key)}
                </button>
              ))}
            {open === "time" &&
              TIMES.map((m) => (
                <button key={m} type="button" className={cx("chip soft", time === m && "on")} onClick={() => { setTime(time === m ? null : m); setOpen(null); }}>
                  {t("rc.upTo", { n: m })}
                </button>
              ))}
            {open === "taste" &&
              (["sladke", "slane"] as const).map((k) => (
                <button key={k} type="button" className={cx("chip soft", taste === k && "on")} onClick={() => { setTaste(taste === k ? null : k); setOpen(null); }}>
                  {t(`rc.taste.${k}`)}
                </button>
              ))}
          </div>
        )}
        {f.cat === "cestoviny" && !open && (
          <div className="chips">
            {PASTA_MEAT.map((k) => (
              <button key={k} type="button" className={cx("chip soft", meat === k && "on")} onClick={() => setMeat(meat === k ? null : k)}>
                {k === "bez" ? t("rc.meat.bez") : t("rc.withMeat", { name: t(`rc.meat.${k}` as Key).toLowerCase() })}
              </button>
            ))}
          </div>
        )}
        {impliedLabels.length > 0 && (
          <span className="t-xs t-2" style={{ padding: "0 4px" }}>
            {t("rc.understood", { what: impliedLabels.map((k) => t(k).toLowerCase()).join(" · ") })}
          </span>
        )}
      </div>

      <div className="stack g-16" style={{ padding: "4px 16px 0" }}>
        {mine.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{t("rc.mine")}</span>
            <div className="cells">
              {mine.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </div>
          </section>
        )}
        {catalog.length > 0 && (
          <section className="stack g-8">
            <span className="section-title">{mine.length ? t("rc.fromCatalog") : tn("rc.recipeCount", catalog.length)}</span>
            <div className="cells">
              {catalog.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </div>
          </section>
        )}
        {!results.length && mode === "favs" && <Empty icon={Sparkles} title={t("rc.favEmpty")} text={t("rc.favEmptyText")} />}
        {!results.length && mode === "similar" && <Empty icon={Search} title={t("rc.similarEmpty")} />}
        {!results.length && mode === "search" && (
          <div className="stack g-12">
            <Empty icon={Search} title={t("rc.notFound")} text={query ? t("rc.notFoundFor", { q: query }) : t("rc.notFoundFilters")} />
            {query.trim() && ai === null && (
              <button type="button" className="btn btn-ink btn-block" onClick={() => void makeAi()}>
                <Sparkles size={18} /> {t("rc.createAi", { q: query.trim() })}
              </button>
            )}
            {ai === "thinking" && (
              <div className="card row g-10 pad">
                <Sparkles size={18} className="pulse" />
                <span className="t-body">{t("rc.creating")}</span>
              </div>
            )}
            {ai && ai !== "thinking" && (
              <div className="card stack g-8 pad anim-rise">
                <span className="t-body">{ai}</span>
                <button type="button" className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => void makeAi()}>
                  {t("common.retry")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="tab-space" style={{ height: 176 }} />
      <CartBar />
      {voice && (
        <VoiceSearch
          onClose={() => setVoice(false)}
          onResult={(q) => {
            setVoice(false);
            setQuery(q);
            setMeat(null);
            setTime(null);
            setTaste(null);
          }}
        />
      )}
    </div>
  );
}
