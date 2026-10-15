import { describe, expect, it } from "vitest";
import { shortName } from "./shortName";

describe("shortName", () => {
  it("meno a prvé písmeno priezviska", () => expect(shortName("Lucia Bieliková")).toBe("Lucia B."));
  it("viac mien berie posledné slovo ako priezvisko", () => expect(shortName("Ján Peter novák")).toBe("Ján N."));
  it("jedno slovo ostane", () => expect(shortName("Marko")).toBe("Marko"));
  it("prázdne", () => expect(shortName(undefined)).toBe(""));
});
