import { describe, expect, it } from "vitest";
import { BREAK_EVERY, feedRound, isBreak, withBreaks, type FeedRecipe, type FeedSignals } from "./taste";

const R = (id: string, cat: string, book = false): FeedRecipe => ({ id, cat, book });
const sig = (o: Partial<FeedSignals> = {}): FeedSignals => ({ have: () => 0, seen: {}, no: {}, rnd: () => 0, ...o });

describe("Ochutnávač – poradie", () => {
  const pool = [R("a", "maso"), R("b", "maso"), R("c", "polievky", true), R("d", "sladke"), R("e", "maso", true)];

  it("recepty z knihy idú prvé", () => {
    const ids = feedRound(pool, sig());
    expect(ids.slice(0, 2).sort()).toEqual(["c", "e"]);
  });

  it("dve rovnaké kategórie za sebou len keď inak niet z čoho vybrať", () => {
    const cat = Object.fromEntries(pool.map((r) => [r.id, r.cat]));
    const ids = feedRound(pool, sig());
    for (let i = 1; i < ids.length; i++) {
      if (ids.slice(i).some((x) => cat[x] !== cat[ids[i - 1]!])) expect(cat[ids[i]!], ids.join()).not.toBe(cat[ids[i - 1]!]);
    }
  });

  it("„Nie“ a už videné idú dozadu", () => {
    expect(feedRound(pool, sig({ no: { c: 1 } })).at(-1)).toBe("c");
    const seen = feedRound(pool, sig({ seen: { e: 1 } }));
    expect(seen.indexOf("e")).toBeGreaterThan(seen.indexOf("c"));
  });

  it("nové kolo nezačne tým istým receptom, ktorým skončilo staré", () => {
    const first = feedRound(pool, sig());
    const last = pool.find((r) => r.id === first.at(-1))!;
    expect(feedRound(pool, sig(), last)[0]).not.toBe(last.id);
  });

  it("prestávka po každých 12 receptoch, aj naprieč kolami", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `r${i}`);
    const a = withBreaks(ids, 0);
    expect(a[BREAK_EVERY]).toBe(`#b${BREAK_EVERY}`);
    expect(a.filter(isBreak)).toHaveLength(1);
    const b = withBreaks(ids.slice(0, 5), 20);
    expect(b.filter(isBreak)).toEqual(["#b24"]);
  });
});
