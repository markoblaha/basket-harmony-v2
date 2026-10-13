import { describe, expect, it } from "vitest";
import { parseAmount, storeHue, storeInitials } from "./format";

describe("storeInitials / storeHue", () => {
  it("robí iniciálky", () => {
    expect(storeInitials("Lidl")).toBe("LI");
    expect(storeInitials("Kaufland Pezinok")).toBe("KP");
    expect(storeInitials(null)).toBe("?");
  });
  it("odtieň je stabilný a v rozsahu", () => {
    expect(storeHue("Tesco")).toBe(storeHue("  tesco "));
    expect(storeHue("Lidl")).toBeGreaterThanOrEqual(0);
    expect(storeHue("Lidl")).toBeLessThan(360);
  });
});

describe("parseAmount", () => {
  it("číta čiarku aj bodku", () => {
    expect(parseAmount("1,49")).toBe(1.49);
    expect(parseAmount(" 12.5 ")).toBe(12.5);
    expect(parseAmount("1 234,50")).toBe(1234.5);
  });
  it("prázdne alebo nezmysel je null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
