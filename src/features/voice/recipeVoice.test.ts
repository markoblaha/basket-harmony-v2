import { describe, expect, it } from "vitest";
import { recipeCommand, sameDish, splitCook } from "./recipeVoice";

describe("splitCook", () => {
  it("oddelí jedlo od položiek", () => {
    expect(splitCook("mlieko, dva rožky a chcem uvariť hovädzí guláš")).toEqual({ cook: ["Hovädzí guláš"], rest: "mlieko, dva rožky a" });
    expect(splitCook("chcem uvariť hovädzí guláš, mlieko a maslo")).toEqual({ cook: ["Hovädzí guláš"], rest: "mlieko a maslo" });
    expect(splitCook("na večeru urobím hovädzí burger").cook).toEqual(["Hovädzí burger"]);
    expect(splitCook("upečiem bábovku a kúp mlieko")).toEqual({ cook: ["Bábovku"], rest: "mlieko" });
    expect(splitCook("mlieko a maslo")).toEqual({ cook: [], rest: "mlieko a maslo" });
  });
  it("rovnaké jedlo", () => {
    expect(sameDish("hovädzí guláš", "Hovädzí guláš")).toBe(true);
    expect(sameDish("guláš", "Hovädzí guláš")).toBe(true);
    expect(sameDish("burger", "guláš")).toBe(false);
  });
});

describe("recipeCommand", () => {
  const opts = ["Klasický hovädzí guláš", "Pivný hovädzí guláš", "Kotlíkový hovädzí guláš", "Rýchly hovädzí guláš"];
  const ings = ["Hovädzie mäso", "Cibuľa", "Cesnak", "Mletá sladká paprika"];
  it("výber variantu", () => {
    expect(recipeCommand("ten druhý", opts, [])).toEqual({ kind: "pick", index: 1 });
    expect(recipeCommand("tretí", opts, [])).toEqual({ kind: "pick", index: 2 });
    expect(recipeCommand("ten pivný", opts, [])).toEqual({ kind: "pick", index: 1 });
    expect(recipeCommand("posledný", opts, [])).toEqual({ kind: "pick", index: 3 });
  });
  it("porcie, bez, pridaj, zruš", () => {
    expect(recipeCommand("na šesť porcií", opts, ings)).toEqual({ kind: "portions", n: 6 });
    expect(recipeCommand("na 8 porcií", opts, ings)).toEqual({ kind: "portions", n: 8 });
    expect(recipeCommand("bez cibule", opts, ings)).toEqual({ kind: "without", index: 1 });
    expect(recipeCommand("cesnak mám doma", opts, ings)).toBeNull();
    expect(recipeCommand("mám doma cesnak", opts, ings)).toEqual({ kind: "without", index: 2 });
    expect(recipeCommand("aj cibuľu", opts, ings)).toEqual({ kind: "with", index: 1 });
    expect(recipeCommand("pridaj", opts, ings)).toEqual({ kind: "add" });
    expect(recipeCommand("áno", opts, ings)).toEqual({ kind: "add" });
    expect(recipeCommand("zruš recept", opts, ings)).toEqual({ kind: "cancel" });
  });
  it("bežná položka nie je povel", () => {
    expect(recipeCommand("mlieko a dva rožky", opts, ings)).toBeNull();
    expect(recipeCommand("tri banány", opts, ings)).toBeNull();
    expect(recipeCommand("tri", opts, ings)).toBeNull();
    expect(recipeCommand("dvojka", opts, ings)).toEqual({ kind: "pick", index: 1 });
  });
});
