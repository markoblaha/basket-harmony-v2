import { describe, expect, it } from "vitest";
import { computePeriod, daysBetween, shiftMonth } from "./period";

describe("computePeriod", () => {
  it("mesiac a predchádzajúci mesiac", () => {
    const p = computePeriod("month", "2026-03", "all");
    expect([p.from, p.to, p.prevFrom, p.prevTo]).toEqual(["2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28"]);
    expect(p.label).toBe("marec 2026");
  });
  it("január: predchádzajúci je december minulého roka", () => {
    const p = computePeriod("month", "2026-01", "all");
    expect([p.prevFrom, p.prevTo]).toEqual(["2025-12-01", "2025-12-31"]);
  });
  it("3 mesiace cez prelom roka", () => {
    const p = computePeriod("3m", "2026-02", "all");
    expect([p.from, p.to, p.prevFrom, p.prevTo]).toEqual(["2025-12-01", "2026-02-28", "2025-09-01", "2025-11-30"]);
    expect(p.label).toBe("dec 2025 – feb 2026");
  });
  it("rok", () => {
    const p = computePeriod("year", "2026-10", "everyday");
    expect([p.from, p.to, p.prevFrom, p.prevTo, p.label]).toEqual(["2026-01-01", "2026-12-31", "2025-01-01", "2025-12-31", "2026"]);
  });
  it("priestupný február", () => {
    expect(computePeriod("month", "2028-02", "all").to).toBe("2028-02-29");
  });
});

describe("pomocné výpočty", () => {
  it("posun mesiaca", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });
  it("dni medzi dátumami", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});
