/**
 * Preklad chýb do slovenčiny. Databázové funkcie vracajú krátke kódy
 * (napr. SESSION_ALREADY_ACTIVE) – tu sa menia na vetu pre človeka.
 * Žiadna chyba sa nesmie "stratiť": neznáma chyba dostane všeobecný text.
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Prihlásenie vypršalo. Prihlás sa znova.",
  NOT_FOUND: "Táto vec už neexistuje alebo k nej nemáš prístup.",
  FORBIDDEN: "Na túto akciu nemáš oprávnenie.",
  VALIDATION: "Skontroluj zadané údaje.",
  LIST_ARCHIVED: "Zoznam je archivovaný.",
  SESSION_ALREADY_ACTIVE: "Práve nakupuje niekto iný.",
  INVITATION_INVALID: "Pozvánka je neplatná.",
  TOO_MANY_PAGES: "Doklad môže mať najviac 8 strán.",
  PAGE_ALREADY_EXISTS: "Táto strana už v aplikácii je (možno v inom doklade).",
  FILE_TOO_LARGE: "Súbor je príliš veľký (najviac 10 MB). Zmenši ho alebo ho odfoť.",
  STATEMENT_READ_FAILED: "Výpis sa nepodarilo prečítať. Skús to znova alebo použi PDF či CSV z internet bankingu.",
  NOT_A_STATEMENT: "V súbore sa nenašiel bankový výpis (zoznam pohybov na účte).",
  GEMINI_402: "Na účte služby Gemini došiel kredit. Dobi ho v Google AI Studio.",
  PRODUCT_EXISTS: "Taký produkt už existuje. Použi radšej „Spojiť“.",
  INVITATION_USED: "Táto pozvánka už bola použitá.",
  INVITATION_EXPIRED: "Platnosť pozvánky vypršala. Požiadaj o novú.",
  // Supabase Auth
  invalid_credentials: "Nesprávny e-mail alebo heslo.",
  user_already_exists: "Účet s týmto e-mailom už existuje. Skús sa prihlásiť.",
  email_exists: "Účet s týmto e-mailom už existuje. Skús sa prihlásiť.",
  weak_password: "Heslo je príliš slabé. Použi aspoň 8 znakov.",
  over_email_send_rate_limit: "Príliš veľa e-mailov za krátky čas. Skús to o chvíľu.",
  over_request_rate_limit: "Príliš veľa pokusov. Počkaj chvíľu a skús znova.",
  email_address_not_authorized: "Na túto adresu zatiaľ nevieme poslať e-mail.",
  same_password: "Nové heslo musí byť iné ako staré.",
};

export function errorMessage(error: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "Si offline. Skontroluj pripojenie na internet.";
  }
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; message?: unknown };
    if (typeof e.code === "string" && MESSAGES[e.code]) return MESSAGES[e.code]!;
    if (typeof e.message === "string") {
      if (MESSAGES[e.message]) return MESSAGES[e.message]!;
      if (/failed to fetch|network/i.test(e.message)) {
        return "Server je nedostupný. Skontroluj pripojenie a skús znova.";
      }
      if (/jwt|token.*expired/i.test(e.message)) return MESSAGES.NOT_AUTHENTICATED!;
      if (/could not find the function/i.test(e.message)) {
        return "Táto funkcia ešte nie je v databáze nasadená. Treba spustiť posledný SQL súbor (migráciu).";
      }
      if (/provider is not enabled|unsupported provider/i.test(e.message)) {
        return "Prihlásenie cez Google ešte nie je zapnuté. Zatiaľ použi e-mail.";
      }
    }
  }
  return "Niečo sa pokazilo. Skús to znova.";
}

export function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string" && /^[A-Z_]+$/.test(m)) return m;
  }
  return undefined;
}
