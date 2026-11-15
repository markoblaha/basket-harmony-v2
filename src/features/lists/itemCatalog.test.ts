import { describe, expect, it } from "vitest";
import { buildCatalog, compareStores, estimate, refinements, resolveName, searchNames, spellFix, typoFix, type Buy, type CatProduct } from "./itemCatalog";

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

describe("odhad ceny (12. 11.: tvoj najčastejší výrobok v obchode zoznamu)", () => {
  const keyOf = (s: string) => (s.toLowerCase().startsWith("lidl") ? "lidl" : s.toLowerCase().startsWith("kaufland") ? "kaufland" : null);
  it("značka = posledná bežná cena v obchode", () => {
    const e = estimate(resolveName(cat, "plzeň"), 6, null, "lidl", keyOf)!;
    expect(e.price.up).toBeCloseTo(1.29, 2);
    expect(e.v).toBeCloseTo(1.29 * 6, 2);
    expect(e.price.same).toBe(true);
  });
  it("všeobecná položka = najčastejší výrobok, nie priemer druhov", () => {
    const e = estimate(resolveName(cat, "pivo"), 1, null, null, keyOf)!;
    // obe pivá 2 nákupy – rozhodne novší nákup (Pilsner pred 3 dňami)
    expect(e.price.product.brand).toBe("Pilsner Urquell");
    expect(e.v).toBeCloseTo(1.29, 2);
    expect(e.lo).toBeCloseTo(0.99, 2);
    expect(e.hi).toBeCloseTo(1.29, 2);
  });
  it("v obchode zoznamu vyhrá výrobok, ktorý kupuješ tam", () => {
    const c = buildCatalog([
      { ...P("Maslo 82 %", "Maslo", "Pilos", "dairy_eggs"), size_value: 250, size_unit: "g", buys: [1, 8, 15, 22].map((ago): Buy => ({ d: day(ago), s: "Lidl", k: "lidl", t: 2.39, q: 1, u: "ks", p: 2.39 })) },
      { ...P("Maslo", "Maslo", "Tatranské", "dairy_eggs"), size_value: 250, size_unit: "g", buys: [3, 12].map((ago): Buy => ({ d: day(ago), s: "Kaufland", k: "kaufland", t: 2.69, q: 1, u: "ks", p: 2.69 })) },
    ]);
    expect(estimate(resolveName(c, "maslo"), 2, null, "kaufland", keyOf)!.price.product.brand).toBe("Tatranské");
    const lidl = estimate(resolveName(c, "maslo"), 2, null, "lidl", keyOf)!;
    expect(lidl.price.product.brand).toBe("Pilos");
    expect(lidl.v).toBeCloseTo(4.78, 2);
    // presná váha pri balenom výrobku: 0,5 kg = 2 balenia po 250 g
    expect(estimate(resolveName(c, "maslo"), 500, "g", "lidl", keyOf)!.v).toBeCloseTo(4.78, 2);
  });
  it("akcia nie je bežná cena", () => {
    const c = buildCatalog([{ ...P("Jogurt biely", "Jogurt", "Rajo", "dairy_eggs"), buys: [
      { d: day(9), s: "Lidl", k: "lidl", t: 0.49, q: 1, u: "ks", p: 0.49 },
      { d: day(2), s: "Lidl", k: "lidl", t: 0.35, q: 1, u: "ks", p: 0.35, a: true },
    ] }]);
    const e = estimate(resolveName(c, "jogurt"), 1, null, "lidl", keyOf)!;
    expect(e.v).toBeCloseTo(0.49, 2);
    expect(e.price.promo).toBe(false);
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
  it("preklep sa nemení na iné slovo – ostane, ako je napísaný (návrhy sú na výber)", () => {
    expect(spellFix(cat, "mleko")).toEqual({ text: "Mleko", typo: false });
    expect(fix("masl")).toBe("Masl");
  });
  it("neznáme slovo ostane, pri viacerých slovách sa preklep nehádže", () => {
    expect(fix("cukrík")).toBe("Cukrík");
    expect(fix("mleko čerstvé")).toBe("Mleko čerstvé");
  });
});

describe("porovnanie obchodov pre zoznam (13. 11.)", () => {
  const keyOf = (s: string) => s.toLowerCase();
  const b = (ago: number, k: string, p: number, a = false, u = "ks", q = 1): Buy => ({ d: day(ago), s: k, k, t: p * q, q, u, p, a });
  const c = buildCatalog([
    { ...P("Maslo 82 %", "Maslo", "Pilos", "dairy_eggs"), buys: [b(2, "lidl", 2.39), b(5, "kaufland", 2.69)] },
    { ...P("Mlieko", "Mlieko", "Rajo", "dairy_eggs"), buys: [b(3, "lidl", 0.95), b(4, "kaufland", 1.19)] },
    { ...P("Banány", "Banány", null, "produce"), buys: [b(2, "lidl", 1.19, false, "kg", 1.2), b(6, "kaufland", 1.29, false, "kg", 0.8)] },
    { ...P("Káva", "Káva", "Lavazza", "breakfast"), buys: [b(10, "kaufland", 17.99), b(100, "lidl", 13.99)] },
    { ...P("Jogurt", "Jogurt", "Rajo", "dairy_eggs"), buys: [b(2, "kaufland", 0.45), b(3, "tesco", 0.3, true)] },
  ]);
  const resolve = (n: string) => resolveName(c, n);
  const items = ["maslo", "mlieko 2", "banány", "káva", "jogurt"].map((x) => { const [name, q] = x.split(" "); return { name: name!, quantity: q ? Number(q) : null, unit: null }; });
  it("porovná len položky s čerstvou cenou bez akcie v oboch obchodoch", () => {
    const r = compareStores(items, resolve, "kaufland", keyOf);
    expect(r.map((x) => x.key)).toEqual(["lidl"]);
    const l = r[0]!;
    // maslo, mlieko a banány; káva v Lidli je stará, jogurt v Tescu len z akcie (a Tesco nemá polovicu položiek)
    expect(l.n).toBe(3);
    expect(l.lines.map((x) => x.name)).toEqual(["maslo", "mlieko", "banány"]);
    // banány na rovnakú váhu v oboch obchodoch (bežný nákup domácnosti = 1 kg)
    const ban = l.lines[2]!;
    expect(ban.there / ban.here).toBeCloseTo(1.19 / 1.29, 3);
    expect(l.diff).toBeCloseTo(0.3 + 2 * 0.24 + 1 * 0.1, 2);
  });
  it("bez dosť spoločných položiek sa neporovnáva", () => {
    expect(compareStores(items.slice(3), resolve, "kaufland", keyOf)).toEqual([]);
  });
});
