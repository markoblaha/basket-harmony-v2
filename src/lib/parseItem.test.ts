import { describe, expect, it } from "vitest";
import { formatQuantity, parseItemInput } from "./parseItem";

describe("parseItemInput", () => {
  it.each([
    ["mlieko", { name: "mlieko", quantity: null, unit: null }],
    ["2 mlieko", { name: "mlieko", quantity: 2, unit: null }],
    ["3x jogurt", { name: "jogurt", quantity: 3, unit: null }],
    ["1,5 kg jablká", { name: "jablká", quantity: 1.5, unit: "kg" }],
    ["jablká 1,5 kg", { name: "jablká", quantity: 1.5, unit: "kg" }],
    ["voda 6ks", { name: "voda", quantity: 6, unit: "ks" }],
    ["mlieko 2l", { name: "mlieko", quantity: 2, unit: "l" }],
    ["  syr   eidam  ", { name: "syr eidam", quantity: null, unit: null }],
    ["Coca cola 0", { name: "Coca cola 0", quantity: null, unit: null }],
    ["7up", { name: "7up", quantity: null, unit: null }],
  ])("%s", (input, expected) => {
    expect(parseItemInput(input)).toEqual(expected);
  });
});

describe("formatQuantity", () => {
  it("formátuje po slovensky", () => {
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(2, null)).toBe("2×");
    expect(formatQuantity(null, null)).toBeNull();
  });
});
