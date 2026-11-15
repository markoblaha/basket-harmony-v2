/*
 * Kontrolný program knihy receptov (bez AI). Beží pri každom `npm run check` – recept s chybou zastaví build.
 * Pravidlá: prototyp/recepty-vyroba-navrh.html („Ako vznikne recept“, „Kvalita“).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOODS } from "./foods";
import { BOOK, SAID, basePortions, bookCheck, bookPics, recipeAllergens, said, stepFoods } from "./kniha";
import { findRef, recipeNutrition, scaleIngredients } from "./logic";
import type { Recipe } from "./types";

const groupOf = (r: Recipe, g: string | undefined) => r.book!.groupSources?.[g ?? ""] ?? r.book!.sources.map((s) => s.k).join("");

describe.each(BOOK.map((r) => [r.name, r] as const))("kniha: %s", (_, r) => {
  const b = r.book!;
  const foods = new Set(r.ingredients.map((x) => x.food));

  it.skipIf(!!b.check)("má 3–5 skutočných zdrojov z rôznych webov na každú skupinu", () => {
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

  it.skipIf(!!b.check)("každá surovina je vo viac ako polovici zdrojov (voliteľná aspoň v 35 %)", () => {
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
    let rest = text.replace(/\{[^}]+\}/g, " "); // {kľúč} je odkaz na množstvo, nie slovo
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

  it.runIf(!!b.check)("metóda kotva: aspoň 11 zdrojov zo 4 webov, kotva je jeden z nich", () => {
    const c = b.check!;
    expect(b.sources.length).toBeGreaterThanOrEqual(11);
    expect(new Set(b.sources.map((s) => s.url)).size, "rovnaký recept dvakrát").toBe(b.sources.length);
    expect(new Set(b.sources.map((s) => s.site)).size).toBeGreaterThanOrEqual(4);
    for (const s of b.sources) expect(s.url).toMatch(/^https:\/\//);
    expect(b.sources.some((s) => s.k === c.anchor), "kotva").toBe(true);
    expect(c.portions[c.anchor], "kotva má uvedené porcie").toBeGreaterThan(0);
    for (const row of c.rows) for (const k of Object.keys(row.v)) expect(b.sources.some((s) => s.k === k), `${row.foods}: zdroj ${k}`).toBe(true);
  });

  it.runIf(!!b.check)("metóda kotva: základná porcia je najčastejšia porcia v zdrojoch", () => {
    expect(r.portions).toBe(basePortions(Object.values(b.check!.portions)));
  });

  it.runIf(!!b.check)("metóda kotva: suroviny väčšiny sú v recepte, nič navyše (každá surovina má aspoň 30 % zdrojov)", () => {
    const res = bookCheck(r)!;
    expect(res.missing, "chýba surovina väčšiny").toEqual([]);
    expect(res.weak, "surovina, ktorú má málo zdrojov").toEqual([]);
  });

  it.runIf(!!b.check)("metóda kotva: množstvá na porciu sú v rozpätí zdrojov", () => {
    for (const x of bookCheck(r)!.rows) {
      if (x.inRange == null) continue;
      expect(x.inRange, `${x.foods.join("+")}: ${x.ours?.toFixed(1)} mimo ${x.min?.toFixed(1)}–${x.max?.toFixed(1)}`).toBe(true);
    }
  });

  it.runIf(!!b.check)("metóda kotva: úkony väčšiny sú v postupe, každý úkon v postupe robí kotva alebo aspoň 30 % zdrojov", () => {
    const c = b.check!;
    const n = b.sources.length;
    const res = bookCheck(r)!;
    expect(res.actsMissing, "chýba úkon väčšiny").toEqual([]);
    for (const a of c.acts) {
      expect([...a.src].every((k) => b.sources.some((s) => s.k === k)), a.a).toBe(true);
      if (a.step) {
        expect(a.step, a.a).toBeLessThanOrEqual(r.steps.length);
        expect(a.src.length / n >= 0.3 || a.src.includes(c.anchor), `${a.a}: robí ho málo zdrojov`).toBe(true);
      }
    }
    // každý krok robí niektorý zo zdrojov a krok úkonu má jeho zdroje
    for (const a of c.acts) if (a.step) expect(r.steps[a.step - 1]!.src, a.a).toBeTruthy();
  });

  it.runIf(!!b.check)("metóda kotva: zhoda so zdrojmi aspoň 90 %", () => {
    const res = bookCheck(r)!;
    expect(res.score, JSON.stringify(res.parts)).toBeGreaterThanOrEqual(0.9);
  });

  it("má aspoň 3 fotky toho istého jedla a malú na karty", () => {
    expect(b.photos).toBeGreaterThanOrEqual(b.check ? 4 : 3);
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

describe("kniha: suroviny pri krokoch receptov overených metódou kotva", () => {
  for (const r of BOOK.filter((x) => x.book?.check)) {
    it(`${r.name}: každý krok má zoznam surovín a každá surovina sa pri niektorom kroku použije`, () => {
      const scaled = scaleIngredients(r, r.portions);
      const used = new Set<string>();
      r.steps.forEach((st, i) => {
        expect(st.uses, `krok ${i + 1}`).toBeTruthy();
        for (const k of st.uses!) {
          expect(findRef(scaled, k), `krok ${i + 1}: ${k}`).toBeTruthy();
          used.add(k);
        }
      });
      for (const ing of r.ingredients) expect(used.has(ing.ref ?? ing.food), `${ing.ref ?? ing.food} nie je pri žiadnom kroku`).toBe(true);
    });
  }
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
