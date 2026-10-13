import { describe, expect, it } from "vitest";
import { setActiveLocale } from "@/i18n/core";
import { category, categoryOrder, guessCategory, normalizeName } from "./categories";

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
    // anglické názvy (odhad nezávisí od jazyka rozhrania)
    ["Milk", "dairy_eggs"],
    ["whole milk 1l", "dairy_eggs"],
    ["Apples", "produce"],
    ["potatoes", "produce"],
    ["orange juice", "beverages"],
    ["oranges", "produce"],
    ["Bread", "bakery"],
    ["chicken breast", "meat_fish"],
    ["Toothpaste", "personal_care"],
    ["pasta", "pantry"],
    ["peanut butter", "breakfast"],
    ["black pepper", "pantry"],
    ["bell pepper", "produce"],
    ["pot", "home"],
    ["Toilet paper", "household_cleaning"],
    ["dog food", "pet"],
    ["frozen pizza", "frozen"],
    ["ice cream", "frozen"],
    ["Beer", "alcohol"],
    ["coffee", "breakfast"],
    ["chocolate", "snacks_sweets"],
  ];
  it.each(cases)("%s -> %s", (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it("názov kategórie sa prekladá podľa zvoleného jazyka", () => {
    setActiveLocale("sk");
    expect(category("produce").name).toBe("Ovocie a zelenina");
    setActiveLocale("en");
    expect(category("produce").name).toBe("Fruit & vegetables");
    expect(category("neznáma").name).toBe("Other");
    setActiveLocale("sk");
  });

  it("radí kategórie v poradí cesty obchodom", () => {
    expect(categoryOrder("produce")).toBeLessThan(categoryOrder("dairy_eggs"));
    expect(categoryOrder("unknown")).toBe(categoryOrder("other"));
  });
});
