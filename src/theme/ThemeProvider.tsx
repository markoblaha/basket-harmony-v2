/**
 * Farebný režim: svetlý, tmavý alebo podľa systému. Voľba sa pamätá v zariadení
 * (každý telefón si môže zvoliť inak) a premieta sa do atribútu data-theme na
 * <html>, podľa ktorého styles.css prepína sadu farieb.
 *
 * Rovnaká logika beží aj v krátkom skripte v index.html – ten nastaví tému ešte
 * pred prvým vykreslením, aby pri tmavom režime nebliklo svetlé pozadie.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "bh.theme";
/** Farba lišty prehliadača (zhodná s --bg v styles.css). */
export const THEME_BG: Record<ResolvedTheme, string> = { light: "#f1ede5", dark: "#121110" };

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

type ThemeState = {
  preference: ThemePreference;
  /** Čo sa skutočne zobrazuje (pri "system" podľa zariadenia). */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  const firstRender = useRef(true);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Zmena voľby v inej karte alebo okne tej istej appky.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPreferenceState(readPreference());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    // Pri ručnej zmene farby jemne prelínajú; pri štarte appky sa nič neanimuje.
    if (!firstRender.current && root.dataset.theme !== resolved) {
      root.classList.add("theme-fade");
      window.setTimeout(() => root.classList.remove("theme-fade"), 350);
    }
    firstRender.current = false;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BG[resolved]);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* súkromný režim prehliadača – voľba platí do zatvorenia */
    }
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme mimo ThemeProvider");
  return ctx;
}
