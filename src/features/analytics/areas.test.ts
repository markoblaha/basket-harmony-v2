import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/categories";
import { AREAS, areaOf, groupByArea } from "./areas";

describe("oblasti rodinného rozpočtu", () => {
  it("každá kategória patrí práve do jednej oblasti", () => {
    for (const c of CATEGORIES) {
      const owners = AREAS.filter((a) => a.categories.includes(c.id));
      expect(owners.length, c.id).toBe(1);
    }
  });
  it("benzín je v Auto a benzín, nájom v Bývaní", () => {
    expect(areaOf("fuel").id).toBe("car");
    expect(areaOf("housing").id).toBe("housing");
    expect(areaOf("neznama").id).toBe("other");
  });
  it("súčet oblastí = súčet kategórií", () => {
    const cats = [
      { id: "produce", amount: 10, items: 2, prev_amount: 5 },
      { id: "groceries", amount: 20.5, items: 0, prev_amount: 0 },
      { id: "fuel", amount: 80, items: 1, prev_amount: 70 },
      { id: "_unassigned", amount: 3.1, items: 0, prev_amount: 0 },
    ];
    const areas = groupByArea(cats);
    expect(areas[0]!.area.id).toBe("car");
    expect(areas.find((a) => a.area.id === "food")!.amount).toBe(30.5);
    expect(areas.reduce((s, a) => s + a.amount, 0)).toBeCloseTo(113.6);
  });
});
