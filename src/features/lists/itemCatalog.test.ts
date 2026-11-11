import { describe, expect, it } from "vitest";
import { buildCatalog, estimate, refinements, resolveName, searchNames, spellFix, typoFix, type Buy, type CatProduct } from "./itemCatalog";

const today = new Date();
const day = (ago: number) => new Date(today.getTime() - ago * 86_400_000).toISOString().slice(0, 10);
let n = 0;
const P = (name: string, kind: string | null, brand: string | null, category_id: string, buys: [number, number, string?][] = []): CatProduct => ({
  id: `p${++n}`,
  name,
  kind,
  brand,
  category_id,
  size_value: null,
  size_unit: null,
  buys: buys.map(([ago, t, s]): Buy => ({ d: day(ago), s: s ?? "LIDL SR", t, q: 1, u: "ks" })),
});

const cat = buildCatalog([
  P("Svetlé pivo 12°", "Pivo", "Pilsner Urquell", "alcohol", [[3, 1.29], [10, 1.35]]),
  P("Svetlé pivo 10°", "Pivo", "Radegast", "alcohol", [[5, 0.99], [20, 1.05]]),
  P("Nealkoholické pivo", "Nealko pivo", "Staropramen", "beverages", [[7, 0.89]]),
  P("Kyslá smotana 16 %", "Kyslá smotana", "Rajo", "dairy_eggs", [[2, 0.55]]),
  P("Smotana na šľahanie 33 %", "Smotana na šľahanie", "Tatra", "dairy_eggs", [[4, 1.49]]),
  P("Smotanová nátierka", "Nátierka", null, "dairy_eggs", [[6, 1.1]]),
  P("Mlieko polotučné", "Mlieko", "Rajo", "dairy_eggs", [[1, 0.99], [8, 0.95]]),
  P("Spevňujúce telové mlieko", "Telové mlieko", "Lactovit", "personal_care", [[9, 2.99], [30, 2.99], [60, 2.99]]),
  P("Trvanlivé mlieko 3,5 %", "Mlieko", null, "dairy_eggs"),
  P("Toastový chlieb", "Chlieb", "Ölz", "bakery", [[3, 1.25]]),
  P("Bochník viaczrnný", "Chlieb", null, "bakery", [[4, 1.9]]),
]);

describe("rozpoznanie položky (appka nič nedomýšľa)", () => {
  it("všeobecná položka = priemer druhov tej istej veci", () => {
    const r = resolveName(cat, "pivo")!;
    expect(r.level).toBe("general");
    expect(r.label).toBe("Pivo");
    expect(r.kinds).toBe(2);
    expect(r.members.map((p) => p.name)).not.toContain("Nealkoholické pivo");
  });

  it("značka podľa hovorového mena – cena len z nej", () => {
    const r = resolveName(cat, "plzeň")!;
    expect(r.level).toBe("brand");
    expect(r.label).toBe("Pilsner Urquell");
    expect(r.members.map((p) => p.name)).toEqual(["Svetlé pivo 12°"]);
    expect(resolveName(cat, "radegast")!.level).toBe("brand");
  });

  it("presný druh", () => {
    const r = resolveName(cat, "kyslá smotana")!;
    expect(r.level).toBe("kind");
    expect(r.members).toHaveLength(1);
  });

  it("„smotana“ = smotany, nie smotanová nátierka", () => {
    const r = resolveName(cat, "smotana")!;
    expect(r.level).toBe("general");
    expect(r.label).toBe("Smotana");
    const names = r.members.map((p) => p.name);
    expect(names).toContain("Kyslá smotana 16 %");
    expect(names).not.toContain("Smotanová nátierka");
  });

  it("mlieko nie je telové mlieko (iná kategória)", () => {
    const r = resolveName(cat, "mlieko")!;
    expect(r.category).toBe("dairy_eggs");
    expect(r.members.map((p) => p.name)).not.toContain("Spevňujúce telové mlieko");
  });

  it("hovorový tvar a iný pád", () => {
    expect(resolveName(cat, "chleba")!.label).toBe("Chlieb");
    expect(resolveName(cat, "2 mlieka")!.label).toBe("Mlieko");
  });

  it("neznáme a široké slová sa pridajú tak, ako sú napísané", () => {
    expect(resolveName(cat, "žehlička")).toBeNull();
    expect(resolveName(cat, "mäso")).toBeNull();
  });

  it("spresnenie všeobecnej položky ponúkne druhy a značky", () => {
    const labels = refinements(cat, resolveName(cat, "pivo")).map((x) => x.label);
    expect(labels).toEqual(expect.arrayContaining(["Svetlé pivo 12°", "Svetlé pivo 10°", "Pilsner Urquell", "Radegast"]));
  });

  it("preklep sa len ponúkne", () => {
    expect(typoFix(cat, "mleko")?.label).toBe("Mlieko");
    expect(typoFix(cat, "mlieko")).toBeNull();
  });

  it("hľadanie podľa začiatku slova", () => {
    expect(searchNames(cat, "smot").map((x) => x.label)).toContain("Kyslá smotana 16 %");
  });

  it("pri písaní ide jedlo pred drogériou s rovnakým slovom", () => {
    expect(searchNames(cat, "mlie").map((x) => x.label)).toEqual(["Mlieko polotučné", "Trvanlivé mlieko 3,5 %", "Spevňujúce telové mlieko"]);
    expect(searchNames(cat, "telo").map((x) => x.label)).toEqual(["Spevňujúce telové mlieko"]);
  });
});

describe("odhad ceny", () => {
  const keyOf = (s: string) => (s.toLowerCase().startsWith("lidl") ? "lidl" : null);
  it("značka = medián jej posledných nákupov", () => {
    const e = estimate(resolveName(cat, "plzeň"), 6, null, "lidl", keyOf)!;
    expect(e.price.up).toBeCloseTo(1.32, 2);
    expect(e.v).toBeCloseTo(1.32 * 6, 2);
  });
  it("všeobecná položka = priemer druhov", () => {
    const e = estimate(resolveName(cat, "pivo"), 1, null, null, keyOf)!;
    expect(e.price.avg).toBe(true);
    expect(e.v).toBeCloseTo((1.29 + 1.35 + 0.99 + 1.05) / 4, 2);
  });
  it("vážený tovar v kusoch sa ráta podľa ceny za kg", () => {
    const c2 = buildCatalog([{ ...P("Banány", "Banány", null, "produce"), buys: [{ d: day(2), s: "LIDL", t: 1.6, q: 1, u: "kg" }, { d: day(9), s: "LIDL", t: 1.2, q: 0.75, u: "kg" }] }]);
    const six = estimate(resolveName(c2, "banány"), 6, null, null, keyOf)!;
    expect(six.perKg).toBe(true);
    expect(six.kg).toBeCloseTo(1.08, 3);
    expect(six.v).toBeCloseTo(1.6 * 1.08, 2);
    const one = estimate(resolveName(c2, "banány"), 1, null, null, keyOf)!;
    expect(one.kg).toBeCloseTo(0.875, 3);
  });
  it("bez nákupov nie je cena", () => {
    expect(estimate(null, 1, null, null, keyOf)).toBeNull();
  });
});

describe("Enter pridá napísané – opraví sa len pravopis (11. 11.)", () => {
  const fix = (x: string) => spellFix(cat, x).text;
  it("diakritika a veľké písmeno, nič iné", () => {
    expect(fix("pivo")).toBe("Pivo");
    expect(fix("svetle pivo")).toBe("Svetlé pivo");
    expect(fix("kysla smotana")).toBe("Kyslá smotana");
    expect(fix("mlieko")).toBe("Mlieko");
  });
  it("značka ostane tak, ako bola napísaná (nie Pilsner Urquell)", () => {
    expect(fix("plzen")).toBe("Plzeň");
    expect(fix("radegast")).toBe("Radegast");
    const c2 = buildCatalog([P("Pivo Smíchov", "Pivo", "Staropramen", "alcohol")]);
    expect(spellFix(c2, "pivo smichov").text).toBe("Pivo Smíchov");
  });
  it("preklep v jednom slove sa opraví", () => {
    expect(spellFix(cat, "mleko")).toEqual({ text: "Mlieko", typo: true });
    expect(spellFix(cat, "mlieko").typo).toBe(false);
  });
  it("neznáme slovo ostane, pri viacerých slovách sa preklep nehádže", () => {
    expect(fix("cukrík")).toBe("Cukrík");
    expect(fix("mleko čerstvé")).toBe("Mleko čerstvé");
  });
});
