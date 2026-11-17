/*
 * Kontrolný program knihy receptov (bez AI). Beží pri každom `npm run check` – recept s chybou zastaví build.
 * Pravidlá: prototyp/recepty-vyroba-navrh.html („Ako vznikne recept“, „Kvalita“).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOODS } from "./foods";
import { BOOK, SAID, bookCheck, bookPics, recipeAllergens, said, stepFoods } from "./kniha";
import { findRef, recipeNutrition, scaleIngredients } from "./logic";
import type { Recipe } from "./types";

/** Metóda kotva: písmená zdrojov hlavného jedla alebo skupiny s vlastnými zdrojmi (halušky) a ich kotva. */
const checkOf = (r: Recipe, g?: string) => {
  const c = r.book!.check!;
  if (g && c.groups?.[g]) return { letters: c.groups[g].src, anchor: c.groups[g].anchor };
  const inGroup = Object.values(c.groups ?? {}).map((x) => x.src).join("");
  return { letters: r.book!.sources.map((s) => s.k).filter((k) => !inGroup.includes(k)).join(""), anchor: c.anchor };
};

// Kniha môže byť dočasne prázdna (čistý začiatok pred šaržou) – kontroly sa vtedy nespúšťajú.
(BOOK.length ? describe.each(BOOK.map((r) => [r.name, r] as const)) : () => () => undefined)("kniha: %s", (_: string, r: Recipe) => {
  const b = r.book!;
  const foods = new Set(r.ingredients.map((x) => x.food));

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
    // Slová surovín receptu (aj náhrad „masť alebo olej“) sa z textu vyškrtnú; čo ostane a patrí inej potravine, v surovinách chýba.
    const alts = new Set(r.ingredients.flatMap((x) => x.alt ?? []));
    let rest = text.replace(/\{[^}]+\}/g, " "); // {kľúč} je odkaz na množstvo, nie slovo
    for (const food of [...foods, ...alts]) rest = rest.replace(new RegExp(`${said(food).source}[^\\s,.;:()]*`, "gi"), " ");
    for (const food of Object.keys(SAID)) {
      if (foods.has(food) || alts.has(food) || FOODS[food]?.free) continue;
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

  it("porovnanie: 11–20 receptov toho istého variantu aspoň z 3 webov, recept (kotva) je jeden z nich", () => {
    expect(b.check, "recept nie je overený metódou kotva").toBeTruthy();
    const c = b.check!;
    expect(new Set(b.sources.map((s) => s.url)).size, "rovnaký recept dvakrát").toBe(b.sources.length);
    for (const s of b.sources) expect(s.url).toMatch(/^https:\/\//);
    for (const g of [undefined, ...Object.keys(c.groups ?? {})]) {
      const { letters, anchor } = checkOf(r, g);
      const sites = new Set(b.sources.filter((s) => letters.includes(s.k)).map((s) => s.site));
      expect(letters.length, g).toBeGreaterThanOrEqual(g ? 8 : 11);
      expect(letters.length, g).toBeLessThanOrEqual(20);
      expect(sites.size, g).toBeGreaterThanOrEqual(3);
      expect(letters.includes(anchor), `kotva ${g ?? ""}`).toBe(true);
      if (!c.whole) expect(c.portions[anchor], "kotva má uvedené porcie").toBeGreaterThan(0);
    }
    for (const row of c.rows) {
      const { letters } = checkOf(r, row.group);
      for (const k of Object.keys(row.v)) expect(letters.includes(k), `${row.foods}: zdroj ${k}`).toBe(true);
    }
  });

  it.skipIf(!!b.check?.whole)("porcie sú ako v pôvodnom recepte", () => {
    expect(r.portions).toBe(b.check!.portions[b.check!.anchor]);
  });

  it("chýba najviac 1 surovina väčšiny", () => {
    expect(bookCheck(r)!.missing.length, bookCheck(r)!.missing.join(", ")).toBeLessThanOrEqual(1);
  });

  it("najviac 1 množstvo je neobvyklé (mimo Tukeyho hraníc)", () => {
    const out = bookCheck(r)!.rows.filter((x) => x.typical === false).map((x) => `${x.foods.join("+")}: ${x.ours?.toFixed(1)} (obvykle ${x.fenceLo?.toFixed(1)}–${x.fenceHi?.toFixed(1)})`);
    expect(out.length, out.join("; ")).toBeLessThanOrEqual(1);
  });

  it("metóda kotva: úkony väčšiny sú v postupe, každý úkon v postupe robí kotva alebo aspoň 30 % zdrojov", () => {
    const c = b.check!;
    const res = bookCheck(r)!;
    expect(res.actsMissing.length, `chýbajú úkony väčšiny: ${res.actsMissing.join(", ")}`).toBeLessThanOrEqual(Math.floor(res.actsMajor / 2));
    for (const a of c.acts) {
      const { letters, anchor } = checkOf(r, a.group);
      expect([...a.src].every((k) => letters.includes(k)), a.a).toBe(true);
      if (a.step) expect(a.src.length / letters.length >= 0.3 || a.src.includes(anchor), `${a.a}: robí ho málo zdrojov`).toBe(true);
      if (a.step) expect(a.step, a.a).toBeLessThanOrEqual(r.steps.length);
    }
    // každý krok robí niektorý zo zdrojov a krok úkonu má jeho zdroje
    for (const a of c.acts) if (a.step) expect(r.steps[a.step - 1]!.src, a.a).toBeTruthy();
  });

  it("prešiel kontrolou (inak patrí do karantény, nie do knihy)", () => {
    expect(bookCheck(r)!.ok).toBe(true);
  });

  it("má fotky (alebo obrázok skúšobnej šarže) a malú na karty", () => {
    expect(b.photos).toBeGreaterThanOrEqual(b.batch ? 1 : 3);
    const css = readFileSync("src/features/recipes/kniha.css", "utf8");
    for (const p of [...bookPics(r), `kb_${r.id}_1s`]) {
      expect(css, p).toContain(`.pic-${p} `);
      const file = `public/kniha/${p.replace(/^kb_/, "").replace(/_(\d)(s?)$/, "-$1$2")}.webp`;
      expect(existsSync(file), file).toBe(true);
    }
  });
});

(BOOK.some((x) => x.book?.check) ? describe : describe.skip)("kniha: suroviny pri krokoch receptov overených metódou kotva", () => {
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
  it("suroviny pri kroku: odkaz {kľúč} a slová z textu, soľ do vody nie", () => {
    const ing = [
      { food: "cibula", qty: 2, unit: "ks" },
      { food: "muka", qty: 3, unit: "lyzica" },
      { food: "sol", qty: 1, unit: "lyzicka", note: "do vody" },
    ] as Recipe["ingredients"];
    expect(stepFoods({ text: "Cibuľu ({cibula}) opeč, zapráš múkou a osoľ." }, ing).map((x) => x.food)).toEqual(["cibula", "muka"]);
  });
  it("kľúče receptov sú jedinečné", () => {
    expect(new Set(BOOK.map((r) => r.id)).size).toBe(BOOK.length);
  });
  it("lasagne s vínom by mali siričitany – alergény idú zo surovín", () => {
    const fake = { ingredients: [{ food: "muka", qty: 1, unit: "g" }, { food: "parmezan", qty: 1, unit: "g" }] } as Recipe;
    expect(recipeAllergens(fake).allergens.sort()).toEqual(["lepok", "mlieko"]);
  });
});
