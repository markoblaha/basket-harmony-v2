/**
 * Fotky receptu, ktoré sa listujú do strán: prstom (natívne posúvanie so zarážkami – plynulé aj na slabom
 * telefóne), ťuknutím na ľavý/pravý okraj, šípkami na počítači a klávesmi ← →. Počítadlo „1/3“.
 * V Ochutnávači (feed) sa fotky aktívneho receptu samy posúvajú s pásikmi ako príbeh, kým sa ich nedotkneš,
 * a aktuálna fotka sa jemne približuje. Obrázky sú <img> (async dekódovanie, lenivé načítanie), pod prvou je
 * malý náhľad, takže sa nikdy neukáže čierna plocha.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [hold, setHold] = useState(false); // dotkol sa → fotky sa už samy neposúvajú
  const sc = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const names = [t("kb.ph.1"), t("kb.ph.2"), t("kb.ph.3")];

  const go = useCallback(
    (k: number) => {
      const el = sc.current;
      if (!el || !n) return;
      const c = Math.max(0, Math.min(n - 1, k));
      el.scrollTo({ left: c * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
    },
    [n],
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

  // Ochutnávač: fotky aktívneho receptu sa samy posúvajú (raz dokola, potom ostane posledná).
  const auto = feed && active && !hold && n > 1 && i < n - 1 && !reduced();
  useEffect(() => {
    if (!auto) return;
    const tm = setTimeout(() => go(i + 1), AUTO_MS);
    return () => clearTimeout(tm);
  }, [auto, i, go]);

  // Šípky na klávesnici pre aktívny recept (feed) – v detaile receptu je fotka vždy aktívna.
  useEffect(() => {
    if (!active || n < 2) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else return;
      setHold(true);
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, n, i, go]);

  // Detail receptu: ťuk na ľavú tretinu = späť, na pravú = ďalej.
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (feed || n < 2) return;
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
    <div className={`gal phs${feed ? " feed" : ""}`} onPointerDown={() => setHold(true)}>
      <div className="phs-s" ref={sc} onScroll={onScroll} onClick={tap} aria-roledescription="carousel">
        {urls.map((u, k) => (
          <div
            key={u}
            className={`phs-i${k === i && active ? " on" : ""}`}
            style={k === 0 && small ? { backgroundImage: `url(${small})` } : undefined}
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
              />
            )}
          </div>
        ))}
      </div>
      {feed && n > 1 && (
        <div className="phs-seg" aria-hidden="true">
          {urls.map((u, k) => (
            <i key={u} className={k < i ? "d" : k === i ? `c${auto ? " run" : ""}` : ""} style={{ ["--auto" as string]: `${AUTO_MS}ms` }} />
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
          <button type="button" className="phs-nav next" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label={t("tst.nextPhoto")}>
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
          {names[i]} · {t("kb.aiPhoto")}
        </span>
      )}
    </div>
  );
}
