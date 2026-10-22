import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/components/kit";

/** Po poslednom ťuknutí počkáme chvíľu – ďalšie ťuknutia pripočítavajú kusy. */
export const COMMIT_MS = 2000;

/**
 * Počítanie ťuknutí na dlaždicu, bublinu či návrh: každé ťuknutie +1,
 * keď sa 2 s neťuká, zavolá `commit(kľúč, počet)`.
 */
export function useTapCounter(commit: (key: string, n: number) => void) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const timers = useRef(new Map<string, number>());
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const tap = useCallback((key: string) => {
    haptic(8);
    setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
    const old = timers.current.get(key);
    if (old) window.clearTimeout(old);
    timers.current.set(
      key,
      window.setTimeout(() => {
        timers.current.delete(key);
        const n = countsRef.current[key] ?? 0;
        setCounts((c) => {
          const { [key]: _gone, ...rest } = c;
          return rest;
        });
        if (n) commitRef.current(key, n);
      }, COMMIT_MS),
    );
  }, []);

  return { counts, tap };
}

/** Krátky odchod prvku (zmenší sa a zmizne), potom `done`. Animuje len transform a priehľadnosť. */
export function popOut(el: Element | null, done: () => void) {
  if (!el || typeof (el as HTMLElement).animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
  const a = (el as HTMLElement).animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.55)" }], {
    duration: 190,
    easing: "cubic-bezier(.4,0,1,1)",
    fill: "forwards",
  });
  a.onfinish = done;
  a.oncancel = done;
}
