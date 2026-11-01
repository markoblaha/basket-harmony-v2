import { useApp, useState, useEffect, useRef, useLayoutEffect, I, IB } from './ui.jsx';
/* icons: hand-pointing question lightbulb x arrow-right sparkle */

// ===================== Nápovedy =====================
// Systém:
//  1. Pri prvom spustení uvítanie: „Ukážte mi to“ alebo „Zvládnem to sám“.
//  2. Na každej obrazovke sa pri prvej návšteve ukážu jej nápovedy postupne (1 z 3, Ďalej, Preskočiť).
//     Nič nezmizne samo – starší človek má čas dočítať. Ťuk mimo bubliny = Ďalej.
//  3. Ťuk priamo na zvýraznený prvok ho normálne použije (napr. otvorí zoznam).
//  4. Tlačidlo „?“ vpravo hore na hlavných obrazovkách prehrá nápovedy danej obrazovky kedykoľvek znova.
//  5. Viac → Nápovedy: zapnúť/vypnúť a ukázať všetky znova.
// Nápoveda sa ukáže len na prvok, ktorý je naozaj na obrazovke a už sa nehýbe.
export const COACH = [
  { id: 'mic', screen: 'home', sel: '.tabbar .tmic', global: true, hand: 'tap', title: 'Hovorte namiesto písania', text: 'Ťuknite sem a povedzte napríklad „dve mlieka a chlieb“. Položky sa pridajú do nákupu.' },
  { id: 'tabs', screen: 'home', sel: '.tabbar', global: true, title: 'Štyri časti appky', text: 'Domov, Nákupy, Recepty a Výdavky. Ťuknutím sa medzi nimi prepínate.' },
  { id: 'quick', screen: 'home', sel: '.qa', title: 'Najčastejšie akcie', text: 'Pridať do nákupu, odfotiť bloček alebo nájsť, čo uvariť.' },
  { id: 'help', screen: 'home', sel: '.nb .helpb', title: 'Pomoc je vždy tu', text: 'Keď si nebudete istí, ťuknite na otáznik. Nápovedy k obrazovke sa ukážu znova.' },
  { id: 'lcard', screen: 'lists', sel: '.lcard', title: 'Váš nákupný zoznam', text: 'Ťuknutím ho otvoríte: uvidíte položky a odhad ceny podľa bločkov.' },
  { id: 'lgo', screen: 'lists', sel: '.lgo', hand: 'tap', title: 'Rovno do obchodu', text: 'Košíkom na karte spustíte nákup bez otvárania zoznamu.' },
  { id: 'newlist', screen: 'lists', sel: '.nb .addb', hand: 'tap', title: 'Nový zoznam', text: 'Pomenujte ho, vyberte deň a či ho uvidí celá domácnosť.' },
  { id: 'composer', screen: 'list', sel: '.dock .field', title: 'Pridajte položku', text: 'Napíšte napríklad „mlieko 2“ alebo ťuknite na mikrofón a povedzte, čo treba.' },
  { id: 'shopbtn', screen: 'list', sel: '.est .btn', hand: 'tap', title: 'Ste v obchode?', text: 'Ťuknite na Nakupovať a odškrtávajte, čo dávate do košíka.' },
  { id: 'shrow', screen: 'm-shop', sel: '.lst.big .row', modal: true, hand: 'tap', title: 'Dali ste to do košíka?', text: 'Ťuknite na položku. Odškrtne sa a presunie medzi kúpené. Omyl opravíte druhým ťuknutím.' },
  { id: 'shhead', screen: 'm-shop', sel: '.shopnb .snb-seg', modal: true, title: 'Koľko ešte zostáva', text: 'Každý dielik je jedna položka. Keď sú všetky zelené, máte nakúpené.' },
  { id: 'vtarget', screen: 'm-voice', sel: '.vx-target', modal: true, title: 'Kam sa položky pridajú', text: 'Ťuknutím vyberiete zoznam. Môžete ho aj povedať, napríklad „do Lidla“.' },
  { id: 'vorb', screen: 'm-voice', sel: '.vx-orb', modal: true, title: 'Hovorte', text: 'Keď guľa pulzuje, appka počúva. Ťuknutím počúvanie pozastavíte.' },
  { id: 'vdone', screen: 'm-voice', sel: '.vx-done', modal: true, title: 'Hotovo', text: 'Keď máte všetko, ťuknite na Hotovo. Položky sa uložia do zoznamu.' },
  { id: 'taste', screen: 'recipes', sel: '.tentry', hand: 'tap', title: 'Neviete, čo variť?', text: 'V Ochutnávači listujete recepty ako videá. Čo sa páči, označíte srdiečkom.' },
  { id: 'rsearch', screen: 'recipes', sel: '.search', title: 'Hľadajte jedlo aj surovinu', text: 'Napríklad „guláš“ alebo „kuracie“.' },
  { id: 'recadd', screen: 'recipe', sel: '.dock .dockc .btn', title: 'Suroviny do nákupu', text: 'Jedným ťuknutím pridáte, čo chýba, do zoznamu alebo do nového.' },
  { id: 'ing', screen: 'recipe', sel: '.ings .ing[role="button"]', hand: 'tap', title: 'Čo máte doma?', text: 'Ťuknite na surovinu, ktorú máte. Do nákupu sa potom pridá len to, čo chýba.' },
  { id: 'mrc', screen: 'money', sel: '.mrc', title: 'Chýba bloček', text: 'Tu sú nákupy bez bločku. Odfoťte ho a ceny sa priradia samé.' },
  { id: 'scan', screen: 'money', sel: '.rbtns .btn.pri', hand: 'tap', title: 'Odfoťte bloček', text: 'Ceny sa zapíšu k položkám a výdavky sa spočítajú samé.' },
];
export const coachScreens = new Set(COACH.map((c) => c.screen));

// „?“ v hlavičke – prehrá nápovedy obrazovky znova
export function HelpBtn({ screen }) {
  const { act } = useApp();
  return <IB n="question" cls="helpb" label="Ako to tu funguje?" onClick={() => act((s) => ({ ...s, coach: { ...(s.coach || {}), welcomed: true, replay: { screen, k: Date.now() } } }))} />;
}

const PAD = 6, GAP = 14, EDGE = 12;
const finiteRunning = (el) => (el.getAnimations ? el.getAnimations({ subtree: true }).some((a) => { const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {}; return a.playState === 'running' && t.iterations !== Infinity && (t.duration || 0) > 0; }) : false);

export function Coach({ screen, blocked, appRef }) {
  const { S, act } = useApp();
  const C = S.coach || {};
  const off = C.off;
  const seen = C.seen || {};
  const [q, setQ] = useState(null); // { list: [ids], i, forced }
  const [box, setBox] = useState(null); // poloha prvku v súradniciach appky
  const [bh, setBh] = useState(0);
  const bubRef = useRef(null);
  const rk = C.replay && C.replay.screen === screen ? C.replay.k : 0;
  const handled = useRef(0);

  const rootFor = (c) => { const app = appRef.current; if (!app) return null; return c.global ? app : c.modal ? app.querySelector('.mdl:not(.out)') : app.querySelector('.scr.top'); };
  const elFor = (c) => { const r = rootFor(c); return r && r.querySelector(c.sel); };
  // poloha prvku: appka môže byť na počítači zmenšená (transform: scale), preto sa delí mierkou
  const measure = (el) => {
    const app = appRef.current; const A = app.getBoundingClientRect(); const s = A.width / app.offsetWidth || 1;
    const r = el.getBoundingClientRect();
    return { x: (r.left - A.left) / s, y: (r.top - A.top) / s, w: r.width / s, h: r.height / s, W: app.offsetWidth, H: app.offsetHeight, rad: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14 };
  };
  const visible = (c, el) => {
    const m = measure(el); if (m.w < 4 || m.h < 4) return false;
    const app = appRef.current;
    const top = !c.global && !c.modal && !el.closest('.nb') ? (() => { const nb = app.querySelector('.scr.top .nb'); return nb ? measure(nb).y + measure(nb).h : 0; })() : 0;
    const tb = !c.global && !c.modal && !el.closest('.dock') && app.querySelector('.tabbar'); const bottom = tb ? measure(tb).y : m.H;
    return m.y >= top - 1 && m.y + m.h <= bottom + 1 && m.x >= -1 && m.x + m.w <= m.W + 1;
  };

  // zostaví poradie nápovied pre obrazovku (pri „?“ aj už videné)
  useEffect(() => {
    setQ(null); setBox(null);
    if (blocked || !coachScreens.has(screen)) return;
    const replay = rk && rk !== handled.current;
    if (!replay && (off || !C.welcomed)) return;
    let tries = 0; let t;
    const tick = () => {
      const app = appRef.current; if (!app || app.querySelector('.intro')) { t = setTimeout(tick, 400); return; }
      if (finiteRunning(app) && tries++ < 12) { t = setTimeout(tick, 200); return; } // obrazovka ešte prichádza
      const list = COACH.filter((c) => c.screen === screen && (replay || !seen[c.id]) && elFor(c)).map((c) => c.id);
      if (replay) handled.current = rk;
      if (list.length) setQ({ list, i: 0, forced: !!replay });
    };
    t = setTimeout(tick, replay ? 150 : 700);
    return () => clearTimeout(t);
  }, [screen, blocked, off, C.welcomed, rk]);

  const c = q && COACH.find((x) => x.id === q.list[q.i]);
  // zameranie: pri „?“ sa prvok posunie na obrazovku; inak sa čaká, kým ho človek uvidí
  useEffect(() => {
    if (!c) { setBox(null); return; }
    let alive = true; let t;
    const aim = (n = 0) => {
      if (!alive) return; const el = elFor(c);
      if (!el) { next(false); return; }
      if (!visible(c, el)) {
        if (q.forced && n === 0) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); t = setTimeout(() => aim(1), 650); return; }
        setBox(null); t = setTimeout(() => aim(n + 1), 600); return; // počká, kým sa k prvku človek posunie
      }
      setBox(measure(el));
    };
    aim();
    // prvok sa môže pohnúť (načítanie, zmena veľkosti okna) – poloha sa priebežne spresňuje
    const id = setInterval(() => { const el = elFor(c); if (!el) return; if (!visible(c, el)) { setBox(null); return; } const m = measure(el); setBox((b) => (!b || Math.abs(b.x - m.x) + Math.abs(b.y - m.y) + Math.abs(b.w - m.w) + Math.abs(b.h - m.h) > 1 ? m : b)); }, 300);
    const onR = () => { const el = elFor(c); if (el) setBox(measure(el)); };
    window.addEventListener('resize', onR);
    return () => { alive = false; clearTimeout(t); clearInterval(id); window.removeEventListener('resize', onR); };
  }, [c && c.id, q && q.i]);
  useLayoutEffect(() => { if (bubRef.current) setBh(bubRef.current.offsetHeight); });
  useEffect(() => { if (!c || !box) return; const k = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); next(true); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });

  const markIds = (ids) => act((s) => ({ ...s, coach: { ...(s.coach || {}), seen: { ...((s.coach && s.coach.seen) || {}), ...Object.fromEntries(ids.map((x) => [x, Date.now()])) } } }));
  function next(markIt = true) {
    if (!q) return;
    if (markIt) markIds([q.list[q.i]]);
    if (q.i + 1 < q.list.length) setQ({ ...q, i: q.i + 1 }); else { setQ(null); setBox(null); }
  }
  const skip = () => { markIds(q.list.slice(q.i)); setQ(null); setBox(null); };

  if (!c || !box) return null;
  const { W, H } = box;
  const hole = { left: Math.max(4, box.x - PAD), top: Math.max(4, box.y - PAD), width: Math.min(W - 8, box.w + PAD * 2), height: box.h + PAD * 2 };
  const bw = Math.min(340, W - EDGE * 2);
  const hb = bh || 170;
  const spaceBelow = H - (hole.top + hole.height) - GAP - EDGE; const spaceAbove = hole.top - GAP - EDGE;
  const below = spaceBelow >= hb || (spaceBelow >= spaceAbove && spaceAbove < hb);
  let top = below ? hole.top + hole.height + GAP : hole.top - GAP - hb;
  top = Math.max(EDGE + 30, Math.min(H - EDGE - hb, top)); // vždy celá na obrazovke
  const cx = box.x + box.w / 2;
  const left = Math.max(EDGE, Math.min(W - EDGE - bw, cx - bw / 2));
  const arrowX = Math.max(22, Math.min(bw - 22, cx - left));
  const arrowOk = below ? top >= hole.top + hole.height + 4 : top + hb <= hole.top - 4; // šípka len keď bublina naozaj susedí s prvkom
  const last = q.i === q.list.length - 1;
  const onBg = (e) => {
    const app = appRef.current; const A = app.getBoundingClientRect(); const s = A.width / app.offsetWidth || 1;
    const x = (e.clientX - A.left) / s, y = (e.clientY - A.top) / s;
    const inHole = x >= hole.left && x <= hole.left + hole.width && y >= hole.top && y <= hole.top + hole.height;
    if (inHole && c.hand) { const el = elFor(c); markIds([c.id]); setQ(null); setBox(null); if (el) setTimeout(() => el.click(), 60); return; }
    next(true);
  };
  return (
    <div className="coach" onClick={onBg} role="dialog" aria-modal="true" aria-labelledby="co-t" aria-describedby="co-p">
      <div className="co-hole" style={{ ...hole, borderRadius: Math.min(hole.height / 2, box.rad + PAD) }} />
      {c.hand && <span className="co-hand" style={{ left: cx - 12, top: box.y + box.h / 2 - 4 }} aria-hidden="true"><I n="hand-pointing" /></span>}
      <div ref={bubRef} className={'co-bub ' + (below ? 'b' : 'a')} style={{ left, top, width: bw }} onClick={(e) => e.stopPropagation()}>
        {arrowOk && <i className="co-arr" style={{ left: arrowX - 8 }} />}
        <div className="co-top"><span className="co-k"><I n="lightbulb" />{q.list.length > 1 ? `Nápoveda ${q.i + 1} z ${q.list.length}` : 'Nápoveda'}</span>{q.list.length > 1 && <span className="co-dots">{q.list.map((_, k) => <i key={k} className={k === q.i ? 'on' : k < q.i ? 'd' : ''} />)}</span>}</div>
        <b id="co-t">{c.title}</b>
        <p id="co-p">{c.text}</p>
        <div className="co-act">
          {!last ? <button type="button" className="co-skip" onClick={skip}>Preskočiť</button> : <span />}
          <button type="button" className="co-ok" onClick={() => next(true)} autoFocus>{last ? 'Rozumiem' : <>Ďalej<I n="arrow-right" w="bold" /></>}</button>
        </div>
      </div>
    </div>
  );
}

// Uvítanie pri prvom spustení
export function CoachWelcome({ blocked }) {
  const { S, act } = useApp();
  const C = S.coach || {};
  if (blocked || C.welcomed || C.off || !S.theme) return null;
  const set = (o) => act((s) => ({ ...s, coach: { ...(s.coach || {}), welcomed: true, ...o } }));
  return (
    <div className="co-wel" role="dialog" aria-modal="true" aria-labelledby="cw-t">
      <div className="co-wcard">
        <span className="co-wi"><I n="sparkle" /></span>
        <h2 id="cw-t">Vitajte v Basket Harmony</h2>
        <p>Ukážeme vám, čo je kde, priamo na obrazovke. Vždy jednu vec naraz a tam, kde ju práve potrebujete.</p>
        <div className="co-wq"><span className="helpdemo"><I n="question" w="bold" /></span><span>Keď si niečo nebudete pamätať, ťuknite na otáznik vpravo hore. Nápovedy sa ukážu znova.</span></div>
        <button type="button" className="co-ok big" onClick={() => set({})}>Ukážte mi to</button>
        <button type="button" className="co-skip c" onClick={() => set({ off: true })}>Zvládnem to sám</button>
      </div>
    </div>
  );
}
