import { describe, expect, it } from "vitest";
import { candidates, keyOf, nextSlots } from "./quickSlots";

describe("candidates", () => {
  it("spája zdroje podľa priority, bez duplicít a bez toho, čo je v zozname", () => {
    expect(candidates([["Rožky", "Mlieko"], ["mlieko", "Chlieb", "Maslo"]], new Set([keyOf("Chlieb")]))).toEqual(["Rožky", "Mlieko", "Maslo"]);
  });
});

describe("nextSlots", () => {
  it("prvé naplnenie v poradí", () => {
    expect(nextSlots([], ["A", "B", "C", "D"], 3)).toEqual(["A", "B", "C"]);
  });
  it("pridaný produkt zmizne a na JEHO miesto príde ďalší – ostatné sa nepohnú", () => {
    expect(nextSlots(["A", "B", "C"], ["A", "C", "D", "E"], 3)).toEqual(["A", "D", "C"]);
  });
  it("produkt, ktorý sa práve ťuká, ostane, aj keď už nie je medzi kandidátmi", () => {
    expect(nextSlots(["A", "B"], ["A", "C"], 2, new Set([keyOf("B")]))).toEqual(["A", "B"]);
  });
  it("keď kandidáti dôjdu, slotov je menej", () => {
    expect(nextSlots(["A", "B", "C"], ["A"], 3)).toEqual(["A"]);
  });
});
