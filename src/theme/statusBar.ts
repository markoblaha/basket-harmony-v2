/**
 * Systémová lišta iPhonu (hodiny, batéria) vo farbe vrchu obrazovky.
 *
 * Od iOS 26 appka z plochy kreslí aj pod lištu a iPhone jej farbu neberie z <meta name="theme-color">,
 * ale z pevného prvku navrchu stránky (pás #sbar z index.html), inak z pozadia body. Všetky tri miesta
 * (pás, pozadie body/html a theme-color pre Android a staršie iPhony) preto dostanú rovnakú farbu (--sbar):
 *  - bežné obrazovky: farba vrchu témy (Teplá: šalviový nádych, Sklo: pozadie, do ktorého prechádza fotka),
 *  - tmavé celoobrazovkové fotky (Ochutnávač, varenie v Skle): čierna, fotka do pásu plynulo prechádza.
 * iPhone farbu znova odčíta, keď sa pás objaví – pri každej zmene ho preto vymeníme za nový prvok.
 * Rovnaké farby nastavuje skript v index.html ešte pred prvým vykreslením.
 */
import { useEffect } from "react";

/** Farba vrchu bežných obrazoviek: Teplá = šalviový nádych (--tint), Sklo = --bg (fotka v pozadí do nej prechádza). */
export const BAR = {
  warm: { light: "#e5ece1", dark: "#152019" },
  glass: { light: "#f3f2f0", dark: "#050506" },
} as const;
/** Pás nad tmavou fotkou cez celú obrazovku. */
export const PHOTO_BAR = "#000000";

let photo = 0;

/** Nastaví farbu pásu podľa témy na <html> (data-style, data-theme) a toho, či je otvorená tmavá fotka. */
export function syncStatusBar() {
  const root = document.documentElement;
  const theme = BAR[root.dataset.style === "glass" ? "glass" : "warm"][root.dataset.theme === "dark" ? "dark" : "light"];
  const color = photo > 0 ? PHOTO_BAR : theme;
  root.style.setProperty("--sbar-t", theme);
  root.style.setProperty("--sbar", color);
  // Zmenu atribútu Safari niekedy prehliadne – nový meta prvok zaberie hneď.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
  const bar = document.createElement("div");
  bar.id = "sbar";
  bar.setAttribute("aria-hidden", "true");
  const old = document.getElementById("sbar");
  if (old) old.replaceWith(bar);
  else document.body.prepend(bar);
}

/** Kým je obrazovka otvorená (a on = true), lišta je čierna – pre tmavé fotky cez celú plochu. */
export function useStatusBarPhoto(on = true) {
  useEffect(() => {
    if (!on) return;
    photo += 1;
    syncStatusBar();
    return () => {
      photo -= 1;
      syncStatusBar();
    };
  }, [on]);
}
