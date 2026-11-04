/*
 * Kontrolný program knihy receptov (bez AI). Beží pri každom `npm run check` – recept s chybou zastaví build.
 * Pravidlá: prototyp/recepty-vyroba-navrh.html („Ako vznikne recept“, „Kvalita“).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOODS } from "./foods";
import { BOOK, SAID, bookPics, recipeAllergens, said, stepFoods } from "./kniha";
import { findRef, recipeNutrition, scaleIngredients } from "./logic";
import type { Recipe } from "./types";

const groupOf = (r: Recipe, g: string | undefined) => r.book!.groupSources?.[g ?? ""] ?? r.book!.sources.map((s) => s.k).join("");

describe.each(BOOK.map((r) => [r.name, r] as const))("kniha: %s", (_, r) => {
  const b = r.book!;
  const foods = new Set(r.ingredients.map((x) => x.food));

  it("má 3–5 skutočných zdrojov z rôznych webov na každú skupinu", () => {
    const groups = new Set(r.ingredients.map((x) => groupOf(r, x.group)));
    for (const letters of groups) {
      expect(letters.length, letters).toBeGreaterThanOrEqual(3);
      expect(letters.length, letters).toBeLessThanOrEqual(5);
      const sites = [...letters].map((k) => b.sources.find((s) => s.k === k)?.site);
      expect(sites.every(Boolean), `neznámy zdroj v ${letters}`).toBe(true);
      expect(new Set(sites).size, `rovnaký web dvakrát v ${letters}`).toBe(sites.length);
    }
    for (const s of b.sources) expect(s.url).toMatch(/^https:\/\//);
  });

  it("každá surovina je vo viac ako polovici zdrojov (voliteľná aspoň v 35 %)", () => {
    for (const ing of r.ingredients) {
      const all = groupOf(r, ing.group);
      const src = ing.src ?? "";
      expect([...src].every((k) => all.includes(k)), `${ing.food}: zdroj mimo skupiny`).toBe(true);
      const share = src.length / all.length;
      if (ing.optional) expect(share, `${ing.food} (voliteľná)`).toBeGreaterThanOrEqual(0.35);
      else expect(share, `${ing.food} má len ${src}`).toBeGreaterThan(0.5);
    }
  });

  it("každý krok má zdroj a odkazy {…} v krokoch existujú", () => {
    const all = b.sources.map((s) => s.k).join("");
    const scaled = scaleIngredients(r, r.portions);
    r.steps.forEach((st, i) => {
      expect(st.src, `krok ${i + 1} bez zdroja`).toBeTruthy();
      expect([...(st.src ?? "")].every((k) => all.includes(k)), `krok ${i + 1}`).toBe(true);
      for (const m of st.text.matchAll(/\{([^}]+)\}/g)) expect(findRef(scaled, m[1]!), `krok ${i + 1}: {${m[1]}}`).toBeTruthy();
    });
  });

  it("suroviny ↔ postup: každá surovina sa použije a postup nepoužíva nič navyše", () => {
    for (const food of foods) expect(SAID[food], `chýba tvar slova pre ${food}`).toBeTruthy();
    const text = r.steps.map((s) => s.text).join("\n");
    for (const ing of r.ingredients) {
      const used = said(ing.food).test(text) || text.includes(`{${ing.ref ?? ing.food}}`);
      expect(used, `${ing.label || FOODS[ing.food]?.name} nie je v postupe`).toBe(true);
    }
    // Slová surovín receptu sa z textu vyškrtnú; čo ostane a patrí inej potravine, v surovinách chýba.
    let rest = text;
    for (const food of foods) rest = rest.replace(new RegExp(`${said(food).source}[^\\s,.;:()]*`, "gi"), " ");
    for (const food of Object.keys(SAID)) {
      if (foods.has(food) || FOODS[food]?.free) continue;
      expect(said(food).test(rest), `postup spomína ${FOODS[food]?.name}, ktorá nie je v surovinách`).toBe(false);
    }
  });

  it("bezpečnosť: hydina 74 °C, mäkký žĺtok s upozornením", () => {
    const all = r.steps.map((s) => [s.text, s.done, s.warn].join(" ")).join("\n");
    if (foods.has("kurca")) expect(all).toMatch(/74 °C/);
    if (foods.has("vajce") && /žĺtok ostane mäkký/.test(all)) expect(all).toMatch(/tehotné/);
  });

  it("časy: čakanie má časovač a súčet sedí s celkovým časom", () => {
    for (const st of r.steps) if (st.wait) expect(st.timerMin, st.text).toBeGreaterThan(0);
    const sum = r.steps.reduce((a, s) => a + (s.timerMin ?? 0), 0);
    expect(sum).toBeLessThanOrEqual(r.minutes * 1.25);
    expect(b.active).toBeLessThanOrEqual(r.minutes);
  });

  it("alergény a výživa sa dajú vypočítať zo všetkých surovín", () => {
    for (const ing of r.ingredients) {
      expect(FOODS[ing.food], ing.food).toBeTruthy();
      expect(Array.isArray(FOODS[ing.food]!.al), `${ing.food} nemá alergény`).toBe(true);
      expect(FOODS[ing.food]!.n, `${ing.food} nemá výživu`).toBeTruthy();
    }
    const nu = recipeNutrition(r);
    expect(nu.unknown).toEqual([]);
    expect(nu.perPortion.kcal).toBeGreaterThan(80);
    expect(nu.perPortion.kcal).toBeLessThan(1500);
    expect(recipeAllergens(r).allergens.length).toBeGreaterThan(0);
  });

  it("má 3 fotky toho istého jedla a malú na karty", () => {
    const css = readFileSync("src/features/recipes/kniha.css", "utf8");
    for (const p of [...bookPics(r), `kb_${r.id}_1s`]) {
      expect(css, p).toContain(`.pic-${p} `);
      const file = `public/kniha/${p.replace(/^kb_/, "").replace(/_(\d)(s?)$/, "-$1$2")}.webp`;
      expect(existsSync(file), file).toBe(true);
    }
  });
});

describe("kniha: suroviny pri kroku (varenie)", () => {
  const scaled = (id: string) => scaleIngredients(BOOK.find((r) => r.id === id)!, 4);
  const names = (id: string, step: number) => stepFoods(BOOK.find((r) => r.id === id)!.steps[step]!, scaled(id)).map((x) => `${x.ref ?? x.food}:${x.qty}`);
  it("halušky: múka a voda z halušiek, nie z omáčky", () => {
    expect(names("paprikas", 5)).toEqual(expect.arrayContaining(["muka_h:300", "voda_h:200", "vajce:1", "sol_h:0.5"]));
    expect(names("paprikas", 5)).not.toContain("muka:3");
  });
  it("omáčka: múka a smotana z paprikáša", () => {
    expect(names("paprikas", 8)).toEqual(expect.arrayContaining(["muka:3", "smotana:250"]));
  });
  it("varenie halušiek: len soľ do vody", () => {
    expect(names("paprikas", 6)).toEqual(["sol_v:1"]);
  });
  it("segedín: krok s mäsom má mäso, rascu, soľ a korenie", () => {
    expect(names("segedin", 2)).toEqual(expect.arrayContaining(["pliecko:700", "rasca:1", "sol:1", "korenie:1"]));
  });
});

describe("kniha: celá", () => {
  it("kľúče receptov sú jedinečné", () => {
    expect(new Set(BOOK.map((r) => r.id)).size).toBe(BOOK.length);
  });
  it("lasagne s vínom by mali siričitany – alergény idú zo surovín", () => {
    const fake = { ingredients: [{ food: "muka", qty: 1, unit: "g" }, { food: "parmezan", qty: 1, unit: "g" }] } as Recipe;
    expect(recipeAllergens(fake).allergens.sort()).toEqual(["lepok", "mlieko"]);
  });
});
