import { formatNumber, t } from "@/i18n";

/**
 * Rýchle zadávanie bez písania do viacerých políčok (slovensky aj anglicky):
 *   "2 mlieko"        -> 2 × mlieko
 *   "3x jogurt"       -> 3 × jogurt
 *   "jablká 1,5 kg"   -> jablká, 1.5 kg
 *   "voda 6 ks"       -> voda, 6 ks      ("water 6 pcs" tiež)
 * Jednotky sa ukladajú v slovenských skratkách (ks, bal) – v anglickom rozhraní
 * sa len zobrazia ako pcs, pack (pozri unitLabel).
 */
const UNITS = ["ks", "pcs", "pc", "kg", "g", "dkg", "l", "ml", "dl", "bal", "balenie", "balenia", "pack", "packs", "pkg", "x"];
const UNIT_RE = UNITS.join("|");

export type ParsedItem = { name: string; quantity: number | null; unit: string | null };

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
}

export function normalizeUnit(unit: string | undefined): string | null {
  if (!unit) return null;
  const u = unit.toLowerCase();
  if (u === "x") return null; // "3x" je len počet kusov
  if (u === "pcs" || u === "pc") return "ks";
  if (u.startsWith("balen") || u === "pack" || u === "packs" || u === "pkg") return "bal";
  return u;
}

export function parseItemInput(input: string): ParsedItem {
  const text = input.trim().replace(/\s+/g, " ");

  // Na začiatku: "2 mlieko", "3x jogurt", "1,5 kg jablká"
  const lead = text.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})?\\.?\\s+(.+)$`, "i"));
  if (lead) {
    const quantity = toNumber(lead[1]!);
    if (quantity !== null) return { name: lead[3]!.trim(), quantity, unit: normalizeUnit(lead[2]) };
  }

  // Na konci: "jablká 1,5 kg", "voda 6ks", "mlieko 2l"
  const trail = text.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})?\\.?$`, "i"));
  if (trail) {
    const quantity = toNumber(trail[2]!);
    if (quantity !== null) return { name: trail[1]!.trim(), quantity, unit: normalizeUnit(trail[3]) };
  }

  // Na konci s „x“: "pivo x6", "pivo ×6", "pivo x 6"
  const times = text.match(/^(.+?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i);
  if (times) {
    const quantity = toNumber(times[2]!);
    if (quantity !== null) return { name: times[1]!.trim(), quantity, unit: null };
  }

  // Bez medzery: "pivo6", "pivo6ks", "mlieko2l" (číslo na konci, nie „7up“)
  const glued = text.match(new RegExp(`^(.*[^\\d\\s.,x×])(\\d+(?:[.,]\\d+)?)(${UNIT_RE})?\\.?$`, "i"));
  if (glued) {
    const quantity = toNumber(glued[2]!);
    if (quantity !== null) return { name: glued[1]!.trim(), quantity, unit: normalizeUnit(glued[3]) };
  }

  return { name: text, quantity: null, unit: null };
}

/** Jednotka tak, ako sa ukáže človeku: "ks" -> "pcs" v angličtine, ostatné (kg, l...) sú medzinárodné. */
export function unitLabel(unit: string): string {
  if (unit === "ks") return t("unit.ks");
  if (unit === "bal") return t("unit.bal");
  return unit;
}

export function formatQuantity(quantity: number | null, unit: string | null): string | null {
  if (quantity === null || quantity === undefined) return unit === null ? null : unitLabel(unit);
  const q = formatNumber(Number(quantity), { maximumFractionDigits: 3 });
  return unit ? `${q} ${unitLabel(unit)}` : `${q}×`;
}
