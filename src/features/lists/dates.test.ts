import { describe, expect, it } from "vitest";
import { addDays, dayLabel, isOverdue, isoDay, nextSaturday } from "./dates";

describe("dátumy nákupov", () => {
  it("dnes, zajtra, včera", () => {
    const today = new Date();
    expect(dayLabel(isoDay(today))).toBe("dnes");
    expect(dayLabel(isoDay(addDays(today, 1)))).toBe("zajtra");
    expect(dayLabel(isoDay(addDays(today, -1)))).toBe("včera");
  });

  it("vzdialenejší deň so skratkou dňa", () => {
    expect(dayLabel("2031-03-15")).toBe("so 15. 3.");
  });

  it("najbližšia sobota", () => {
    expect(nextSaturday(new Date(2026, 9, 13)).getDate()).toBe(17); // utorok -> sobota
    expect(nextSaturday(new Date(2026, 9, 17)).getDate()).toBe(17); // sobota -> dnes
  });

  it("zmeškaný plánovaný deň", () => {
    expect(isOverdue(isoDay(addDays(new Date(), -2)))).toBe(true);
    expect(isOverdue(isoDay(new Date()))).toBe(false);
  });
});
