/**
 * Vzhľad appky = téma × režim.
 *  - téma (bh.style): „warm“ = Teplá kuchyňa, „glass“ = Fotky a sklo,
 *  - režim (bh.theme): svetlý, tmavý alebo podľa systému.
 * Voľba sa pamätá v zariadení (každý telefón si môže zvoliť inak) a premieta sa do atribútov
 * data-style a data-theme na <html>, podľa ktorých styles.css prepína sadu farieb.
 *
 * Rovnaká logika beží aj v krátkom skripte v index.html – ten nastaví vzhľad ešte
 * pred prvým vykreslením, aby pri tmavom režime nebliklo svetlé pozadie.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ThemeStyle = "warm" | "glass";

const MODE_KEY = "bh.theme";
const STYLE_KEY = "bh.style";

/** Farba systémovej lišty iPhonu (zhodná s --bg v styles.css). */
export const STATUS_BAR: Record<ThemeStyle, Record<ResolvedTheme, string>> = {
  // Teplá kuchyňa: lišta má farbu šalviového nádychu hore obrazovky (--tint v prototyp/css/polish.css).
  warm: { light: "#e5ece1", dark: "#152019" },
  glass: { light: "#f3f2f0", dark: "#050506" },
};

/**
 * Farba systémovej lišty iPhonu (hodiny, batéria) = farba témy. iPhone ju berie z <meta name="theme-color">
 * a k nej sám zvolí tmavý alebo svetlý text. Zmenu atribútu Safari niekedy prehliadne,
 * preto starý meta nahradíme novým – vtedy sa lišta prefarbí hneď, bez reštartu appky.
 */
function setStatusBarColor(color: string) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* súkromný režim prehliadača – voľba platí do zatvorenia */
  }
}

/** Staré voľby (farebná téma) sa zmenia na svetlý režim. */
function readPreference(): ThemePreference {
  const stored = read(MODE_KEY);
  if (stored === "color") return "light";
  return stored === "light" || stored === "dark" ? stored : "system";
}

function readStyle(): ThemeStyle {
  return read(STYLE_KEY) === "glass" ? "glass" : "warm";
}

type ThemeState = {
  preference: ThemePreference;
  /** Čo sa skutočne zobrazuje (pri "system" podľa zariadenia). */
  resolved: ResolvedTheme;
  style: ThemeStyle;
  setPreference: (preference: ThemePreference) => void;
  setStyle: (style: ThemeStyle) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [style, setStyleState] = useState<ThemeStyle>(readStyle);
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
      if (e.key === MODE_KEY) setPreferenceState(readPreference());
      if (e.key === STYLE_KEY) setStyleState(readStyle());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    // Pri ručnej zmene farby jemne prelínajú; pri štarte appky sa nič neanimuje.
    if (!firstRender.current && (root.dataset.theme !== resolved || root.dataset.style !== style)) {
      root.classList.add("theme-fade");
      window.setTimeout(() => root.classList.remove("theme-fade"), 350);
    }
    firstRender.current = false;
    root.dataset.theme = resolved;
    root.dataset.style = style;
    // Triedy témy z mockupu (w = Teplá kuchyňa, g = Fotky a sklo, t-d = tmavý režim) – štýly src/mockup/mockup.css.
    root.classList.toggle("w", style === "warm");
    root.classList.toggle("g", style === "glass");
    root.classList.toggle("t-d", resolved === "dark");
    root.classList.toggle("t-l", resolved === "light");
    root.style.colorScheme = resolved;
    setStatusBarColor(STATUS_BAR[style][resolved]);
  }, [resolved, style]);

  const setPreference = useCallback((next: ThemePreference) => {
    write(MODE_KEY, next);
    setPreferenceState(next);
  }, []);

  const setStyle = useCallback((next: ThemeStyle) => {
    write(STYLE_KEY, next);
    setStyleState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, style, setPreference, setStyle }),
    [preference, resolved, style, setPreference, setStyle],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme mimo ThemeProvider");
  return ctx;
}
