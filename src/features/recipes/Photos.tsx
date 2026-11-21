/**
 * Fotky receptu, ktoré sa listujú do strán: prstom (natívne posúvanie so zarážkami – plynulé aj na slabom
 * telefóne), ťuknutím na ľavý/pravý okraj, šípkami na počítači a klávesmi ← →. Počítadlo „1/3“.
 * V Ochutnávači (feed) sa fotky aktívneho receptu samy posúvajú s pásikmi ako príbeh – dokola, kým neprejdeš
 * na ďalší recept (prst na fotke ich len pozdrží) – a aktuálna fotka sa jemne približuje. Obrázky sú <img> (async dekódovanie, lenivé načítanie), pod prvou je
 * malý náhľad, takže sa nikdy neukáže čierna plocha.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { t } from "@/i18n";
import { E, I } from "@/mockup/ui";
import { bookPhotos } from "./kniha";
import { art } from "./mk";
import type { Recipe } from "./types";

/** Ako dlho je fotka v Ochutnávači, kým sa sama posunie na ďalšiu. */
export const AUTO_MS = 3200;
const reduced = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

type Props = {
  r: Recipe;
  /** Ochutnávač: pásiky, samé posúvanie, priblíženie. */
  feed?: boolean;
  /** Recept je práve na obrazovke (feed) – len vtedy sa fotky samy posúvajú a reagujú na klávesy. */
  active?: boolean;
  /** Recept je blízko (feed) – načítajú sa všetky jeho fotky, inak len prvá. */
  near?: boolean;
};

export function PhotoSwiper({ r, feed = false, active = true, near = true }: Props) {
  const { urls, small } = bookPhotos(r);
  const n = urls.length;
  const [i, setI] = useState(0);
  const [down, setDown] = useState(false); // prst na fotke → samé posúvanie stojí, po pustení pokračuje
  const sc = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const names = [t("kb.ph.1"), t("kb.ph.2"), t("kb.ph.3"), t("kb.ph.4")];

  const go = useCallback(
    (k: number) => {
      const el = sc.current;
      if (!el || !n) return;
      // Ochutnávač: za poslednou fotkou znova prvá (fotky idú dokola) – skokom s krátkym prelínaním,
      // nie prevíjaním naspäť cez všetky fotky.
      if (feed && k >= n) {
        el.scrollTo({ left: 0, behavior: "auto" });
        if (!reduced()) el.animate?.([{ opacity: 0.3 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
        return;
      }
      const c = Math.max(0, Math.min(n - 1, k));
      el.scrollTo({ left: c * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
    },
    [n, feed],
  );

  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = sc.current;
      if (!el) return;
      const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setI((p) => (p === k ? p : k));
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Ochutnávač: fotky aktívneho receptu sa samy posúvajú dokola (po poslednej znova prvá), kým je recept
  // na obrazovke (pokyn majiteľa 21. 11.). Prst na fotke posúvanie pozdrží (ako príbeh) – pásik aj čas stoja
  // a po pustení dobehne len zvyšok času; ťuk alebo ťah na inú fotku začne jej čas odznova.
  const auto = feed && active && n > 1 && !reduced();
  const left = useRef(AUTO_MS);
  useEffect(() => {
    left.current = AUTO_MS;
  }, [i, active]);
  useEffect(() => {
    if (!active) setDown(false);
  }, [active]);
  useEffect(() => {
    if (!auto || down) return;
    const start = performance.now();
    const tm = setTimeout(() => go(i + 1), left.current);
    return () => {
      clearTimeout(tm);
      left.current = Math.max(0, left.current - (performance.now() - start));
    };
  }, [auto, down, i, go]);

  // Šípky na klávesnici pre aktívny recept (feed) – v detaile receptu je fotka vždy aktívna.
  useEffect(() => {
    if (!active || n < 2) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, n, i, go]);

  // Ťuk na ľavú časť fotky = späť, na pravú = ďalej (detail receptu aj Ochutnávač; v Ochutnávači je stred na dvojťuk „Chcem“).
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n < 2) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    if (x < 0.3) go(i - 1);
    else if (x > 0.7) go(i + 1);
  };

  if (!n) {
    // Recept bez sady fotiek: jedna fotka z mockupu alebo 3D ikona.
    const a = art(r);
    return (
      <div className={`gal phs${feed ? " feed" : ""}`}>
        {a.pic ? (
          <div className={`phs-i on pic-${a.big ?? a.pic}`} role="img" aria-label={r.name} />
        ) : (
          <div className={`phs-i bg-${a.bg} tst-em`}>
            <E k={a.e} s={180} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`gal phs${feed ? " feed" : ""}`}
      onPointerDown={feed ? () => setDown(true) : undefined}
      onPointerUp={feed ? () => setDown(false) : undefined}
      onPointerCancel={feed ? () => setDown(false) : undefined}
      onPointerLeave={feed ? () => setDown(false) : undefined}
    >
      <div className="phs-s" ref={sc} onScroll={onScroll} onClick={tap} aria-roledescription="carousel">
        {urls.map((u, k) => (
          <div
            key={u}
            className={`phs-i${k === i && active ? " on" : ""}`}
            style={feed ? ({ "--bg": `url(${k === 0 && small ? small : u})` } as CSSProperties) : k === 0 && small ? { backgroundImage: `url(${small})` } : undefined}
            role="group"
            aria-label={t("tst.photo", { n: k + 1, all: n })}
          >
            {(k === 0 || near) && (
              <img
                src={u}
                alt={`${r.name} – ${names[k] ?? ""}`}
                draggable={false}
                decoding="async"
                loading={k === 0 || (active && k <= i + 1) ? "eager" : "lazy"}
                fetchPriority={k === 0 && active ? "high" : "auto"}
                // Ochutnávač je na výšku: fotka na šírku by sa orezala na úzky pás v strede („extrémne priblížená“) –
                // takú ukážeme celú a pozadie vyplní jej rozmazaná kópia (pokyn majiteľa 21. 11.).
                onLoad={feed ? (e) => e.currentTarget.classList.toggle("wide", e.currentTarget.naturalWidth / e.currentTarget.naturalHeight > 0.8) : undefined}
              />
            )}
          </div>
        ))}
      </div>
      {feed && n > 1 && (
        <div className="phs-seg" aria-hidden="true">
          {urls.map((u, k) => (
            <i key={u} className={k < i ? "d" : k === i ? `c${auto ? " run" : ""}${down ? " p" : ""}` : ""} style={{ ["--auto" as string]: `${AUTO_MS}ms` }} />
          ))}
        </div>
      )}
      <span className="phs-cnt" aria-live="polite">
        {i + 1}/{n}
      </span>
      {n > 1 && (
        <>
          <button type="button" className="phs-nav prev" onClick={() => go(i - 1)} disabled={i === 0} aria-label={t("tst.prevPhoto")}>
            <I n="caret-left" w="bold" />
          </button>
          <button type="button" className="phs-nav next" onClick={() => go(i + 1)} disabled={!feed && i === n - 1} aria-label={t("tst.nextPhoto")}>
            <I n="caret-right" w="bold" />
          </button>
        </>
      )}
      {!feed && n > 1 && (
        <div className="gal-d">
          {urls.map((u, k) => (
            <button type="button" key={u} className={k === i ? "on" : ""} onClick={() => go(k)} aria-label={names[k]} />
          ))}
        </div>
      )}
      {!feed && (
        <span className="gal-l">
          {r.book?.batch ? t("kb.batchPhoto", { n: r.book.batch }) : `${names[i]} · ${t("kb.aiPhoto")}`}
        </span>
      )}
    </div>
  );
}
