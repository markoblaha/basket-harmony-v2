import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { buyPlan, formatAmount, interpretQuery, matchesFilters, mergeIngredients, recipeNutrition, renderStep, scaleIngredients } from "./logic";

const find = (id: string) => CATALOG.find((r) => r.id === id);
const segedin = find("segedin")!;

describe("recepty", () => {
  it("prepočíta porcie a zaokrúhli ako človek", () => {
    const two = scaleIngredients(segedin, 2);
    expect(two.find((x) => x.food === "pliecko")?.qty).toBe(300);
    expect(two.find((x) => x.food === "cibula")?.qty).toBe(1);
    expect(two.find((x) => x.food === "cesnak")?.qty).toBe(1);
  });

  it("doplní množstvá do krokov", () => {
    const text = renderStep("Cibuľu ({cibula}) speň na {olej} oleja.", scaleIngredients(segedin, 4));
    expect(text).toBe("Cibuľu (2 ks) speň na 3 lyžice oleja.");
  });

  it("skloňuje lyžice a strúčiky", () => {
    expect(formatAmount(1, "lyzica")).toBe("1 lyžica");
    expect(formatAmount(5, "lyzica")).toBe("5 lyžíc");
    expect(formatAmount(1.5, "lyzica")).toBe("1,5 lyžice");
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
    expect(cibula.qty).toBe(4);
    expect(cibula.sources).toHaveLength(2);
    expect(rows.find((r) => r.food === "sol")?.staple).toBe(true);
  });

  it("navrhne balenie a váhu na nákup", () => {
    const rows = mergeIngredients([{ recipeId: "segedin", portions: 4 }], find);
    const meat = buyPlan(rows.find((r) => r.food === "pliecko")!);
    expect(meat).toMatchObject({ qty: 0.6, unit: "kg" });
    const cream = buyPlan(rows.find((r) => r.food === "kysla_smotana")!);
    expect(cream).toMatchObject({ qty: 1, unit: "ks" });
    const garlic = buyPlan(rows.find((r) => r.food === "cesnak")!);
    expect(garlic).toMatchObject({ qty: 1, unit: "ks" });
  });

  it("rozumie vete pri hľadaní", () => {
    const q = interpretQuery("niečo rýchle s kuracím");
    expect(q.filters).toMatchObject({ time: 30, meat: "kuracie" });
    expect(q.terms).toEqual([]);
    expect(CATALOG.filter((r) => matchesFilters(r, q.filters)).map((r) => r.id)).toContain("kuracie-kari");
  });

  it("výživa na porciu je rozumná a soľ do vody sa nepočíta", () => {
    const nu = recipeNutrition(find("carbonara")!);
    expect(nu.perPortion.kcal).toBeGreaterThan(400);
    expect(nu.perPortion.kcal).toBeLessThan(1200);
    expect(nu.skipped).toContain("Soľ");
  });
});
