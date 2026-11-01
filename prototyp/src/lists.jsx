import { useApp, Back, MeBtn, useState, useEffect, useRef, useMemo, Fragment, I, E, IB, Btn, StoreTile, Avatars, Av, pe, Sheet, Stepper, SwipeRow, Empty, Check, Seg } from './ui.jsx';
import { PRODUCTS, STAPLES, STORES, SHOP_STORES, CATS, MEMBERS } from './data.js';
import { HelpBtn } from './coach.jsx';
import { typoProduct, weightOf, listTotals, estimate, unitPrice, eur, eur0, rangeText, fmtQty, bump, minQty, storeName, withStore, itemUnit, frequentStores, relDay, qtyOptions, norm, parseOne, splitChunks, parseChunk, history, shortDate, recipeById, dayLower, addDays, dkey, ago } from './logic.js';
import { when } from './home.jsx';

/* icons: dots-three caret-left plus trash note-pencil arrows-left-right share-network broom pencil-simple storefront x check users magnifying-glass */

export const itemName = (i) => (i.pid && PRODUCTS[i.pid] ? PRODUCTS[i.pid].n : i.n || 'Položka');
const unitOf = itemUnit;

export function PriceLine({ it, S, store, by }) {
  const e = estimate(it, S, store);
  const parts = [];
  if (it.paid != null) parts.push(<span key="p" className="paid">{eur(it.paid)} zaplatené</span>);
  else if (!e) parts.push(<span key="n" className="noprice">bez ceny</span>);
  else {
    parts.push(<span key="v">~{eur(e.v)}{e.perKg ? <small className="pk"> · {eur(e.up)}/kg</small> : null}</span>);
    if (e.approx) parts.push(<span key="a" className="mk ap">orientačne</span>);
    else if (e.store && e.store !== store) parts.push(<span key="s" className="mk" style={{ '--sc': (STORES[e.store] || {}).c1 }}>{storeName(e.store)}</span>);
  }
  if (it.note) parts.push(<span key="no" className="note">· {it.note}</span>);
  return <span className="sub">{parts}{by && it.by !== 'm' && <Av id={it.by} s={16} />}</span>;
}

// ---------- prehľad zoznamov ----------
export function Lists() {
  const { S, push, sheet, modal, theme, jump } = useApp();
  const g = theme === 'g';
  const lists = S.lists.filter((l) => !l.live);
  const live = S.live && S.lists.find((l) => l.id === S.live.listId);
  const lt = live && listTotals(live, S);
  return (
    <>
      
      <div className="sc">
        <header className="nb"><MeBtn /><span className="nbt">Nákupy</span><div className="nbr"><HelpBtn screen="lists" /><IB n="plus" cls="addb" label="Nový zoznam" onClick={() => sheet('newList')} /></div></header>
        <div className="body">
          <h1 className="lt">Nákupy</h1>
          {live && lt.done < lt.n && (
            <button type="button" className={'card row-card tapc livemini' + (g ? ' glass2' : '')} onClick={() => modal('follow')}>
              <div className="grow"><div className="t1">Nakupuje: Lucia <span className="dot" /></div><div className="meta">{storeName(live.store)} · {lt.done} z {lt.n} v košíku</div></div><I n="caret-right" w="bold" cls="chev" />
            </button>
          )}
          {lists.map((l) => {
            const t = listTotals(l, S, true); const open = l.items.filter((i) => !i.done);
            return (
              <div role="button" tabIndex={0} key={l.id} className={'card lcard tapc' + (g ? ' glass2' : '') + (l.hl && Date.now() - l.hl < 7000 ? ' lhl' : '')} onClick={() => push('list', { id: l.id })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push('list', { id: l.id }); } }} aria-label={`${l.name}, otvoriť zoznam`}
                ref={l.hl && Date.now() - l.hl < 7000 ? (n) => n && setTimeout(() => n.scrollIntoView({ block: 'center', behavior: 'smooth' }), 450) : undefined}>
                <div className="rowc"><div className="grow"><div className="ttl tw"><span>{l.name}</span>{l.shared.length > 1 ? <Avatars ids={l.shared} sm /> : <span className="prv" role="img" aria-label="Súkromný – iba ja"><I n="lock-simple" /></span>}</div><div className="meta">{withStore(l, when(l))}</div></div><div className="ra"><div className="price">{t.priced ? '~' + eur0(t.v) : '–'}</div><div className="meta">{open.length} {open.length === 1 ? 'položka' : open.length < 5 && open.length > 0 ? 'položky' : 'položiek'}</div></div>
                  {open.length > 0 && (() => { const going = S.shopping && S.shopping.listId === l.id; return (
                    <button type="button" className={'lgo' + (going ? ' going' : '')} onClick={(e) => { e.stopPropagation(); modal('shop', { listId: l.id }); }} aria-label={going ? `Pokračovať v nákupe: ${l.name}` : `Nakupovať: ${l.name}`}>{going ? <I n="play" w="fill" /> : <I n="basket" w="fill" />}</button>
                  ); })()}</div>
                {(() => { // recepty pridané do zoznamu (skupiny „Na …“), každý raz
                  const rs = [...new Map(l.items.filter((i) => i.grp && i.grp.rid).map((i) => [i.grp.rid, i.grp])).values()];
                  if (!rs.length) return null;
                  return <div className="lrec">{rs.map((gr) => { const r = recipeById(gr.rid, S); const left = l.items.filter((i) => i.grp && i.grp.rid === gr.rid && !i.done).length; return (
                    <span key={gr.rid} className="rch"><E k={(r && r.e) || 'pot'} s={20} /><span>{r ? r.n : gr.label}{gr.day ? ` · ${dayLower(new Date(gr.day))}` : ''}</span><small>{left ? `${left} ${left === 1 ? 'surovina' : left < 5 ? 'suroviny' : 'surovín'}` : <I n="check" w="bold" />}</small></span>
                  ); })}</div>;
                })()}
                {!open.length && <div className="rowc lfoot"><span className="meta">{l.items.length ? 'Všetko kúpené' : 'Zatiaľ prázdny'}</span></div>}
              </div>
            );
          })}
          <button type="button" className={'card addcard tapc' + (g ? ' glass2' : '')} onClick={() => sheet('newList')}><span className="pl"><I n="plus" w="bold" /></span>Nový zoznam</button>
          {(S.history || []).length > 0 && <button type="button" className={'card row-card tapc histrow' + (g ? ' glass2' : '')} onClick={() => push('history')}><span className="th ic"><I n="clock-counter-clockwise" /></span><div className="grow"><div className="t1">História nákupov</div><div className="meta">{S.history.length} {S.history.length === 1 ? 'ukončený nákup' : S.history.length < 5 ? 'ukončené nákupy' : 'ukončených nákupov'}{(S.missingReceipts || []).length ? ` · ${(S.missingReceipts || []).length} bez bločku` : ''}</div></div><I n="caret-right" w="bold" cls="chev" /></button>}
        </div>
      </div>
    </>
  );
}

// ---------- vyhľadávanie produktov pri písaní ----------
function searchProducts(q, exclude) {
  const t = norm(q).replace(/\b\d+([.,]\d+)?\b|\b(x|ks|kg|g|l|ml)\b/g, '').trim();
  if (t.length < 2) return [];
  const words = t.split(' ').filter(Boolean);
  const res = [];
  for (const p of Object.values(PRODUCTS)) {
    const nn = norm(p.n); const toks = (nn + ' ' + norm(p.syn)).split(' ');
    let s = 0;
    if (nn.startsWith(t)) s = 10;
    else if (words.every((w) => toks.some((x) => x.startsWith(w)))) s = 6;
    else if (words.every((w) => toks.some((x) => x.startsWith(w.slice(0, Math.max(3, w.length - 2)))))) s = 3;
    if (s) res.push([s - (exclude.has(p.id) ? 4 : 0) - p.n.length / 100, p]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => x[1]);
}

function Composer({ list, onAdded, focus0 }) {
  const { S, act, voice, theme } = useApp();
  const g = theme === 'g';
  const [txt, setTxt] = useState('');
  const [focus, setFocus] = useState(false);
  const inp = useRef(null);
  const inList = useMemo(() => new Set(list.items.filter((i) => !i.done).map((i) => i.pid)), [list.items]);
  // Čo pridá Enter – rovnaký výsledok, aký ukazuje náhľad nad poľom
  const enter = useMemo(() => (txt.trim().length >= 2 ? splitChunks(txt.trim()).map(parseChunk).filter(Boolean) : []), [txt]);
  const enterPid = enter.length === 1 && enter[0].pid;
  // možný preklep („mlieo“ → Mlieko): Enter pridá text tak, ako je, oprava je len ponuka na ťuknutie
  const typo = useMemo(() => (enter.length === 1 && !enterPid ? typoProduct(enter[0].n) : null), [enter, enterPid]);
  const sugg = useMemo(() => { const r = searchProducts(txt, inList).filter((p) => !typo || p.id !== typo.id); return enterPid ? [PRODUCTS[enterPid], ...r.filter((p) => p.id !== enterPid)].slice(0, 6) : r.slice(0, typo ? 5 : 6); }, [txt, inList, enterPid, typo]);
  // dlaždice „istý nákup“ – ťuk = +1, po 2 s sa pridá a nahradí ďalšou
  const [pend, setPend] = useState({});
  const cnt = useRef({}); const tm = useRef({});
  useEffect(() => () => Object.values(tm.current).forEach(clearTimeout), []);
  const staples = STAPLES.filter((p) => !inList.has(p) || pend[p]).slice(0, 8);
  const tapStaple = (pid) => {
    cnt.current[pid] = (cnt.current[pid] || 0) + 1;
    setPend((p) => ({ ...p, [pid]: { n: cnt.current[pid], k: Math.random() } }));
    clearTimeout(tm.current[pid]);
    tm.current[pid] = setTimeout(() => {
      const n = cnt.current[pid]; delete cnt.current[pid];
      act('addItems', list.id, [{ pid, q: n, u: 'ks' }]);
      setPend((x) => { const y = { ...x }; delete y[pid]; return y; });
      onAdded && onAdded();
    }, 2000);
  };
  const add = (p, q, u) => { act('addItems', list.id, [{ pid: p.id, q: q || 1, u: u || 'ks' }]); setTxt(''); onAdded && onAdded(); inp.current && inp.current.focus(); };
  const submit = (e) => {
    e && e.preventDefault();
    const v = txt.trim(); if (!v) return;
    const items = enter.map((x) => (x.pid ? { pid: x.pid, q: x.q, u: x.u } : { n: x.n, q: x.q, u: x.u }));
    if (items.length) act('addItems', list.id, items);
    setTxt(''); onAdded && onAdded();
  };
  useEffect(() => { if (focus0) setTimeout(() => inp.current && inp.current.focus(), 350); }, []);
  const typing = focus && txt.trim().length >= 2;
  return (
    <div className="dock">
      {typing ? (
        <div className="bubbles" role="listbox" aria-label="Návrhy">
          {enter.length > 1 && <div className={'bub none ent' + (g ? ' glass2' : '')}><span><b>{enter.length} položky: {enter.map((x) => (x.pid ? PRODUCTS[x.pid].n.replace(/ ·.*$/, '') : x.n)).join(', ')}</b><small>Pridá Enter</small></span><kbd>Enter</kbd></div>}
          {enter.length === 1 && !enterPid && <button type="button" className={'bub ent new' + (g ? ' glass2' : '')} onPointerDown={(e) => e.preventDefault()} onClick={submit}><span className="nwi"><I n="plus" w="bold" /></span><span><b>{enter[0].n}</b><small>{fmtQty(enter[0].q, enter[0].u)} · {typo ? 'pridá sa takto' : 'nová položka'}</small></span><kbd>Enter</kbd></button>}
          {typo && <button type="button" className={'bub typo' + (g ? ' glass2' : '')} onPointerDown={(e) => e.preventDefault()} onClick={() => add(typo, enter[0].q, enter[0].u === 'ks' ? 'ks' : enter[0].u)}><E k={typo.e} s={28} /><span><b>{typo.n.replace(/ ·.*$/, '')}?</b><small>Preklep? Ťuknite pre opravu</small></span></button>}
          {sugg.map((p) => { const ent = enterPid === p.id; const q = ent ? enter[0].q : 1; const qu = ent ? enter[0].u : 'ks'; const e = estimate({ pid: p.id, q, u: qu }, S, list.store); return (
            <button type="button" key={p.id} className={'bub' + (ent ? ' ent' : '') + (g ? ' glass2' : '')} onPointerDown={(e) => e.preventDefault()} onClick={() => add(p, q, qu)}><E k={p.e} s={28} /><span><b>{p.n.replace(/ ·.*$/, '')}</b><small>{ent ? '↵ ' : ''}{fmtQty(q, qu)}{e ? ' · ~' + eur(e.v) : ''}</small></span></button>
          ); })}
        </div>
      ) : (
        <div className="chips staples" aria-label="Často kupujete">
          {staples.map((pid) => { const p = PRODUCTS[pid]; const pd = pend[pid]; return (
            <button type="button" key={pid} className={'chip' + (pd ? ' pend' : '') + (g ? ' glass2' : '')} onClick={() => tapStaple(pid)}>
              <E k={p.e} />{p.n.replace(/ ·.*$/, '').replace(/ polotučné| šalátová/, '')}
              {pd ? <span className="cnt" key={pd.k}>+{pd.n}</span> : <span className="pl"><I n="plus" w="bold" /></span>}
            </button>
          ); })}
        </div>
      )}
      <form className={'field' + (g ? ' glass2' : '')} onSubmit={submit}>
        <input ref={inp} id={'add-' + list.id} value={txt} onChange={(e) => setTxt(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder="Napíšte alebo nadiktujte položku" autoComplete="off" enterKeyHint="done" aria-label="Pridať položku" />
        {txt ? <button type="submit" className="m" aria-label="Pridať"><I n="arrow-up" w="bold" /></button> : <button type="button" className="m" onClick={() => voice({ listId: list.id })} aria-label="Pridať hlasom"><I n="microphone" /></button>}
      </form>
    </div>
  );
}

function ItemRow({ it, list, sel, setSel }) {
  const { S, act, sheet, toast } = useApp();
  const u = unitOf(it);
  const atMin = it.q <= minQty(u);
  const del = () => {
    const idx = list.items.findIndex((x) => x.id === it.id);
    act('removeItem', list.id, it.id);
    toast(`${itemName(it)} – zmazané`, { icon: 'trash', action: { label: 'Vrátiť', fn: () => act('restoreItem', list.id, it, idx) } });
  };
  const flash = it.flash && Date.now() - it.flash < 1500;
  return (
    <SwipeRow atMin={atMin} onPlus={() => act('setQty', list.id, it.id, bump(it.q, u, 1))} onMinus={() => act('setQty', list.id, it.id, bump(it.q, u, -1))} onDelete={del}
      cls={(sel ? 'sel ' : '') + (flash ? 'flash' : '')} onTap={() => sheet('item', { listId: list.id, itemId: it.id })}>
      <div className="row">
        <span className="th"><E k={pe(it.pid)} /></span>
        <div className="tx"><b>{itemName(it)}</b><PriceLine it={it} S={S} store={list.store} by /></div>
        {sel ? <Stepper q={it.q} u={u} onChange={(q) => act('setQty', list.id, it.id, q)} />
          : <button type="button" className="qty" onClick={(e) => { e.stopPropagation(); setSel(it.id); }} aria-label={'Množstvo ' + fmtQty(it.q, u)}>{fmtQty(it.q, u)}</button>}
      </div>
    </SwipeRow>
  );
}

export function ListScreen({ p }) {
  const { S, act, pop, modal, sheet, theme, push } = useApp();
  const g = theme === 'g';
  const list = S.lists.find((l) => l.id === p.id);
  const [sel, setSel] = useState(null);
  const sc = useRef(null);
  useEffect(() => { if (!sel) return; const t = setTimeout(() => setSel(null), 6000); return () => clearTimeout(t); }, [sel, list && list.items]);
  if (!list) return <div className="sc"><header className="nb"><Back /></header><Empty e="basket" t="Zoznam už neexistuje" /></div>;
  const t = listTotals(list, S, true);
  const open = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);
  const loose = open.filter((i) => !i.grp).sort((a, b) => b.t - a.t);
  const groups = {};
  for (const i of open.filter((x) => x.grp)) (groups[i.grp.label] = groups[i.grp.label] || { g: i.grp, items: [] }).items.push(i);
  const afterAdd = () => { if (sc.current) sc.current.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <>
      
      <div className="sc list-sc" ref={sc} onClick={() => sel && setSel(null)}>
        <header className="nb"><Back /><span className="nbt">{list.name}</span><div className="nbr"><Avatars ids={list.shared} sm /><HelpBtn screen="list" /><IB n="dots-three" label="Možnosti zoznamu" onClick={() => sheet('listMenu', { id: list.id })} /></div></header>
        <div className="body">
          <div className="lhead"><div className="grow"><h1 className="lt">{list.name}</h1><div className="meta">{withStore(list, when(list))}{list.shared.length > 1 ? '' : ' · iba ja'}</div></div></div>
          <div className={'card est' + (g ? ' glass2' : '')}>
            <div className="grow estc"><div className="k">Odhad nákupu</div><div className="price nw">{t.priced ? '~' + eur0(t.v) : '–'}</div><div className="estm">{t.priced ? <span className="nw">rozpätie {rangeText(t)}</span> : null}<span className="nw sm">{t.priced === t.n ? 'všetky ceny z bločkov' : `${t.priced} z ${t.n} položiek s cenou`}</span></div></div>
            <Btn cls={'pri sm' + (g ? ' a' : '')} onClick={() => modal('shop', { listId: list.id })} disabled={!open.length}><I n="basket" />Nakupovať</Btn>
          </div>
          {open.length > 0 && !(S.tips && S.tips.swipe) && <div className="tip"><I n="hand-swipe-right" /><div className="grow"><b>Rýchla úprava množstva</b><span>Potiahnite položku doprava = +1, doľava = −1. Ťuknutím otvoríte detail.</span></div><button type="button" className="tipx" onClick={() => act((s) => ({ ...s, tips: { ...(s.tips || {}), swipe: true } }))}>Rozumiem</button></div>}
          {!open.length && !done.length && <Empty e="basket" t="Zoznam je prázdny" d="Pridajte položky dole, ťuknite na časté položky alebo použite mikrofón." />}
          {loose.length > 0 && <div className={'lst' + (g ? ' glass2' : '')}>{loose.map((it) => <ItemRow key={it.id} it={it} list={list} sel={sel === it.id} setSel={setSel} />)}</div>}
          {Object.values(groups).map(({ g: gr, items }) => {
            const r = recipeById(gr.rid, S); const gs = items.reduce((a, i) => { const e = estimate(i, S, list.store); return a + (e ? e.v : 0); }, 0);
            return (
              <Fragment key={gr.label}>
                <button type="button" className="group" onClick={() => r && push('recipe', { id: r.id })}>{r && (g && r.pic ? <span className={'gth pic-' + r.pic} /> : <E k={r.e} />)}<span className="gl">{gr.label}</span><span className="tag">~{eur(gs)}</span></button>
                <div className={'lst' + (g ? ' glass2' : '')}>{items.map((it) => <ItemRow key={it.id} it={it} list={list} sel={sel === it.id} setSel={setSel} />)}</div>
              </Fragment>
            );
          })}
          {done.length > 0 && <>
            <div className="group plain"><I n="check-circle" /><span className="gl">Kúpené</span><button type="button" className="tag lnk" onClick={() => act('clearDone', list.id)}>Vymazať</button></div>
            <div className={'lst done-lst' + (g ? ' glass2' : '')}>{done.map((it) => (
              <div className="row done" key={it.id}><span className="th"><E k={pe(it.pid)} /></span><div className="tx"><b>{itemName(it)}</b><PriceLine it={it} S={S} store={list.store} /></div><button type="button" className="qty" onClick={() => act('toggleDone', list.id, it.id)} aria-label="Vrátiť do zoznamu"><I n="arrow-counter-clockwise" w="bold" /></button></div>
            ))}</div>
          </>}

        </div>
      </div>
      <Composer list={list} onAdded={afterAdd} focus0={p.focus} />
    </>
  );
}

// ---------- úprava položky ----------
export function ItemSheet({ open, close, listId, itemId }) {
  const { S, act, toast, push } = useApp();
  const list = S.lists.find((l) => l.id === listId);
  const it = list && list.items.find((i) => i.id === itemId);
  const [note, setNote] = useState(it ? it.note || '' : '');
  if (!it) return <Sheet open={false} onClose={close} />;
  const p = PRODUCTS[it.pid]; const u = unitOf(it);
  const up = it.pid && unitPrice(it.pid, S, list.store);
  const e = estimate(it, S, list.store);
  const h = it.pid ? history(it.pid, S).slice(-5).reverse() : [];
  const others = S.lists.filter((l) => l.id !== listId && !l.live);
  const save = () => { if ((it.note || '') !== note) act('patchItem', listId, itemId, { note: note.trim() }); close(); };
  return (
    <Sheet open={open} onClose={save} label={itemName(it)}>
      <div className="sh-head"><span className="th lg"><E k={pe(it.pid)} s={44} /></span><div className="grow"><h2>{itemName(it)}</h2><div className="meta">{p ? CATS[p.c].n : 'Vlastná položka'}{it.by !== 'm' ? ' · pridala Lucia' : ''}</div></div></div>
      <div className="sh-body">
        <div className="qblock"><Stepper q={it.q} u={u} onChange={(q) => act('setQty', listId, itemId, q)} />
          {(!p || p.u === 'kg' || p.u === 'l') && <Seg value={u === 'ks' ? 'ks' : 'x'} onChange={(v) => { if (v === (u === 'ks' ? 'ks' : 'x')) return; const xu = p ? p.u : 'kg'; act('patchItem', listId, itemId, v === 'ks' ? { u: 'ks', q: 1 } : { u: xu, q: xu === 'kg' ? Math.max(.1, Math.round(weightOf(it, S) * 10) / 10) : 1 }); }} items={[['ks', 'Kusy'], ['x', p && p.u === 'l' ? 'Litre' : 'Váha']]} />}
          <div className="qopts">{(u === 'kg' ? [.25, .5, 1, 2] : u === 'l' ? [.5, 1, 2, 3] : [1, 2, 3, 6]).map((q) => <button type="button" key={q} className={'chip plain' + (Math.abs(q - it.q) < .001 ? ' on' : '')} onClick={() => act('setQty', listId, itemId, q)}>{fmtQty(q, u)}</button>)}</div>
        </div>
        <div className="pinfo">
          <div className="pi-top"><div><div className="k">{it.paid != null ? 'Zaplatené' : 'Odhad'}</div><div className="price">{e ? (it.paid != null ? '' : '~') + eur(e.v) : '–'}</div></div>
            {up && <div className="ra"><div className="k">Bežná cena</div><div className="pv">{eur(up.up)} / {p.u === 'kg' ? 'kg' : p.u === 'l' ? 'l' : 'ks'}</div></div>}</div>
          {e && e.perKg && <p className="meta">Odhad podľa vášho bežného nákupu (~{fmtQty(weightOf(it, S), 'kg')}). Presnú cenu zapíše bloček.</p>}
          {up && !up.approx && <p className="meta">{up.k === 1 ? 'Cena z posledného nákupu' : `Medián posledných ${up.k} nákupov`}{up.same ? ` v obchode ${storeName(list.store)}` : list.store ? ' zo všetkých obchodov' : ''}. Rozpätie {eur(up.min)} – {eur(up.max)}.{!up.same && list.store ? ` V obchode ${storeName(list.store)} ste to ešte nekupovali – cena je z obchodu ${storeName(up.store)}.` : ''}</p>}
          {up && up.approx && <p className="meta">Orientačná cena – v bločkoch zatiaľ nie je. Po prvom bločku sa sem zapíše skutočná.</p>}
          {!up && <p className="meta">Cenu zatiaľ nepoznáme. Zapíše sa z bločku po nákupe.</p>}
          {h.length > 0 && <div className="hist">{h.map((x, i) => <div key={i}><span>{shortDate(x.d)}</span><span className="mk" style={{ '--sc': (STORES[x.s] || {}).c1 }}>{storeName(x.s)}</span><b>{eur(x.p)}</b></div>)}</div>}
          {it.pid && <button type="button" className="lnk" onClick={() => { save(); push('product', { pid: it.pid }); }}>Celá história ceny<I n="caret-right" w="bold" /></button>}
        </div>
        <label className="fl"><span>Poznámka pre nakupujúceho</span><input id="item-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="napr. bez laktózy, väčšie balenie" /></label>
        {others.length > 0 && <div className="mv"><span className="k">Presunúť do</span><div className="chips wrap">{others.map((l) => <button type="button" key={l.id} className="chip plain" onClick={() => { act((s) => { const s1 = { ...s, lists: s.lists.map((x) => x.id === listId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x.id === l.id ? { ...x, items: [{ ...it, t: Date.now() }, ...x.items] } : x) }; return s1; }); toast(`Presunuté do zoznamu ${l.name}`); close(); }}><StoreTile k={l.store} s={22} />{l.name}</button>)}</div></div>}
        <div className="sh-act"><Btn cls="danger soft" onClick={() => { const idx = list.items.findIndex((x) => x.id === itemId); act('removeItem', listId, itemId); toast(`${itemName(it)} – zmazané`, { icon: 'trash', action: { label: 'Vrátiť', fn: () => act('restoreItem', listId, it, idx) } }); close(); }}><I n="trash" />Zmazať</Btn><Btn cls="pri" onClick={save}>Hotovo</Btn></div>
      </div>
    </Sheet>
  );
}

// ---------- nový zoznam ----------
// Názov presne zodpovedá známemu obchodu („Lidl“, „Lidl Petržalka“) → obchod sa vyberie sám
const matchStore = (v) => { const n = norm(v); return Object.keys(STORES).find((k) => { const s = norm(STORES[k].n); return n === s || n.startsWith(s + ' '); }) || null; };
export function NewListSheet({ open, close }) {
  const { act, push, S, toast } = useApp();
  const [name, setName] = useState('');
  const [store, setStore] = useState(null);
  const auto = useRef(false); // obchod vybraný podľa napísaného názvu, nie ťuknutím
  const [day, setDay] = useState(1);
  const [date, setDate] = useState(''); // vlastný dátum (RRRR-MM-DD), prednosť pred Dnes/Zajtra
  const [mine, setMine] = useState(false); // predvolene spoločný zoznam domácnosti
  const all = useMemo(() => frequentStores(S, 99), []);
  // 6 najčastejších obchodov; obchod rozpoznaný z názvu sa ukáže, aj keď medzi nimi nie je
  const freq = store && all.findIndex((x) => x.k === store) >= 6 ? [...all.slice(0, 5), all.find((x) => x.k === store)] : all.slice(0, 6);
  const typed = (v) => {
    setName(v);
    if (store && !auto.current) return;
    const k = matchStore(v.trim()); auto.current = !!k; setStore(k);
  };
  const pick = (k) => {
    auto.current = false;
    if (store === k) { setStore(null); if (name.trim() === storeName(k)) setName(''); return; }
    setStore(k);
    if (!name.trim() || matchStore(name.trim())) setName(storeName(k));
  };
  const title = name.trim() || (store ? storeName(store) : '');
  const create = () => {
    if (!title) { document.getElementById('nl-name')?.focus(); return; }
    const d = date ? new Date(date + 'T00:00') : addDays(new Date(), day); const today = !date && day === 0; d.setHours(today ? new Date().getHours() + 1 : 17, 0, 0, 0);
    let id = null;
    act((s) => { const nl = { id: Math.random().toString(36).slice(2, 9), name: title, store, when: d.toISOString(), shared: mine ? ['m'] : ['m', 'l'], items: [] }; id = nl.id; return { ...s, lists: [...s.lists.filter((x) => !x.live), nl, ...s.lists.filter((x) => x.live)] }; });
    close(); setTimeout(() => id && push('list', { id }), 50); toast(mine ? 'Zoznam vytvorený – vidíte ho len vy' : 'Zoznam vytvorený – Lucia ho vidí tiež');
  };
  return (
    <Sheet open={open} onClose={close} label="Nový zoznam" cls="nl">
      <div className="sh-head"><h2>Nový zoznam</h2></div>
      <div className="sh-body">
        <label className="fl"><span>Názov</span><input id="nl-name" value={name} onChange={(e) => typed(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Napr. Víkendový nákup alebo Metro" enterKeyHint="done" /></label>
        <div><span className="k">Obchod <small>· nepovinné, podľa neho appka odhadne ceny</small></span><div className="stgrid">{freq.map(({ k, cnt }) => <button type="button" key={k} aria-pressed={store === k} className={'stb' + (store === k ? ' on' : '')} style={{ '--sc': STORES[k].c1 }} onClick={() => pick(k)}><b>{storeName(k)}</b>{cnt > 0 && <small>{cnt} {cnt === 1 ? 'nákup' : cnt < 5 ? 'nákupy' : 'nákupov'}</small>}</button>)}</div></div>
        <div><span className="k">Kedy</span><div className="days">{[[0, 'Dnes'], [1, 'Zajtra'], [2, 'Pozajtra']].map(([d, l]) => <button type="button" key={l} className={'chip plain' + (!date && day === d ? ' on' : '')} onClick={() => { setDay(d); setDate(''); }}>{l}</button>)}
          <label className={'chip plain datec' + (date ? ' on' : '')}><I n="calendar-blank" />{date ? `${['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'][new Date(date + 'T00:00').getDay()]} ${new Date(date + 'T00:00').getDate()}. ${new Date(date + 'T00:00').getMonth() + 1}.` : 'Dátum'}<input type="date" aria-label="Vybrať dátum" min={dkey(new Date())} value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }} /></label></div></div>
        <div><span className="k">Kto ho uvidí</span><div className="who">
          <button type="button" aria-pressed={!mine} className={'whob' + (!mine ? ' on' : '')} onClick={() => setMine(false)}><I n="users-three" /><span><b>Blahovci</b><small>spoločný s Luciou</small></span></button>
          <button type="button" aria-pressed={mine} className={'whob' + (mine ? ' on' : '')} onClick={() => setMine(true)}><I n="lock-simple" /><span><b>Iba ja</b><small>súkromný</small></span></button>
        </div></div>
      </div>
      {/* potvrdenie je vždy viditeľné pod obsahom, netreba rolovať */}
      <div className="sh-foot"><Btn cls="pri full" disabled={!title} onClick={create}>{title ? `Vytvoriť „${title}“` : 'Napíšte názov alebo vyberte obchod'}</Btn></div>
    </Sheet>
  );
}
const dayLowerCap = (d) => ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'][d.getDay()];

export function ListMenuSheet({ open, close, id }) {
  const { S, act, toast, pop } = useApp();
  const l = S.lists.find((x) => x.id === id);
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(l ? l.name : '');
  if (!l) return <Sheet open={false} onClose={close} />;
  const share = () => {
    const txt = `${l.name}${l.store && storeName(l.store) !== l.name ? ` (${storeName(l.store)})` : ''}\n` + l.items.filter((i) => !i.done).map((i) => `• ${itemName(i)} – ${fmtQty(i.q, unitOf(i))}`).join('\n');
    const ok = () => toast('Zoznam skopírovaný – vložte ho do správy');
    try { navigator.clipboard.writeText(txt).then(ok, () => toast('Kopírovanie tu nie je povolené', { icon: 'warning-circle' })); } catch { toast('Kopírovanie tu nie je povolené', { icon: 'warning-circle' }); }
  };
  return (
    <Sheet open={open} onClose={close} label="Možnosti zoznamu">
      <div className="sh-head"><div className="grow"><h2>{l.name}</h2><div className="meta">{withStore(l, `${l.items.length} položiek`)}</div></div></div>
      <div className="sh-body">
        {mode === 'name' ? <form className="fl row" onSubmit={(e) => { e.preventDefault(); act('patchList', id, { name: name.trim() || l.name }); setMode(null); }}><input id="ren" autoFocus value={name} onChange={(e) => setName(e.target.value)} /><Btn type="submit" cls="pri sm">Uložiť</Btn></form>
          : mode === 'store' ? <div className="stgrid">{SHOP_STORES.map((k) => <button type="button" key={k} className={'stb' + (l.store === k ? ' on' : '')} onClick={() => { act('patchList', id, { store: k }); setMode(null); toast(`Obchod: ${storeName(k)} – ceny sa prepočítali`); }}><StoreTile k={k} s={40} /><span>{storeName(k)}</span></button>)}</div>
          : mode === 'del' ? <div className="confirm"><p>Zmazať zoznam „{l.name}“ aj s {l.items.length} položkami? Lucia ho tiež prestane vidieť.</p><div className="sh-act"><Btn cls="soft" onClick={() => setMode(null)}>Nechať</Btn><Btn cls="danger" onClick={() => { act('deleteList', id); close(); pop(); toast('Zoznam zmazaný'); }}>Zmazať</Btn></div></div>
          : <div className="menu">
            <button type="button" onClick={() => setMode('name')}><I n="pencil-simple" />Premenovať</button>
            <button type="button" onClick={() => setMode('store')}><I n="storefront" />Zmeniť obchod<span className="mv">{l.store ? storeName(l.store) : 'nezvolený'}</span></button>
            <button type="button" onClick={share}><I n="share-network" />Skopírovať ako text</button>
            <button type="button" onClick={() => { act('clearDone', id); toast('Kúpené položky odstránené'); close(); }} disabled={!l.items.some((i) => i.done)}><I n="broom" />Vymazať kúpené</button>
            <button type="button" className="dng" onClick={() => setMode('del')}><I n="trash" />Zmazať zoznam</button>
          </div>}
      </div>
    </Sheet>
  );
}

// ---------- história ukončených nákupov ----------
const whenTxt = (t) => { const d = new Date(t); const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return (days === 0 ? 'dnes' : days === 1 ? 'včera' : d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })) + ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
function RcptPill({ h, S }) {
  const missing = (S.missingReceipts || []).some((m) => m.listId === h.id);
  return h.receipt ? <span className="stat ok"><I n="check" w="bold" />bloček</span> : missing ? <span className="stat warnp">chýba bloček</span> : <span className="stat">bez bločku</span>;
}
export function History() {
  const { S, push, theme } = useApp();
  const g = theme === 'g';
  const hs = S.history || [];
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">História nákupov</span><span className="ibs" /></header>
      <div className="body">
        <div><h1 className="lt">História nákupov</h1><p className="meta">Ukončené nákupy. Ťuknutím pozriete, čo ste kúpili, alebo nakúpite znova.</p></div>
        {!hs.length ? <Empty e="bags" t="Zatiaľ žiadny ukončený nákup" d="Keď nákup dokončíte, nájdete ho tu." /> : (
          <div className={'lst' + (g ? ' glass2' : '')}>{hs.map((h) => (
            <button type="button" key={h.id} className="row tap" onClick={() => push('histlist', { id: h.id })}>
              {h.store ? <StoreTile k={h.store} s={44} /> : <span className="th ic"><I n="basket" /></span>}
              <div className="tx"><b>{h.name}</b><span className="sub">{whenTxt(h.closedAt)} · {h.n} {h.n === 1 ? 'položka' : h.n < 5 ? 'položky' : 'položiek'} · ~{eur(h.total)}</span></div>
              <RcptPill h={h} S={S} /><I n="caret-right" w="bold" cls="chev" />
            </button>
          ))}</div>
        )}
      </div>
    </div>
  );
}
export function HistList({ p }) {
  const { S, act, modal, theme, jump, toast } = useApp();
  const g = theme === 'g';
  const h = (S.history || []).find((x) => x.id === p.id);
  if (!h) return <div className="sc"><header className="nb"><Back /></header><Empty e="bags" t="Nákup sa nenašiel" /></div>;
  const miss = (S.missingReceipts || []).find((m) => m.listId === h.id);
  const again = () => {
    const id = Math.random().toString(36).slice(2, 9); const when = new Date(); when.setDate(when.getDate() + 1); when.setHours(17, 0, 0, 0);
    act((s) => ({ ...s, lists: [...s.lists.filter((x) => !x.live), { id, name: h.name, store: h.store, when: when.toISOString(), shared: h.shared || ['m', 'l'], items: [], hl: Date.now() }, ...s.lists.filter((x) => x.live)] }));
    act('addItems', id, h.items.map((i) => (i.pid ? { pid: i.pid, q: i.q, u: i.u || 'ks' } : { n: i.n, q: i.q, u: i.u || 'ks' })));
    jump('lists', 'list', { id }); toast(`Nový zoznam „${h.name}“ · ${h.items.length} položiek`, { icon: 'check-circle' });
  };
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">{h.name}</span><span className="ibs" /></header>
      <div className="body">
        <div className="lhead"><div className="grow"><h1 className="lt">{h.name}</h1><div className="meta">{withStore(h, 'ukončený ' + whenTxt(h.closedAt))}</div></div></div>
        <div className={'card hsum' + (g ? ' glass2' : '')}>
          <div className="rowc"><div className="grow"><div className="k">Spolu</div><div className="price nw">~{eur(h.total)}</div><div className="meta sm">{h.n} {h.n === 1 ? 'položka' : h.n < 5 ? 'položky' : 'položiek'}</div></div><RcptPill h={h} S={S} /></div>
          {miss && <Btn cls={'pri full' + (g ? ' a' : '')} onClick={() => modal('scan', { listId: h.id, missing: miss.id })}><I n="camera" />Odfotiť bloček</Btn>}
        </div>
        <div className="h2 sm">Kúpené</div>
        <div className={'lst' + (g ? ' glass2' : '')}>{h.items.map((it) => (
          <div key={it.id} className="row"><span className="th ckth on"><E k={pe(it.pid)} /><span className="ckov" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg></span></span><div className="tx"><b>{itemName(it)}</b><span className="sub">{fmtQty(it.q, itemUnit(it))}{it.paid ? ` · ${eur(it.paid)}` : ''}</span></div></div>
        ))}</div>
        <Btn cls="soft full" onClick={again}><I n="arrow-counter-clockwise" w="bold" />Nakúpiť znova</Btn>
      </div>
    </div>
  );
}
