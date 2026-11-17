/**
 * Plynulé prechody medzi obrazovkami (View Transitions) a poloha posúvania.
 *
 * Prečo takto: predtým sa animovala len nová obrazovka posunom (transform). Stará zmizla hneď,
 * pevné prvky (pole dole, okná na celú plochu) sa počas posunu viezli s obsahom a na konci skočili
 * na miesto a ťažká obrazovka sa kreslila počas animácie (zásek). Teraz prehliadač nasníma starú
 * obrazovku, appka v pokoji nakreslí novú (aj načíta jej časť kódu), a až potom sa obe snímky
 * plynule vymenia – animácia beží mimo hlavného vlákna, takže ju nič nezasekne.
 *
 * Druh prechodu: dopredu v tej istej časti = nová prichádza sprava, späť = odchádza doprava,
 * okná na celú plochu (bloček, varenie, Ochutnávač) vychádzajú zdola, medzi časťami lišty
 * jemné prelínanie. Zmena len parametrov adresy (filter, záložka) sa neanimuje.
 */
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { UNSAFE_createBrowserHistory, unstable_HistoryRouter as HistoryRouter, useLocation, useNavigationType } from "react-router";

type Kind = "push" | "pop" | "tab" | "up" | "down" | "fade" | "none";
type Update = { action: "POP" | "PUSH" | "REPLACE"; location: { pathname: string; key: string }; delta: number | null };

/** Časť appky (záložka lišty) – prechod v rámci nej je „dopredu/späť“, medzi nimi prelínanie. */
function section(p: string) {
  if (p === "/" || p.startsWith("/more")) return "home";
  if (p.startsWith("/lists") || p.startsWith("/history") || p === "/scan") return "lists";
  if (p.startsWith("/recipes")) return "recipes";
  if (p.startsWith("/analytics") || p.startsWith("/receipts")) return "money";
  return p;
}
/** Obrazovky, ktoré v mockupe vychádzajú zdola ako okno na celú plochu. */
const MODAL = [/^\/scan\/?$/, /^\/recipes\/r\/[^/]+\/cook\/?$/, /^\/recipes\/taste\/?$/];
const isModal = (p: string) => MODAL.some((re) => re.test(p));

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const hasViewTransitions = () => typeof document !== "undefined" && "startViewTransition" in document && !reduced();

/* ------------------------------------------------------------------ stav medzi históriou a Reactom */
let pending: (() => void) | null = null;
let nextKind: Kind | null = null;
const afterCommit: (() => void)[] = [];
let currentKey = "default";
let lastPath = location.pathname;
const SCROLL_KEY = "bh.scroll";
const scrolls: Record<string, number> = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
})();

/** Nasledujúci prechod bude daného druhu (napr. po potiahnutí späť už len prelínanie). */
export function setNextTransition(kind: Kind, then?: () => void) {
  nextKind = kind;
  if (then) afterCommit.push(then);
}

/** Zmena obrazovky mimo adresy (napr. zatvorenie hlasového režimu) s rovnakým plynulým prechodom. */
export function animateChange(kind: Exclude<Kind, "none">, change: () => void) {
  if (!hasViewTransitions() || document.hidden) {
    change();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = kind;
  const vt = document.startViewTransition(() => flushSync(change));
  vt.ready.catch(() => undefined);
  vt.finished.catch(() => undefined).finally(() => {
    if (root.dataset.nav === kind) delete root.dataset.nav;
  });
}

function kindOf(u: Update, from: string): Kind {
  const to = u.location.pathname;
  if (to === from) return "none"; // len parametre adresy (filtre, záložky na obrazovke)
  if (u.action === "REPLACE") return "fade";
  const back = u.action === "POP";
  if (isModal(to) && !back) return "up";
  if (isModal(from) && back) return "down";
  if (section(to) !== section(from)) return "tab";
  return back ? "pop" : "push";
}

function createHistory() {
  const base = UNSAFE_createBrowserHistory({ window, v5Compat: true });
  return new Proxy(base, {
    get(target, prop, recv) {
      if (prop !== "listen") return Reflect.get(target, prop, recv);
      return (fn: (u: Update) => void) =>
        target.listen((u: Update) => {
          // poloha posúvania odchádzajúcej obrazovky (na návrat späť)
          scrolls[currentKey] = window.scrollY;
          try {
            sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrolls));
          } catch {
            /* súkromné okno */
          }
          const kind = nextKind ?? kindOf(u, lastPath);
          nextKind = null;
          lastPath = u.location.pathname;
          if (kind === "none" || !hasViewTransitions() || document.hidden) {
            fn(u);
            return;
          }
          const root = document.documentElement;
          root.dataset.nav = kind;
          const vt = document.startViewTransition(
            () =>
              new Promise<void>((resolve) => {
                pending = resolve;
                fn(u);
                // poistka: keby sa nová obrazovka nezobrazila včas, animácia nečaká donekonečna
                setTimeout(resolve, 700);
              }),
          );
          // Prerušený prechod (napr. otočenie telefónu) nie je chyba – obrazovka sa len vymení bez animácie.
          vt.ready.catch(() => undefined);
          vt.finished.catch(() => undefined).finally(() => {
            if (root.dataset.nav === kind) delete root.dataset.nav;
          });
        });
    },
  });
}

/** Po vykreslení novej obrazovky: poloha posúvania a pokyn prehliadaču, že môže animovať. */
function CommitSignal() {
  const loc = useLocation();
  const type = useNavigationType();
  const prevPath = useRef(loc.pathname);
  useLayoutEffect(() => {
    const samePage = prevPath.current === loc.pathname;
    prevPath.current = loc.pathname;
    currentKey = loc.key;
    if (type === "POP") {
      const y = scrolls[loc.key] ?? 0;
      window.scrollTo(0, y);
      // obsah sa môže ešte dokresliť (napr. obrázky) – ešte raz po chvíli
      if (y) requestAnimationFrame(() => window.scrollY !== y && window.scrollTo(0, y));
    } else if (!samePage) window.scrollTo(0, 0);
    afterCommit.splice(0).forEach((f) => f());
    pending?.();
    pending = null;
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

let history: ReturnType<typeof createHistory> | null = null;
/** Router appky s plynulými prechodmi (náhrada BrowserRouter). */
export function MotionRouter({ children }: { children: ReactNode }) {
  if (!history) {
    window.history.scrollRestoration = "manual";
    history = createHistory();
  }
  if (hasViewTransitions()) document.documentElement.classList.add("has-vt");
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <HistoryRouter history={history as any}>
      <CommitSignal />
      {children}
    </HistoryRouter>
  );
}
