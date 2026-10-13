/**
 * Množstvo v nákupnom zozname. Zoznam počíta v kusoch: položka bez jednotky
 * je „1 ks“, tlačidlami +/− sa mení počet kusov. Váhové a objemové jednotky
 * (kg, l…) z rýchleho zadávania („jablká 1,5 kg“) sa len zobrazia – na ne
 * sa tlačidlá nehodia, menia sa v úprave položky.
 */
import { formatQuantity } from "@/lib/parseItem";
import { normalizeName } from "@/lib/categories";

export function isCountable(unit: string | null | undefined): boolean {
  return !unit || unit === "ks" || unit === "bal";
}

export function countOf(quantity: number | null | undefined): number {
  return quantity && quantity > 0 ? Number(quantity) : 1;
}

/** „3 ks“, „1 bal“, „1,5 kg“ */
export function qtyLabel(quantity: number | null | undefined, unit: string | null | undefined): string {
  if (isCountable(unit)) {
    const n = countOf(quantity).toLocaleString("sk-SK", { maximumFractionDigits: 2 });
    return `${n} ${unit === "bal" ? "bal" : "ks"}`;
  }
  return formatQuantity(quantity ?? null, unit ?? null) ?? "";
}

/** 1 položka · 2 položky · 5 položiek */
export function itemsWord(n: number): string {
  if (n === 1) return "položka";
  if (n >= 2 && n <= 4) return "položky";
  return "položiek";
}

export function sameProduct(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
