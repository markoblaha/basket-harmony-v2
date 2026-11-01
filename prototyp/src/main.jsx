import { Ctx, ScreenCtx, useState, useEffect, useRef, useMemo, useCallback, I, E, useInterval, Seg, Btn } from './ui.jsx';
import { load, save, clearSaved, initialState, A } from './store.js';
import { aiAvailable } from './ai.js';
import { RCATS, RCOLS } from './data.js';
import { Home, NotifSheet } from './home.jsx';
import { Lists, ListScreen, ItemSheet, NewListSheet, ListMenuSheet } from './lists.jsx';
import { Shop, Follow, FinishSheet } from './shop.jsx';
import { Voice } from './voice.jsx';
import { Cook, PlanSheet, ImportSheet, AddRecipeSheet } from './recipes.jsx';
import { Taste, BookMap } from './book.jsx';
import { Coach } from './coach.jsx';
import { Recipes, RecipeScreen, RecipeCollection } from './cookbook.jsx';
import { Scan, Receipts, ReceiptDetail } from './receipt.jsx';
import { Money, CategoryScreen, KindScreen, VariantScreen, ProductScreen, StoreScreen, BudgetSheet } from './money.jsx';
import { More, ThemePicker } from './more.jsx';

/* icons: house basket plus cooking-pot chart-pie sun fork-knife wallet microphone */
const SCREENS = { home: Home, lists: Lists, list: ListScreen, recipes: Recipes, recipe: RecipeScreen, rcol: RecipeCollection, money: Money, category: CategoryScreen, kind: KindScreen, variant: VariantScreen, product: ProductScreen, store: StoreScreen, receipts: Receipts, receipt: ReceiptDetail, more: More, bookmap: BookMap };
const MODALS = { shop: Shop, follow: Follow, cook: Cook, scan: Scan, voice: Voice, taste: Taste };
const SHEETS = { item: ItemSheet, newList: NewListSheet, listMenu: ListMenuSheet, finish: FinishSheet, plan: PlanSheet, import: ImportSheet, addRecipe: AddRecipeSheet, budget: BudgetSheet, notif: NotifSheet };
const TABS = ['home', 'lists', 'recipes', 'money'];
const LABEL = { home: 'Domov', lists: 'Nákupy', recipes: 'Recepty', money: 'Výdavky', list: 'Zoznam', recipe: 'Recept', category: 'Kategória', product: 'Produkt', store: 'Obchod', receipts: 'Bločky', receipt: 'Bloček', more: 'Nastavenia', bookmap: 'Mapa knihy' };
const backLabel = (e) => { if (!e) return 'Späť'; if (e.s === 'kind') return e.p.kind; if (e.s === 'variant') return 'Výrobok'; if (e.s === 'rcol') { const c = e.p && (RCATS.find((x) => x.id === e.p.cat) || RCOLS.find((x) => x.id === e.p.col)); return c ? c.n.split(',')[0] : 'Recepty'; } return LABEL[e.s] || 'Späť'; };
const ROOT = { home: 'home', lists: 'lists', recipes: 'recipes', money: 'money' };

// Návrat potiahnutím z ľavého okraja: obrazovka ide za prstom a pod ňou je vidieť predchádzajúcu
function EdgeBack({ appRef, done }) {
  const g = useRef(null);
  const paint = (x, s, anim) => {
    const { top, prev, w } = s; const k = x / w; const tr = anim ? 'transform .27s cubic-bezier(.2,.85,.25,1)' : 'none';
    top.style.transition = tr; top.style.transform = `translateX(${x}px)`; top.style.boxShadow = '-14px 0 32px rgb(0 0 0 / .18)';
    if (prev) { prev.classList.add('peek'); prev.style.transition = tr; prev.style.transform = `translateX(${(k - 1) * 30}%)`; prev.style.setProperty('--dim', ((1 - k) * .16).toFixed(3)); }
  };
  const clear = (...els) => { for (const el of els) if (el) { el.style.transition = el.style.transform = el.style.boxShadow = ''; el.style.removeProperty('--dim'); el.classList.remove('peek'); } };
  const down = (e) => { if (e.button > 0) return; e.currentTarget.setPointerCapture(e.pointerId); g.current = { x: e.clientX, y: e.clientY, lock: null, vx: 0, lx: e.clientX, lt: e.timeStamp }; };
  const move = (e) => {
    const s = g.current; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      const a = appRef.current; s.lock = dx > Math.abs(dy) && a ? 'x' : 'n';
      if (s.lock === 'x') { s.top = a.querySelector('.scr.top'); s.prev = a.querySelector('.scr[data-prev]'); s.w = a.clientWidth; if (!s.top) s.lock = 'n'; }
    }
    if (s.lock !== 'x') return;
    const dt = e.timeStamp - s.lt; if (dt > 0) s.vx = (e.clientX - s.lx) / dt; s.lx = e.clientX; s.lt = e.timeStamp;
    paint(Math.max(0, dx), s, false);
  };
  const up = (e) => {
    const s = g.current; g.current = null; if (!s) return;
    if (s.lock !== 'x') {
      // obyčajné ťuknutie pri okraji patrí prvku pod ním
      if (!s.lock && e.type === 'pointerup') { const el = e.currentTarget; el.style.pointerEvents = 'none'; const t = document.elementFromPoint(e.clientX, e.clientY); el.style.pointerEvents = ''; t && t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY })); }
      return;
    }
    const dx = Math.max(0, e.clientX - s.x);
    const back = e.type === 'pointerup' && (dx > s.w * .35 || (s.vx > .35 && dx > 24));
    paint(back ? s.w : 0, s, true);
    setTimeout(() => { if (back) { done(); clear(s.prev); } else clear(s.top, s.prev); }, 280);
  };
  return <div className="edgeb" aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}

function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f); }, [q]);
  return m;
}
function useHostDark() {
  const get = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
  const [d, setD] = useState(get);
  useEffect(() => {
    const mm = window.matchMedia('(prefers-color-scheme: dark)'); const f = () => setD(get());
    mm.addEventListener('change', f);
    const mo = new MutationObserver(f); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mm.removeEventListener('change', f); mo.disconnect(); };
  }, []);
  return d;
}

function StatusBar({ light }) {
  const [t, setT] = useState(() => new Date());
  useInterval(() => setT(new Date()), 20000);
  return (
    <div className={'sbar' + (light ? ' lt' : '')}>
      <span>{t.getHours()}:{String(t.getMinutes()).padStart(2, '0')}</span>
      <span className="r">
        <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="1" /><rect x="5" y="5" width="3.2" height="7" rx="1" /><rect x="10" y="2.5" width="3.2" height="9.5" rx="1" /><rect x="15" y="0" width="3.2" height="12" rx="1" /></svg>
        <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.1-1.1A10.1 10.1 0 0 0 8.5.7 10.1 10.1 0 0 0 1.4 3.6l1.1 1.1a8.6 8.6 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1.1-1.1a7 7 0 0 0-9.6 0l1.1 1.1c1-.9 2.3-1.4 3.7-1.4Zm0 3.2c.6 0 1.2.2 1.6.6L8.5 11 6.9 9.3c.4-.4 1-.6 1.6-.6Z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="20" height="9" rx="2.3" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" opacity=".45" /></svg>
      </span>
    </div>
  );
}

function TabBar({ tab, go, voice, vOn }) {
  const T = [['home', 'Domov', 'house'], ['lists', 'Nákupy', 'basket'], ['recipes', 'Recepty', 'cooking-pot'], ['money', 'Výdavky', 'wallet']];
  const btn = ([k, l, ic]) => <button type="button" key={k} className={tab === k && !vOn ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}><I n={ic} />{l}</button>;
  return (
    <nav className="tabbar" aria-label="Hlavná navigácia">
      {T.slice(0, 2).map(btn)}
      <button type="button" className={'tmic' + (vOn ? ' on' : '')} onClick={() => voice()} aria-label="Hlasový asistent"><span className="tmb"><I n="microphone" w="fill" /></span></button>
      {T.slice(2).map(btn)}
    </nav>
  );
}

function Toasts({ t, close }) {
  if (!t) return null;
  return (
    <div className={'toast' + (t.out ? ' out' : '')} role="status" key={t.id}>
      {t.e ? <E k={t.e} s={26} /> : <I n={t.icon || 'check-circle'} />}
      <span className="tt">{t.text}</span>
      {t.action && <button type="button" onClick={() => { t.action.fn(); close(); }}>{t.action.label}</button>}
    </div>
  );
}

export function App() {
  const [S, setS] = useState(load);
  const frame = useMedia('(min-width: 860px) and (min-height: 640px)');
  const hostDark = useHostDark();
  const theme = S.theme || 'w';
  const dark = S.mode === 'dark' || (S.mode === 'system' && hostDark);
  const [nav, setNav] = useState(() => ({ tab: 'home', stacks: { home: [{ s: 'home', k: 'r' }], lists: [{ s: 'lists', k: 'r' }], recipes: [{ s: 'recipes', k: 'r' }], money: [{ s: 'money', k: 'r' }] }, anim: 'none', modal: null }));
  const [sheet, setSheet] = useState(null);
  const [toastS, setToast] = useState(null);
  const [ai, setAi] = useState(null);
  const [ovl, setOvl] = useState(null);
  const appRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => save(S), 250); return () => clearTimeout(t); }, [S]);
  useEffect(() => { aiAvailable().then(setAi); }, []);
  useEffect(() => { document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; }, [dark]);

  // Spodná lišta a karty v doku ležia nad obsahom: ťah, ktorý začne na nich, sa prepošle do obsahu pod nimi
  // (aj so zotrvačnosťou), takže sa posúvanie nezasekne. Vodorovný ťah (rad dlaždíc) ostáva prehliadaču, ťuk ostáva tlačidlám.
  useEffect(() => {
    const app = appRef.current; if (!app) return;
    const OV = '.tabbar, .dock';
    const scroller = (el) => { const host = el.closest('.mdl') || app.querySelector('.scr.top'); return host && host.querySelector('.sc'); };
    let g = null, raf = 0;
    const stopFling = () => { cancelAnimationFrame(raf); raf = 0; };
    const start = (e) => {
      const ov = e.target.closest && e.target.closest(OV); if (!ov || e.touches.length !== 1) return;
      const sc = scroller(ov); if (!sc) return;
      stopFling();
      const t = e.touches[0];
      g = { sc, x: t.clientX, y: t.clientY, ly: t.clientY, lt: e.timeStamp, v: 0, lock: null };
    };
    const move = (e) => {
      if (!g) return; const t = e.touches[0];
      const dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.lock) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; g.lock = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'; }
      if (g.lock !== 'y') return;
      const d = t.clientY - g.ly; const dt = Math.max(1, e.timeStamp - g.lt);
      g.sc.scrollTop -= d;
      g.v = .8 * (-d / dt) + .2 * g.v; // px/ms, vyhladené
      g.ly = t.clientY; g.lt = e.timeStamp;
      if (e.cancelable) e.preventDefault();
    };
    const end = (e) => {
      if (!g) return; const { sc, lock } = g; let v = g.v; const idle = e.timeStamp - g.lt; g = null;
      if (lock !== 'y' || idle > 90 || Math.abs(v) < .05) return;
      let last = performance.now();
      const step = (now) => { const dt = Math.min(32, now - last); last = now; sc.scrollTop += v * dt; v *= Math.pow(.995, dt); if (Math.abs(v) > .02) raf = requestAnimationFrame(step); else raf = 0; };
      raf = requestAnimationFrame(step);
    };
    const wheel = (e) => { const ov = e.target.closest && e.target.closest(OV); if (!ov) return; const sc = scroller(ov); if (!sc) return; sc.scrollTop += e.deltaY; e.preventDefault(); };
    const touchHere = (e) => { if (raf && !(e.target.closest && e.target.closest(OV))) stopFling(); };
    app.addEventListener('touchstart', start, { passive: true });
    app.addEventListener('touchstart', touchHere, { passive: true });
    app.addEventListener('touchmove', move, { passive: false });
    app.addEventListener('touchend', end); app.addEventListener('touchcancel', end);
    app.addEventListener('wheel', wheel, { passive: false });
    return () => { stopFling(); app.removeEventListener('touchstart', start); app.removeEventListener('touchstart', touchHere); app.removeEventListener('touchmove', move); app.removeEventListener('touchend', end); app.removeEventListener('touchcancel', end); app.removeEventListener('wheel', wheel); };
  }, [frame]);

  // klávesnica v telefóne – posun spodného panela nad ňu
  useEffect(() => {
    const vv = window.visualViewport; if (!vv || !appRef.current) return;
    const f = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); appRef.current && appRef.current.style.setProperty('--kb', (kb > 80 ? kb : 0) + 'px'); appRef.current && appRef.current.classList.toggle('kbd', kb > 80); };
    vv.addEventListener('resize', f); vv.addEventListener('scroll', f); f();
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
  }, [frame]);

  const act = useCallback((fn, ...args) => setS((s) => (typeof fn === 'function' ? fn(s) : A[fn](s, ...args))), []);
  const toastTimer = useRef(null);
  const toast = useCallback((text, o = {}) => {
    clearTimeout(toastTimer.current);
    const id = Math.random();
    setToast({ id, text, ...o });
    toastTimer.current = setTimeout(() => { setToast((t) => (t && t.id === id ? { ...t, out: true } : t)); setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 260); }, o.ms || 3400);
  }, []);

  const go = useCallback((tab) => setNav((n) => {
    if (n.tab === tab) { const st = n.stacks[tab]; return st.length > 1 ? { ...n, stacks: { ...n.stacks, [tab]: [st[0]] }, anim: 'pop' } : n; }
    return { ...n, tab, anim: 'tab' };
  }), []);
  const push = useCallback((s, p = {}) => setNav((n) => ({ ...n, stacks: { ...n.stacks, [n.tab]: [...n.stacks[n.tab], { s, p, k: Math.random().toString(36).slice(2) }] }, anim: 'push' })), []);
  const pop = useCallback(() => setNav((n) => { const st = n.stacks[n.tab]; return st.length > 1 ? { ...n, stacks: { ...n.stacks, [n.tab]: st.slice(0, -1) }, anim: 'pop' } : n; }), []);
  const popNow = useCallback(() => ReactDOM.flushSync(() => setNav((n) => { const st = n.stacks[n.tab]; return st.length > 1 ? { ...n, stacks: { ...n.stacks, [n.tab]: st.slice(0, -1) }, anim: 'none' } : n; })), []);
  const modal = useCallback((s, p = {}) => setNav((n) => ({ ...n, modal: { s, p, k: Math.random() } })), []);
  const closeModal = useCallback(() => setNav((n) => (n.modal ? { ...n, modal: { ...n.modal, out: true } } : n)), []);
  useEffect(() => { if (nav.modal && nav.modal.out) { const t = setTimeout(() => setNav((n) => (n.modal && n.modal.out ? { ...n, modal: null } : n)), 300); return () => clearTimeout(t); } }, [nav.modal]);
  // skok na obrazovku v inej záložke
  const jump = useCallback((tab, s, p = {}, anim = 'tab') => setNav((n) => ({ ...n, tab, stacks: { ...n.stacks, [tab]: s && s !== ROOT[tab] ? [n.stacks[tab][0], { s, p, k: Math.random().toString(36).slice(2) }] : [n.stacks[tab][0]] }, anim, modal: n.modal ? { ...n.modal, out: true } : null })), []);
  const openSheet = useCallback((name, props = {}) => setSheet({ name, props, open: true, k: Math.random() }), []);
  const closeSheet = useCallback(() => setSheet((s) => (s ? { ...s, open: false } : s)), []);
  const voice = useCallback((p = {}) => modal('voice', p), [modal]);

  // Lucia nakupuje – každých 25 s odškrtne ďalšiu položku
  useInterval(() => { const l = S.live && S.lists.find((x) => x.id === S.live.listId); if (l && l.items.some((i) => !i.done)) act('liveTick'); }, S.live ? 25000 : 0);
  // Počas nákupu príde po chvíli žiadosť od Lucie
  useEffect(() => {
    if (!S.shopping || S.shopping.req) return;
    const t = setTimeout(() => {
      act((s) => (s.shopping && !s.shopping.req ? { ...A.pushRequest(s, { from: 'l', pid: 'smotana', q: 2, listId: s.shopping.listId, note: 'na kari' }), shopping: { ...s.shopping, req: true } } : s));
    }, 11000);
    return () => clearTimeout(t);
  }, [S.shopping && S.shopping.listId, S.shopping && S.shopping.req]);

  const reset = () => { clearSaved(); const s = initialState(); s.theme = S.theme; s.mode = S.mode; setS(s); setNav({ tab: 'home', stacks: { home: [{ s: 'home', k: 'r' }], lists: [{ s: 'lists', k: 'r' }], recipes: [{ s: 'recipes', k: 'r' }], money: [{ s: 'money', k: 'r' }] }, anim: 'tab', modal: null }); toast('Ukážka je ako na začiatku'); };

  const onSc = (e) => { const t = e.target; if (t && t.classList && t.classList.contains('sc') && !t.classList.contains('rsc')) t.classList.toggle('scrolled', t.scrollTop > 8); };
  const ctx = { S, act, setS, theme, dark, frame, nav, go, push, pop, modal, closeModal, jump, sheet: openSheet, closeSheet, toast, voice, ai, ovl, reset };
  window.__bh = ctx; // len pre automatické testy prototypu

  const stack = nav.stacks[nav.tab];
  const topK = stack[stack.length - 1].k;
  const M = nav.modal && MODALS[nav.modal.s];
  const SH = sheet && SHEETS[sheet.name];
  const hideTabs = !!(nav.modal && !nav.modal.out && nav.modal.s !== 'voice') || stack.length > 1 && ['list'].includes(stack[stack.length - 1].s);

  const app = (
    <div ref={appRef} className={`app ${theme} ${dark ? 't-d' : 't-l'}${frame ? ' framed' : ''}${hideTabs ? ' notabs' : ''}`}>
      {TABS.map((tab) => nav.stacks[tab].map((e, i) => {
        const Sc = SCREENS[e.s]; const st = nav.stacks[tab]; const top = tab === nav.tab && i === st.length - 1;
        const anim = top ? (nav.anim === 'push' ? ' in-push' : nav.anim === 'pop' ? ' in-pop' : nav.anim === 'tab' ? ' in-tab' : nav.anim === 'fly' ? ' in-fly' : '') : '';
        const prev = tab === nav.tab && i === st.length - 2;
        return <section key={tab + e.k} className={'scr s-' + e.s + (top ? ' top' + anim : ' off')} data-prev={prev ? '' : undefined} aria-hidden={!top} onScrollCapture={onSc}>{theme === 'g' && <div className="bgl"><div className="bgb pic-trh_p" /><div className="veil" /></div>}<ScreenCtx.Provider value={{ back: backLabel(st[i - 1]) }}><Sc p={e.p || {}} top={top} /></ScreenCtx.Provider></section>;
      }))}
      {stack.length > 1 && !nav.modal && !(sheet && sheet.open) && <EdgeBack appRef={appRef} done={popNow} />}
      <Coach appRef={appRef} screen={stack[stack.length - 1].s} blocked={!!(nav.modal && !nav.modal.out) || !!(sheet && sheet.open)} />
      {!hideTabs && <div className="tabfade" aria-hidden="true" />}
      {!hideTabs && <TabBar tab={nav.tab} go={go} voice={voice} vOn={!!(nav.modal && nav.modal.s === 'voice' && !nav.modal.out)} />}
      {M && <section key={nav.modal.k} className={'mdl m-' + nav.modal.s + (nav.modal.out ? ' out' : '')} onScrollCapture={onSc}><M p={nav.modal.p} /></section>}
      <div className="ovl" ref={setOvl} />
      {SH && <SH key={sheet.k} open={sheet.open} close={closeSheet} {...sheet.props} />}
      <Toasts t={toastS} close={() => setToast(null)} />
      {!S.theme && <ThemeIntro onPick={(t) => act((s) => ({ ...s, theme: t }))} />}
    </div>
  );

  return (
    <Ctx.Provider value={ctx}>
      {frame ? <Desk app={app} /> : app}
    </Ctx.Provider>
  );
}

function ThemeIntro({ onPick }) {
  return (
    <div className="intro" role="dialog" aria-label="Výber témy">
      <div className="in-wrap">
        <span className="in-k">Basket Harmony · prototyp</span>
        <h1>Ktorú tému chcete vyskúšať?</h1>
        <p>Obe témy majú rovnaké funkcie. Prepnúť ich môžete kedykoľvek v časti Viac.</p>
        <ThemePicker onPick={onPick} big />
      </div>
    </div>
  );
}

function Desk({ app }) {
  const { S, act, theme, dark, voice, modal, jump, ai, reset } = React.useContext(Ctx);
  const [sc, setSc] = useState(1);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { const f = () => setSc(Math.min(1, (window.innerHeight - 40) / 878)); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const tryIt = [
    ['microphone', 'Nadiktujte nákup', 'V zozname ťuknite na mikrofón v poli dole.', () => voice({ listId: 'l1' })],
    ['shopping-cart', 'Choďte nakupovať', 'Odškrtávajte, príde aj žiadosť od Lucie.', () => modal('shop', { listId: 'l1' })],
    ['receipt', 'Odfoťte bloček', 'Skutočné ceny sa zapíšu k položkám.', () => modal('scan', { listId: 'l1' })],
    ['cooking-pot', 'Prelistujte knihu receptov', 'Kategórie, obľúbené a plán týždňa.', () => jump('recipes')],
    ['wallet', 'Pozrite výdavky', 'Október z vašich bločkov.', () => jump('money')],
  ];
  return (
    <div className="desk">
      <div className="phone-col">
        <div className="phone-sz" style={{ width: 419 * sc, height: 878 * sc }}>
          <div className={`dev ${theme} ${dark ? 't-d' : 't-l'}`} style={{ transform: `scale(${sc})` }}>
            <div className="di" />
            <div className="scrn">{app}<StatusBar /></div>
          </div>
        </div>
      </div>
      <aside className="panel">
        <div className="p-head">
          <span className="p-k">Interaktívny prototyp</span>
          <h1>Basket Harmony</h1>
          <p>Všetko v telefóne funguje: zoznamy, nákup, hlas, recepty, bločky aj výdavky. Zmeny sa ukladajú v tomto prehliadači. Späť sa vrátite aj potiahnutím z ľavého okraja obrazovky doprava.</p>
        </div>
        <div className="p-sec">
          <h2>Téma</h2>
          <ThemePicker value={theme} onPick={(t) => act((s) => ({ ...s, theme: t }))} />
        </div>
        <div className="p-sec">
          <h2>Vzhľad</h2>
          <Seg items={[['light', 'Svetlý'], ['dark', 'Tmavý'], ['system', 'Podľa systému']]} value={S.mode} onChange={(m) => act((s) => ({ ...s, mode: m }))} />
        </div>
        <div className="p-sec">
          <h2>Vyskúšajte</h2>
          <div className="p-try">{tryIt.map(([ic, t, d, fn]) => <button type="button" key={t} onClick={fn}><I n={ic} /><span><b>{t}</b><small>{d}</small></span><I n="caret-right" w="bold" /></button>)}</div>
        </div>
        <div className="p-sec p-foot">
          <p className="p-ai"><i className={ai ? 'ok' : ''} />{ai == null ? 'Zisťujem, či je dostupná AI…' : ai ? 'AI (Claude) je pripojená – rozpoznáva reč, recepty aj bločky. Pri prvom použití sa opýta na povolenie.' : 'AI tu nie je dostupná – hlas a bločky sa rozpoznávajú v telefóne a cez ukážky.'}</p>
          {confirm ? <div className="p-confirm"><span>Vymazať všetky zmeny?</span><button type="button" className="d" onClick={() => { reset(); setConfirm(false); }}>Áno, začať odznova</button><button type="button" onClick={() => setConfirm(false)}>Nie</button></div>
            : <button type="button" className="p-reset" onClick={() => setConfirm(true)}><I n="arrow-counter-clockwise" w="bold" />Začať ukážku odznova</button>}
        </div>
      </aside>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
