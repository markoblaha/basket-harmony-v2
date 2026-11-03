/**
 * Recept z knihy v appke – prenesené z mockupu (prototyp/src/book.jsx): suroviny v skupinách s presným
 * množstvom, kroky s časom, ohňom a radami („Hotové je, keď“, „Pozor“, „Tip“),
 * alergény (odvodené zo surovín), náradie, skladovanie a zdroje, z ktorých recept vznikol. Fotky: Photos.tsx.
 */
import { formatNumber, t, tn, type Key } from "@/i18n";
import { E, I } from "@/mockup/ui";
import type { Estimator } from "@/features/lists/estimate";
import { FOODS } from "./foods";
import { recipeAllergens } from "./kniha";
import { formatAmount, ingName, renderStep, roundQty, scaleIngredients, toGrams } from "./logic";
import type { IngRow } from "./mk";
import type { Ingredient, Recipe, Step } from "./types";

/** „2 h 30 min“ / „45 min“. */
export function duration(min: number) {
  if (min < 60) return t("rk.minutes", { min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? t("kb.hm", { h, m }) : t("kb.h", { h });
}

/** Množstvo s gramami pri lyžiciach a kusovej zelenine: „1 lyžica (7 g)“, „2 ks (240 g)“. */
export function bookAmount(ing: Ingredient) {
  const base = formatAmount(ing.qty, ing.unit);
  const food = FOODS[ing.food];
  const spoon = ing.unit === "lyzica" || ing.unit === "lyzicka";
  const piece = ing.unit === "ks" && !!food?.loose && !!food.g;
  if (!spoon && !piece) return base;
  const g = toGrams(ing.food, ing.qty, ing.unit);
  return g && g >= 1 ? `${base} (${formatNumber(roundQty(g, "g"))} g)` : base;
}

/** Suroviny v skupinách; ťuk prepne „mám doma“ (rovnako ako pri ostatných receptoch). */
export function BookIngredients({ r, portions, rows, est, onToggle }: { r: Recipe; portions: number; rows: IngRow[]; est: Estimator; onToggle: (row: IngRow) => void }) {
  const scaled = scaleIngredients(r, portions);
  const groups = [...new Set(scaled.map((x) => x.group ?? ""))];
  return (
    <div className="bgroups">
      {groups.map((g) => (
        <div key={g} className="bgrp">
          {g && <div className="bgh">{g}</div>}
          <div className="ings">
            {scaled
              .filter((x) => (x.group ?? "") === g)
              .map((ing, k) => {
                const food = FOODS[ing.food];
                const free = !!food?.free;
                const row = free ? undefined : rows.find((x) => x.food === ing.food);
                const home = !!row?.home;
                const name = ing.label || ingName(ing);
                const state = free ? "" : home ? ` · ${t("rk.haveHome")}` : row?.staple ? ` · ${t("rk.noHome")}` : "";
                return (
                  <div
                    key={`${ing.food}${k}`}
                    className={`ing${home ? " home" : ""}${row?.staple && !home ? " nohome" : ""}`}
                    onClick={() => row && onToggle(row)}
                    role={row ? "button" : undefined}
                    aria-pressed={row ? home : undefined}
                  >
                    <span className="th">
                      <E k={free ? "water" : est.emoji(food?.name ?? name, food?.cat)} />
                    </span>
                    <div className="tx">
                      <b>
                        {name}
                        {ing.optional && <span className="bopt">{t("kb.optional")}</span>}
                      </b>
                      <span className="sub">
                        {bookAmount(ing)}
                        {ing.note ? ` · ${ing.note}` : ""}
                        {state}
                      </span>
                    </div>
                    {row ? (
                      <span className={`cbx${home ? " on" : ""}`} aria-hidden="true">
                        <I n="check" w="bold" />
                      </span>
                    ) : (
                      <span className="bfree">{t("kb.free")}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** „Hotové je, keď“, „Pozor“ a „Tip“ pri kroku (aj v režime varenia). */
export function StepBoxes({ st }: { st: Pick<Step, "done" | "warn" | "tip"> }) {
  return (
    <>
      {st.done && (
        <div className="sbx ok">
          <I n="check-circle" />
          <span>
            <b>{t("ck.doneWhen")}</b> {st.done}
          </span>
        </div>
      )}
      {st.warn && (
        <div className="sbx pz">
          <I n="warning" />
          <span>
            <b>{t("ck.warn")}</b> {st.warn}
          </span>
        </div>
      )}
      {st.tip && (
        <div className="sbx tip">
          <I n="lightbulb" />
          <span>
            <b>{t("ck.tip")}</b> {st.tip}
          </span>
        </div>
      )}
    </>
  );
}

export function StepChips({ st }: { st: Pick<Step, "timerMin" | "heat"> }) {
  if (!st.timerMin && !st.heat) return null;
  return (
    <div className="schips">
      {st.timerMin ? (
        <span>
          <I n="timer" />
          {t("rk.minutes", { min: st.timerMin })}
        </span>
      ) : null}
      {st.heat && (
        <span>
          <I n="flame" />
          {st.heat}
        </span>
      )}
    </div>
  );
}

export function BookSteps({ r, portions }: { r: Recipe; portions: number }) {
  const scaled = scaleIngredients(r, portions);
  return (
    <ol className="bsteps">
      {r.steps.map((st, i) => (
        <li key={i}>
          <span className="n">{i + 1}</span>
          <div className="grow">
            <p>{renderStep(st.text, scaled)}</p>
            <StepChips st={st} />
            <StepBoxes st={st} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BookInfo({ r }: { r: Recipe }) {
  const b = r.book;
  if (!b) return null;
  const { allergens, check } = recipeAllergens(r);
  return (
    <div className="binfo grid">
      <div>
        <div className="bgh">{t("kb.allergens")}</div>
        {allergens.length ? (
          <div className="bal">
            {allergens.map((a) => (
              <span key={a}>{t(`kb.al.${a}` as Key)}</span>
            ))}
          </div>
        ) : (
          <p>{t("kb.noAllergens")}</p>
        )}
        {check.length > 0 && <p>{t("kb.checkPack", { names: check.join(", ") })}</p>}
      </div>
      <div>
        <div className="bgh">{t("kb.tools")}</div>
        <p>{b.tools.join(" · ")}</p>
      </div>
      <div>
        <div className="bgh">{t("kb.store")}</div>
        <p>{b.store}</p>
      </div>
      <div>
        <div className="bgh">{tn("kb.sources", b.sources.length)}</div>
        <p>{t("kb.sourcesHint")}</p>
        <div className="bsrc">
          {b.sources.map((s) => (
            <a key={s.k} href={s.url} target="_blank" rel="noopener noreferrer">
              <b>{s.k}</b>
              <span>
                {s.site} · {s.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
