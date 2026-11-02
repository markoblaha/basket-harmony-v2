/**
 * Uvítanie, ukážka a nápovedy (mockup prototyp/src/coach.jsx a tour.jsx) – stav v zariadení (`bh.help`).
 * Pravidlo majiteľa: samy sa ukážu len pri prvom spustení (uvítanie → ukážka, alebo „Začať naprázdno“ → tipy
 * na Domove). Potom nič samo – len cez „?“ alebo Viac → Pomoc a ukážka (prípadne si nápovedy zapne sám).
 */
import { useSyncExternalStore } from "react";

export type HelpState = {
  /** Uvítanie už prebehlo (vybral ukážku alebo „Začať naprázdno“). */
  started: boolean;
  /** Nápovedy sa samy neukazujú (len cez „?“). */
  off: boolean;
  /** Videné nápovedy (id). */
  seen: Record<string, number>;
  /** Prejdené kapitoly ukážky (index). */
  chapters: Record<number, true>;
  /** Karta Prvé kroky na Domove je skrytá. */
  firstHidden: boolean;
  /** Pozvánka do domácnosti už bola odoslaná (Prvé kroky). */
  invited: boolean;
};
/** Prechodný stav (neukladá sa): prehrať nápovedy obrazovky, otvorená ukážka, ponuka „?“. */
export type HelpUi = {
  replay: { screen: string; k: number } | null;
  demo: { run: string; fromHelp: boolean } | null;
  menu: string | null;
};

const KEY = "bh.help";
const DEF: HelpState = { started: false, off: true, seen: {}, chapters: {}, firstHidden: false, invited: false };
let state: HelpState = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HelpState> | null;
    return v ? { ...DEF, ...v } : DEF;
  } catch {
    return DEF;
  }
})();
let ui: HelpUi = { replay: null, demo: null, menu: null };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function setHelp(fn: (s: HelpState) => Partial<HelpState>) {
  state = { ...state, ...fn(state) };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* súkromné okno – platí do zatvorenia */
  }
  emit();
}
export function setUi(o: Partial<HelpUi>) {
  ui = { ...ui, ...o };
  emit();
}
export const useHelp = () => useSyncExternalStore(subscribe, () => state);
export const useHelpUi = () => useSyncExternalStore(subscribe, () => ui);

/** Prehrá nápovedy obrazovky (aj už videné). */
export const replayHints = (screen: string) => setUi({ replay: { screen, k: Date.now() }, menu: null });
/** Spustí ukážku: „zaklady“ (3 kapitoly), „vsetko“ (8 kapitol) alebo „k0“…„k7“ (jedna kapitola). */
export const startDemo = (run: string, fromHelp = true) => setUi({ demo: { run, fromHelp }, menu: null });

/* ------------------------------------------------------------------ obrazovka s „?“ */
// Každé tlačidlo „?“ zapíše svoju obrazovku; platí naposledy pripojené (okno nad obrazovkou má prednosť).
let screens: string[] = [];
export function pushScreen(s: string) {
  screens = [...screens, s];
  emit();
  return () => {
    const i = screens.lastIndexOf(s);
    if (i >= 0) screens = [...screens.slice(0, i), ...screens.slice(i + 1)];
    emit();
  };
}
export const useHelpScreen = () => useSyncExternalStore(subscribe, () => screens[screens.length - 1] ?? null);
