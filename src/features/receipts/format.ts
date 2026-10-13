import type { Receipt } from "./api";

const money = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" });
export const formatMoney = (n: number | null | undefined) => (n == null ? "—" : money.format(n));

/** "2026-09-13" -> "13. 9. 2026" (bez posunu časového pásma). */
export function formatDate(iso: string | null): string {
  if (!iso) return "Bez dátumu";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

export function monthLabel(iso: string | null): string {
  if (!iso) return "Bez dátumu";
  const [y, m] = iso.split("-").map(Number);
  const names = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  return `${names[m! - 1]} ${y}`;
}

/** Prečo bloček čaká na kontrolu – vysvetlenie pre človeka. */
export function reviewText(r: Receipt): string {
  switch (r.review_reason) {
    case "TOTAL_MISMATCH":
      return `Súčet položiek (${formatMoney(r.items_sum)}) nesedí s celkovou sumou (${formatMoney(r.total)}). Porovnaj s fotkou.`;
    case "NO_ITEMS":
      return "Nepodarilo sa prečítať žiadne položky.";
    case "DATE_SUSPECT":
      return "Dátum chýba, vyzerá nepravdepodobne alebo je starší ako 18 mesiacov. Skontroluj ho podľa dokladu.";
    case "POSSIBLE_DUPLICATE":
      return "Vyzerá to na duplicitu: rovnaký obchod, dátum a suma už v zozname je.";
    default:
      return "Skontroluj bloček podľa fotky.";
  }
}

/** Chyba čítania zo servera -> veta pre človeka (technický detail zostáva v databáze). */
export function failureText(error: string | null): string {
  if (!error) return "Čítanie sa nepodarilo.";
  if (error.startsWith("NOT_A_RECEIPT")) return "Nepodarilo sa nájsť nákupný doklad s cenami položiek (bloček, faktúru ani potvrdenie objednávky). Ak ho tam vidíš, skús „Prečítať znova“, inak ho zmaž.";
  if (error.startsWith("GEMINI_402"))
    return "Na účte služby Gemini došiel predplatený kredit. Dobi kredit v Google AI Studio (Billing) alebo vymeň kľúč, potom spusti čítanie znova.";
  if (error.startsWith("GEMINI_429")) return "Služba na čítanie je práve preťažená alebo je vyčerpaný limit. Skús o chvíľu.";
  if (error.startsWith("GEMINI_API_KEY_MISSING")) return "Chýba kľúč služby na čítanie bločkov (GEMINI_API_KEY).";
  if (error.startsWith("GEMINI_400") || error.startsWith("GEMINI_403") || error.startsWith("GEMINI_404"))
    return "Služba na čítanie bločkov odmietla požiadavku (nastavenie kľúča alebo modelu).";
  if (error.startsWith("IMAGE_MISSING")) return "Súbor sa nenašiel v úložisku.";
  if (/^GEMINI_(TIMEOUT|NETWORK|EMPTY|BAD_JSON|5\d\d)/.test(error))
    return "Služba na čítanie sa tentoraz neozvala alebo vrátila nepoužiteľnú odpoveď. Skús čítanie spustiť znova.";
  return "Čítanie sa nepodarilo. Skús ho spustiť znova.";
}
