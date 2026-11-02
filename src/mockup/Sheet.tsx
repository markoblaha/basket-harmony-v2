/**
 * Spodný panel z mockupu (prototyp/src/ui.jsx Sheet): stmavené pozadie, úchyt na potiahnutie nadol,
 * zatvorenie ťukom vedľa alebo klávesou Escape. Vykreslí sa nad celou appkou (portál do <body>).
 * --kb = výška klávesnice iPhonu, aby tlačidlo dole nezakryla.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

function useKeyboardHeight(active: boolean) {
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
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number } | null>(null);
  const kb = useKeyboardHeight(mounted);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDy(0);
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
    drag.current = { y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => drag.current && setDy(Math.max(0, e.clientY - drag.current.y));
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dy > 90) onClose();
    else setDy(0);
  };
  return createPortal(
    <div className="bhm bhm-ovl" style={{ "--kb": `${kb}px` } as CSSProperties}>
      <div className={`sheetw${closing ? " out" : ""}`}>
        <div className="scrim" onClick={onClose} />
        <div className={`sheet ${cls}`} role="dialog" aria-modal="true" aria-label={label} style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}>
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
