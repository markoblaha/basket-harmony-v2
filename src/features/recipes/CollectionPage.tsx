/**
 * Recepty jednej kategórie / rýchleho výberu / zdroja – z mockupu (cookbook.jsx RecipeCollection):
 * triedenie Z toho, čo mám / Najrýchlejšie / Najlacnejšie.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { t, tn, type Key } from "@/i18n";
import { E, Back, MkHeader, Seg } from "@/mockup/ui";
import { eur } from "@/mockup/kit";
import { useFavorites, useRecipes } from "./api";
import { CHEAP, RCATS, RCOLS, RCard, useRecipeFacts } from "./mk";
import type { Recipe } from "./types";

type Sort = "rec" | "fast" | "cheap";

export function CollectionPage() {
  const { kind = "cat", id = "all" } = useParams();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const recipes = useRecipes(household.id);
  const favs = useFavorites(household.id).data ?? new Set<string>();
  const { facts } = useRecipeFacts(household.id, recipes.all, recipes.find);
  const [sort, setSort] = useState<Sort>("rec");

  let title = "";
  let sub = "";
  let list: Recipe[] = [];
  if (kind === "cat") {
    const c = RCATS.find((x) => x.id === id) ?? RCATS[RCATS.length - 1]!;
    title = t(`rk.cat.${c.id}` as Key);
    list = recipes.all.filter(c.test);
  } else if (kind === "col") {
    const c = RCOLS.find((x) => x.id === id) ?? RCOLS[0]!;
    title = t(`rk.col.${c.id}` as Key);
    list = c.test ? recipes.all.filter(c.test) : recipes.all.filter((r) => (facts.get(r.id)?.cost ?? 99) <= CHEAP);
    if (c.id === "lacne") sub = t("rk.cheapSub", { price: eur(CHEAP) });
  } else {
    title = id;
    list = recipes.mine.filter((r) => (r.source || t("rk.srcMine")) === id);
  }
  const f = (r: Recipe) => facts.get(r.id);
  const ratio = (r: Recipe) => (f(r) ? f(r)!.have / Math.max(1, f(r)!.all) : 0);
  const sorted = [...list].sort(
    sort === "fast" ? (a, b) => a.minutes - b.minutes : sort === "cheap" ? (a, b) => (f(a)?.cost ?? 99) - (f(b)?.cost ?? 99) : (a, b) => ratio(b) - ratio(a),
  );

  return (
    <div className="stack">
      <MkHeader title={title} back={<Back label={t("recipes.title")} onClick={() => navigate(-1)} />}>
        <p className="meta">
          {tn("rk.recipes", list.length)}
          {sub ? ` · ${sub}` : ""}
        </p>
        <Seg<Sort>
          items={[
            ["rec", t("rk.sortHave")],
            ["fast", t("rk.sortFast")],
            ["cheap", t("rk.sortCheap")],
          ]}
          value={sort}
          onChange={setSort}
        />
      </MkHeader>
      <div className="bhm bhm-list">
        <div className="body">
          {sorted.length ? (
            <div className="rgrid2">
              {sorted.map((r) => (
                <RCard
                  key={r.id}
                  r={r}
                  fav={favs.has(r.id)}
                  fact={f(r)}
                  onOpen={() => navigate(`/recipes/r/${encodeURIComponent(r.id)}`, { state: { ids: sorted.map((x) => x.id) } })}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <E k="cooking" s={64} />
              <b>{t("rk.emptyCol")}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
