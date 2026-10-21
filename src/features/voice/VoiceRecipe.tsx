/**
 * Recepty v hlasovom nákupe.
 *
 * „Chcem uvariť hovädzí guláš“ → v diktovaní sa objaví karta s až 4 receptmi:
 * najprv vlastné a z katalógu (hneď), zvyšok navrhne AI (názvy za ~2 s, suroviny
 * všetkých variantov naraz na pozadí, takže po ťuknutí sú väčšinou hneď hotové).
 * Vybraný recept ukáže suroviny so zaškrtnutím (soľ, olej… ako „mám doma“),
 * počet porcií, a „Pridať“ ich vloží medzi položky s poznámkou „na …“.
 * Ovláda sa aj hlasom: „ten druhý“, „na šesť porcií“, „bez cibule“, „pridaj“.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, ChefHat, Pencil, RotateCw, X } from "lucide-react";
import { Stepper, haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { t, tn, type Key } from "@/i18n";
import { useRecipes, recipeVariants, suggestRecipe, type RecipeDraft } from "@/features/recipes/api";
import { interpretQuery, matchesFilters, matchesTerms } from "@/features/recipes/logic";
import { Cover, RIcon } from "@/features/recipes/common";
import type { Recipe } from "@/features/recipes/types";
import { guessCategory } from "@/lib/categories";
import type { DraftItem, VoicePlan } from "./api";
import { ingredientRows, rowToItem, sameDish, type IngredientRow } from "./recipeVoice";
import type { VoiceUnit } from "./parse";

export type Option = {
  id: string;
  source: "mine" | "catalog" | "ai";
  name: string;
  variant: string;
  minutes: number;
  difficulty: number;
  icon: string | null;
  /** Celý recept (pri AI až po dopočítaní surovín). */
  recipe: Recipe | null;
  draft: RecipeDraft | null;
  failed?: boolean;
};

export type Card = {
  id: string;
  query: string;
  /** Veta, z ktorej karta vznikla (AI ju môže spresniť). */
  seq: number;
  status: "loading" | "ready" | "error" | "added";
  options: Option[];
  sel: number | null;
  portions: number;
  /** Odškrtnuté suroviny (kľúče riadkov). */
  off: string[];
};

const MAX = 4;
const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function fromRecipe(r: Recipe): Option {
  return {
    id: r.id,
    source: r.mine ? "mine" : "catalog",
    name: r.name,
    variant: "",
    minutes: r.minutes,
    difficulty: r.difficulty,
    icon: r.icon,
    recipe: r,
    draft: null,
  };
}

/** Riadky surovín vybraného variantu. */
export function cardRows(card: Card): IngredientRow[] {
  const o = card.sel != null ? card.options[card.sel] : undefined;
  return o?.recipe ? ingredientRows(o.recipe, card.portions) : [];
}

/** Stav všetkých kariet receptov v jednom diktovaní. */
export function useRecipeCards(householdId: string) {
  const recipes = useRecipes(householdId);
  const [cards, setCards] = useState<Card[]>([]);
  const ref = useRef(cards);
  ref.current = cards;

  const update = useCallback((id: string, fn: (c: Card) => Card) => {
    const next = ref.current.map((c) => (c.id === id ? fn(c) : c));
    ref.current = next;
    setCards(next);
  }, []);
  const setOpt = useCallback(
    (id: string, optId: string, p: Partial<Option>) =>
      update(id, (c) => ({ ...c, options: c.options.map((o) => (o.id === optId ? { ...o, ...p } : o)) })),
    [update],
  );

  /** Suroviny AI variantu (beží paralelne pre všetky varianty). */
  const loadDetail = useCallback(
    (cardId: string, o: Option) => {
      setOpt(cardId, o.id, { failed: false });
      suggestRecipe(o.name, o.variant)
        .then((d) => {
          const draft: RecipeDraft = { ...d, name: o.name, ai: true };
          const recipe: Recipe = { ...draft, id: o.id, hue: hueOf(o.name), icon: d.icon || o.icon || "CookingPot", mine: false, ai: true };
          setOpt(cardId, o.id, { recipe, draft, minutes: d.minutes || o.minutes });
        })
        .catch(() => setOpt(cardId, o.id, { failed: true }));
    },
    [setOpt],
  );

  const fetchVariants = useCallback(
    (cardId: string) => {
      const c = ref.current.find((x) => x.id === cardId);
      if (!c) return;
      const have = c.options.filter((o) => o.source !== "ai");
      const want = MAX - have.length;
      if (want <= 0) return update(cardId, (x) => ({ ...x, status: "ready" }));
      update(cardId, (x) => ({ ...x, status: have.length ? "ready" : "loading" }));
      recipeVariants(c.query, want, have.map((o) => o.name))
        .then((vs) => {
          const opts: Option[] = vs.map((v) => ({
            id: `ai-${crypto.randomUUID()}`,
            source: "ai",
            name: v.name,
            variant: v.variant,
            minutes: v.minutes,
            difficulty: v.difficulty,
            icon: v.icon,
            recipe: null,
            draft: null,
          }));
          if (!ref.current.some((x) => x.id === cardId)) return;
          update(cardId, (x) => ({ ...x, status: x.status === "added" ? "added" : "ready", options: [...x.options.filter((o) => o.source !== "ai"), ...opts] }));
          for (const o of opts) loadDetail(cardId, o);
        })
        .catch(() => update(cardId, (x) => (x.status === "added" ? x : { ...x, status: x.options.length ? "ready" : "error" })));
    },
    [update, loadDetail],
  );

  /** Nové jedlo („Hovädzí guláš“). To isté jedlo druhýkrát kartu nepridá. */
  const addQuery = useCallback(
    (query: string, seq: number) => {
      if (ref.current.some((c) => sameDish(c.query, query))) return;
      const { terms, filters } = interpretQuery(query);
      const local = recipes.all.filter((r) => terms.length && matchesTerms(r, terms) && matchesFilters(r, filters)).slice(0, 2);
      const card: Card = { id: crypto.randomUUID(), query, seq, status: "loading", options: local.map(fromRecipe), sel: null, portions: 4, off: [] };
      ref.current = [card, ...ref.current];
      setCards(ref.current);
      fetchVariants(card.id);
    },
    [recipes.all, fetchVariants],
  );

  /** AI spresnila, aké jedlo zaznelo: nedotknutá karta z tej istej vety sa nahradí. */
  const confirmCook = useCallback(
    (seq: number, names: string[]) => {
      if (!names.length) return;
      for (const c of ref.current.filter((x) => x.seq === seq && x.sel == null && x.status !== "added")) {
        if (!names.some((n) => sameDish(n, c.query))) {
          ref.current = ref.current.filter((x) => x.id !== c.id);
          setCards(ref.current);
        }
      }
      for (const n of names) addQuery(n, seq);
    },
    [addQuery],
  );

  const pick = useCallback(
    (id: string, index: number) =>
      update(id, (c) => {
        const o = c.options[index];
        if (!o) return c;
        const rows = o.recipe ? ingredientRows(o.recipe, o.recipe.portions) : [];
        return { ...c, sel: index, portions: o.recipe?.portions ?? c.portions, off: rows.filter((r) => r.staple).map((r) => r.key) };
      }),
    [update],
  );

  return {
    cards,
    ref,
    update,
    addQuery,
    confirmCook,
    pick,
    retry: fetchVariants,
    retryDetail: loadDetail,
    remove: (id: string) => {
      ref.current = ref.current.filter((c) => c.id !== id);
      setCards(ref.current);
    },
  };
}

/** Položky zoznamu zo zaškrtnutých surovín. */
export function cardItems(card: Card): DraftItem[] {
  return cardRows(card)
    .filter((r) => !card.off.includes(r.key))
    .map((r) => {
      const e = rowToItem(r);
      return {
        id: crypto.randomUUID(),
        name: e.name,
        quantity: e.quantity,
        unit: e.unit as VoiceUnit,
        categoryId: e.category_id || guessCategory(e.name),
        status: "ok" as const,
        suggestions: [],
        note: e.note,
        recipeCard: card.id,
      };
    });
}

/** Plán receptu na uloženie (čaká v Receptoch na uvarenie). */
export function cardPlan(card: Card): VoicePlan | null {
  const o = card.sel != null ? card.options[card.sel] : undefined;
  if (!o?.recipe) return null;
  return { card: card.id, key: o.source === "ai" ? null : o.recipe.id, name: o.recipe.name, portions: card.portions, draft: o.source === "ai" ? o.draft : null };
}

const SOURCE: Record<Option["source"], Key> = { mine: "voice.rc.mine", catalog: "voice.rc.catalog", ai: "voice.rc.ai" };

export function RecipeCardView({
  card,
  active,
  onPick,
  onPortions,
  onToggle,
  onAdd,
  onClose,
  onRetry,
  onRetryDetail,
}: {
  card: Card;
  active: boolean;
  onPick: (i: number) => void;
  onPortions: (n: number) => void;
  onToggle: (key: string) => void;
  onAdd: () => void;
  onClose: () => void;
  onRetry: () => void;
  onRetryDetail: (o: Option) => void;
}) {
  const sel = card.sel != null ? card.options[card.sel] : undefined;
  const rows = useMemo(() => cardRows(card), [card]);
  const on = rows.filter((r) => !card.off.includes(r.key)).length;
  const skeletons = card.status === "loading" ? Math.max(0, MAX - card.options.length) : 0;

  return (
    <div className={cx("v-rc anim-pop", active && "active")} role="group" aria-label={t("voice.rc.aria", { name: card.query })}>
      <div className="row g-10">
        <span className="cat-ic v-rc-ic">
          <ChefHat size={18} />
        </span>
        <span className="grow stack g-2" style={{ minWidth: 0 }}>
          <span className="t-xs t-2 fw-6">{t("voice.rc.cooking")}</span>
          <span className="t-h ellipsis">{card.query}</span>
        </span>
        <button type="button" className="ibtn sm" onClick={onClose} aria-label={t("voice.rc.close")}>
          <X size={18} />
        </button>
      </div>

      {card.status === "error" ? (
        <div className="row g-8">
          <span className="grow t-sm t-2">{t("voice.rc.error")}</span>
          <button type="button" className="btn btn-soft btn-sm" onClick={onRetry}>
            <RotateCw size={15} /> {t("voice.rc.retry")}
          </button>
        </div>
      ) : (
        <>
          <span className="t-sm t-2">{sel ? t("voice.rc.pickedHint") : card.options.length || skeletons ? t("voice.rc.pickHint") : t("voice.rc.loading")}</span>
          <div className="v-rc-opts" role="listbox" aria-label={t("voice.rc.options")}>
            {card.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={card.sel === i}
                className={cx("v-rc-opt", card.sel === i && "on")}
                onClick={() => {
                  haptic(10);
                  onPick(i);
                }}
              >
                <span className="row g-6" style={{ alignItems: "flex-start" }}>
                  {o.recipe ? <Cover recipe={o.recipe} size="sm" /> : <span className="rc-cover sm" style={{ "--h": hueOf(o.name) } as React.CSSProperties}><RIcon name={o.icon ?? "CookingPot"} size={26} strokeWidth={1.7} /></span>}
                  <span className="v-rc-num num">{i + 1}</span>
                </span>
                <span className="t-sm fw-6 v-rc-name">{o.name}</span>
                {o.variant && <span className="t-xs t-2 v-rc-var">{o.variant}</span>}
                <span className="t-xs t-3">
                  {t("rc.meta", { min: o.minutes, diff: t(`rc.diff.${o.difficulty}` as Key) })} · {t(SOURCE[o.source])}
                </span>
              </button>
            ))}
            {Array.from({ length: skeletons }).map((_, i) => (
              <div key={`s${i}`} className="v-rc-opt sk" aria-hidden>
                <span className="skel" style={{ width: 26, height: 26, borderRadius: 8 }} />
                <span className="skel" style={{ width: "90%", height: 12 }} />
                <span className="skel" style={{ width: "60%", height: 10 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {sel && (
        <div className="stack g-10 anim-pop">
          {!sel.recipe ? (
            sel.failed ? (
              <div className="row g-8">
                <span className="grow t-sm t-2">{t("voice.rc.detailError")}</span>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => onRetryDetail(sel)}>
                  <RotateCw size={15} /> {t("voice.rc.retry")}
                </button>
              </div>
            ) : (
              <div className="stack g-6" aria-busy>
                <span className="t-sm t-2">{t("voice.rc.preparing")}</span>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="skel" style={{ height: 34, borderRadius: 10 }} />
                ))}
              </div>
            )
          ) : (
            <>
              <div className="row g-10">
                <span className="grow t-sm fw-6">{t("voice.rc.portions")}</span>
                <Stepper value={card.portions} min={1} onChange={onPortions} small />
              </div>
              <div className="v-rc-ings">
                {rows.map((r) => {
                  const checked = !card.off.includes(r.key);
                  return (
                    <button key={r.key} type="button" className={cx("v-rc-ing", !checked && "off")} onClick={() => onToggle(r.key)} aria-pressed={checked}>
                      <span className={cx("v-check", checked && "on")}>{checked && <Check size={14} strokeWidth={3} />}</span>
                      <span className="grow stack g-1" style={{ minWidth: 0 }}>
                        <span className="t-body fw-5 ellipsis">{r.buy.name}</span>
                        {(detailOf(r) || (r.staple && !checked)) && (
                          <span className="t-xs t-2 ellipsis">{!checked && r.staple ? t("voice.rc.usuallyHome") : detailOf(r)}</span>
                        )}
                      </span>
                      <span className="t-sm fw-6 num" style={{ whiteSpace: "nowrap" }}>{r.buy.buyLabel}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn btn-ink btn-block" disabled={!on} onClick={onAdd}>
                {tn("voice.rc.add", on)}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Podrobnosť bez balenia, ktoré už je vpravo („10 g · potrebné 1,5 lyžičky“ → „potrebné 1,5 lyžičky“). */
const detailOf = (r: IngredientRow) => r.buy.detail.split(" · ").filter((x) => x !== r.buy.buyLabel).join(" · ");

/** Pridaný recept – skrátene, s možnosťou zmeniť výber. */
export function PlanRow({ plan, count, onEdit, onRemove }: { plan: VoicePlan; count: number; onEdit?: () => void; onRemove: () => void }) {
  return (
    <div className="v-rc done row g-10">
      <span className="cat-ic v-rc-ic on">
        <Check size={18} strokeWidth={2.6} />
      </span>
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-body fw-6 ellipsis">{plan.name}</span>
        <span className="t-xs t-2">
          {tn("voice.rc.portionsN", plan.portions)} · {tn("voice.rc.ingCount", count)}
        </span>
      </span>
      {onEdit && (
        <button type="button" className="ibtn sm" onClick={onEdit} aria-label={t("voice.rc.edit")}>
          <Pencil size={16} />
        </button>
      )}
      <button type="button" className="ibtn sm" onClick={onRemove} aria-label={t("voice.rc.removePlan")}>
        <X size={18} />
      </button>
    </div>
  );
}
