import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, ChefHat, Heart, Link2, Mic, Repeat, Search, ShoppingBasket, Sparkles, X } from "lucide-react";
import { ScreenHeader } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProducts } from "@/features/analytics/api";
import { useLists } from "@/features/lists/api";
import { listDay } from "@/features/lists/dates";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn } from "@/i18n";
import { useRecipePlans, useRecipes, useSetPlanStatus, type RecipePlan } from "./api";
import { useCart } from "./cart";
import { RECIPE_CATEGORIES } from "./catalog";
import { Cover, RIcon, RecipeRow, VoiceSearch } from "./common";
import { ImportSheet } from "./ImportSheet";
import { categoryName, mergeIngredients, recipeMeta, recommendations } from "./logic";
import type { Recipe } from "./types";

/** R1 – Recepty: hľadanie, import, čakajúce recepty, pre teba, kategórie, moje recepty. */
export function RecipesPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const recipes = useRecipes(household.id);
  const [voice, setVoice] = useState(false);
  const [importing, setImporting] = useState<"photo" | "link" | null>(null);

  return (
    <div className="stack">
      <ScreenHeader
        title={t("recipes.title")}
        right={
          <button type="button" className="ibtn" onClick={() => navigate("/recipes/search?favs=1")} aria-label={t("rc.favorites")}>
            <Heart size={22} />
          </button>
        }
      />
      <div className="stack g-24" style={{ padding: "4px 16px 0" }}>
        <div className="stack g-10">
          <div className="rc-search">
            <Search size={20} color="var(--text-3)" />
            <button type="button" className="grow t-body t-3" style={{ minHeight: 50, textAlign: "left", fontSize: 16 }} onClick={() => navigate("/recipes/search?focus=1")}>
              {t("rc.searchPlaceholder")}
            </button>
            <button type="button" className="ibtn" onClick={() => setVoice(true)} aria-label={t("rc.voiceSearch")}>
              <Mic size={21} />
            </button>
          </div>
          <div className="row g-8">
            <button type="button" className="btn btn-line grow" style={{ padding: "0 10px", gap: 6, fontSize: 14 }} onClick={() => setImporting("photo")}>
              <Camera size={18} /> {t("rc.photoRecipe")}
            </button>
            <button type="button" className="btn btn-line grow" style={{ padding: "0 10px", gap: 6, fontSize: 14 }} onClick={() => setImporting("link")}>
              <Link2 size={18} /> {t("rc.linkOrText")}
            </button>
          </div>
        </div>

        <Waiting />
        <Featured catalog={recipes.catalog} find={recipes.find} />

        <section className="stack g-8">
          <span className="section-title">{t("rc.categories")}</span>
          <div className="rc-cats">
            {RECIPE_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className="rc-cat" onClick={() => navigate(`/recipes/search?cat=${c.id}`)}>
                <span className="ic" style={{ "--h": c.hue } as React.CSSProperties}>
                  <RIcon name={c.icon} size={19} strokeWidth={1.8} />
                </span>
                {categoryName(c.id)}
              </button>
            ))}
          </div>
        </section>

        <section className="stack g-8">
          <div className="section-head">
            <span className="section-title" style={{ padding: 0 }}>
              {t("rc.mine")}
            </span>
            {recipes.mine.length > 0 && <span className="t-sm t-2 num">{recipes.mine.length}</span>}
          </div>
          {recipes.mine.length ? (
            <div className="cells">
              {recipes.mine.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </div>
          ) : (
            <div className="card stack g-4" style={{ padding: 16 }}>
              <span className="t-h">{t("rc.mineEmpty")}</span>
              <span className="t-sm t-2">{t("rc.mineEmptyText")}</span>
            </div>
          )}
        </section>
      </div>
      <div className="tab-space" />
      {voice && (
        <VoiceSearch
          onClose={() => setVoice(false)}
          onResult={(q) => {
            setVoice(false);
            navigate(`/recipes/search?q=${encodeURIComponent(q)}`);
          }}
        />
      )}
      <ImportSheet open={!!importing} source={importing ?? "photo"} onClose={() => setImporting(null)} />
    </div>
  );
}

/** Čakajúce recepty: rozpracovaný nákup surovín a recepty, ktoré čakajú na uvarenie. */
function Waiting() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const c = useCart(household.id);
  const plans = useRecipePlans(household.id);
  const lists = useLists(household.id);
  const setStatus = useSetPlanStatus(household.id);
  const cartItems = c.items.filter((x) => recipes.find(x.recipeId));
  const pending = (plans.data ?? []).filter((p) => p.status === "PENDING");
  if (!cartItems.length && !pending.length) return null;
  const nIng = cartItems.length ? mergeIngredients(cartItems, recipes.find).length : 0;

  const remove = (p: RecipePlan) => {
    const fail = (e: unknown) => toast.show(errorMessage(e), "error");
    setStatus.mutate(
      { id: p.id, status: "DISMISSED" },
      {
        onSuccess: () => toast.show(t("rc.removedWaiting", { name: p.recipe_name }), "info", { undo: () => setStatus.mutate({ id: p.id, status: "PENDING" }, { onError: fail }) }),
        onError: fail,
      },
    );
  };

  return (
    <section className="stack g-8">
      <div className="section-head">
        <span className="t-h">{t("rc.waiting")}</span>
        <span className="t-sm t-2 num">{cartItems.length + pending.length}</span>
      </div>
      {cartItems.length > 0 && (
        <button type="button" className="rc-wait draft" onClick={() => navigate("/recipes/cart")}>
          <span className="bk">
            <ShoppingBasket size={20} />
          </span>
          <span className="grow stack g-2" style={{ minWidth: 0 }}>
            <span className="t-xs t-2">
              {t("rc.draft")} · {tn("rc.ingFor", cartItems.length)} · <span className="num">{nIng}</span>
            </span>
            <span className="t-h ellipsis">{cartItems.map((x) => recipes.find(x.recipeId)!.name).join(" + ")}</span>
          </span>
          <span className="btn btn-sm btn-ink">{t("rc.continue")}</span>
        </button>
      )}
      {pending.map((p) => {
        const r = recipes.find(p.recipe_key);
        const list = lists.data?.find((l) => l.id === p.list_id);
        const status = list
          ? list.completed_at
            ? t("rc.boughtIn", { name: list.name })
            : t("rc.inList", { name: list.name, day: listDay(list) })
          : t("rc.bought");
        return (
          <div key={p.id} className="rc-wait">
            <button type="button" className="row g-12 grow" style={{ minWidth: 0, textAlign: "left" }} onClick={() => r && navigate(`/recipes/r/${r.id}`)}>
              {r ? <Cover recipe={r} size="sm" /> : <span className="rc-cover sm"><ChefHat size={24} /></span>}
              <span className="grow stack g-2" style={{ minWidth: 0 }}>
                <span className="t-h">{r?.name ?? p.recipe_name}</span>
                <span className="t-xs t-2 rc-clamp">
                  {tn("rc.portions", p.portions)} · {status}
                </span>
              </span>
            </button>
            {r && (
              <button type="button" className="btn btn-sm btn-soft" onClick={() => navigate(`/recipes/r/${r.id}/cook?p=${p.portions}`)}>
                <ChefHat size={16} /> {t("rc.cook")}
              </button>
            )}
            <button type="button" className="ibtn sm" aria-label={t("rc.removeWaiting", { name: p.recipe_name })} onClick={() => remove(p)}>
              <X size={17} />
            </button>
          </div>
        );
      })}
    </section>
  );
}

/**
 * „Pre teba“ (podľa nedávnych nákupov) / „Často varíte“ (z uvarených receptov domácnosti) –
 * pás kariet s bodkami na prechod medzi receptami.
 */
function Featured({ catalog, find }: { catalog: Recipe[]; find: (id: string) => Recipe | undefined }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const products = useProducts(household.id);
  const plans = useRecipePlans(household.id);
  const [mode, setMode] = useState<"me" | "often">("me");
  const [idx, setIdx] = useState(0);
  const rail = useRef<HTMLDivElement>(null);

  // Nové poradie pri každom otvorení obrazovky, nič sa samo neotáča.
  const recs = useMemo(() => {
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const recent = (products.data ?? []).filter((p) => p.last_date >= since).map((p) => p.name);
    return { list: recommendations(catalog, recent), basedOnShopping: recent.length > 0 };
  }, [catalog, products.data]);

  const often = useMemo(() => {
    const cooked = new Map<string, { n: number; last: string }>();
    for (const p of plans.data ?? []) {
      if (p.status !== "COOKED" || !p.cooked_at) continue;
      const x = cooked.get(p.recipe_key) ?? { n: 0, last: p.cooked_at };
      x.n += 1;
      if (p.cooked_at > x.last) x.last = p.cooked_at;
      cooked.set(p.recipe_key, x);
    }
    return [...cooked.entries()]
      .map(([id, x]) => ({ recipe: find(id), ...x }))
      .filter((x): x is { recipe: Recipe; n: number; last: string } => !!x.recipe)
      .sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))
      .slice(0, 7);
  }, [plans.data, find]);

  const items =
    mode === "me"
      ? recs.list.map(({ recipe, reason }) => ({ recipe, line: reason, icon: Sparkles }))
      : often.map((x) => ({ recipe: x.recipe, line: t("rc.cookedTimes", { n: x.n, date: formatDateTime(x.last, { day: "numeric", month: "numeric" }) }), icon: Repeat }));

  useEffect(() => {
    setIdx(0);
    rail.current?.scrollTo({ left: 0 });
  }, [mode]);
  if (!recs.list.length) return null;

  const goTo = (i: number) => {
    const el = rail.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
    setIdx(i);
  };
  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth || 1;
    setIdx(Math.round(el.scrollLeft / (w + 12)));
  };

  return (
    <section className="stack g-10">
      {often.length > 0 ? (
        <div className="section-head" style={{ paddingRight: 0 }}>
          <div className="seg rc-feat-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "me"} className={cx(mode === "me" && "on")} onClick={() => setMode("me")}>
              <Sparkles size={14} /> {t("rc.forYou")}
            </button>
            <button type="button" role="tab" aria-selected={mode === "often"} className={cx(mode === "often" && "on")} onClick={() => setMode("often")}>
              <Repeat size={14} /> {t("rc.often")}
            </button>
          </div>
        </div>
      ) : (
        <span className="section-title">{t("rc.forYou")}</span>
      )}
      <span className="t-xs t-2" style={{ marginTop: -4, padding: "0 4px" }}>
        {mode === "often" ? t("rc.oftenSub") : recs.basedOnShopping ? t("rc.forYouSub") : t("rc.forYouSubNone")}
      </span>
      <div className="rc-rail" ref={rail} onScroll={onScroll}>
        {items.map(({ recipe, line, icon: I }) => (
          <button key={recipe.id} type="button" className="card rc-card" onClick={() => navigate(`/recipes/r/${recipe.id}`)}>
            <Cover recipe={recipe} size="md" />
            <span className="stack g-2" style={{ padding: "0 6px" }}>
              <span className="t-h">{recipe.name}</span>
              <span className="t-sm t-2">{recipeMeta(recipe)}</span>
              <span className="row g-4 t-xs t-accent" style={{ marginTop: 4 }}>
                <I size={13} /> <span className="ellipsis">{line}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="rc-dots">
        {items.map((x, i) => (
          <button key={x.recipe.id} type="button" className={cx(i === idx && "on")} onClick={() => goTo(i)} aria-label={t("rc.recipeN", { n: i + 1 })} />
        ))}
      </div>
    </section>
  );
}
