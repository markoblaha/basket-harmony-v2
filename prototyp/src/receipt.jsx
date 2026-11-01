import { useApp, Back, MeBtn, Seg, useState, useEffect, useRef, useMemo, Fragment, I, E, IB, Btn, StoreTile, pe, Empty, Toggle } from './ui.jsx';
import { PRODUCTS, STORES } from './data.js';
import { demoReceipt, matchReceipt, estimate, eur, eur0, fmtQty, num, signed, storeName, shortDate, relDay, allReceipts, lineEmoji, plural, uid, dkey, sizeTxt } from './logic.js';
import { CATS } from './data.js';
import { aiReceipt, aiErrorText } from './ai.js';
import { A, nextOpenList } from './store.js';
import { itemName } from './lists.jsx';

/* icons: x camera image sparkle check check-circle lightning receipt caret-right plus info warning-circle file-text */

export const storeKeyOf = (name) => { const n = (name || '').toLowerCase(); return Object.keys(STORES).find((k) => n.startsWith(STORES[k].n.toLowerCase()) || n.includes(STORES[k].n.toLowerCase())) || null; };
const STEPS = ['Čítam text bločku', 'Párujem s nákupom', 'Počítam skutočné ceny'];

function Paper({ rec, list, small }) {
  const lines = rec ? rec.lines : (list ? list.items.filter((i) => i.done || true).slice(0, 6).map((i) => ({ raw: itemName(i).toUpperCase().slice(0, 14), t: null })) : []);
  return (
    <div className={'paper' + (small ? ' sm' : '')} aria-hidden="true">
      <div className="pc b">{rec ? storeName(rec.store).toUpperCase() : list && list.store ? storeName(list.store).toUpperCase() : 'OBCHOD'}</div>
      <div className="pc o">{rec ? `${shortDate(rec.date)} ${rec.time || ''}` : '— — —'}</div>
      <div className="pd" />
      {lines.slice(0, small ? 4 : 8).map((l, i) => <div className="pr" key={i}><span>{l.raw}</span><span>{l.t != null ? l.t.toFixed(2).replace('.', ',') : '··,··'}</span></div>)}
      {lines.length > (small ? 4 : 8) && <div className="pr o"><span>…</span><span /></div>}
      <div className="pd" />
      <div className="pr b"><span>SPOLU EUR</span><span>{rec ? rec.total.toFixed(2).replace('.', ',') : '··,··'}</span></div>
    </div>
  );
}

const withStoreName = (l) => (l.store && storeName(l.store) !== l.name ? `${l.name} · ${storeName(l.store)}` : l.name);
export function Scan({ p }) {
  const { S, act, closeModal, theme, toast, jump, ai } = useApp();
  const g = theme === 'g';
  const list = S.lists.find((l) => l.id === p.listId) || nextOpenList(S);
  const [phase, setPhase] = useState('capture');
  const [step, setStep] = useState(0);
  const [rec, setRec] = useState(null);
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');
  const [write, setWrite] = useState(true);
  const cam = useRef(null); const gal = useRef(null);
  const tm = useRef([]);
  useEffect(() => () => { tm.current.forEach(clearTimeout); img && URL.revokeObjectURL(img); }, []);
  const demo = () => {
    setPhase('reading'); setStep(0); setErr('');
    tm.current.push(setTimeout(() => setStep(1), 900), setTimeout(() => setStep(2), 1800), setTimeout(() => { setRec(demoReceipt(list, S)); setPhase('result'); }, 2700));
  };
  const fromFile = async (f) => {
    if (!f) return;
    setImg(URL.createObjectURL(f)); setPhase('reading'); setStep(0); setErr('');
    if (!ai) { setErr('Na čítanie skutočnej fotky treba AI, ktorá tu nie je dostupná. Ukážem ukážkový bloček.'); tm.current.push(setTimeout(demo, 1600)); return; }
    const t = setInterval(() => setStep((s) => Math.min(2, s + 1)), 3500);
    try {
      const r = await aiReceipt([f]);
      clearInterval(t);
      const sk = storeKeyOf(r.store) || r.store || (list && list.store);
      const rr = { store: sk, date: r.date || dkey(new Date()), time: r.time || '', total: +r.total || 0, lines: (r.lines || []).map((l) => ({ id: uid(), raw: l.raw || l.n, n: l.n || l.raw, pid: l.id && PRODUCTS[l.id] ? l.id : null, q: +l.q || 1, u: l.u || 'ks', up: +l.up || +l.t || 0, t: +l.t || 0 })), listId: list && list.id };
      if (!rr.total) rr.total = Math.round(rr.lines.reduce((a, l) => a + l.t, 0) * 100) / 100;
      matchReceipt(rr, list);
      setRec(rr); setStep(2); setPhase('result');
    } catch (e) { clearInterval(t); setErr(aiErrorText(e)); setPhase('capture'); }
  };
  const save = () => {
    const hit = (p.missing && (S.missingReceipts || []).find((m) => m.id === p.missing)) || pairMissing(S, rec, list && list.id);
    act((s) => { const s2 = A.saveReceipt(s, rec, list, write).S; return hit ? { ...s2, missingReceipts: (s2.missingReceipts || []).filter((m) => m.id !== hit.id) } : s2; });
    closeModal();
    setTimeout(() => { if (list) jump('lists', 'list', { id: list.id }); toast(hit ? `Bloček priradený k nákupu ${hit.name}` : write ? 'Bloček uložený – skutočné ceny sú pri položkách' : 'Bloček uložený do výdavkov', { e: 'receipt' }); }, 60);
  };
  const inputs = <><input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromFile(e.target.files && e.target.files[0])} /><input ref={gal} type="file" accept="image/*" hidden onChange={(e) => fromFile(e.target.files && e.target.files[0])} /></>;

  if (phase === 'capture') return (
    <div className={'scr scan cap'}>
      {inputs}
      {g && <div className="cam" />}
      <header className="nb"><IB n="x" label="Zavrieť" cls={g ? 'wg' : ''} onClick={closeModal} /><span className="nbt sh">{g ? '' : 'Bloček'}</span>{g ? <span className="pb sm wg"><I n="lightning" />Auto</span> : <span className="ibs" />}</header>
      <div className="capbody">
        {g ? <div className="frame"><span className="cor tl" /><span className="cor tr" /><span className="cor bl" /><span className="cor br" /><Paper list={list} /></div>
          : <><h1 className="lt">Bloček z nákupu</h1><p className="meta">{list ? withStoreName(list) : ''}. Skutočné ceny sa zapíšu k položkám zoznamu a do cenníka domácnosti.</p><div className="papwrap"><Paper list={list} /></div></>}
      </div>
      <div className={'capfoot' + (g ? ' glass2' : '')}>
        {err && <p className="vnote"><I n="warning-circle" />{err}</p>}
        {g && <div className="t1 c">Bloček v rámčeku, celý a rovno</div>}
        <Btn cls={'pri full big' + (g ? ' a' : '')} onClick={() => cam.current.click()}><I n="camera" />Odfotiť bloček</Btn>
        <div className="rowc two"><Btn cls={'soft grow' + (g ? ' gl' : '')} onClick={() => gal.current.click()}><I n="image" />Z galérie</Btn><Btn cls={'soft grow' + (g ? ' gl' : '')} onClick={demo}><I n="sparkle" />Ukážkový</Btn></div>
        <p className="meta sm c">{ai ? 'Fotku prečíta AI (Claude). Pri prvom použití sa opýta na povolenie.' : 'AI tu nie je dostupná – vyskúšajte ukážkový bloček.'}</p>
      </div>
    </div>
  );

  if (phase === 'reading') return (
    <div className={'scr scan reading'}>
      {g && <div className="cam" />}
      <header className="nb"><IB n="x" label="Zrušiť" cls={g ? 'wg' : ''} onClick={closeModal} /><span className="nbt sh">Čítam bloček</span><span className="ibs" /></header>
      <div className="capbody">
        <div className="frame rd">{img ? <img src={img} alt="Odfotený bloček" className="shot" /> : <Paper list={list} />}<span className="scanl" /></div>
        <div className={'rsteps' + (g ? ' glass2' : '')}>{STEPS.map((s, i) => <div key={s} className={i < step ? 'dn' : i === step ? 'now' : ''}>{i < step ? <I n="check-circle" /> : <span className="sp" />}{s}</div>)}</div>
        {err && <p className="vnote"><I n="info" />{err}</p>}
      </div>
    </div>
  );

  // výsledok
  const items = rec.lines.filter((l) => !l.extra);
  const extra = rec.lines.filter((l) => l.extra);
  const est = items.reduce((a, l) => { const it = list && list.items.find((i) => i.id === l.itemId); const e = it && estimate(it, S, list.store); return a + (e ? e.v : 0); }, 0);
  const ok = !extra.length || extra.every((x) => x.t < 3);
  const missing = list ? list.items.filter((i) => i.done && !i.na && !rec.lines.some((l) => l.itemId === i.id)) : [];
  const lineRow = (l) => {
    const it = list && list.items.find((i) => i.id === l.itemId);
    const e = it && estimate(it, S, list.store);
    const d = e ? l.t - e.v : null;
    const pp = l.pid && PRODUCTS[l.pid];
    return (
      <div className="row" key={l.id}>
        <span className="th"><E k={pe(l.pid)} /></span>
        <div className="tx"><b>{it ? itemName(it) : l.n}</b><span className="sub">{pp && pp.u === 'kg' ? `${num(l.q)} kg · ${eur(l.up)}/kg` : l.q > 1 ? `${num(l.q)} × ${eur(l.up)}` : l.raw}{it && pp && pp.u === 'kg' && Math.abs(l.q - it.q) > .005 ? ` · plán ${fmtQty(it.q, 'kg')}` : ''}</span></div>
        <div className="ra"><b className="lt2">{eur(l.t)}</b>{d != null && <span className={'diff' + (Math.abs(d) < .05 ? ' good' : d < 0 ? ' good' : '')}>{Math.abs(d) < .05 ? 'presne' : signed(d)}</span>}</div>
      </div>
    );
  };
  return (
    <div className={'scr scan res'}>
      {g && <div className="cam" />}
      <div className="sc">
        <header className="nb"><IB n="x" label="Zavrieť bez uloženia" cls={g ? 'wg' : ''} onClick={closeModal} /><span className="nbt sh">{storeName(rec.store)}</span><span className="ibs" /></header>
        <div className={'body' + (g ? ' rsheet glass2' : '')}>
          <div className="reshead">
            {!g && <Paper rec={rec} small />}
            <div className="grow">{g && <span className="okb"><I n="check" w="bold" /></span>}<h1 className="lt">{ok ? 'Bloček sedí' : 'Skontrolujte'}</h1><div className="meta">{items.length} z {rec.lines.length} položiek spárovaných s nákupom · {shortDate(rec.date)}{rec.demo ? ' · ukážka' : ''}</div></div>
          </div>
          <div className={'card match' + (g ? ' mg' : '')}>
            <div><div className="k">Zaplatené</div><div className="price">{eur(rec.total)}</div></div>
            <div className="ra"><div className="k">Odhad bol</div><div className="price mut">~{est < 20 ? eur(est) : eur0(est)}</div><div className="meta sm">{(() => { const paidL = items.reduce((a, l) => a + l.t, 0); const d = paidL - est; const ex = extra.reduce((a, l) => a + l.t, 0); return (Math.abs(d) < .3 ? 'položky zo zoznamu takmer presne' : `položky zo zoznamu o ${eur(Math.abs(d))} ${d > 0 ? 'drahšie' : 'lacnejšie'}`) + (ex ? ` · navyše ${eur(ex)}` : ''); })()}</div></div>
          </div>
          <div className="group plain"><span className="gl">Skutočné ceny pri položkách</span></div>
          <div className="lst">{items.map(lineRow)}</div>
          {extra.length > 0 && <><div className="group plain"><span className="gl">Navyše v bločku – nebolo v zozname</span></div><div className="lst">{extra.map(lineRow)}</div></>}
          {missing.length > 0 && <p className="vnote"><I n="info" />Na bločku chýba: {missing.map(itemName).join(', ')}. Ostanú v zozname ako kúpené bez ceny.</p>}
          <div className="tgrow"><span><b>Zapísať ceny k položkám a do cenníka</b><small>Nabudúce bude odhad presnejší. Pri kg sa cena prepočíta na množstvo v zozname.</small></span><Toggle on={write} onChange={setWrite} label="Zapísať ceny" /></div>
        </div>
      </div>
      <div className="dock solo"><Btn cls={'pri full big' + (g ? ' a' : '')} onClick={save}>Uložiť do výdavkov</Btn></div>
    </div>
  );
}

export function Receipts() {
  const { S, pop, push, modal, theme } = useApp();
  const g = theme === 'g';
  const [mo, setMo] = useState('2026-10');
  const rs = allReceipts(S).filter((r) => r.date.startsWith(mo));
  const total = rs.reduce((a, r) => a + r.total, 0);
  const byDay = {};
  for (const r of rs) (byDay[r.date] = byDay[r.date] || []).push(r);
  return (
    <>
      
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">Bločky</span><IB n="camera" label="Odfotiť bloček" onClick={() => modal('scan', {})} /></header>
        <div className="body">
          <h1 className="lt">Bločky</h1>
          <Seg items={[['2026-10', 'Október'], ['2026-09', 'September'], ['2026-08', 'August']]} value={mo} onChange={setMo} />
          <p className="meta">{plural(rs.length, 'bloček', 'bločky', 'bločkov')} · spolu {eur(total)}</p>
          {Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([d, list]) => (
            <Fragment key={d}>
              <div className="group plain"><span className="gl">{relDay(d) === shortDate(d) ? shortDate(d) : relDay(d).charAt(0).toUpperCase() + relDay(d).slice(1) + ' · ' + shortDate(d)}</span><span className="cnt">{eur(list.reduce((a, r) => a + r.total, 0))}</span></div>
              <div className={'lst' + (g ? ' glass2' : '')}>{list.map((r) => (
                <button type="button" key={r.id} className="row tap" onClick={() => push('receipt', { id: r.id })}>
                  <StoreTile k={r.store || storeKeyOf(r.storeName) || r.storeName} s={40} />
                  <div className="tx"><b>{r.storeName}</b><span className="sub">{r.time ? r.time + ' · ' : ''}{plural(r.lines.length, 'položka', 'položky', 'položiek')}{r.mine ? ' · nový' : ''}</span></div>
                  <b className="amt">{eur(r.total)}</b>
                </button>
              ))}</div>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

export function ReceiptDetail({ p }) {
  const { S, push, theme } = useApp();
  const g = theme === 'g';
  const r = allReceipts(S).find((x) => x.id === p.id);
  if (!r) return <div className="sc"><header className="nb"><Back /></header><Empty e="receipt" t="Bloček sa nenašiel" /></div>;
  const items = r.lines.filter((l) => l.c !== 'deposit');
  const dep = r.lines.filter((l) => l.c === 'deposit');
  const sumItems = r.lines.reduce((a, l) => a + l.t, 0);
  const diff = Math.round((r.total - sumItems) * 100) / 100;
  // ťuk na riadok otvorí výrobok (značka + balenie); riadok, z ktorého sme prišli, sa rozsvieti
  const row = (l) => { const pp = l.pid && PRODUCTS[l.pid]; const go = l.vkey ? () => push('variant', { vkey: l.vkey }) : pp ? () => push('product', { pid: l.pid }) : null; return (
    <button type="button" className={'row' + (go ? ' tap' : '') + (p.hl === l.id ? ' hl' : '')} key={l.id} disabled={!go} onClick={() => go && go()} ref={p.hl === l.id ? (n) => n && setTimeout(() => n.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350) : undefined}>
      <span className="th"><E k={lineEmoji(l)} /></span>
      <div className="tx"><b>{l.n}</b>{(l.brand || l.size) && <span className="sub br">{[l.brand, sizeTxt(l.size)].filter(Boolean).join(' · ')}</span>}<span className="sub">{l.u === 'kg' ? `${num(l.q)} kg × ${eur(l.up)}/kg` : l.q > 1 ? `${num(l.q)} × ${eur(l.up)}` : (CATS[l.c] || {}).n}{l.up && l.t < l.up * l.q - .01 && l.u !== 'kg' ? ' · so zľavou' : ''}</span></div>
      <b className="amt">{eur(l.t)}</b>
    </button>
  ); };
  return (
    <>
      
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">{r.storeName}</span><span className="ibs" /></header>
        <div className="body">
          <div className="lhead"><StoreTile k={r.store || storeKeyOf(r.storeName) || r.storeName} s={60} /><div className="grow"><h1 className="lt">{r.storeName}</h1><div className="meta">{shortDate(r.date)} {r.time} · {plural(items.length, 'položka', 'položky', 'položiek')}</div></div></div>
          <div className={'card match' + (g ? ' mg' : '')}><div><div className="k">Zaplatené</div><div className="price">{eur(r.total)}</div></div>{Math.abs(diff) > .009 && <div className="ra"><div className="k">Rozdiel voči položkám</div><div className="price mut">{eur(diff)}</div><div className="meta sm">zľava alebo zaokrúhlenie</div></div>}</div>
          <div className={'lst' + (g ? ' glass2' : '')}>{items.map(row)}</div>
          {dep.length > 0 && <><div className="group plain"><span className="gl">Zálohy za obaly</span><span className="cnt">{eur(dep.reduce((a, l) => a + l.t, 0))}</span></div><div className={'lst' + (g ? ' glass2' : '')}>{dep.map(row)}</div></>}
          <p className="hint">Ťuknutím na položku otvoríte výrobok: cenu za kg/l/ks v čase a v obchodoch.</p>
        </div>
      </div>
    </>
  );
}

// ---------- nákupy bez bločku ----------
// Po „Teraz nie“ si appka pamätá dokončený nákup bez bločku. Odfotený bloček sa s ním spáruje sám
// (rovnaký zoznam, alebo rovnaký obchod do 3 dní od nákupu). Ukazuje sa na lište (číslo pri Výdavkoch),
// vo Výdavkoch a na Domove.
export function pairMissing(S, rec, listId) {
  const ms = S.missingReceipts || [];
  const day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const hit = ms.find((m) => m.listId === listId && (!rec.store || !m.store || rec.store === m.store))
    || ms.find((m) => m.store && rec.store === m.store && Math.abs(day(rec.date) - day(m.at)) <= 3 * 864e5);
  return hit || null;
}
export function MissingReceipts({ compact }) {
  const { S, act, modal, theme, toast } = useApp();
  const g = theme === 'g';
  const ms = S.missingReceipts || [];
  if (!ms.length) return null;
  const when = (t) => { const d = new Date(t); const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return (days === 0 ? 'dnes' : days === 1 ? 'včera' : `${d.getDate()}. ${d.getMonth() + 1}.`) + ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const drop = (m) => { act((s) => ({ ...s, missingReceipts: (s.missingReceipts || []).filter((x) => x.id !== m.id) })); toast('Bez bločku – nákup ostane len s odhadom', { action: { label: 'Späť', fn: () => act((s) => ({ ...s, missingReceipts: [m, ...(s.missingReceipts || [])] })) } }); };
  const list = compact ? ms.slice(0, 1) : ms;
  return (
    <div className={'card mrc' + (g ? ' glass2' : '')} role="region" aria-label="Chýbajúce bločky">
      <div className="mrc-h"><span className="mrc-i"><I n="receipt" /><b>{ms.length}</b></span><div className="grow"><div className="t1">{ms.length === 1 ? 'Chýba bloček z nákupu' : `Chýbajú bločky z ${ms.length} nákupov`}</div><div className="meta sm">Odfoťte ho a skutočné ceny sa priradia k nákupu samé.</div></div></div>
      {list.map((m) => (
        <div key={m.id} className="mrc-r">
          {m.store ? <StoreTile k={m.store} s={36} /> : <span className="th ic"><I n="basket" /></span>}
          <div className="grow"><b>{m.name}</b><span className="sub">{when(m.at)} · {m.n} {m.n === 1 ? 'položka' : m.n < 5 ? 'položky' : 'položiek'} · ~{eur(m.total)}</span></div>
          {!compact && <IB n="x" cls="flat sm" label={`Bloček nemám: ${m.name}`} onClick={() => drop(m)} />}
          <Btn cls={'pri sm' + (g ? ' a' : '')} onClick={() => modal('scan', { listId: m.listId, missing: m.id })}><I n="camera" />Odfotiť</Btn>
        </div>
      ))}
      {compact && ms.length > 1 && <div className="meta sm">a ďalšie vo Výdavkoch</div>}
    </div>
  );
}
