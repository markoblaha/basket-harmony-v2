import { errorMessage } from "@/lib/errors";
import { formatCalendarDate, formatEuro, t } from "@/i18n";
import type { Receipt } from "./api";

export const formatMoney = (n: number | null | undefined) => (n == null ? "—" : formatEuro(n));

/** "2026-09-13" -> "13. 9. 2026" / "13/09/2026" (bez posunu časového pásma). */
export function formatDate(iso: string | null): string {
  if (!iso) return t("receipts.noDate");
  return formatCalendarDate(iso, { day: "numeric", month: "numeric", year: "numeric" });
}

/** "2026-10-13" -> "13. 10." (rok len keď nie je tohtoročný). */
export function formatShortDate(iso: string | null): string {
  if (!iso) return t("receipts.noDate");
  const year = Number(iso.slice(0, 4));
  return formatCalendarDate(iso, year === new Date().getFullYear() ? { day: "numeric", month: "numeric" } : { day: "numeric", month: "numeric", year: "numeric" });
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

const REASONS = ["TOTAL_MISMATCH", "NO_ITEMS", "STORE_MISSING", "DATE_SUSPECT", "POSSIBLE_DUPLICATE"] as const;
type Reason = (typeof REASONS)[number];
const asReason = (r: string | null | undefined): Reason | null => REASONS.find((x) => x === r) ?? null;

/** Krátky dôvod pre zoznam ("Súčet nesedí"). */
export function shortReason(r: Receipt): string {
  const reason = asReason(r.review_reason);
  return reason ? t(`receipts.short.${reason}`) : t("receipts.short.default");
}

/** Čo má človek spraviť ("Doplniť obchod") – jedna konkrétna akcia na riadok schránky. */
export function nextStep(r: Receipt): string {
  if (r.status === "FAILED") return r.error_text?.startsWith("NOT_A_RECEIPT") ? t("receipts.next.NOT_A_RECEIPT") : t("receipts.next.FAILED");
  const reason = asReason(r.review_reason);
  return reason ? t(`receipts.next.${reason}`) : t("receipts.next.default");
}

/** "október 2026" / "October 2026" – mesiac a rok z dátumu "2026-10-13" alebo "2026-10". */
export function monthLabel(iso: string | null): string {
  if (!iso) return t("receipts.noDate");
  return formatCalendarDate(`${iso.slice(0, 7)}-01`, { month: "long", year: "numeric" });
}

/** Prečo bloček čaká na kontrolu – vysvetlenie pre človeka. */
export function reviewText(r: Receipt): string {
  const reason = asReason(r.review_reason);
  if (reason === "TOTAL_MISMATCH") return t("receipts.review.TOTAL_MISMATCH", { sum: formatMoney(r.items_sum), total: formatMoney(r.total) });
  return reason ? t(`receipts.review.${reason}`) : t("receipts.review.default");
}

/** Chyba čítania zo servera -> veta pre človeka (technický detail zostáva v databáze). */
export function failureText(error: string | null): string {
  if (!error) return t("receipts.fail.default");
  if (error.startsWith("NOT_A_RECEIPT")) return t("receipts.fail.NOT_A_RECEIPT");
  if (error.startsWith("GEMINI_402")) return t("receipts.fail.GEMINI_402");
  if (error.startsWith("GEMINI_429")) return t("receipts.fail.GEMINI_429");
  if (error.startsWith("GEMINI_API_KEY_MISSING")) return t("receipts.fail.GEMINI_API_KEY_MISSING");
  if (error.startsWith("GEMINI_400") || error.startsWith("GEMINI_403") || error.startsWith("GEMINI_404")) return t("receipts.fail.rejected");
  if (error.startsWith("FILES_TOO_LARGE")) return t("receipts.fail.FILES_TOO_LARGE");
  if (error.startsWith("IMAGE_MISSING")) return t("receipts.fail.IMAGE_MISSING");
  if (/^GEMINI_(TIMEOUT|NETWORK|EMPTY|BAD_JSON|5\d\d)/.test(error)) return t("receipts.fail.transient");
  return t("receipts.fail.other");
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
