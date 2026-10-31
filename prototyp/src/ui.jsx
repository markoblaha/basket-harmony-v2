import { ICONS } from '../gen/icons.js';
import { STORES, MEMBERS, PRODUCTS } from './data.js';
import { fmtQty, bump, minQty } from './logic.js';

export const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, useLayoutEffect, Fragment } = React;

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Ikony (Phosphor). w = fill | bold | regular
export function I({ n, w = 'fill', s, cls = '' }) {
  const key = w === 'fill' ? n : n + ':' + w;
  const svg = ICONS[key] || ICONS[n] || '';
  return <span className={'ico ' + cls} style={s ? { width: s, height: s } : null} aria-hidden="true"><svg viewBox="0 0 256 256" dangerouslySetInnerHTML={{ __html: svg }} /></span>;
}
// 3D emoji (Fluent)
export function E({ k, s, cls = '' }) {
  return <span className={'em em-' + k + ' ' + cls} style={s ? { width: s, height: s } : null} aria-hidden="true" />;
}
export const pe = (pid) => (PRODUCTS[pid] ? PRODUCTS[pid].e : 'basket');

export function StoreTile({ k, n, s = 46, r }) {
  const st = STORES[k] || { n: k, s: (k || n || '?').trim().slice(0, 1).toUpperCase() || '?', c1: '#9a9488', c2: '#6b665c' };
  return <span className="stile" style={{ width: s, height: s, borderRadius: r || Math.round(s * .32), fontSize: st.s.length > 1 ? s * .34 : s * .4, background: `linear-gradient(160deg, ${st.c1}, ${st.c2})` }}>{st.s}</span>;
}
export function Avatars({ ids = ['m', 'l'], sm }) {
  return <span className={'avs' + (sm ? ' sm' : '')}>{ids.map((id) => <i key={id} style={{ background: MEMBERS[id].col }}>{MEMBERS[id].ini}</i>)}</span>;
}
export function Av({ id, s = 28 }) {
  const m = MEMBERS[id];
  return <span className="av1" style={{ width: s, height: s, fontSize: s * .42, background: m.col }}>{m.ini}</span>;
}

// Tlačidlo, ktoré pri ťuknutí jemne „zatlačí“
export function Btn({ cls = '', onClick, children, disabled, label, type = 'button' }) {
  return <button type={type} className={'btn ' + cls} onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>;
}
export function IB({ n, w = 'bold', onClick, label, cls = '' }) {
  return <button type="button" className={'ib ' + cls} onClick={onClick} aria-label={label}><I n={n} w={w} /></button>;
}

export function Stepper({ q, u, onChange, label }) {
  return (
    <span className="step" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Menej" onClick={() => onChange(bump(q, u, -1))} disabled={q <= minQty(u)}><I n="minus" w="bold" /></button>
      <b>{label || fmtQty(q, u)}</b>
      <button type="button" aria-label="Viac" onClick={() => onChange(bump(q, u, 1))}><I n="plus" w="bold" /></button>
    </span>
  );
}
export function Seg({ items, value, onChange }) {
  return <div className="seg" role="tablist">{items.map(([k, l]) => <button type="button" role="tab" aria-selected={value === k} key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
export function Check({ on, onClick, label }) {
  return <button type="button" className={'cbx' + (on ? ' on' : '')} onClick={onClick} aria-label={label} aria-pressed={on}><I n="check" w="bold" /></button>;
}

// Spodný panel (sheet) s potiahnutím nadol na zatvorenie
export function Sheet({ open, onClose, children, cls = '', label }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef(null);
  const { ovl } = useApp();
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); setDy(0); }
    else if (mounted) { setClosing(true); const t = setTimeout(() => { setMounted(false); setClosing(false); }, 280); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => { if (!open) return; const f = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [open, onClose]);
  if (!mounted || !ovl) return null;
  const down = (e) => { drag.current = { y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)); };
  const up = () => { if (!drag.current) return; drag.current = null; if (dy > 90) onClose(); else setDy(0); };
  return ReactDOM.createPortal(
    <div className={'sheetw' + (closing ? ' out' : '')}>
      <div className="scrim" onClick={onClose} />
      <div className={'sheet ' + cls} role="dialog" aria-modal="true" aria-label={label} style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : null}>
        <div className="grabz" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><div className="grab" /></div>
        {children}
      </div>
    </div>, ovl);
}

// Riadok zoznamu s potiahnutím: doprava +1, doľava −1, pri minime dlhý ťah = zmazať
export function SwipeRow({ children, onPlus, onMinus, onDelete, atMin, cls = '', onTap, disabled }) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const st = useRef(null);
  const down = (e) => { if (disabled) return; st.current = { x: e.clientX, y: e.clientY, lock: null, id: e.pointerId, moved: false }; };
  const move = (e) => {
    const s = st.current; if (!s) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (s.lock == null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) { s.lock = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y'; if (s.lock === 'x') e.currentTarget.setPointerCapture(e.pointerId); }
    if (s.lock === 'x') { s.moved = true; setDx(Math.max(-170, Math.min(110, ddx))); }
  };
  const up = () => {
    const s = st.current; st.current = null; if (!s) return;
    if (s.lock !== 'x') { setDx(0); return; }
    if (dx > 60) onPlus && onPlus();
    else if (dx < -130 && atMin && onDelete) { setGone(true); setTimeout(() => onDelete(), 220); return; }
    else if (dx < -60) { if (atMin) { /* posledný kus – treba dlhší ťah */ } else onMinus && onMinus(); }
    setDx(0);
  };
  const hint = dx > 30 ? 'plus' : dx < -30 ? (atMin ? (dx < -130 ? 'del go' : 'del') : 'minus') : '';
  return (
    <div className={'swr ' + cls + (gone ? ' gone' : '') + (dx ? ' mv' : '')} style={{ '--dx': dx + 'px' }}>
      <div className={'swbg ' + hint} aria-hidden="true"><span className="l"><I n="plus" w="bold" />1</span><span className="r">{atMin ? <><I n="trash" />{dx < -130 ? 'Pustiť = zmazať' : 'Ťahať ďalej'}</> : <><I n="minus" w="bold" />1</>}</span></div>
      <div className="swfg" style={{ transform: dx ? `translateX(${dx}px)` : null, transition: dx && st.current ? 'none' : null }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={(e) => { if (Math.abs(dx) < 4 && onTap) onTap(e); }}>{children}</div>
    </div>
  );
}

export function useInterval(fn, ms) {
  const r = useRef(fn); r.current = fn;
  useEffect(() => { if (!ms) return; const t = setInterval(() => r.current(), ms); return () => clearInterval(t); }, [ms]);
}
export function Empty({ e, t, d, children }) {
  return <div className="empty"><E k={e} s={64} /><b>{t}</b>{d && <p>{d}</p>}{children}</div>;
}
// Prepínač áno/nie
export function Toggle({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'tgl' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button>;
}

export const ScreenCtx = createContext({ back: 'Späť' });
// Tlačidlo späť s názvom predchádzajúcej obrazovky (štandard iOS)
export function Back({ w }) {
  const { pop } = useApp(); const { back } = useContext(ScreenCtx);
  return <button type="button" className={'back' + (w ? ' wg' : '')} onClick={pop} aria-label={'Späť: ' + back}><I n="caret-left" w="bold" /><span>{back}</span></button>;
}
// Profil a nastavenia – rovnaké miesto na každej hlavnej záložke
export function MeBtn() {
  const { push } = useApp();
  return <button type="button" className="mebtn" onClick={() => push('more')} aria-label="Profil, domácnosť a nastavenia">M</button>;
}
