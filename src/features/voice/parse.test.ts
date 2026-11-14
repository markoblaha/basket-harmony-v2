import { describe, expect, it } from "vitest";
import { cleanStore, isChatter, isVocabEcho, keepSaidWords, matchStore, parseLocal, splitStore, tooLong } from "./parse";

const add = (text: string) => parseLocal(text).filter((o) => o.op === "add");

describe("parseLocal", () => {
  it("položka bez množstva", () => {
    expect(add("banány")).toMatchObject([{ name: "Banány", quantity: null, unit: null }]);
  });

  it("čísla slovom aj číslicami", () => {
    expect(add("tri nugátové šišky")).toMatchObject([{ name: "Nugátové šišky", quantity: 3, unit: "ks" }]);
    expect(add("3 jogurty")).toMatchObject([{ name: "Jogurty", quantity: 3, unit: "ks" }]);
    expect(add("hovädzie mäso dvesto päťdesiat gramov")).toMatchObject([{ name: "Hovädzie mäso", quantity: 250, unit: "g" }]);
    expect(add("mlieko 2 litre")).toMatchObject([{ name: "Mlieko", quantity: 2, unit: "l" }]);
    expect(add("dvadsaťpäť deka šunky")).toMatchObject([{ name: "Šunky", quantity: 25, unit: "dkg" }]);
  });

  it("pol a jeden a pol", () => {
    expect(add("pol kila múky")).toMatchObject([{ name: "Múky", quantity: 0.5, unit: "kg" }]);
    expect(add("jeden a pol kila jabĺk")).toMatchObject([{ name: "Jabĺk", quantity: 1.5, unit: "kg" }]);
  });

  it("viac položiek v jednej vete", () => {
    const ops = add("chlieb, maslo a potom dve mlieka");
    expect(ops.map((o) => o.op === "add" && o.name)).toEqual(["Chlieb", "Maslo", "Mlieka"]);
  });

  it("výplňové slová na začiatku", () => {
    expect(add("a ešte jedny banány")).toMatchObject([{ name: "Banány", quantity: 1 }]);
  });

  it("príkazy", () => {
    expect(parseLocal("zmaž tresku")).toEqual([{ op: "remove", target: "Tresku" }]);
    expect(parseLocal("Hotovo.")).toEqual([{ op: "done" }]);
    expect(parseLocal("to je všetko")).toEqual([{ op: "done" }]);
  });

  it("úprava ťuknutej položky", () => {
    expect(parseLocal("pol kila", "Treska")).toEqual([{ op: "change", target: "Treska", quantity: 0.5, unit: "kg", delta: null, name: null }]);
    expect(parseLocal("o jeden viac", "Chlieb")).toMatchObject([{ op: "change", delta: 1 }]);
  });
});

describe("matchStore", () => {
  const stores = ["Lidl", "Kaufland", "Billa", "Tesco"];
  it("skloňované názvy", () => {
    expect(matchStore("idem do Lidla", stores)).toBe("Lidl");
    expect(matchStore("do Kauflandu", stores)).toBe("Kaufland");
    expect(matchStore("Billa", stores)).toBe("Billa");
  });
  it("neznáma predajňa po „idem do“", () => {
    expect(matchStore("idem do drogérie", stores)).toBe("Drogérie");
  });
});

describe("delenie vety bez čiarok", () => {
  const names = (t: string) => parseLocal(t).map((o) => (o.op === "add" ? `${o.name}${o.quantity != null ? ` ${o.quantity} ${o.unit}` : ""}` : o.op));
  it("rozpoznávanie reči bez čiarok", () => {
    expect(names("banány 3 rožky maslo šunka")).toEqual(["Banány", "Rožky 3 ks", "Maslo", "Šunka"]);
    expect(names("mrkva pivo 6ks šunka")).toEqual(["Mrkva", "Pivo 6 ks", "Šunka"]);
    expect(names("mlieko 3 kusy banány smotana 3 kusy")).toEqual(["Mlieko 3 ks", "Banány", "Smotana 3 ks"]);
    expect(names("tri banány")).toEqual(["Banány 3 ks"]);
    expect(names("banány 3ks")).toEqual(["Banány 3 ks"]);
  });
  it("prídavné meno ostáva pri podstatnom", () => {
    expect(names("maslo hovädzie mäso 250 g")).toEqual(["Maslo", "Hovädzie mäso 250 g"]);
    expect(names("kuracie prsia mlieko polotučné")).toEqual(["Kuracie prsia", "Mlieko polotučné"]);
  });
});

describe("splitStore", () => {
  const stores = ["Lidl", "Kaufland", "Billa", "Coop Jednota", "DM"];
  it("oddelí známu predajňu v inom páde", () => {
    expect(splitStore("idem do Lidla", stores)).toEqual({ store: "Lidl", rest: "" });
    expect(splitStore("idem do Kauflandu, mlieko a rožky", stores)).toEqual({ store: "Kaufland", rest: "mlieko a rožky" });
    expect(splitStore("v Coop Jednote maslo", stores)).toEqual({ store: "Coop Jednota", rest: "maslo" });
  });
  it("neznámu predajňu len za „idem do“", () => {
    expect(splitStore("idem do Fresh", stores)).toEqual({ store: "Fresh", rest: "" });
    expect(splitStore("mlieko a maslo", stores)).toEqual({ store: null, rest: "mlieko a maslo" });
  });
});

describe("keepSaidWords – AI nedomýšľa", () => {
  it("nechá len slová, ktoré zazneli", () => {
    expect(keepSaidWords("Mlieko plnotučné", "dve mlieka")).toBe("Mlieko");
    expect(keepSaidWords("Mleté mäso zmiešané", "pol kila mletého mäsa")).toBe("Mleté mäso");
    expect(keepSaidWords("Kyslá smotana", "kyslú smotanu")).toBe("Kyslá smotana");
  });
  it("preklad značky nechá", () => {
    expect(keepSaidWords("Pilsner Urquell", "šesť plzní")).toBe("Pilsner Urquell");
  });
});

describe("isChatter", () => {
  it("výplňové slová, pozdravy a výmysly prepisu nie sú nákup", () => {
    for (const x of ["hm", "Hmm…", "dobre, jasné", "Áno áno.", "ďakujem", "ahoj", "no tak", "OK", "[hudba]", "(smiech)", "Titulky vytvoril JohnyX", "Ďakujem za pozornosť.", "  ", "Ty kokos!", "Ale to je.", "no teda, áno"])
      expect(isChatter(x), x).toBe(true);
  });
  it("veta s tovarom alebo číslom ide ďalej (rozhodne AI)", () => {
    for (const x of ["mlieko", "dve", "nie, tri", "hotovo", "zmaž banány", "ahoj, kúp mlieko", "kde máš kľúče", "jasné, a ešte chlieb"])
      expect(isChatter(x), x).toBe(false);
  });
});

describe("ozvena slovníka, dlhé názvy, obchod", () => {
  it("výrazy oddelené pomlčkami sú ozvena slovníka živého prepisu", () => {
    expect(isChatter("Max - Golden Turtle - Finish - Gimbap Gim - FeverMates - Nongshim")).toBe(true);
    expect(isChatter("Olej - Batat -")).toBe(true);
    expect(isChatter("mlieko, chlieb a maslo")).toBe(false);
    expect(isChatter("kokos")).toBe(false);
  });
  it("celá veta nie je názov položky", () => {
    expect(tooLong("Ja som nič nevidel a ani nepočul nič")).toBe(true);
    expect(tooLong("Mlieko polotučné 1,5 %")).toBe(false);
  });
  it("obchod musí mať aspoň dve písmená", () => {
    expect(cleanStore(".")).toBe(null);
    expect(cleanStore("  ")).toBe(null);
    expect(cleanStore("Lidl.")).toBe("Lidl");
    expect(cleanStore("dm")).toBe("dm");
  });
});

describe("isVocabEcho", () => {
  const vocab = ["kapary", "mlieko", "šafran", "rožky", "chlieb", "kurkuma", "maslo", "banány", "olej", "vajcia", "syr", "cukor", "múka", "ryža"];
  it("výrazy v poradí (zamiešaného) slovníka sú ozvena", () => {
    expect(isVocabEcho("Kapary, mlieko, šafran, rožky", vocab)).toBe(true);
    expect(isVocabEcho("mlieko rožky chlieb maslo", vocab)).toBe(true);
  });
  it("bežné diktovanie nie je ozvena", () => {
    expect(isVocabEcho("maslo, mlieko a chlieb", vocab)).toBe(false);
    expect(isVocabEcho("dve mlieka a chlieb", vocab)).toBe(false);
    expect(isVocabEcho("ryža, cukor, múka a olej", vocab)).toBe(false);
  });
  it("priveľa výrazov naraz je ozvena", () => {
    expect(isVocabEcho("ryža syr maslo kapary mlieko šafran olej cukor múka vajcia rožky banány", vocab)).toBe(true);
  });
});
