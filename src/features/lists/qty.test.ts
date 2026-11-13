import { describe, expect, it } from "vitest";
import { itemKey, sameProduct } from "./qty";

describe("sameProduct – tvary toho istého slova", () => {
  it("spojí jednotné a množné číslo aj pády", () => {
    expect(sameProduct("Banán", "Banány")).toBe(true);
    expect(sameProduct("rožok", "Rožky")).toBe(true);
    expect(sameProduct("Mlieko", "mlieka")).toBe(true);
    expect(sameProduct("cukor", "Cukru")).toBe(true);
    expect(sameProduct("Pivo", "piva")).toBe(true);
    expect(sameProduct("jablko", "Jablká")).toBe(true);
    expect(sameProduct("syr", "Syry")).toBe(true);
  });
  it("rozdielne veci nespojí", () => {
    expect(sameProduct("Mlieko", "Mlieko polotučné")).toBe(false);
    expect(sameProduct("Pivo", "Pivo 12°")).toBe(false);
    expect(sameProduct("Maslo", "Mlieko")).toBe(false);
    expect(sameProduct("Syr", "Smotana")).toBe(false);
  });
  it("kľúč nezávisí od diakritiky a veľkých písmen", () => {
    expect(itemKey("Šampiňóny")).toBe(itemKey("sampinony"));
  });
});
