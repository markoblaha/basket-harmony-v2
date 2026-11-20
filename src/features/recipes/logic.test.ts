import { describe, expect, it } from "vitest";
import { buyPlan, formatAmount, interpretQuery, matchesFilters, mergeIngredients, metric, recipeNutrition, renderStep, rowKey, scaleIngredients, scaleOrig } from "./logic";
import type { Ingredient, Recipe } from "./types";

/* Skúšobné recepty len pre tento test (logika nesmie závisieť od obsahu knihy, ktorá sa mení po šaržiach). */
const base = { minutes: 60, difficulty: 2 as const, portions: 4, hue: 0, icon: "", tags: [] as string[], source: "", steps: [] };
const ing = (food: string, qty: number, unit: string, note?: string): Ingredient => ({ food, qty, unit, ...(note ? { note } : {}) });
const SAMPLES: Recipe[] = [
  {
    ...base, id: "segedin", name: "Segedínsky guláš", category: "hlavne", meat: "bravcove",
    ingredients: [ing("pliecko", 800, "g"), ing("cibula", 2, "ks"), ing("cesnak", 2, "strucik"), ing("vyvar", 500, "ml"), ing("kapusta", 500, "g"), ing("smotana_sladka", 200, "ml"), ing("sol", 1, "lyzicka")],
  },
  {
    ...base, id: "paprikas", name: "Kurací paprikáš", category: "hlavne", meat: "kuracie",
    ingredients: [ing("kuracie_stehna", 1000, "g"), ing("cibula", 1, "ks"), ing("paprika_mleta", 2, "lyzica"), ing("smotana", 200, "ml"), ing("muka", 3, "lyzica"), ing("maslo", 30, "g"), ing("sol", 1, "lyzicka", "do vody")],
  },
  { ...base, id: "gulas", name: "Hovädzí guláš", category: "hlavne", meat: "hovadzie", ingredients: [ing("hovadzie", 800, "g")] },
];
const find = (id: string) => SAMPLES.find((r) => r.id === id);
const segedin = find("segedin")!;

describe("recepty", () => {
  it("prepočíta porcie a zaokrúhli ako človek", () => {
    const two = scaleIngredients(segedin, 2);
    expect(two.find((x) => x.food === "pliecko")?.qty).toBe(400);
    expect(two.find((x) => x.food === "cibula")?.qty).toBe(1);
    expect(two.find((x) => x.food === "cesnak")?.qty).toBe(1);
  });

  it("doplní množstvá do krokov", () => {
    const text = renderStep("Cibuľu ({cibula}) opeč a podlej {vyvar} vývaru.", scaleIngredients(segedin, 4));
    expect(text).toBe("Cibuľu (2 ks) opeč a podlej 500 ml vývaru.");
  });

  it("skloňuje lyžice a strúčiky", () => {
    expect(formatAmount(1, "lyzica")).toBe("1 lyžica");
    expect(formatAmount(5, "lyzica")).toBe("5 lyžíc");
    expect(formatAmount(1.5, "lyzica")).toBe("1,5 lyžice");
    expect(formatAmount(0.25, "lyzicka")).toBe("¼ lyžičky");
    expect(formatAmount(2, "strucik")).toBe("2 strúčiky");
  });

  it("spojí rovnaké suroviny z viacerých receptov", () => {
    const rows = mergeIngredients(
      [
        { recipeId: "segedin", portions: 4 },
        { recipeId: "paprikas", portions: 4 },
      ],
      find,
    );
    const cibula = rows.find((r) => r.food === "cibula")!;
    expect(cibula.qty).toBe(3);
    expect(cibula.sources).toHaveLength(2);
    expect(rows.find((r) => r.food === "sol")?.staple).toBe(true);
  });

  it("navrhne balenie a váhu na nákup", () => {
    const rows = mergeIngredients([{ recipeId: "segedin", portions: 4 }], find);
    const meat = buyPlan(rows.find((r) => r.food === "pliecko")!);
    expect(meat).toMatchObject({ qty: 0.8, unit: "kg" });
    const cream = buyPlan(rows.find((r) => r.food === "smotana_sladka")!);
    expect(cream).toMatchObject({ qty: 1, unit: "ks" });
    const garlic = buyPlan(rows.find((r) => r.food === "cesnak")!);
    expect(garlic).toMatchObject({ qty: 1, unit: "ks" });
  });

  it("rozumie vete pri hľadaní", () => {
    const q = interpretQuery("niečo rýchle s kuracím");
    expect(q.filters).toMatchObject({ time: 30, meat: "kuracie" });
    expect(q.terms).toEqual([]);
    const beef = interpretQuery("niečo s hovädzím");
    expect(beef.filters).toMatchObject({ meat: "hovadzie" });
    expect(SAMPLES.filter((r) => matchesFilters(r, beef.filters)).map((r) => r.id)).toEqual(["gulas"]);
  });

  it("výživa na porciu je rozumná a soľ do vody sa nepočíta", () => {
    const nu = recipeNutrition(find("paprikas")!);
    expect(nu.perPortion.kcal).toBeGreaterThan(400);
    expect(nu.perPortion.kcal).toBeLessThan(1200);
    expect(nu.skipped).toContain("Soľ");
  });
});

describe("metric – len g, kg, ml a l", () => {
  it("dekagramy, decilitre a hrnčeky prepočíta, ostatné nechá", () => {
    expect(scaleOrig("20 dkg slanina", 1)).toBe("200 g slanina");
    expect(scaleOrig("20 dkg slanina", 6)).toBe("1,2 kg slanina");
    expect(scaleOrig("60 ml rajčatového protlaku (0,25 hrnku)", 1)).toBe("60 ml rajčatového protlaku");
    expect(scaleOrig("350 ml mléka (1,5 hrnku)", 2)).toBe("700 ml mléka");
    expect(scaleOrig("0.5 lžička kmín", 1)).toBe("0,5 lžička kmín");
    expect(scaleOrig("1/2 lžičky mletého zázvoru", 1)).toBe("1/2 lžičky mletého zázvoru");
    expect(metric("s necelými 3,5 dl studené vody")).toBe("s necelými 350 ml studené vody");
    expect(metric("1 hrnek mouky, 10-15 dkg cukru")).toBe("250 ml mouky, 100-150 g cukru");
    expect(metric("2 dlouhé prameny, 4x4 cm, 2 litre vody")).toBe("2 dlouhé prameny, 4x4 cm, 2 litre vody");
    expect(renderStep("Přilijte 2 dl mléka.", [])).toBe("Přilijte 200 ml mléka.");
  });
});

describe("rowKey – surovina mimo databázy potravín", () => {
  it("recept nájde riadok nákupu aj pre surovinu, ktorá nie je v databáze potravín", () => {
    const ing: Ingredient = { food: "x_mangove_pyre", label: "mangového pyré", qty: 60, unit: "g" };
    const r = { id: "t", name: "T", portions: 1, ingredients: [ing], steps: [] } as unknown as Recipe;
    const rows = mergeIngredients([{ recipeId: "t", portions: 1 }], () => r);
    expect(rows.map((x) => x.key)).toContain(rowKey(ing));
    expect(rowKey({ food: "cibula" })).toBe("cibula");
  });
});

describe("scaleOrig – pôvodný riadok suroviny zo zdroja", () => {
  it("pri pôvodných porciách ostane riadok presne", () => {
    expect(scaleOrig("0,5 kg celer", 1)).toBe("0,5 kg celer");
    expect(scaleOrig("mletý  pepř", 2)).toBe("mletý  pepř");
  });
  it("prepočíta číslo na začiatku, rozpätie aj zlomok a zvyšok nechá", () => {
    expect(scaleOrig("0.5 kg mrkev", 2)).toBe("1 kg mrkev");
    expect(scaleOrig("1-2 lžičky mleté červené papriky", 2)).toBe("2-4 lžičky mleté červené papriky");
    expect(scaleOrig("1/2 lžičky mletého zázvoru", 2)).toBe("1 lžičky mletého zázvoru");
    expect(scaleOrig("175 g vlašských orechov Alesto", 0.5)).toBe("87,5 g vlašských orechov Alesto");
  });
});
