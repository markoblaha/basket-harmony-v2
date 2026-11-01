import { useApp, useState, useEffect, useRef, useMemo, I, E, IB, Btn, StoreTile, pe, Stepper } from './ui.jsx';
import { PRODUCTS, RECIPES } from './data.js';
import { plural, parseLocal, matchProduct, toItemQty, estimate, unitPrice, eur, fmtQty, qtyOptions, storeName, relDay, recipeById, norm, splitChunks, parseChunk } from './logic.js';
import { aiParseVoice, aiRecipeFromText, aiErrorText } from './ai.js';
import { nextOpenList } from './store.js';
import { VoiceTalk } from './voicetalk.jsx';

/* icons: microphone keyboard x check caret-down arrow-up sparkle receipt cooking-pot stop warning-circle */

const SEARCH_EX = ['Niečo rýchle s kuracím', 'Polievka z toho, čo mám doma', 'Sladké raňajky pre deti'];
const EXAMPLES = [
  'Dve mlieka, rožky šesť kusov a kuracie prsia',
  'Pol kila mletého mäsa, kyslú smotanu a šesť pív',
  'Niečo na palacinky',
];
const RECIPE_EXAMPLE = 'Babkin perkelt: kilo bravčového pliecka, štyri cibule, dve lyžice mletej papriky, lyžica pretlaku. Cibuľu opražím, pridám mäso, papriku a podlejem vodou. Dusím hodinu a pol, nakoniec dochutím soľou.';
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function fromAI(x) {
  const p = x.id && PRODUCTS[x.id] ? PRODUCTS[x.id] : x.name ? matchProduct(x.name) : null;
  const { q, u } = toItemQty(x.qty, x.unit === 'bal' ? 'ks' : x.unit); // bez jednotky = počet kusov
  if (!p) return x.name ? { pid: null, n: cap(x.name), q, u } : null;
  return { pid: p.id, q, u };
}
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);

// Diktovanie do nákupu má vlastnú obrazovku (voicetalk.jsx); tu ostáva hľadanie receptu a diktovanie receptu.
export function Voice({ p }) { return (p.mode || 'talk') === 'talk' ? <VoiceTalk p={p} /> : <VoiceOther p={p} />; }
function VoiceOther({ p }) {
  const { S, act, closeModal, theme, toast, jump, modal, push, ai } = useApp();
  const g = theme === 'g';
  const lists = S.lists.filter((l) => !l.live);
  const [target, setTarget] = useState(() => p.listId || (nextOpenList(S) || lists[0]).id);
  const [mode, setMode] = useState(p.mode || 'talk');
  const [phase, setPhase] = useState('idle'); // idle | listening | thinking | result
  const [tr, setTr] = useState('');
  const [items, setItems] = useState([]);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [kbd, setKbd] = useState(false);
  const [sel, setSel] = useState(null);
  const [intent, setIntent] = useState(null);
  const inp = useRef(null);
  const rec = useRef(null);
  const typer = useRef(null);
  const list = S.lists.find((l) => l.id === target) || lists[0];
  useEffect(() => () => { clearInterval(typer.current); try { rec.current && rec.current.abort(); } catch {} }, []);

  const process = async (text) => {
    const tx = text.trim(); if (!tx) { setPhase('idle'); return; }
    if (mode === 'search') { act((s) => ({ ...s, recipeQuery: { q: tx, k: Math.random() } })); closeModal(); return; }
    setPhase('thinking'); setNote(''); setReply('');
    let res = null;
    if (ai) {
      try {
        const r = await withTimeout(aiParseVoice(tx), 20000);
        if (r && r.intent) res = { intent: r.intent === 'recipe_add' && r.recipe ? 'recipe_add:' + r.recipe : r.intent, items: (r.items || []).map(fromAI).filter(Boolean), say: r.say, query: r.query, ai: true };
      } catch (e) { setNote(aiErrorText(e)); }
    }
    if (!res) res = parseLocal(tx);
    if (res.intent === 'recipe_search') {
      setIntent({ type: 'search', q: res.query || tx });
      setReply(res.say || 'Pozriem recepty, ktoré sa hodia.');
      setItems([]); setPhase('result'); return;
    }
    if (res.intent && res.intent.startsWith('recipe_add:')) {
      const r = recipeById(res.intent.split(':')[1], S);
      if (r) {
        const grp = { rid: r.id, label: `Na ${r.n.charAt(0).toLowerCase() + r.n.slice(1)}` };
        const miss = r.ing.filter((x) => !x[3] && !S.have.includes(x[0]) && PRODUCTS[x[0]]).map(([pid, use]) => ({ key: Math.random(), pid, q: Math.max(PRODUCTS[pid].u === 'kg' ? .1 : 1, PRODUCTS[pid].u === 'kg' ? Math.round(use * 20) / 20 : Math.ceil(use - .001)), u: PRODUCTS[pid].u === 'kg' || PRODUCTS[pid].u === 'l' ? PRODUCTS[pid].u : 'ks', grp }));
        setIntent({ type: 'recipe', r });
        setReply(res.say || (miss.length ? `${r.n}: doma chýba ${plural(miss.length, 'surovina', 'suroviny', 'surovín')}.` : `${r.n}: všetko máte doma.`));
        setItems(miss); setPhase('result'); return;
      }
    }
    setIntent(null);
    const its = res.items.map((x) => ({ ...x, key: Math.random() }));
    setItems(its);
    setReply(res.say || (its.length ? 'Rozumiem, toto pridám.' : 'Nerozumel som – skúste to inak.'));
    setPhase('result');
  };

  const simulate = (text) => {
    clearInterval(typer.current); try { rec.current && rec.current.abort(); } catch {}
    setMode('talk'); setKbd(false); setItems([]); setReply(''); setNote(''); setPhase('listening'); setTr('');
    let i = 0;
    typer.current = setInterval(() => { i += 2; setTr(text.slice(0, i)); if (i >= text.length) { clearInterval(typer.current); setTimeout(() => process(text), 350); } }, 45);
  };
  const startMic = () => {
    setItems([]); setReply(''); setNote(''); setTr('');
    if (SR) {
      try {
        const r = new SR(); r.lang = 'sk-SK'; r.interimResults = true; r.continuous = false;
        let final = '';
        r.onresult = (e) => { let s = ''; for (const x of e.results) s += x[0].transcript; final = s; setTr(s); };
        r.onerror = (e) => { setPhase('idle'); setKbd(true); setNote('Mikrofón tu nie je povolený. Ťuknite do poľa a diktujte cez mikrofón na klávesnici – alebo vyskúšajte príklad.'); };
        r.onend = () => { if (final) process(final); };
        r.start(); rec.current = r; setPhase('listening'); return;
      } catch {}
    }
    setKbd(true); setPhase('idle');
    setNote('Diktujte cez mikrofón na klávesnici telefónu, alebo vyskúšajte príklad.');
    setTimeout(() => inp.current && inp.current.focus(), 0);
  };
  const stop = () => { try { rec.current && rec.current.stop(); } catch {} if (phase === 'listening' && tr) process(tr); else setPhase('idle'); };

  const setQ = (key, q) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, q, ask: false } : x)));
  const remove = (key) => setItems((xs) => xs.filter((x) => x.key !== key));
  const total = items.reduce((a, x) => { const e = estimate(x, S, list.store); return a + (e ? e.v : 0); }, 0);
  const ready = items.length > 0;
  const confirm = () => {
    act('addItems', list.id, items.map((x) => (x.pid ? { pid: x.pid, q: x.q, u: x.u, grp: x.grp } : { n: x.n, q: x.q, u: x.u })));
    if (intent && intent.type === 'recipe') act((s) => s);
    closeModal();
    toast(`Pridané do zoznamu ${list.name}: ${items.length}`, { action: { label: 'Zobraziť', fn: () => jump('lists', 'list', { id: list.id }) } });
  };
  const toRecipes = () => { act((s) => ({ ...s, recipeQuery: { q: intent.q, k: Math.random() } })); jump('recipes'); };
  const cycle = () => { const i = lists.findIndex((l) => l.id === target); setTarget(lists[(i + 1) % lists.length].id); };

  const itemRows = items.map((x) => {
    const pp = x.pid && PRODUCTS[x.pid]; const e = estimate(x, S, list.store); const xu = x.u || 'ks';
    if (g) return (
      <span key={x.key} className="chipg glass2" onClick={() => setSel(sel === x.key ? null : x.key)}>
        <span className="et"><E k={pe(x.pid)} /></span>{pp ? pp.n.replace(/ ·.*$/, '').replace(/ polotučné/, '') : x.n} <em>{fmtQty(x.q, xu)}</em>
        {<span className="okk"><I n="check" w="bold" /></span>}
      </span>
    );
    return (
      <div key={x.key} className="row vrow">
        <span className="th"><E k={pe(x.pid)} /></span>
        <div className="tx"><b>{pp ? pp.n : x.n}</b><span className="sub">{fmtQty(x.q, xu) + (e ? ' · ~' + eur(e.v) : '')}</span></div>
        {sel === x.key ? <Stepper q={x.q} u={xu} onChange={(q) => setQ(x.key, q)} /> : <button type="button" className="ok" onClick={() => setSel(x.key)} aria-label="Upraviť množstvo"><I n="check" w="bold" /></button>}
        <button type="button" className="rm" onClick={() => remove(x.key)} aria-label="Odstrániť"><I n="x" w="bold" /></button>
      </div>
    );
  });
  const askItem = g && items.find((x) => x.key === sel);

  const kbdField = (
    <form className={'field vfield' + (g ? ' glass2' : '')} onSubmit={(e) => { e.preventDefault(); const v = tr.trim(); if (v) process(v); }}>
      <input ref={inp} id="voice-text" value={tr} onChange={(e) => { setTr(e.target.value); if (phase === 'result') setPhase('idle'); }} placeholder={mode === 'type' ? 'Napíšte, napr. „2 l mlieka a chlieb“' : 'Diktujte alebo napíšte…'} autoComplete="off" enterKeyHint="send" aria-label="Text pre asistenta" />
      <button type="submit" className="m" aria-label="Spracovať" disabled={!tr.trim()}><I n="arrow-up" w="bold" /></button>
    </form>
  );

  const talk = (
    <>
      {g ? <div className={'orb' + (phase === 'listening' ? ' on' : phase === 'thinking' ? ' think' : '')} onClick={phase === 'listening' ? stop : startMic} role="button" aria-label={phase === 'listening' ? 'Zastaviť' : 'Hovoriť'} />
        : <button type="button" className={'mic' + (phase === 'listening' ? ' on' : phase === 'thinking' ? ' think' : '')} onClick={phase === 'listening' ? stop : startMic} aria-label={phase === 'listening' ? 'Zastaviť' : 'Hovoriť'}><I n={phase === 'listening' ? 'stop' : 'microphone'} /></button>}
      {tr && phase !== 'idle' ? <div className={g ? 'vtx' : 'quote'}>„{tr}{phase === 'listening' ? <i>…</i> : ''}“</div>
        : phase === 'idle' && <div className={g ? 'vtx sm' : 'vhint'}>{mode === 'search' ? 'Ťuknite na mikrofón a povedzte, na čo máte chuť' : 'Ťuknite na mikrofón a povedzte, čo kúpiť'}</div>}
      {phase === 'thinking' && <div className="think-l"><span /><span /><span />{ai ? 'Rozumiem vete…' : 'Spracúvam…'}</div>}
      {phase === 'result' && reply && <div className="reply"><I n="sparkle" />{reply}</div>}
      {note && <div className="vnote"><I n="info" />{note}</div>}
      {phase === 'result' && items.length > 0 && (g ? <div className="chipsg">{itemRows}</div> : <div className="lst vl">{itemRows}</div>)}
      {g && askItem && <div className="qtyg">{((askItem.u || 'ks') === 'kg' ? [.25, .5, 1, 2] : askItem.u === 'l' ? [.5, 1, 2, 3] : [1, 2, 3, 6]).map((q) => <button type="button" key={q} className={Math.abs(askItem.q - q) < .001 ? 'on' : 'glass2'} onClick={() => { setQ(askItem.key, q); setSel(null); }}>{fmtQty(q, askItem.u || 'ks')}</button>)}</div>}
      {phase === 'result' && intent && intent.type === 'search' && <Btn cls={'pri' + (g ? ' a' : '')} onClick={toRecipes}><I n="cooking-pot" />Ukázať recepty</Btn>}
      {(phase === 'idle' || (phase === 'result' && !items.length && !intent)) && (
        <div className="examples"><span className="k">Alebo vyskúšajte príklad</span>{(mode === 'search' ? SEARCH_EX : EXAMPLES).map((x) => <button type="button" key={x} className={g ? 'glass2' : ''} onClick={() => simulate(x)}><I n="microphone" />{x}</button>)}</div>
      )}
      {(kbd || mode === 'type') && kbdField}
    </>
  );

  const [rtxt, setRtxt] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const saveRecipe = async () => {
    const tx = rtxt.trim(); if (!tx) return;
    setRbusy(true);
    let r = null;
    if (ai) { try { r = await withTimeout(aiRecipeFromText(tx), 40000); } catch (e) { setNote(aiErrorText(e)); } }
    if (!r || !r.n) r = localRecipe(tx);
    const id = 'ai' + Math.random().toString(36).slice(2, 7);
    const rec2 = { id, n: r.n, e: r.e || 'pot', bg: 'peach', min: r.min || 45, kcal: r.kcal || 500, por: r.por || 4, src: 'Nadiktovaný', diff: 'vlastný recept', tags: [r.tag || 'vlastné'], ai: true,
      ing: (r.ing || []).map((x) => [x.id && PRODUCTS[x.id] ? x.id : (matchProduct(x.name || '') || {}).id || null, x.use || 1, x.label || '', 0, x.name]).filter((x) => x[0]),
      steps: (r.steps && r.steps.length ? r.steps : [{ t: 'Postup nebol uvedený.', min: 0 }]).map((s) => [s.t || s, s.min || 0]) };
    act((s) => ({ ...s, aiRecipes: [rec2, ...s.aiRecipes] }));
    setRbusy(false); closeModal();
    setTimeout(() => { jump('recipes', 'recipe', { id }); toast('Recept uložený medzi vaše recepty'); }, 50);
  };
  const recipeMode = (
    <div className="rdict">
      <p className="meta">Nadiktujte recept vlastnými slovami (cez mikrofón na klávesnici) alebo ho sem vložte. {ai ? 'AI z neho spraví suroviny a postup.' : 'Suroviny sa rozpoznajú v telefóne.'}</p>
      <textarea id="recipe-text" value={rtxt} onChange={(e) => setRtxt(e.target.value)} placeholder="Napr. „Babkin perkelt: kilo pliecka, štyri cibule…“" rows={5} />
      <div className="rowc"><button type="button" className="chip plain" onClick={() => setRtxt(RECIPE_EXAMPLE)}><I n="sparkle" />Vložiť príklad</button><span className="grow" /><Btn cls={'pri sm' + (g ? ' a' : '')} onClick={saveRecipe} disabled={!rtxt.trim() || rbusy}>{rbusy ? 'Spracúvam…' : 'Uložiť recept'}</Btn></div>
      {note && <div className="vnote"><I n="info" />{note}</div>}
    </div>
  );

  const foot = mode === 'talk' && (
    <div className="vfoot">
      {!g && <button type="button" className="target" onClick={cycle}>Do: <b>{list.name} · {storeName(list.store)}</b><I n="caret-down" w="bold" /></button>}
      <Btn cls={'pri grow'} onClick={confirm} disabled={!ready}>{items.length ? `Pridať ${items.length}${total ? ' · ~' + eur(total) : ''}` : 'Pridať'}</Btn>
    </div>
  );

  const title = mode === 'search' ? 'Nájsť recept hlasom' : mode === 'recipe' ? 'Nadiktovať recept' : 'Nadiktovať do nákupu';
  const kbBtn = mode !== 'recipe' && <button type="button" className={'kbt' + (kbd ? ' on' : '')} onClick={() => { setKbd(!kbd); setTimeout(() => inp.current && inp.current.focus(), 0); }}><I n="keyboard" />{kbd ? 'Skryť klávesnicu' : 'Písať namiesto hovorenia'}</button>;

  if (g) return (
    <div className="vwrap vg">
      <div className="bgl"><div className="bgb pic-kari_p" /><div className="veil" /><div className="veil" /></div>
      <header className="nb"><IB n="x" cls="glass2" label="Zavrieť" onClick={closeModal} /><span className="nbt sh">{title}</span><span className="ibs" /></header>
      {mode === 'talk' && <button type="button" className="pb gl sm tgt" onClick={cycle}>Do zoznamu: {list.name}<I n="caret-down" w="bold" /></button>}
      <div className="vbody">{mode === 'recipe' ? recipeMode : <>{talk}{kbBtn}</>}</div>
      {foot}
    </div>
  );
  return (
    <div className="vwrap vw">
      <div className="scrim" onClick={closeModal} />
      <div className="vsheet">
        <div className="grab" onClick={closeModal} />
        <div className="vhead"><h2>{title}</h2><IB n="x" cls="flat sm" label="Zavrieť" onClick={closeModal} /></div>
        <div className="vbody">{mode === 'recipe' ? recipeMode : <>{talk}{kbBtn}</>}</div>
        {foot}
      </div>
    </div>
  );
}

// Jednoduché rozpoznanie receptu bez AI: prvý riadok = názov, vety s množstvom = suroviny, ostatné = postup.
function localRecipe(tx) {
  const [head, ...rest] = tx.split(/:\s*/);
  const body = rest.join(': ') || tx;
  const sentences = body.split(/(?<=\.)\s+/);
  const ingS = sentences[0] || '';
  const ing = splitChunks(ingS).map(parseChunk).filter((x) => x && x.pid).map((x) => ({ id: x.pid, use: x.q, label: x.raw }));
  const steps = sentences.slice(1).filter((s) => s.trim().length > 3).map((s) => ({ t: s.trim(), min: /hodin/.test(s) ? 90 : 0 }));
  return { n: cap((rest.length ? head : 'Môj recept').trim()), e: 'pot', min: 60, kcal: 500, por: 4, tag: 'vlastné', ing, steps: steps.length ? steps : [{ t: body, min: 0 }] };
}
