import { useApp, useState, useEffect, useRef, I, E, IB, Btn, StoreTile, pe } from './ui.jsx';
import { PRODUCTS } from './data.js';
import { plural, parseLocal, parseChunk, estimate, eur, fmtQty, storeName, norm, frequentStores, withStore, dkey, addDays } from './logic.js';
/* icons: x keyboard caret-down check-circle trash warning-circle pencil-simple arrow-up arrow-counter-clockwise */

// Hlasový nákup 2.0: položky padajú zhora, živý prepis dole, viditeľné opravy, neistota s voľbami,
// úprava ťuknutím a hlasom, cieľ (kam sa pridáva) stále hore, Hotovo → „Kam pridať?“ alebo rovno uložiť.
const EX_START = ['Dve mlieka, chlieb a pol kila mletého mäsa do Lidla', 'Banány a syr', 'Šesť pív a kyslú smotanu'];
const EX_MORE = ['Ešte jedno mlieko a šesť pív', 'Banány a syr', 'Zmaž pivo', 'Hotovo'];
const AMBIG = { syr: ['eidam', 'mozzarella', 'camembert', 'feta'], maso: ['mlete', 'pliecko', 'kuracie', 'hovadzie'] };
const FILL = new Set('a aj este ešte jedno jeden jedna jednu dve dva tri styri štyri pat päť sest šesť sedem osem desat desať pol kila kilo kg g gramov litra liter litre l ks kusov kusy kusa balenie bal x'.split(' ').map((w) => norm(w)));
const DAYS = { dnes: 0, zajtra: 1, pozajtra: 2 };
const STORE_W = [['lidl', /^lidl/], ['kaufland', /^kaufland/], ['tesco', /^tesc/], ['billa', /^bill/], ['dm', /^dm$/], ['kraj', /^kraj/], ['metro', /^metr/]];
const dayLbl = (d) => (d === 0 ? 'dnes' : d === 1 ? 'zajtra' : d === 2 ? 'pozajtra' : '');
const base = (x) => (x.pid && PRODUCTS[x.pid] ? PRODUCTS[x.pid].n.replace(/ ·.*$/, '') : x.n);
const label = (x) => fmtQty(x.q, x.u || 'ks');
let KEY = 0; const nk = () => 'v' + Date.now().toString(36) + (KEY++);

// z vety vyberie „do Lidla“, „zajtra“, „do Veľkého nákupu“ – zvyšok sú položky
function pullTarget(text, lists) {
  const toks = text.split(/\s+/).filter(Boolean); const nt = toks.map((t) => norm(t).replace(/[^a-z0-9]/g, ''));
  const out = {}; const drop = new Set();
  for (let i = 0; i < nt.length; i++) {
    if (nt[i] in DAYS) { out.day = DAYS[nt[i]]; drop.add(i); continue; }
    if ((nt[i] === 'do' || nt[i] === 'v') && nt[i + 1]) {
      const st = STORE_W.find(([, rx]) => rx.test(nt[i + 1]));
      if (st) { out.store = st[0]; drop.add(i); drop.add(i + 1); continue; }
      for (const l of lists) {
        const ws = norm(l.name).split(' ').filter((w) => w.length > 2);
        if (ws.length && ws.every((w, k) => nt[i + 1 + k] && nt[i + 1 + k].startsWith(w.slice(0, 4)))) { out.listId = l.id; drop.add(i); ws.forEach((_, k) => drop.add(i + 1 + k)); break; }
      }
    }
  }
  return { rest: toks.filter((_, i) => !drop.has(i)).join(' ').replace(/[\s,]+$/, '').replace(/\s+a$/, ''), ...out };
}
const coreWord = (raw) => norm(raw || '').split(' ').filter((w) => w && !FILL.has(w) && !/^\d/.test(w)).join(' ');

export function VoiceTalk({ p }) {
  const { S, act, closeModal, theme, toast, jump } = useApp();
  const g = theme === 'g';
  const lists = S.lists.filter((l) => !l.live);
  const draft = S.voiceDraft && S.voiceDraft.items && S.voiceDraft.items.length ? S.voiceDraft : null;
  const [items, setItems] = useState(() => (draft ? draft.items : []));
  const [target, setTarget] = useState(() => (p.listId ? { kind: 'list', id: p.listId } : draft ? draft.target : null));
  const [restored, setRestored] = useState(!!draft);
  const [phase, setPhase] = useState('listening'); // listening | paused
  const [tr, setTr] = useState('');
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [kbd, setKbd] = useState(false);
  const [txt, setTxt] = useState('');
  const [panel, setPanel] = useState(null); // 'pick' | 'done'
  const [exI, setExI] = useState(0);
  const typer = useRef(null); const rec = useRef(null); const inp = useRef(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const selRef = useRef(sel); selRef.current = sel;

  // rozdiktované položky sa priebežne ukladajú (po zatvorení sa pokračuje)
  useEffect(() => { act((s) => ({ ...s, voiceDraft: items.length ? { items, target } : null })); }, [items, target]);
  useEffect(() => () => { clearInterval(typer.current); try { rec.current && rec.current.abort(); } catch {} }, []);

  const tList = target && target.kind === 'list' ? S.lists.find((l) => l.id === target.id) : null;
  const tStore = tList ? tList.store : target && target.store;
  const tLabel = tList ? withStore(tList, tList.name) : target && target.kind === 'new' && (target.store || target.day != null) ? [target.store ? storeName(target.store) : 'Nový zoznam', dayLbl(target.day)].filter(Boolean).join(' · ') : null;
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(10); } catch {} };

  const addParsed = (parsed) => {
    const now = Date.now();
    setItems((xs) => {
      let out = [...xs];
      for (const y of parsed) {
        const cw = coreWord(y.raw);
        let pid = y.pid; let unsure = null;
        if (AMBIG[cw]) { const opts = [...AMBIG[cw]].filter((k) => PRODUCTS[k]).sort((a, b) => PRODUCTS[b].h.length - PRODUCTS[a].h.length); pid = opts[0]; unsure = { word: cw, opts }; }
        const u = y.u || 'ks';
        const i = out.findIndex((x) => (pid ? x.pid === pid : !x.pid && norm(x.n) === norm(y.n)));
        if (i >= 0) {
          const o = out[i]; const nq = (o.u || 'ks') === u ? Math.round((o.q + y.q) * 1000) / 1000 : y.q;
          out[i] = { ...o, q: nq, u, bump: (o.bump || 0) + 1, fix: { from: label(o), to: fmtQty(nq, u), at: now } };
          out = [out[i], ...out.filter((_, k) => k !== i)];
        } else {
          const it = { key: nk(), pid, n: pid ? null : y.n, q: y.q, u, at: now, unsure };
          const nm = norm(base(it)); if (!unsure && cw && !nm.startsWith(cw) && !cw.startsWith(nm.split(' ')[0])) it.fix = { from: cw, to: base(it), at: now };
          out = [it, ...out];
        }
      }
      return out;
    });
    if (parsed.length) buzz();
  };

  const editSel = (text) => {
    const x = itemsRef.current.find((i) => i.key === selRef.current); if (!x) return false;
    const n = norm(text);
    if (/^(zmaz|vymaz|odstran|zrus|nechcem)/.test(n)) { setItems((xs) => xs.filter((i) => i.key !== x.key)); setSel(null); return true; }
    const strip = text.replace(/\b(nie|radšej|radsej|tak|daj|chcem|ešte|este|teda|nakoniec|prosím|prosim)\b/gi, ' ').replace(/[,.]/g, ' ').trim();
    const other = parseLocal(strip).items.find((y) => y.pid && y.pid !== x.pid && coreWord(y.raw));
    if (other) { setItems((xs) => xs.map((i) => (i.key === x.key ? { ...i, pid: other.pid, n: null, q: other.q, u: other.u || 'ks', unsure: null, fix: { from: base(x), to: base({ pid: other.pid }), at: Date.now() } } : i))); setSel(null); buzz(); return true; }
    const y = parseChunk(`${strip} ${base(x)}`);
    if (y && y.q && (y.q !== x.q || (y.u || 'ks') !== (x.u || 'ks'))) { const u = y.u || 'ks'; setItems((xs) => xs.map((i) => (i.key === x.key ? { ...i, q: y.q, u, bump: (i.bump || 0) + 1, fix: { from: label(i), to: fmtQty(y.q, u), at: Date.now() } } : i))); setSel(null); buzz(); return true; }
    setNote(`Úprave „${text}“ som nerozumel. Skúste napríklad „tri“, „pol kila“ alebo „zmaž“.`);
    return true;
  };

  const process = (text) => {
    const t = (text || '').trim(); if (!t) return;
    setNote('');
    if (selRef.current) { editSel(t); return; }
    const n = norm(t);
    if (/^(hotovo|to je vsetko|koniec)\b/.test(n)) { finish(); return; }
    const del = n.match(/^(zmaz|vymaz|odstran|zrus)\s+(.+)$/);
    if (del) {
      const w = del[2].split(' ').filter((x) => x.length > 2);
      const xs = itemsRef.current;
      const hit = /^(posledn|to\b)/.test(del[2]) ? xs[0] : xs.find((x) => w.some((ww) => norm(base(x)).split(' ').some((bw) => bw.startsWith(ww.slice(0, 4)))));
      if (hit) { setItems((ys) => ys.filter((x) => x.key !== hit.key)); buzz(); } else setNote(`„${del[2]}“ v zozname nie je.`);
      return;
    }
    const pt = pullTarget(t, lists);
    if (pt.listId) setTarget({ kind: 'list', id: pt.listId });
    else if (pt.store || pt.day != null) setTarget((tg) => (tg && tg.kind === 'list' ? tg : { kind: 'new', store: pt.store || (tg && tg.store) || null, day: pt.day != null ? pt.day : tg && tg.day != null ? tg.day : 1 }));
    const res = pt.rest ? parseLocal(pt.rest) : { items: [] };
    const its = (res.items || []).filter((y) => y.pid || (y.n && y.n.length > 1));
    if (!its.length && pt.rest) setNote(`„${pt.rest}“ som nerozumel. Skúste to inak alebo napíšte.`);
    addParsed(its);
  };
  const processRef = useRef(process); processRef.current = process;

  // ukážka diktovania (v prototype mikrofón nie je): slová sa objavujú v bubline „Počujem“
  const simulate = (text) => {
    clearInterval(typer.current); setPhase('listening'); setKbd(false); setRestored(false);
    const ws = text.split(' '); let i = 0; setTr('');
    typer.current = setInterval(() => { i++; setTr(ws.slice(0, i).join(' ')); if (i >= ws.length) { clearInterval(typer.current); setTimeout(() => { processRef.current(text); setTr(''); }, 420); } }, 120);
  };
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const startMic = () => {
    setPhase('listening');
    if (!SR) { setKbd(true); setNote('Mikrofón tu nie je dostupný. Diktujte cez mikrofón na klávesnici alebo vyskúšajte príklad.'); setTimeout(() => inp.current && inp.current.focus(), 0); return; }
    try {
      const r = new SR(); r.lang = 'sk-SK'; r.interimResults = true; r.continuous = true;
      r.onresult = (e) => { let interim = ''; for (let k = e.resultIndex; k < e.results.length; k++) { const x = e.results[k]; if (x.isFinal) { processRef.current(x[0].transcript); setTr(''); } else interim += x[0].transcript; } setTr(interim); };
      r.onerror = () => { setKbd(true); setNote('Mikrofón tu nie je povolený. Diktujte cez mikrofón na klávesnici alebo vyskúšajte príklad.'); };
      r.onend = () => { if (rec.current === r && phaseRef.current === 'listening') { try { r.start(); } catch {} } };
      r.start(); rec.current = r;
    } catch { setKbd(true); }
  };
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const toggleMic = () => { if (phase === 'listening') { setPhase('paused'); try { rec.current && rec.current.stop(); } catch {} rec.current = null; } else startMic(); };
  useEffect(() => { if (SR) startMic(); }, []);

  // ---------- uloženie ----------
  const commit = (tg) => {
    const its = itemsRef.current; if (!its.length) return;
    const snapshot = S.lists; const keep = { items: its, target: tg };
    const payload = its.map((x) => (x.pid ? { pid: x.pid, q: x.q, u: x.u || 'ks' } : { n: x.n, q: x.q, u: x.u || 'ks' }));
    let id = tg.kind === 'list' ? tg.id : null; let name;
    if (tg.kind === 'list') { name = (S.lists.find((l) => l.id === id) || {}).name; }
    else {
      const when = addDays(new Date(), tg.day != null ? tg.day : 1); when.setHours(17, 0, 0, 0);
      name = tg.store ? storeName(tg.store) : 'Nákup';
      const nl = { id: Math.random().toString(36).slice(2, 9), name, store: tg.store || null, when: when.toISOString(), shared: tg.mine ? ['m'] : ['m', 'l'], items: [] };
      id = nl.id; act((s) => ({ ...s, lists: [...s.lists.filter((x) => !x.live), nl, ...s.lists.filter((x) => x.live)] }));
    }
    act('addItems', id, payload); act('patchList', id, { hl: Date.now() });
    act((s) => ({ ...s, voiceDraft: null }));
    setItems([]); closeModal();
    setTimeout(() => jump('lists', null, {}, 'fly'), 260);
    toast(`${plural(payload.length, 'položka', 'položky', 'položiek')} v „${name}“`, { icon: 'check-circle', action: { label: 'Späť', fn: () => act((s) => ({ ...s, lists: snapshot, voiceDraft: keep })) } });
  };
  const finish = () => {
    setSel(null);
    const tg = target;
    if (!itemsRef.current.length) { setNote('Zatiaľ tu nie je nič na uloženie.'); return; }
    if (tg && (tg.kind === 'list' || tg.store)) commit(tg); else setPanel('done');
  };

  const selItem = items.find((x) => x.key === sel);
  const pick = (key, pid) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, pid, unsure: { ...x.unsure, picked: true }, fix: null } : x)));
  const exList = sel ? ['Radšej kilo', 'Tri', 'Zmaž'] : items.length ? EX_MORE : EX_START;
  const nextEx = exList[exI % exList.length];

  return (
    <div className={'vx' + (g ? ' g2' : '')}>
      {g && <div className="bgl"><div className="bgb pic-kari_p" /><div className="veil" /><div className="veil" /></div>}
      <div className="vx-top">
        <IB n="x" cls="vx-ib" label="Zavrieť (položky ostanú uložené)" onClick={() => { closeModal(); if (items.length) toast('Rozdiktované položky ostali uložené', { icon: 'check-circle' }); }} />
        <button type="button" className="vx-target" onClick={() => setPanel('pick')} aria-label="Kam pridávať">Do: {tLabel ? <b>{tLabel}</b> : <em>nový zoznam</em>}<I n="caret-down" w="bold" /></button>
      </div>
      {restored && items.length > 0 && <div className="vx-rest"><I n="arrow-counter-clockwise" w="bold" /><span className="grow">Pokračujete v rozdiktovanom zozname ({items.length})</span><button type="button" onClick={() => { setItems([]); setTarget(p.listId ? { kind: 'list', id: p.listId } : null); setRestored(false); }}>Začať odznova</button></div>}
      <div className="vx-list" onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
        {!items.length ? (
          <div className="vx-empty">
            <b>Hovorte, čo kúpiť</b>
            <span>Napríklad: „dve mlieka, chlieb a pol kila mletého mäsa do Lidla“</span>
            <div className="vx-ex">{EX_START.map((x) => <button type="button" key={x} onClick={() => simulate(x)}>{x}</button>)}</div>
          </div>
        ) : <>
          <div className="vx-cnt">{plural(items.length, 'položka', 'položky', 'položiek')} · ťuknutím upravíte</div>
          {items.map((x) => {
            const e = estimate(x, S, tStore);
            return (
              <div key={x.key} role="button" tabIndex={0} className={'vxi' + (sel === x.key ? ' sel' : '') + (x.unsure && !x.unsure.picked ? ' unsure' : '')}
                style={x.bump ? { animation: (x.bump % 2 ? 'vxbumpA' : 'vxbumpB') + ' .55s cubic-bezier(.3,1.5,.5,1)' } : undefined}
                onClick={() => { setSel(sel === x.key ? null : x.key); setNote(''); }} onKeyDown={(ev) => ev.key === 'Enter' && setSel(sel === x.key ? null : x.key)}>
                <span className="th"><E k={pe(x.pid)} /></span>
                <div className="grow">
                  <b>{base(x)}{x.unsure && !x.unsure.picked ? '?' : ''}</b>
                  {x.unsure && !x.unsure.picked ? <div className="vx-opts">{x.unsure.opts.map((k) => <button type="button" key={k} className={k === x.pid ? 'on' : ''} onClick={(ev) => { ev.stopPropagation(); pick(x.key, k); }}>{PRODUCTS[k].n.replace(/ ·.*$/, '')}</button>)}</div>
                    : x.fix && Date.now() - x.fix.at < 3000 ? <small key={x.fix.at} className="vx-fix"><s>{x.fix.from}</s> → {x.fix.to}</small>
                    : e ? <small>~{eur(e.v)}</small> : null}
                </div>
                <span className="q">{label(x)}</span>
              </div>
            );
          })}
        </>}
      </div>
      <div className="vx-bot">
        {selItem && <div className="vx-qq">{((selItem.u || 'ks') === 'kg' ? [.25, .5, 1, 2] : selItem.u === 'l' ? [.5, 1, 2, 3] : [1, 2, 3, 6]).map((q) => <button type="button" key={q} className={Math.abs(selItem.q - q) < .001 ? 'on' : ''} onClick={() => { setItems((xs) => xs.map((i) => (i.key === sel ? { ...i, q, bump: (i.bump || 0) + 1, fix: { from: label(i), to: fmtQty(q, i.u || 'ks'), at: Date.now() } } : i))); setSel(null); }}>{fmtQty(q, selItem.u || 'ks')}</button>)}</div>}
        <div className={'vx-heard' + (selItem ? ' edit' : '')} aria-live="polite">
          <small>{selItem ? `Upravujem: ${base(selItem)}` : tr ? 'Počujem' : phase === 'listening' ? 'Počúvam' : 'Pozastavené'}</small>
          {tr ? <span>{tr}<i>…</i></span> : selItem ? <span className="dim">Povedzte napr. „radšej kilo“ alebo „zmaž“</span> : phase === 'listening' ? <span className="wave"><i /><i /><i /><i /><i /></span> : <span className="dim">Ťuknite na guľu a hovorte ďalej</span>}
          {note && <p className="vx-note"><I n="warning-circle" />{note}</p>}
        </div>
        {kbd && <form className="vx-kbd" onSubmit={(e) => { e.preventDefault(); const v = txt.trim(); if (v) { process(v); setTxt(''); } }}><input ref={inp} id="voice-talk-text" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={selItem ? 'Napr. „tri“ alebo „zmaž“' : 'Napr. „2 mlieka a chlieb“'} autoComplete="off" enterKeyHint="send" aria-label="Napísať položky" /><button type="submit" disabled={!txt.trim()} aria-label="Pridať"><I n="arrow-up" w="bold" /></button></form>}
        <button type="button" className="vx-try" onClick={() => { setExI((i) => i + 1); simulate(nextEx); }}>Vyskúšať: „{nextEx}“</button>
        <div className="vx-ctrl">
          {selItem ? <button type="button" className="vx-side" onClick={() => setSel(null)}>Zrušiť<br />úpravu</button>
            : <button type="button" className={'vx-side' + (kbd ? ' on' : '')} onClick={() => { setKbd(!kbd); setTimeout(() => inp.current && inp.current.focus(), 0); }}><I n="keyboard" />Písať</button>}
          <button type="button" className={'vx-orb' + (phase === 'listening' ? ' on' : '') + (selItem ? ' edit' : '')} onClick={toggleMic} aria-label={phase === 'listening' ? 'Pozastaviť počúvanie' : 'Počúvať'} />
          {selItem ? <button type="button" className="vx-side dng" onClick={() => { setItems((xs) => xs.filter((i) => i.key !== sel)); setSel(null); }}><I n="trash" />Zmazať</button>
            : <button type="button" className="vx-done" onClick={finish} disabled={!items.length}>Hotovo</button>}
        </div>
      </div>
      {panel && <WherePanel mode={panel} n={items.length} target={target} lists={lists} onClose={() => setPanel(null)}
        onPick={(tg) => { setTarget(tg); setPanel(null); }} onCommit={(tg) => { setTarget(tg); setPanel(null); commit(tg); }} />}
    </div>
  );
}

// „Kam pridať?“ – existujúce zoznamy navrchu, pod nimi nový zoznam (obchod, deň, kto ho uvidí)
function WherePanel({ mode, n, target, lists, onClose, onPick, onCommit }) {
  const { S } = useApp();
  const [c, setC] = useState(() => target || { kind: 'list', id: (lists[0] || {}).id });
  const stores = frequentStores(S, 6);
  const sorted = [...lists].sort((a, b) => ((b.store && b.store === c.store) - (a.store && a.store === c.store)) || new Date(a.when) - new Date(b.when));
  const isNew = c.kind === 'new';
  const newC = (patch) => setC((x) => ({ kind: 'new', store: x.kind === 'new' ? x.store : null, day: x.kind === 'new' && x.day != null ? x.day : 1, mine: x.kind === 'new' ? x.mine : false, ...patch }));
  const L = !isNew && lists.find((l) => l.id === c.id);
  const btn = mode === 'pick' ? 'Hotovo' : isNew ? `Vytvoriť „${c.store ? storeName(c.store) : 'Nákup'}“ a pridať` : `Pridať do „${L ? L.name : ''}“`;
  return (
    <div className="vx-panel" role="dialog" aria-label="Kam pridať">
      <div className="vx-scrim" onClick={onClose} />
      <div className="vx-sheet">
        <span className="grab" onClick={onClose} />
        <h2>{mode === 'done' ? `Kam pridať ${plural(n, 'položku', 'položky', 'položiek')}?` : 'Kam pridávať?'}</h2>
        <span className="k">Do existujúceho zoznamu</span>
        <div className="vx-lists">{sorted.map((l) => (
          <button type="button" key={l.id} className={'vx-opt' + (!isNew && c.id === l.id ? ' on' : '')} onClick={() => setC({ kind: 'list', id: l.id })}>
            <span className="grow"><b>{l.name}</b><small>{withStore(l, new Date(l.when).toLocaleDateString('sk-SK', { weekday: 'long' }))} · {plural(l.items.filter((i) => !i.done).length, 'položka', 'položky', 'položiek')}</small></span>
            {!isNew && c.id === l.id && <I n="check-circle" />}
          </button>
        ))}</div>
        <span className="k">Alebo nový zoznam</span>
        <div className={'vx-new' + (isNew ? ' on' : '')}>
          <div className="vx-stores">{stores.map(({ k }) => <button type="button" key={k} className={isNew && c.store === k ? 'on' : ''} onClick={() => newC({ store: isNew && c.store === k ? null : k })}><StoreTile k={k} s={22} />{storeName(k)}</button>)}</div>
          <div className="vx-days">{[0, 1, 2].map((d) => <button type="button" key={d} className={isNew && c.day === d ? 'on' : ''} onClick={() => newC({ day: d })}>{d === 0 ? 'Dnes' : d === 1 ? 'Zajtra' : 'Pozajtra'}</button>)}
</div>
          <div className="vx-days"><span className="vx-who">Uvidí ho</span><button type="button" className={isNew && !c.mine ? 'on' : ''} onClick={() => newC({ mine: false })}>Blahovci</button><button type="button" className={isNew && c.mine ? 'on' : ''} onClick={() => newC({ mine: true })}>Iba ja</button></div>
        </div>
        <Btn cls="pri full big" onClick={() => (mode === 'pick' ? onPick(c) : onCommit(c))} disabled={!isNew && !L}>{btn}</Btn>
      </div>
    </div>
  );
}
