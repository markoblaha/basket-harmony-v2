import { afterEach, describe, expect, it } from "vitest";
import { en, enModules } from "./en";
import { sk, skModules } from "./sk";
import { formatEuro, formatNumber, getLocale, hasKey, setActiveLocale, t, tn } from "./core";

const skEntries = Object.entries(sk) as [string, string][];
const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("slovníky", () => {
  it("slovenčina a angličtina majú rovnaké kľúče", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sk).sort());
  });

  it("každý modul má v oboch jazykoch rovnaké kľúče", () => {
    expect(enModules.length).toBe(skModules.length);
    skModules.forEach((module, i) => {
      expect(Object.keys(enModules[i]!).sort()).toEqual(Object.keys(module).sort());
    });
  });

  it("žiadny kľúč nie je v dvoch moduloch (druhý by potichu prepísal prvý)", () => {
    const total = skModules.reduce((sum, module) => sum + Object.keys(module).length, 0);
    expect(total).toBe(Object.keys(sk).length);
  });

  it("žiadny text nie je prázdny", () => {
    for (const [key, text] of skEntries) {
      expect(text.trim(), `sk ${key}`).not.toBe("");
      expect((en as Record<string, string>)[key]!.trim(), `en ${key}`).not.toBe("");
    }
  });

  it("anglický text má rovnaké {parametre} ako slovenský", () => {
    for (const [key, text] of skEntries) {
      expect(params((en as Record<string, string>)[key]!), key).toEqual(params(text));
    }
  });

  it("množné číslo: každý základ má tvary one, few aj other v oboch jazykoch", () => {
    // Základ množného čísla = kľúč končiaci na ".one" (kľúč ako "area.other" je obyčajný text, nie tvar).
    const bases = skEntries.map(([key]) => key).filter((key) => key.endsWith(".one")).map((key) => key.slice(0, -".one".length));
    expect(bases.length).toBeGreaterThan(10);
    for (const base of bases) {
      for (const form of ["one", "few", "other"]) {
        expect(hasKey(`${base}.${form}`), `${base}.${form}`).toBe(true);
      }
    }
  });
});

describe("t() a tn()", () => {
  afterEach(() => setActiveLocale("sk"));

  it("dosadzuje parametre", () => {
    setActiveLocale("sk");
    expect(t("household.remove", { name: "Lucia" })).toContain("Lucia");
    setActiveLocale("en");
    expect(t("household.remove", { name: "Lucia" })).toContain("Lucia");
  });

  it("slovenčina má tri tvary množného čísla", () => {
    setActiveLocale("sk");
    expect(tn("shop.itemCount", 1)).toBe("1 položka");
    expect(tn("shop.itemCount", 3)).toBe("3 položky");
    expect(tn("shop.itemCount", 5)).toBe("5 položiek");
    expect(tn("shop.itemCount", 0)).toBe("0 položiek");
  });

  it("angličtina rozlišuje jednotné a množné číslo", () => {
    setActiveLocale("en");
    expect(tn("shop.itemCount", 1)).toBe("1 item");
    expect(tn("shop.itemCount", 3)).toBe("3 items");
    expect(tn("shop.itemCount", 0)).toBe("0 items");
  });

  it("tn() dosadí aj ďalšie parametre", () => {
    setActiveLocale("en");
    expect(tn("stmt.addPayments", 2, { sum: "€10.00" })).toBe("Add 2 payments · €10.00");
  });

  it("jazyk sa prepína a čísla sa formátujú podľa neho", () => {
    setActiveLocale("sk");
    expect(getLocale()).toBe("sk");
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatEuro(1.5)).toContain("1,50");
    setActiveLocale("en");
    expect(getLocale()).toBe("en");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatEuro(1.5)).toBe("€1.50");
  });

  it("hasKey rozozná existujúci a neexistujúci kľúč", () => {
    expect(hasKey("error.generic")).toBe(true);
    expect(hasKey("error.NEEXISTUJE")).toBe(false);
  });
});
