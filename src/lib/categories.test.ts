import { describe, expect, it } from "vitest";
import { categoryOrder, guessCategory, normalizeName } from "./categories";

describe("normalizeName", () => {
  it("odstráni diakritiku, veľké písmená a nadbytočné medzery", () => {
    expect(normalizeName("  Mlieko  POLOTUČNÉ ")).toBe("mlieko polotucne");
  });
});

describe("guessCategory", () => {
  const cases: [string, string][] = [
    ["Mlieko polotučné", "dairy_eggs"],
    ["jablká", "produce"],
    ["Rožky", "bakery"],
    ["Kuracie prsia", "meat_fish"],
    ["Šunka", "deli_chilled"],
    ["Minerálka", "beverages"],
    ["Pivo", "alcohol"],
    ["Toaletný papier", "household_cleaning"],
    ["Zubná pasta", "personal_care"],
    ["Plienky", "baby"],
    ["Granule pre psa", "pet"],
    ["Káva", "breakfast"],
    ["Čokoláda", "snacks_sweets"],
    ["Olivový olej", "pantry"],
    ["Zmrzlina", "frozen"],
    ["Šróbovák", "other"],
    ["", "other"],
  ];
  it.each(cases)("%s -> %s", (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it("radí kategórie v poradí cesty obchodom", () => {
    expect(categoryOrder("produce")).toBeLessThan(categoryOrder("dairy_eggs"));
    expect(categoryOrder("unknown")).toBe(categoryOrder("other"));
  });
});
