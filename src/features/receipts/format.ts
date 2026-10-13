import { errorMessage } from "@/lib/errors";
import type { Receipt } from "./api";

const money = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" });
export const formatMoney = (n: number | null | undefined) => (n == null ? "—" : money.format(n));

/** "2026-09-13" -> "13. 9. 2026" (bez posunu časového pásma). */
export function formatDate(iso: string | null): string {
  if (!iso) return "Bez dátumu";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

/** "2026-10-13" -> "13. 10." (rok len keď nie je tohtoročný). */
export function formatShortDate(iso: string | null): string {
  if (!iso) return "Bez dátumu";
  const [y, m, d] = iso.split("-").map(Number);
  return y === new Date().getFullYear() ? `${d}. ${m}.` : `${d}. ${m}. ${y}`;
}

/** Skloňovanie podľa počtu: plural(3, ["doklad", "doklady", "dokladov"]) -> "doklady" */
export function plural(n: number, forms: [string, string, string]): string {
  return n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2];
}

/** Iniciálky obchodu do farebného kruhu: "Lidl Slovensko" -> "LS", "Tesco" -> "TE". */
export function storeInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Stabilný odtieň (0–359) podľa názvu: ten istý obchod má vždy tú istú farbu. */
export function storeHue(name: string | null | undefined): number {
  const text = (name ?? "").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

/** Krátky dôvod pre zoznam ("Súčet nesedí"). */
export function shortReason(r: Receipt): string {
  switch (r.review_reason) {
    case "TOTAL_MISMATCH":
      return "Súčet nesedí";
    case "NO_ITEMS":
      return "Bez položiek";
    case "STORE_MISSING":
      return "Chýba obchod";
    case "DATE_SUSPECT":
      return "Skontrolovať dátum";
    case "POSSIBLE_DUPLICATE":
      return "Možná duplicita";
    default:
      return "Skontrolovať";
  }
}

/** Čo má človek spraviť ("Doplniť obchod") – jedna konkrétna akcia na riadok schránky. */
export function nextStep(r: Receipt): string {
  if (r.status === "FAILED") return r.error_text?.startsWith("NOT_A_RECEIPT") ? "Nie je doklad" : "Čítanie sa nepodarilo";
  switch (r.review_reason) {
    case "TOTAL_MISMATCH":
      return "Skontrolovať súčet";
    case "NO_ITEMS":
      return "Doplniť položky";
    case "STORE_MISSING":
      return "Doplniť obchod";
    case "DATE_SUSPECT":
      return "Skontrolovať dátum";
    case "POSSIBLE_DUPLICATE":
      return "Možná duplicita";
    default:
      return "Skontrolovať";
  }
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
      return "Nepodarilo sa prečítať položky s cenami (doklad ich možno neobsahuje). Čo sa dalo prečítať, je uložené. Doplň obchod, dátum a sumu cez „Upraviť“ alebo pridaj ďalšiu stranu.";
    case "STORE_MISSING":
      return "Na doklade sa nenašiel obchod. Doplň ho cez „Upraviť“. Ak je na ďalšej strane, pridaj ju alebo doklad spoj s ďalším.";
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
  if (error.startsWith("FILES_TOO_LARGE"))
    return "Strany dokladu sú spolu príliš veľké. Zmenši ich alebo ich rozdeľ na dva doklady.";
  if (error.startsWith("IMAGE_MISSING")) return "Súbor sa nenašiel v úložisku.";
  if (/^GEMINI_(TIMEOUT|NETWORK|EMPTY|BAD_JSON|5\d\d)/.test(error))
    return "Služba na čítanie sa tentoraz neozvala alebo vrátila nepoužiteľnú odpoveď. Skús čítanie spustiť znova.";
  return "Čítanie sa nepodarilo. Skús ho spustiť znova.";
}

/** Chyba akcie s dokladom -> veta pre človeka (chyby čítania majú vlastné texty, ostatné ide cez errorMessage). */
export function readErrorMessage(err: unknown): string {
  if (err instanceof Error && /^(GEMINI_|NOT_A_RECEIPT|IMAGE_MISSING|FILES_TOO_LARGE|SAVE_FAILED)/.test(err.message)) {
    return failureText(err.message);
  }
  return errorMessage(err);
}

/** "1,50" alebo "1.5" -> 1.5; prázdne alebo nezmysel -> null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
