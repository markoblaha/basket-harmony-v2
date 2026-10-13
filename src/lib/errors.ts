/**
 * Preklad chýb na vety pre človeka (v jazyku, ktorý má zvolený). Databázové funkcie
 * vracajú krátke kódy (napr. SESSION_ALREADY_ACTIVE); texty sú v src/i18n/sk/errors.ts a src/i18n/en/errors.ts
 * pod kľúčom `error.<kód>`. Žiadna chyba sa nesmie "stratiť": neznáma chyba dostane
 * všeobecný text.
 */
import { hasKey, t } from "@/i18n";

function known(code: string): string | null {
  const key = `error.${code}`;
  return hasKey(key) ? t(key) : null;
}

export function errorMessage(error: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return t("error.offline");
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; message?: unknown };
    if (typeof e.code === "string") {
      const byCode = known(e.code);
      if (byCode) return byCode;
    }
    if (typeof e.message === "string") {
      const byMessage = known(e.message);
      if (byMessage) return byMessage;
      if (/failed to fetch|network/i.test(e.message)) return t("error.unreachable");
      if (/jwt|token.*expired/i.test(e.message)) return t("error.NOT_AUTHENTICATED");
      if (/could not find the function/i.test(e.message)) return t("error.missingFunction");
      if (/provider is not enabled|unsupported provider/i.test(e.message)) return t("error.providerDisabled");
    }
  }
  return t("error.generic");
}

export function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string" && /^[A-Z_]+$/.test(m)) return m;
  }
  return undefined;
}
