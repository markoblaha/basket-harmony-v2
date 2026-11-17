/**
 * Ilustrácie jedál: orezanie zakrytých čiar je náročný výpočet, preto ho appka nerobí pri
 * zobrazení – výsledky sú vopred v dishes.cuts.json. Tento test overí, že súbor sedí s kresbami.
 * Po zmene kresby v dishes.jsx: UPDATE_DISHES=1 npx vitest run dishes
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DISHES, cutCache, cutKey, setBakedCuts } from "./dishes.jsx";

test("dishes.cuts.json zodpovedá kresbám", () => {
  setBakedCuts(false);
  for (const C of Object.values(DISHES)) renderToStaticMarkup(<C strokeWidth={2} />);
  const fresh: Record<string, string> = {};
  for (const [key, out] of cutCache) fresh[cutKey(key)] = out;
  setBakedCuts(true);
  const file = fileURLToPath(new URL("./dishes.cuts.json", import.meta.url));
  if (process.env.UPDATE_DISHES) writeFileSync(file, JSON.stringify(fresh) + "\n");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(fresh);
});
