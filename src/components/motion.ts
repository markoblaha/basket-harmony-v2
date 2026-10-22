/**
 * Plynulé animácie zoznamov (FLIP): keď položka pribudne, zmizne alebo sa presunie,
 * ostatné sa k novému miestu dokĺžu. Hýbe sa len `transform` a `opacity` cez Web Animations API,
 * takže animáciu kreslí grafický čip a telefón medzitým nemusí nič prepočítavať (žiadne
 * animovanie výšky ani okrajov, žiadne prekresľovanie Reactu počas pohybu).
 *
 * Použitie: kontajner dostane ref, každá položka atribút `data-flip="<id>"`.
 */
import { useLayoutEffect, useRef, type RefObject } from "react";

export const EASE = "cubic-bezier(.2,.8,.2,1)";
/** Poloha v rozložení (bez vplyvu prebiehajúcich animácií – tie posúvajú len transform). */
function layoutTop(el: HTMLElement) {
  let y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
  return y;
}

export const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param ref kontajner
 * @param enter animovať aj nové položky (pri prvom vykreslení nie)
 * Polohy sa merajú len vtedy, keď sa zmení zostava položiek – bežné prekreslenie (iné číslo
 * v riadku) nestojí nič navyše.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, { enter = true }: { enter?: boolean } = {}) {
  const prev = useRef<{ sig: string; pos: Map<string, number> } | null>(null);
  const later = useRef(0);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const nodes = [...box.querySelectorAll<HTMLElement>("[data-flip]")];
    const sig = nodes.map((n) => n.dataset.flip).join(",");
    // Poloha voči najbližšiemu animovanému rodičovi (napr. riadok voči svojej kategórii):
    // keď sa posunie celá kategória, riadky v nej sa už neposúvajú druhýkrát.
    const measure = () => {
      const top = layoutTop(box);
      return new Map(
        nodes.map((n) => {
          const parent = n.parentElement?.closest<HTMLElement>("[data-flip]");
          const base = parent && box.contains(parent) ? layoutTop(parent) : top;
          return [n.dataset.flip!, layoutTop(n) - base] as const;
        }),
      );
    };
    cancelAnimationFrame(later.current);
    const before = prev.current;
    if (before && before.sig === sig) {
      // Nič nepribudlo ani neubudlo: polohy si len obnovíme v ďalšom snímku, keď je rozloženie
      // už spočítané (čítanie je vtedy zadarmo) – napr. po otvorení úpravy v riadku.
      later.current = requestAnimationFrame(() => {
        if (prev.current?.sig === sig) prev.current = { sig, pos: measure() };
      });
      return;
    }
    const pos = measure();
    prev.current = { sig, pos };
    if (!before || reduceMotion()) return;
    for (const n of nodes) {
      const id = n.dataset.flip!;
      const y = pos.get(id)!;
      const was = before.pos.get(id);
      if (was === undefined) {
        if (enter) n.animate([{ opacity: 0, transform: "translateY(-10px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EASE });
      } else if (Math.abs(was - y) > 0.5) {
        n.animate([{ transform: `translateY(${was - y}px)` }, { transform: "none" }], { duration: 320, easing: EASE });
      }
    }
  });
  useLayoutEffect(() => () => cancelAnimationFrame(later.current), []);
}

/**
 * Odchod položky, potom `done` – až vtedy ju odstráň z dát (ostatné sa k sebe dokĺžu cez useFlip).
 * dir −1/1 = odletí doľava/doprava, 0 = jemne klesne a zmizne (napr. „kúpené“ ide do košíka).
 */
export function animateOut(el: HTMLElement | null, dir: -1 | 1 | 0, done: () => void) {
  if (!el || reduceMotion()) return done();
  const from = el.style.transform || "none";
  el.style.transition = "none";
  const a = el.animate(
    [{ transform: from, opacity: 1 }, { transform: dir ? `translate3d(${dir * 105}%,0,0)` : "translate3d(0,14px,0) scale(0.97)", opacity: 0 }],
    { duration: dir ? 220 : 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
  );
  a.onfinish = done;
  a.oncancel = done;
}
