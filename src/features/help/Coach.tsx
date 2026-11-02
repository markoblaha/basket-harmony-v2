/**
 * Nápovedy na obrazovke (mockup prototyp/src/coach.jsx): zvýrazní prvok a vedľa neho bublina „Nápoveda 1 z 3“.
 * Nič nezmizne samo; ťuk mimo bubliny = Ďalej, ťuk na zvýraznený prvok s rúčkou ho rovno použije.
 * Samy sa ukážu len, keď si ich človek zapne (Viac → Pomoc a ukážka); inak len cez „?“.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t, type Key } from "@/i18n";
import { I } from "@/mockup/ui";
import { HINTS, type Hint } from "./hints";
import { setHelp, useHelp, useHelpScreen, useHelpUi } from "./state";

const PAD = 6;
const GAP = 14;
const EDGE = 12;
type Box = { x: number; y: number; w: number; h: number; W: number; H: number; rad: number };

/** Slovenská typografia: jednopísmenová predložka nezostane na konci riadku. */
export const nbsp = (s: string) => s.replace(/(^|[\s(„])([vVkKsSzZaAoOuUiI])\s+/g, "$1$2 ");

function safeInsets() {
  let p = document.getElementById("sa-probe");
  if (!p) {
    p = document.createElement("div");
    p.id = "sa-probe";
    p.setAttribute("aria-hidden", "true");
    p.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(p);
  }
  const cs = getComputedStyle(p);
  return { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
}
const rootFor = (c: Hint): ParentNode | null => {
  if (c.global) return document;
  if (c.modal) {
    const all = document.querySelectorAll(".bhm.bhm-full");
    return all[all.length - 1] ?? null;
  }
  return document.querySelector("main");
};
const elFor = (c: Hint) => rootFor(c)?.querySelector<HTMLElement>(c.sel) ?? null;
const measure = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, W: window.innerWidth, H: window.innerHeight, rad: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14 };
};
/** Prvok je celý vidno: nie pod hlavičkou, nie pod spodnou lištou ani pod dokom. */
function visible(c: Hint, el: Element) {
  const m = measure(el);
  if (m.w < 4 || m.h < 4) return false;
  let top = 0;
  let bottom = m.H;
  if (!c.global && !c.modal) {
    const nb = !el.closest(".nb") && document.querySelector(".bhm-top .nb");
    if (nb) top = nb.getBoundingClientRect().bottom;
    const tb = !el.closest(".dock") && document.querySelector(".tabbar");
    if (tb) bottom = tb.getBoundingClientRect().top;
    const dock = !el.closest(".dock") && document.querySelector("main .dock");
    if (dock) bottom = Math.min(bottom, dock.getBoundingClientRect().top);
  }
  return m.y >= top - 1 && m.y + m.h <= bottom + 1 && m.x >= -1 && m.x + m.w <= m.W + 1;
}
/** Obrazovka ešte prichádza (bežiaca konečná animácia). */
const animating = () =>
  document.getAnimations?.().some((a) => {
    const tm = a.effect?.getTiming?.();
    return a.playState === "running" && tm?.iterations !== Infinity && Number(tm?.duration ?? 0) > 0;
  }) ?? false;

export function Coach({ blocked }: { blocked: boolean }) {
  const H = useHelp();
  const ui = useHelpUi();
  const screen = useHelpScreen();
  const [q, setQ] = useState<{ list: string[]; i: number; forced: boolean } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [bh, setBh] = useState(0);
  const bub = useRef<HTMLDivElement>(null);
  const handled = useRef(0);
  const rk = ui.replay && ui.replay.screen === screen ? ui.replay.k : 0;

  // poradie nápoved pre obrazovku (pri „?“ aj už videné)
  useEffect(() => {
    setQ(null);
    setBox(null);
    if (blocked || !screen) return;
    const replay = !!rk && rk !== handled.current;
    if (!replay && (H.off || !H.started)) return;
    let tries = 0;
    let tm: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.querySelector(".sheetw") || (animating() && tries++ < 12)) {
        tm = setTimeout(tick, 200);
        return;
      }
      const list = HINTS.filter((c) => c.screen === screen && (replay || !H.seen[c.id]) && elFor(c)).map((c) => c.id);
      if (replay) handled.current = rk;
      if (list.length) setQ({ list, i: 0, forced: replay });
    };
    tm = setTimeout(tick, replay ? 150 : 700);
    return () => clearTimeout(tm);
  }, [screen, blocked, H.off, H.started, rk]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = q ? HINTS.find((x) => x.id === q.list[q.i]) : undefined;
  const mark = (ids: string[]) => setHelp((s) => ({ seen: { ...s.seen, ...Object.fromEntries(ids.map((x) => [x, Date.now()])) } }));
  const next = (markIt = true) => {
    if (!q) return;
    if (markIt) mark([q.list[q.i]!]);
    if (q.i + 1 < q.list.length) setQ({ ...q, i: q.i + 1 });
    else {
      setQ(null);
      setBox(null);
    }
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // zameranie: pri „?“ sa prvok posunie na obrazovku; inak sa čaká, kým ho človek uvidí
  useEffect(() => {
    if (!c || !q) {
      setBox(null);
      return;
    }
    let alive = true;
    let tm: ReturnType<typeof setTimeout>;
    const aim = (n = 0) => {
      if (!alive) return;
      const el = elFor(c);
      if (!el) {
        nextRef.current(false);
        return;
      }
      if (!visible(c, el)) {
        if (q.forced && n === 0) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          tm = setTimeout(() => aim(1), 650);
          return;
        }
        setBox(null);
        tm = setTimeout(() => aim(n + 1), 600);
        return;
      }
      setBox(measure(el));
    };
    aim();
    const id = setInterval(() => {
      const el = elFor(c);
      if (!el) return;
      if (!visible(c, el)) {
        setBox(null);
        return;
      }
      const m = measure(el);
      setBox((b) => (!b || Math.abs(b.x - m.x) + Math.abs(b.y - m.y) + Math.abs(b.w - m.w) + Math.abs(b.h - m.h) > 1 ? m : b));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(tm);
      clearInterval(id);
    };
  }, [c?.id, q?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (bub.current && Math.abs(bub.current.offsetHeight - bh) > 1) setBh(bub.current.offsetHeight);
  });
  useEffect(() => {
    if (!c || !box) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        nextRef.current(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [c, box]);

  if (!c || !box || !q) return null;
  const { W, H: Hh } = box;
  const hole = { left: Math.max(4, box.x - PAD), top: Math.max(4, box.y - PAD), width: Math.min(W - 8, box.w + PAD * 2), height: box.h + PAD * 2 };
  const bw = Math.min(340, W - EDGE * 2);
  const hb = bh || 170;
  const spaceBelow = Hh - (hole.top + hole.height) - GAP - EDGE;
  const spaceAbove = hole.top - GAP - EDGE;
  const below = spaceBelow >= hb || (spaceBelow >= spaceAbove && spaceAbove < hb);
  let top = below ? hole.top + hole.height + GAP : hole.top - GAP - hb;
  const SA = safeInsets();
  top = Math.max(EDGE + 30, SA.t + EDGE, Math.min(Hh - EDGE - hb - SA.b, top));
  const cx = box.x + box.w / 2;
  const left = Math.max(EDGE, Math.min(W - EDGE - bw, cx - bw / 2));
  const arrowX = Math.max(22, Math.min(bw - 22, cx - left));
  const arrowOk = below ? top >= hole.top + hole.height + 4 : top + hb <= hole.top - 4;
  const last = q.i === q.list.length - 1;
  const skip = () => {
    mark(q.list.slice(q.i));
    setQ(null);
    setBox(null);
  };
  const onBg = (e: React.MouseEvent) => {
    const inHole = e.clientX >= hole.left && e.clientX <= hole.left + hole.width && e.clientY >= hole.top && e.clientY <= hole.top + hole.height;
    if (inHole && c.hand) {
      const el = elFor(c);
      mark([c.id]);
      setQ(null);
      setBox(null);
      if (el) setTimeout(() => el.click(), 60);
      return;
    }
    next(true);
  };
  return (
    <div className="bhm bhm-help">
      <div className="coach" onClick={onBg} role="dialog" aria-modal="true" aria-labelledby="co-t" aria-describedby="co-p">
        <div className="co-hole" style={{ ...hole, borderRadius: Math.min(hole.height / 2, box.rad + PAD) }} />
        {c.hand && (
          <span className="co-hand" style={{ left: cx - 12, top: box.y + box.h / 2 - 4 }} aria-hidden="true">
            <I n="hand-pointing" />
          </span>
        )}
        <div ref={bub} className={`co-bub ${below ? "b" : "a"}`} style={{ left, top, width: bw }} onClick={(e) => e.stopPropagation()}>
          {arrowOk && <i className="co-arr" style={{ left: arrowX - 8 }} />}
          <div className="co-top">
            <span className="co-k">
              <I n="lightbulb" />
              {q.list.length > 1 ? t("co.nOf", { i: q.i + 1, n: q.list.length }) : t("co.single")}
            </span>
            {q.list.length > 1 && (
              <span className="co-dots">
                {q.list.map((_, k) => (
                  <i key={k} className={k === q.i ? "on" : k < q.i ? "d" : ""} />
                ))}
              </span>
            )}
          </div>
          <b id="co-t">{nbsp(t(`co.${c.id}.t` as Key))}</b>
          <p id="co-p">{nbsp(t(`co.${c.id}.x` as Key))}</p>
          <div className="co-act">
            {!last ? (
              <button type="button" className="co-skip" onClick={skip}>
                {t("co.skip")}
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="co-ok" onClick={() => next(true)} autoFocus>
              {last ? (
                t("co.got")
              ) : (
                <>
                  {t("co.next")}
                  <I n="arrow-right" w="bold" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
