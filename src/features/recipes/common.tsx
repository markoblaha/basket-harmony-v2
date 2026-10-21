import { useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Baby, Beef, CakeSlice, ChevronRight, CookingPot, Croissant, Drumstick, Egg, Fish, Ham, Heart, Mic, Salad, ShoppingBasket, Soup, Sparkles,
  Timer, UtensilsCrossed, Wheat, X, type LucideIcon,
} from "lucide-react";
import { haptic } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useSpeech } from "@/features/voice/useSpeech";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useFavorites, useRecipes, useToggleFavorite } from "./api";
import { useCart } from "./cart";
import { DISHES, Dish } from "./dishes";
import { mergeIngredients, recipeMeta } from "./logic";
import type { Recipe } from "./types";

const ICONS: Record<string, LucideIcon> = { CookingPot, UtensilsCrossed, Soup, CakeSlice, Egg, Salad, Timer, Baby, Beef, Ham, Drumstick, Wheat, Croissant, Fish };
export function RIcon({ name, size, strokeWidth }: { name: string; size?: number; strokeWidth?: number }) {
  const I = ICONS[name] ?? CookingPot;
  return <I size={size} strokeWidth={strokeWidth} />;
}

/** Obal receptu: čiarová ilustrácia jedla (katalóg) alebo ikona na tónovanej ploche. */
export function Cover({ recipe, size = "md" }: { recipe: Pick<Recipe, "id" | "hue" | "icon" | "mine" | "ai">; size?: "sm" | "md" | "lg" }) {
  const big = size === "lg" ? 84 : size === "md" ? 56 : 26;
  return (
    <div className={`rc-cover ${size}`} style={{ "--h": recipe.hue ?? 30 } as React.CSSProperties} aria-hidden={size === "sm"}>
      {DISHES[recipe.id] ? (
        <Dish id={recipe.id} size={size === "lg" ? 176 : size === "md" ? 118 : 42} strokeWidth={size === "lg" ? 1.4 : size === "md" ? 1.6 : 2.5} />
      ) : (
        <RIcon name={recipe.icon} size={big} strokeWidth={size === "sm" ? 1.7 : 1.15} />
      )}
      {size !== "sm" && !recipe.mine && <span className="rc-label">{t("rc.illustration")}</span>}
      {size !== "sm" && recipe.ai && <span className="rc-label">{t("rc.aiDraft")}</span>}
    </div>
  );
}

export function RecipeRow({ recipe, right }: { recipe: Recipe; right?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="cell" onClick={() => navigate(`/recipes/r/${recipe.id}`)}>
      <Cover recipe={recipe} size="sm" />
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-body fw-6 ellipsis">{recipe.name}</span>
        <span className="t-sm t-2">{recipeMeta(recipe)}</span>
      </span>
      {right}
      <ChevronRight size={18} className="chev" />
    </button>
  );
}

export function FavButton({ id }: { id: string }) {
  const { household } = useHousehold();
  const favs = useFavorites(household.id);
  const toggle = useToggleFavorite(household.id);
  const toast = useToast();
  const on = !!favs.data?.has(id);
  return (
    <button
      type="button"
      className="ibtn"
      aria-pressed={on}
      aria-label={on ? t("rc.favRemove") : t("rc.favAdd")}
      onClick={() => {
        haptic();
        toggle.mutate({ id, on: !on }, { onError: (e) => toast.show(errorMessage(e), "error") });
        toast.show(on ? t("rc.favRemoved") : t("rc.favAdded"));
      }}
    >
      <Heart size={22} fill={on ? "var(--red)" : "none"} color={on ? "var(--red)" : "currentColor"} />
    </button>
  );
}

/** Lišta „Košík receptov“ nad spodnou lištou. */
export function CartBar() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const recipes = useRecipes(household.id);
  const c = useCart(household.id);
  const items = c.items.filter((x) => recipes.find(x.recipeId));
  if (!items.length) return null;
  const n = mergeIngredients(items, recipes.find).length;
  const names = items.map((x) => recipes.find(x.recipeId)!.name);
  return (
    <button type="button" className="rc-cartbar" onClick={() => navigate("/recipes/cart")}>
      <span className="bk">
        <ShoppingBasket size={20} />
      </span>
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-h">
          {t("rc.cartTitle")} · <span className="num">{items.length}</span>
        </span>
        <span className="t-sm t-2 ellipsis">
          {tn("rc.ingredientCount", n)} · {names.join(", ")}
        </span>
      </span>
      <span className="btn btn-sm btn-soft">{t("rc.continue")}</span>
    </button>
  );
}

/** Hľadanie hlasom: mikrofón v prehliadači, výsledok ide do hľadania. */
export function VoiceSearch({ onResult, onClose }: { onResult: (q: string) => void; onClose: () => void }) {
  const speech = useSpeech((said) => {
    speech.stop();
    onResult(said.trim());
  });
  useEffect(() => {
    speech.start();
    return () => speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "var(--scrim)" }} onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl stack g-16"
        style={{ background: "var(--surface)", borderRadius: "24px 24px 0 0", padding: "16px 16px calc(28px + env(safe-area-inset-bottom))", boxShadow: "var(--sh-3)", animation: "sheetUp 280ms cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("rc.voiceSearch")}
      >
        <div className="row g-8">
          <span className="t-h grow">{t("rc.voiceSearch")}</span>
          <button type="button" className="ibtn soft sm" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        <div className="stack g-10" style={{ minHeight: 92, alignItems: "center", justifyContent: "center" }}>
          <span className={`ibtn ink${speech.listening ? " pulse" : ""}`} style={{ width: 56, height: 56 }}>
            <Mic size={24} />
          </span>
          <span className="t-title" style={{ textAlign: "center" }}>
            {speech.interim || (speech.error || !speech.supported ? t("ls.micBlocked") : t("rc.voiceHint"))}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Štítok „Návrh AI“. */
export const AiBadge = () => (
  <span className="badge b-violet row g-4">
    <Sparkles size={12} /> {t("rc.aiDraft")}
  </span>
);
