import { useApp, useState, useEffect, useRef, I } from './ui.jsx';
/* icons: hand-tap hand-pointing hand-swipe-left x */

// Nápovedy pre nových používateľov: vždy len jedna, ukazuje na skutočný prvok obrazovky.
// Zmizne po „Rozumiem“, ťuknutím mimo nej alebo sama po 10 s; každá sa ukáže len raz.
// Ťuknutie priamo na zvýraznený prvok nápovedu zavrie a prvok normálne použije.
// Keď prvok na obrazovke nie je alebo nie je celý viditeľný, nápoveda sa neukáže.
export const COACH = [
  { id: 'mic', screen: 'home', sel: '.tabbar .tmic', global: true, hand: 'tap', title: 'Hovorte namiesto písania', text: 'Ťuknite a povedzte napríklad „dve mlieka a chlieb“. Položky sa pridajú do zoznamu.' },
  { id: 'tabs', screen: 'home', sel: '.tabbar', global: true, title: 'Štyri časti appky', text: 'Domov, Nákupy, Recepty a Výdavky. Ťuknutím sa medzi nimi prepínate.' },
  { id: 'quick', screen: 'home', sel: '.qa', title: 'Najčastejšie akcie', text: 'Pridať do nákupu, odfotiť bloček alebo nájsť, čo uvariť – všetko jedným ťuknutím.' },
  { id: 'newlist', screen: 'lists', sel: '.nb .nbr .ib:last-child, .nb > .ib:last-child', hand: 'tap', title: 'Nový zoznam', text: 'Pomenujte ho, vyberte deň a či ho uvidí celá domácnosť.' },
  { id: 'lcard', screen: 'lists', sel: '.lcard', hand: 'tap', title: 'Otvorte zoznam', text: 'Uvidíte položky, odhad ceny podľa bločkov a môžete ísť nakupovať.' },
  { id: 'composer', screen: 'list', sel: '.dock .field', title: 'Pridajte položku', text: 'Napíšte napríklad „mlieko 2“ alebo ťuknite na mikrofón a povedzte, čo treba.' },
  { id: 'shopbtn', screen: 'list', sel: '.est .btn', hand: 'tap', title: 'Ste v obchode?', text: 'Ťuknite na Nakupovať a odškrtávajte, čo dávate do košíka.' },
  { id: 'taste', screen: 'recipes', sel: '.tentry', hand: 'tap', title: 'Neviete, čo variť?', text: 'V Ochutnávači listujete recepty ako videá. Čo sa páči, označíte srdiečkom.' },
  { id: 'rsearch', screen: 'recipes', sel: '.search', title: 'Hľadajte jedlo aj surovinu', text: 'Napríklad „guláš“ alebo „kuracie“. Čo v knihe nie je, pridáme do plánu.' },
  { id: 'ing', screen: 'recipe', sel: '.ings .ing[role="button"]', hand: 'tap', title: 'Čo máte doma?', text: 'Ťuknite na surovinu, ktorú máte. Do nákupu sa potom pridá len to, čo chýba.' },
  { id: 'recadd', screen: 'recipe', sel: '.dock .dockc .btn', title: 'Suroviny do nákupu', text: 'Jedným ťuknutím pridáte, čo chýba, do zoznamu alebo do nového.' },
  { id: 'scan', screen: 'money', sel: '.rbtns .btn.pri', hand: 'tap', title: 'Odfoťte bloček', text: 'Ceny sa zapíšu k položkám a výdavky sa spočítajú samé.' },
];

export function Coach({ screen, blocked, appRef }) {
  const { S, act } = useApp();
  const [cur, setCur] = useState(null); // { c, r }
  const [hide, setHide] = useState(false);
  const timer = useRef(null);
  const seen = (S.coach && S.coach.seen) || {};
  const off = S.coach && S.coach.off;
  const mark = (id, all) => act((s) => ({ ...s, coach: { ...(s.coach || {}), off: all || (s.coach && s.coach.off), seen: { ...((s.coach && s.coach.seen) || {}), [id]: Date.now() } } }));

  const find = () => {
    const app = appRef.current; if (!app || off || blocked || app.querySelector('.intro')) return null;
    const A = app.getBoundingClientRect();
    for (const c of COACH) {
      if (c.screen !== screen || seen[c.id]) continue;
      const root = c.global ? app : app.querySelector('.scr.top');
      const el = root && root.querySelector(c.sel); if (!el) continue;
      const r = el.getBoundingClientRect();
      const tb = !c.global && app.querySelector('.tabbar'); const bottom = tb ? tb.getBoundingClientRect().top : A.bottom;
      const nb = !c.global && app.querySelector('.scr.top .nb'); const top = nb && !el.closest('.nb') ? nb.getBoundingClientRect().bottom : A.top;
      const inside = r.width > 0 && r.height > 0 && r.top >= top - 1 && r.left >= A.left - 1 && r.right <= A.right + 1 && (r.bottom <= bottom + 1 || el.closest('.dock,.tabbar'));
      if (!inside) continue;
      return { c, r: { x: r.left - A.left, y: r.top - A.top, w: r.width, h: r.height }, W: A.width, H: A.height };
    }
    return null;
  };

  // nová obrazovka / zmena stavu → po chvíli skúsiť ukázať ďalšiu nápovedu
  useEffect(() => {
    setCur(null); clearTimeout(timer.current);
    if (off || blocked) return;
    timer.current = setTimeout(() => setCur(find()), 900);
    return () => clearTimeout(timer.current);
  }, [screen, blocked, off, Object.keys(seen).length]);

  // prvok sa mohol objaviť neskôr (úvodný výber témy, načítanie) → skúšať každé 1,5 s
  const curRef = useRef(null); curRef.current = cur;
  useEffect(() => {
    if (off || blocked) return;
    const id = setInterval(() => { if (!curRef.current) { const f = find(); if (f) setCur(f); } }, 1500);
    return () => clearInterval(id);
  }, [screen, blocked, off, Object.keys(seen).length, S.theme]);

  // posúvanie: nápoveda sa skryje a po zastavení sa znova zameria (alebo počká, kým bude prvok viditeľný)
  const findRef = useRef(find); findRef.current = find;
  useEffect(() => {
    const app = appRef.current; if (!app) return;
    let t;
    const onSc = (e) => { if (e.target.closest && e.target.closest('.gal-s,.rrow,.chips,.staples,.carousel')) return; setHide(true); clearTimeout(t); t = setTimeout(() => { setHide(false); setCur(findRef.current()); }, 450); };
    app.addEventListener('scroll', onSc, true);
    return () => { app.removeEventListener('scroll', onSc, true); clearTimeout(t); };
  }, []);

  const done = () => { if (cur) mark(cur.c.id); setCur(null); };
  // automatické zmiznutie po 10 s (počíta sa ako videné)
  useEffect(() => { if (!cur || hide) return; const t = setTimeout(() => done(), 10000); return () => clearTimeout(t); }, [cur && cur.c.id, hide]);

  if (!cur || hide) return null;
  const { c, r, W, H } = cur;
  const pad = 6;
  const hole = { left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 };
  const below = r.y + r.h + 190 < H && !(r.y > H * .55);
  const bw = Math.min(330, W - 32);
  const bx = Math.max(16, Math.min(W - 16 - bw, r.x + r.w / 2 - bw / 2));
  const ax = Math.max(22, Math.min(bw - 22, r.x + r.w / 2 - bx));
  const onBg = (e) => {
    const A = appRef.current.getBoundingClientRect(); const x = e.clientX - A.left, y = e.clientY - A.top;
    const inHole = x >= hole.left && x <= hole.left + hole.width && y >= hole.top && y <= hole.top + hole.height;
    done();
    if (inHole) { const root = c.global ? appRef.current : appRef.current.querySelector('.scr.top'); const el = root && root.querySelector(c.sel); if (el && c.hand) setTimeout(() => el.click(), 60); }
  };
  return (
    <div className="coach" onClick={onBg} role="dialog" aria-label={c.title} aria-live="polite">
      <div className="co-hole" style={{ ...hole, borderRadius: Math.min(28, hole.height / 2) }} />
      {c.hand && <span className={'co-hand ' + c.hand} style={{ left: r.x + r.w / 2 - 20, top: r.y + r.h / 2 - 6 }}><I n="hand-pointing" /></span>}
      <div className={'co-bub ' + (below ? 'b' : 'a')} style={{ left: bx, width: bw, ...(below ? { top: hole.top + hole.height + 14 } : { bottom: H - hole.top + 14 }) }} onClick={(e) => e.stopPropagation()}>
        <i className="co-arr" style={{ left: ax - 8 }} />
        <b>{c.title}</b>
        <p>{c.text}</p>
        <div className="co-act">
          <button type="button" className="co-skip" onClick={() => { mark(c.id, true); setCur(null); }}>Vypnúť nápovedy</button>
          <button type="button" className="co-ok" onClick={done}>Rozumiem</button>
        </div>
        <span className="co-bar" key={c.id}><i /></span>
      </div>
    </div>
  );
}
