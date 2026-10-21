import { describe, expect, it } from "vitest";
import { matchStore, parseLocal, splitStore } from "./parse";

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
