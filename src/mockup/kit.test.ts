import { describe, expect, it } from "vitest";
import { emojiFor } from "./kit";

describe("emojiFor – ikona podľa názvu", () => {
  it("ovocie má vlastnú ikonu aj pri zlej kategórii", () => {
    expect(emojiFor("Mango", "baby")).toBe("mango");
    expect(emojiFor("Kiwi")).toBe("kiwi");
    expect(emojiFor("Hrozno biele")).toBe("grapes");
    expect(emojiFor("Mandarinky")).toBe("tangerine");
  });
  it("známe veci ostávajú", () => {
    expect(emojiFor("Banány")).toBe("banana");
    expect(emojiFor("Pomarančový džús")).toBe("juice");
  });
  it("neznámy názov dostane ikonu kategórie", () => {
    expect(emojiFor("Xyz", "baby")).toBe("babybottle");
  });
});
