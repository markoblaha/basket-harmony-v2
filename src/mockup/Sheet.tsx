/**
 * Spodný panel z mockupu (prototyp/src/ui.jsx Sheet): stmavené pozadie, úchyt na potiahnutie nadol,
 * zatvorenie ťukom vedľa alebo klávesou Escape. Vykreslí sa nad celou appkou (portál do <body>).
 * --kb = výška klávesnice iPhonu, aby tlačidlo dole nezakryla.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function useKeyboardHeight(active: boolean) {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const f = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, [active]);
  return kb;
}

export function Sheet({ open, onClose, children, cls = "", label }: { open: boolean; onClose: () => void; children: ReactNode; cls?: string; label: string }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // Ťah úchytom: posúva sa priamo panel (bez prekreslenia obsahu Reactom pri každom pohybe prsta).
  const drag = useRef<{ y: number; dy: number; t: number; v: number } | null>(null);
  const sheetEl = useRef<HTMLDivElement>(null);
  const scrimEl = useRef<HTMLDivElement>(null);
  const kb = useKeyboardHeight(mounted);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      if (sheetEl.current) sheetEl.current.style.transform = "";
      if (scrimEl.current) scrimEl.current.style.opacity = "";
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const tm = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 280);
    return () => clearTimeout(tm);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", f);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, dy: 0, t: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = sheetEl.current;
    if (!d || !el) return;
    const dy = Math.max(0, e.clientY - d.y);
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (dy - d.dy) / dt;
    d.dy = dy;
    d.t = e.timeStamp;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
    if (scrimEl.current) scrimEl.current.style.opacity = String(Math.max(0.2, 1 - dy / Math.max(1, el.offsetHeight)));
  };
  const up = () => {
    const d = drag.current;
    const el = sheetEl.current;
    drag.current = null;
    if (!d || !el) return;
    // ďaleko alebo rýchly švih nadol = zavrieť (animácia pokračuje z miesta, kde je prst)
    if (d.dy > 90 || (d.v > 0.5 && d.dy > 20)) onClose();
    else {
      el.style.transition = "transform var(--dur-3) var(--ease-out)";
      el.style.transform = "";
      if (scrimEl.current) scrimEl.current.style.opacity = "";
    }
  };
  return createPortal(
    <div className="bhm bhm-ovl" style={{ "--kb": `${kb}px` } as CSSProperties}>
      <div className={`sheetw${closing ? " out" : ""}`}>
        <div ref={scrimEl} className="scrim" onClick={onClose} />
        <div ref={sheetEl} className={`sheet ${cls}`} role="dialog" aria-modal="true" aria-label={label}>
          <div className="grabz" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div className="grab" />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
