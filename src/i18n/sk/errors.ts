/**
 * Chyby pre človeka. Databázové funkcie vracajú krátke kódy (SESSION_ALREADY_ACTIVE),
 * Supabase Auth má vlastné kódy (invalid_credentials) – kľúč je vždy `error.<kód>`.
 */
export const skErrors = {
  "error.NOT_AUTHENTICATED": "Prihlásenie vypršalo. Prihlás sa znova.",
  "error.NOT_FOUND": "Táto vec už neexistuje alebo k nej nemáš prístup.",
  "error.FORBIDDEN": "Na túto akciu nemáš oprávnenie.",
  "error.VALIDATION": "Skontroluj zadané údaje.",
  "error.INVALID_INPUT": "Správa je prázdna alebo príliš dlhá (najviac 300 znakov).",
  "error.LIST_ARCHIVED": "Zoznam je archivovaný.",
  "error.SESSION_ALREADY_ACTIVE": "Práve nakupuje niekto iný.",
  "error.INVITATION_INVALID": "Pozvánka je neplatná.",
  "error.INVITATION_USED": "Táto pozvánka už bola použitá.",
  "error.INVITATION_EXPIRED": "Platnosť pozvánky vypršala. Požiadaj o novú.",
  "error.TOO_MANY_PAGES": "Doklad môže mať najviac 8 strán.",
  "error.PAGE_ALREADY_EXISTS": "Táto strana už v aplikácii je (možno v inom doklade).",
  "error.FILE_TOO_LARGE": "Súbor je príliš veľký (najviac 10 MB). Zmenši ho alebo ho odfoť.",
  "error.STATEMENT_READ_FAILED": "Výpis sa nepodarilo prečítať. Skús to znova alebo použi PDF či CSV z internet bankingu.",
  "error.NOT_A_STATEMENT": "V súbore sa nenašiel bankový výpis (zoznam pohybov na účte).",
  "error.GEMINI_402": "Na účte služby Gemini došiel kredit. Dobi ho v Google AI Studio.",
  "error.PRODUCT_EXISTS": "Taký produkt už existuje. Použi radšej „Spojiť“.",
  // Supabase Auth
  "error.invalid_credentials": "Nesprávny e-mail alebo heslo.",
  "error.user_already_exists": "Účet s týmto e-mailom už existuje. Skús sa prihlásiť.",
  "error.email_exists": "Účet s týmto e-mailom už existuje. Skús sa prihlásiť.",
  "error.weak_password": "Heslo je príliš slabé. Použi aspoň 8 znakov.",
  "error.over_email_send_rate_limit": "Príliš veľa e-mailov za krátky čas. Skús to o chvíľu.",
  "error.over_request_rate_limit": "Príliš veľa pokusov. Počkaj chvíľu a skús znova.",
  "error.email_address_not_authorized": "Na túto adresu zatiaľ nevieme poslať e-mail.",
  "error.same_password": "Nové heslo musí byť iné ako staré.",
  // Rozpoznané podľa znenia chyby
  "error.offline": "Si offline. Skontroluj pripojenie na internet.",
  "error.unreachable": "Server je nedostupný. Skontroluj pripojenie a skús znova.",
  "error.missingFunction": "Táto funkcia ešte nie je v databáze nasadená. Treba spustiť posledný SQL súbor (migráciu).",
  "error.providerDisabled": "Prihlásenie cez Google ešte nie je zapnuté. Zatiaľ použi e-mail.",
  "error.generic": "Niečo sa pokazilo. Skús to znova.",
} as const;
