import { useApp, useState, useEffect, useRef, useMemo, Fragment, I, E, IB, Btn, StoreTile, pe, Sheet, Stepper, Check, Empty, useInterval, Toggle } from './ui.jsx';
import { PRODUCTS, RECIPES } from './data.js';
import { plural, allRecipes, recipeById, recipeCost, haveCount, eur, unitPrice, buyQty, fmtQty, storeName, dkey, addDays, dayName, dayShort, relDay, norm, matchProduct } from './logic.js';
import { aiRecipes, aiRecipeFromImage, aiErrorText } from './ai.js';
import { nextOpenList } from './store.js';
import { hasHome } from './logic.js';
import { StepBoxes, scaleLabel } from './book.jsx';
/* icons: x list timer pause check caret-left caret-right play plus camera link microphone warning-circle check-circle */

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function Cook({ p }) {
  const { S, act, closeModal, theme, toast } = useApp();
  const g = theme === 'g';
  const r = recipeById(p.id, S);
  const [i, setI] = useState(0);
  const [timers, setTimers] = useState({});
  const [, setTick] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const fired = useRef({});
  useInterval(() => {
    setTick((t) => t + 1);
    for (const [k, end] of Object.entries(timers)) if (end && Date.now() >= end && !fired.current[k]) { fired.current[k] = true; toast(`Krok ${+k + 1}: čas vypršal`, { icon: 'timer', ms: 6000 }); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {} }
  }, Object.keys(timers).length ? 1000 : 0);
  useEffect(() => { let l; (async () => { try { l = await navigator.wakeLock.request('screen'); } catch {} })(); return () => { try { l && l.release(); } catch {} }; }, []);
  if (!r) return null;
  const steps = r.steps.length ? r.steps : [['Postup nebol uvedený.', 0]];
  const st = steps[Math.min(i, steps.length - 1)];
  const end = timers[i];
  const left = end ? Math.max(0, (end - Date.now()) / 1000) : null;
  const running = Object.entries(timers).filter(([k, e]) => e && e > Date.now() && +k !== i);
  const por = p.por || r.por;
  const done = () => { act((s) => ({ ...s, cooked: { ...s.cooked, [r.id]: Date.now() } })); closeModal(); toast('Dobrú chuť! Recept je v histórii varenia.', { e: 'party' }); };
  return (
    <div className="scr cook">
      {g && r.pic && <div className="bgl"><div className={'bgb pic-' + r.pic} /><div className="veil dk" /></div>}
      <header className="nb"><IB n="x" label="Ukončiť varenie" cls={g ? 'glass2' : ''} onClick={closeModal} /><span className="nbt sh">Krok {i + 1} z {r.steps.length}</span><IB n="list" label="Suroviny" cls={g ? 'glass2' : ''} onClick={() => setShowIng(!showIng)} /></header>
      <div className="dots">{r.steps.map((_, k) => <i key={k} className={k < i ? 'd' : k === i ? 'c' : ''} />)}</div>
      {running.map(([k, e]) => <button type="button" key={k} className="runt" onClick={() => setI(+k)}><I n="timer" />Krok {+k + 1} · {mmss((e - Date.now()) / 1000)}</button>)}
      <div className="cbody">
        {showIng ? (
          r.groups ? <div className="cgroups">{r.groups.map((gr, gi) => <div key={gi} className={'lst' + (g ? ' glass2' : '')}><div className="cgh">{gr.n}</div>{gr.items.map(([pid, , label, , nm], k) => <div className="row" key={k}><span className="th"><E k={PRODUCTS[pid] ? PRODUCTS[pid].e : 'water'} /></span><div className="tx"><b>{nm || (PRODUCTS[pid] ? PRODUCTS[pid].n.replace(/ ·.*$/, '') : '')}</b><span className="sub">{scaleLabel(label, por / r.por)}</span></div></div>)}</div>)}</div>
          : <div className={'lst' + (g ? ' glass2' : '')}>{r.ing.map(([pid, use, label], k) => <div className="row" key={k}><span className="th"><E k={pe(pid)} /></span><div className="tx"><b>{PRODUCTS[pid] ? PRODUCTS[pid].n.replace(/ ·.*$/, '') : ''}</b><span className="sub">{por === r.por ? label : fmtQty(Math.round(use * por / r.por * 1000) / 1000, PRODUCTS[pid].u)}</span></div></div>)}</div>
        ) : (
          <>
            <span className="stn">{i + 1}</span>
            <p className="stx">{st[0]}</p>
            {st[2] && st[2].heat && <span className="cheat"><I n="flame" />{st[2].heat}</span>}
            {st[2] && <div className="cbox"><StepBoxes x={st[2]} /></div>}
            {st[1] > 0 && (end ? (
              <button type="button" className={'timer on' + (left === 0 ? ' fin' : '')} onClick={() => setTimers((t) => ({ ...t, [i]: null }))}><I n={left === 0 ? 'check' : 'pause'} w={left === 0 ? 'bold' : 'fill'} /><b>{left === 0 ? 'Hotovo' : mmss(left)}</b><span>{left === 0 ? 'čas vypršal' : 'zastaviť'}</span></button>
            ) : (
              <button type="button" className="timer" onClick={() => { fired.current[i] = false; setTimers((t) => ({ ...t, [i]: Date.now() + st[1] * 60000 })); }}><I n="timer" /><b>{st[1]} min</b><span>spustiť časovač</span></button>
            ))}
          </>
        )}
      </div>
      <div className="cfoot">
        <Btn cls={'soft' + (g ? ' gl' : '')} onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><I n="caret-left" w="bold" />Späť</Btn>
        {i < r.steps.length - 1 ? <Btn cls={'pri grow' + (g ? ' a' : '')} onClick={() => { setShowIng(false); setI(i + 1); }}>Ďalší krok<I n="caret-right" w="bold" /></Btn>
          : <Btn cls={'pri grow' + (g ? ' a' : '')} onClick={done}><I n="check" w="bold" />Hotovo</Btn>}
      </div>
    </div>
  );
}

export function PlanSheet({ open, close, day, rid }) {
  const { S, act, toast, push } = useApp();
  const [d, setD] = useState(day || null);
  const [addIng, setAddIng] = useState(true);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => { const x = addDays(today, i); return { k: dkey(x), x, i }; });
  const cur = d && S.week[d] && recipeById(S.week[d], S);
  const target = nextOpenList(S);
  const plan = (id) => {
    const r = recipeById(id, S);
    if (addIng && target) act('addRecipe', id, target.id, r.por, d); else act('planDay', d, id);
    toast(`${r.n} – ${relDay(d)}` + (addIng && target ? ' · suroviny v zozname' : ''), { icon: 'calendar-blank' });
    close();
  };
  const list = [...allRecipes(S)].filter((r) => !r.ai || S.favorites.includes(r.id) || r.src === 'Nadiktovaný').sort((a, b) => S.favorites.includes(b.id) - S.favorites.includes(a.id));
  return (
    <Sheet open={open} onClose={close} label="Naplánovať jedlo">
      <div className="sh-head"><h2>{rid ? `Kedy: ${recipeById(rid, S).n}?` : d ? `${dayName(new Date(d))} – čo uvaríme?` : 'Naplánovať'}</h2></div>
      <div className="sh-body">
        {(rid || !day) && <div className="chips wrap">{days.map((x) => <button type="button" key={x.k} className={'chip plain' + (d === x.k ? ' on' : '')} onClick={() => setD(x.k)}>{x.i === 0 ? 'Dnes' : x.i === 1 ? 'Zajtra' : dayName(x.x)}{S.week[x.k] ? ' •' : ''}</button>)}</div>}
        {target && <div className="tgrow"><span>Chýbajúce suroviny pridať do zoznamu {target.name}</span><Toggle on={addIng} onChange={setAddIng} label="Pridať suroviny" /></div>}
        {cur && !rid && <div className="curp"><span>Naplánované: <b>{cur.n}</b></span><button type="button" className="lnk dng" onClick={() => { act('planDay', d, null); toast('Odstránené z plánu'); close(); }}>Odstrániť</button></div>}
        {rid ? <Btn cls="pri full" disabled={!d} onClick={() => plan(rid)}>Naplánovať{d ? ' na ' + relDay(d) : ''}</Btn>
          : <div className="plist">{list.map((r) => <button type="button" key={r.id} className="row tap" onClick={() => d && plan(r.id)} disabled={!d}><span className={'th bg-' + r.bg}><E k={r.e} /></span><div className="tx"><b>{r.n}</b><span className="sub">{r.min} min{S.favorites.includes(r.id) ? ' · obľúbené' : ''}</span></div><I n="plus" w="bold" cls="chev" /></button>)}</div>}
      </div>
    </Sheet>
  );
}

// Pridanie surovín receptu: kúpi sa všetko, čo v recepte nie je označené „mám doma“.
// Predvolene vznikne nový zoznam „Nákup k receptu“ (názov sa dá zmeniť); názov receptu je v bubline na karte zoznamu.
const RECIPE_LIST = 'Nákup k receptu';
export function AddRecipeSheet({ open, close, rid, por }) {
  const { S, act, toast, jump } = useApp();
  const r = recipeById(rid, S);
  const lists = S.lists.filter((l) => !l.live);
  const [lid, setLid] = useState(null); // null = nový zoznam
  const [name, setName] = useState(RECIPE_LIST);
  const [day, setDay] = useState(null);
  const L = lists.find((l) => l.id === lid);
  const k = (por || r.por) / r.por;
  const cand = r.ing.filter((x) => PRODUCTS[x[0]] && !hasHome(S, rid, x[0], x[3])).map(([pid, use]) => ({ pid, q: buyQty(pid, use * k) }));
  const today = new Date();
  const total = cand.reduce((a, x) => { const u = unitPrice(x.pid, S, L && L.store); return a + (u ? u.up * x.q : 0); }, 0);
  const title = name.trim() || RECIPE_LIST;
  const add = () => {
    const grp = { rid, label: `Na ${r.n.charAt(0).toLowerCase() + r.n.slice(1)}` + (day ? ` · ${dayName(new Date(day)).toLowerCase()}` : ''), day };
    const items = cand.map((x) => ({ pid: x.pid, q: x.q, u: PRODUCTS[x.pid].u === 'kg' || PRODUCTS[x.pid].u === 'l' ? PRODUCTS[x.pid].u : 'ks', grp }));
    let target = L;
    if (!target) {
      const when = day ? new Date(day + 'T17:00') : addDays(today, 1); if (!day) when.setHours(17, 0, 0, 0);
      target = { id: Math.random().toString(36).slice(2, 9), name: title, store: null, when: when.toISOString(), shared: ['m', 'l'], items: [] };
      const nl = target;
      act((s) => ({ ...s, lists: [...s.lists.filter((x) => !x.live), nl, ...s.lists.filter((x) => x.live)] }));
    }
    act('addItems', target.id, items);
    act('patchList', target.id, { hl: Date.now() }); // karta zoznamu sa v Nákupoch rozsvieti a chvíľu pulzuje
    if (day) act('planDay', day, rid);
    close();
    // pekne do Nákupov: obrazovka vyletí nahor a zoznam, ktorý sa zmenil, sa rozsvieti
    setTimeout(() => jump('lists', null, {}, 'fly'), 260);
    toast(L ? `${plural(items.length, 'surovina pridaná', 'suroviny pridané', 'surovín pridaných')} do zoznamu ${L.name}` : `Nový zoznam „${title}“ · ${plural(items.length, 'surovina', 'suroviny', 'surovín')}`, { action: { label: 'Otvoriť', fn: () => jump('lists', 'list', { id: target.id }) } });
  };
  return (
    <Sheet open={open} onClose={close} label="Pridať suroviny" cls="nl">
      <div className="sh-head"><span className="th lg"><E k={r.e || 'pot'} s={40} /></span><div className="grow"><h2>{r.n}</h2><div className="meta">{plural(cand.length, 'surovina', 'suroviny', 'surovín')} na kúpu · ~{eur(total)}</div></div></div>
      <div className="sh-body">
        <div><span className="k">Kam pridať</span><div className="chips wrap">
          <button type="button" className={'chip plain' + (lid === null ? ' on' : '')} onClick={() => setLid(null)}><I n="plus" w="bold" />Nový zoznam</button>
          {lists.map((l) => <button type="button" key={l.id} className={'chip plain' + (lid === l.id ? ' on' : '')} onClick={() => setLid(l.id)}>{l.name}</button>)}
        </div></div>
        {lid === null && <label className="fl"><span>Názov zoznamu</span><input id="rl-name" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && cand.length && add()} placeholder={RECIPE_LIST} enterKeyHint="done" /></label>}
        <div><span className="k">Na ktorý deň</span><div className="days">{[null, 0, 1, 2].map((i) => { const k2 = i == null ? null : dkey(addDays(today, i)); return <button type="button" key={String(i)} className={'chip plain' + (day === k2 ? ' on' : '')} onClick={() => setDay(k2)}>{i == null ? 'Bez dňa' : i === 0 ? 'Dnes' : i === 1 ? 'Zajtra' : 'Pozajtra'}</button>; })}</div></div>
        <p className="meta">Kúpi sa všetko, čo v recepte nemáte označené „mám doma“.</p>
      </div>
      <div className="sh-foot">{cand.length ? <Btn cls="pri full" onClick={add}>{L ? `Pridať do „${L.name}“` : `Vytvoriť zoznam „${title}“`}</Btn> : <Btn cls="soft full" onClick={close}>Všetko máte doma</Btn>}</div>
    </Sheet>
  );
}

export function ImportSheet({ open, close, start }) {
  const { voice, act, toast, jump, ai } = useApp();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef(null);
  const fromLink = (e) => {
    e.preventDefault();
    const host = (url.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/) || [])[1] || 'web';
    const id = 'web' + Math.random().toString(36).slice(2, 6);
    act((s) => ({ ...s, aiRecipes: [{ id, n: 'Bryndzové halušky', e: 'bowl', bg: 'sage', min: 40, kcal: 640, por: 4, src: host, diff: 'ukážka importu', tags: ['klasika'], ai: true,
      ing: [['zemiaky', 1, '1 kg'], ['muka', .3, '300 g'], ['bryndza', 2, '250 g'], ['bok', .15, '150 g slaniny']], steps: [['Zemiaky nastrúhajte najemno a zmiešajte s múkou a soľou.', 5], ['Cesto pretláčajte cez sitko do vriacej vody, varte 3 minúty.', 15], ['Na panvici opečte slaninu.', 8], ['Halušky zmiešajte s bryndzou a posypte slaninou.', 2]] }, ...s.aiRecipes] }));
    close(); setTimeout(() => { jump('recipes', 'recipe', { id }); toast('Recept z odkazu uložený (v prototype ukážka)'); }, 60);
  };
  const fromPhoto = async (f) => {
    if (!f) return;
    if (!ai) { setErr('Čítanie fotky potrebuje AI, ktorá tu nie je dostupná.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await aiRecipeFromImage([f]);
      const id = 'ph' + Math.random().toString(36).slice(2, 6);
      act((s) => ({ ...s, aiRecipes: [{ id, n: r.n, e: r.e || 'pot', bg: 'butter', min: r.min || 45, kcal: r.kcal || 500, por: r.por || 4, src: 'Z fotky', diff: r.tag || '', tags: [r.tag || 'z fotky'], ai: true, ing: (r.ing || []).map((y) => [y.id && PRODUCTS[y.id] ? y.id : (matchProduct(y.name || '') || {}).id, y.use || 1, y.label || '', 0, y.name]).filter((y) => y[0]), steps: (r.steps && r.steps.length ? r.steps : [{ t: 'Postup nebol uvedený.', min: 0 }]).map((s) => [s.t || String(s), s.min || 0]) }, ...s.aiRecipes] }));
      setBusy(false); close(); setTimeout(() => jump('recipes', 'recipe', { id }), 60);
    } catch (e) { setBusy(false); setErr(aiErrorText(e)); }
  };
  return (
    <Sheet open={open} onClose={close} label="Pridať recept">
      <div className="sh-head"><h2>Pridať recept</h2></div>
      <div className="sh-body">
        <div className="menu big">
          <button type="button" onClick={() => { close(); setTimeout(() => voice({ mode: 'recipe' }), 300); }}><E k="mic" s={34} /><span><b>Nadiktovať alebo vložiť text</b><small>Poviete recept vlastnými slovami, appka z neho spraví suroviny a postup.</small></span></button>
          <button type="button" onClick={() => file.current && file.current.click()} disabled={busy}><E k="camera" s={34} /><span><b>{busy ? 'Čítam fotku…' : 'Odfotiť z knihy alebo obrazovky'}</b><small>{ai ? 'AI prepíše recept z fotky.' : 'Potrebuje AI – tu nie je dostupná.'}</small></span></button>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => fromPhoto(e.target.files && e.target.files[0])} />
        <form className="fl row" onSubmit={fromLink}><input id="recipe-url" autoFocus={start === 'link'} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Odkaz, napr. varecha.sk/recept/…" inputMode="url" aria-label="Odkaz na recept" /><Btn type="submit" cls="pri sm" disabled={!url.trim()}>Načítať</Btn></form>
        <p className="meta sm">Odkaz v skutočnej appke načíta server. V prototype sa namiesto neho uloží ukážkový recept.</p>
        {err && <p className="vnote"><I n="warning-circle" />{err}</p>}
      </div>
    </Sheet>
  );
}
