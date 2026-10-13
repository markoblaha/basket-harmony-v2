/**
 * Jazyk aplikácie. Vybraný jazyk sa pamätá v zariadení (localStorage).
 *
 * Pri zmene jazyka sa celá aplikácia vykreslí znova (kľúč `key={locale}`),
 * aby sa žiadny starý text nezasekol v pamäti komponentu. Prihlásenie ani
 * načítané údaje sa pritom nestratia – tie žijú nad týmto prvkom.
 */
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocale, persistLocale, setActiveLocale, t, type Locale } from "./core";

type I18nState = { locale: Locale; setLocale: (locale: Locale) => void };
const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  const setLocale = useCallback((next: Locale) => {
    setActiveLocale(next); // najprv modul, aby novo vykreslené komponenty čítali už nový jazyk
    persistLocale(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("app.description"));
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale mimo I18nProvider");
  return ctx;
}
