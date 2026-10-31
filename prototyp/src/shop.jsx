import { useApp, useState, useEffect, useRef, useMemo, Fragment, I, E, IB, Btn, StoreTile, Av, pe, Sheet, Check, Empty, useInterval, Toggle } from './ui.jsx';
import { PRODUCTS, CATS, ROUTE, MEMBERS } from './data.js';
import { itemUnit, listTotals, estimate, eur, eur0, fmtQty, storeName, ago, unitPrice, parseChunk } from './logic.js';
import { itemName, PriceLine } from './lists.jsx';

/* icons: x sun sun-dim check check-circle arrow-counter-clockwise prohibit camera paper-plane-right */

const catOf = (i) => (i.pid && PRODUCTS[i.pid] ? PRODUCTS[i.pid].c : 'other');
const unitOf = itemUnit;

function useWake() {
  const [on, setOn] = useState(false);
  const lock = useRef(null);
  const req = async () => { try { lock.current = await navigator.wakeLock.request('screen'); setOn(true); lock.current.addEventListener('release', () => setOn(false)); } catch { setOn(false); } };
  useEffect(() => { req(); return () => { try { lock.current && lock.current.release(); } catch {} }; }, []);
  return [on, req];
}

export function Shop({ p }) {
  const { S, act, closeModal, sheet, theme, toast } = useApp();
  const g = theme === 'g';
  const list = S.lists.find((l) => l.id === p.listId);
  const [wake] = useWake();
  const [mins, setMins] = useState(0);
  const [menu, setMenu] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const refs = useRef({});
  useEffect(() => { if (!S.shopping || S.shopping.listId !== p.listId) act('startShopping', p.listId); }, []);
  useInterval(() => setMins((m) => m + 1), 60000);
  if (!list) return null;
  const started = S.shopping && S.shopping.listId === list.id ? S.shopping.started : Date.now();
  const el = Math.max(mins, Math.round((Date.now() - started) / 60000));
  const all = list.items.filter((i) => !i.na);
  const t = listTotals({ ...list, items: all }, S);
  const open = all.filter((i) => !i.done);
  const na = list.items.filter((i) => i.na);
  const cats = ROUTE.filter((c) => list.items.some((i) => catOf(i) === c));
  const curCat = cats.find((c) => open.some((i) => catOf(i) === c));
  const reqs = S.requests.filter((r) => r.listId === list.id);
  const toggle = (it) => act('toggleDone', list.id, it.id);
  const finish = () => sheet('finish', { listId: list.id });
  const close = () => { if (t.done) finish(); else { act('endShopping'); closeModal(); } };
  const pct = t.n ? t.done / t.n : 0;

  return (
    <div className="scr shop">
      {g && <div className="bgl"><div className="bgb pic-trh_p" /><div className="veil" /></div>}
      <div className="sc">
        <header className="nb"><IB n="x" label="Zavrieť nákup" onClick={close} /><span className="nbt sh">{list.store ? storeName(list.store) : list.name}</span>
          {wake ? <span className="wake" title="Obrazovka počas nákupu ostáva zapnutá"><I n="sun" />Obrazovka ostáva zapnutá</span> : <span className="ibs" />}</header>
        <div className="body">
          {g ? (
            <div className="card glass2 prog-g">
              <div className="ring" style={{ '--p': pct * 100 + '%' }}><span><b className="num">{t.done}<small>/{t.n}</small></b><small>v košíku</small></span></div>
              <div className="grow"><div className="t2">{list.store ? storeName(list.store) : list.name} · {el} min</div><div className="num xl">{eur(t.doneV)}</div><div className="t2">zostáva ~{eur0(Math.max(0, t.v - t.doneV))}</div></div>
            </div>
          ) : (
            <div className="card live shopc">
              <span className="k">Nakupuješ · {el} min</span>
              <div className="sc-row"><div className="t big">{t.done}<span> z {t.n}</span></div><div className="ra"><div className="sv">{eur(t.doneV)}</div><div className="s">v košíku</div></div></div>
              <div className="prog"><i style={{ width: pct * 100 + '%' }} /></div>
            </div>
          )}
          {reqs.map((r) => { const pp = PRODUCTS[r.pid]; const u = unitPrice(r.pid, S, list.store); return (
            <div key={r.id} className={'card req' + (g ? ' glass2' : '')}>
              <Av id={r.from} s={40} />
              <div className="grow"><div className="t1">{MEMBERS[r.from].name}: {pp.n.toLowerCase()}</div><div className="meta">{fmtQty(r.q, pp.u)}{u ? ' · ~' + eur(u.up * r.q) : ''}{r.note ? ' · ' + r.note : ''}</div></div>
              <Btn cls={'pri sm' + (g ? ' a' : '')} onClick={() => { act((s) => { const s1 = { ...s, requests: s.requests.filter((x) => x.id !== r.id) }; const L = s1.lists.find((x) => x.id === list.id); return { ...s1, lists: s1.lists.map((x) => x.id === list.id ? { ...x, items: [{ id: Math.random().toString(36).slice(2), pid: r.pid, q: r.q, by: r.from, t: Date.now(), done: false, flash: Date.now() }, ...x.items] } : x) }; }); toast('Pridané – Lucia dostane potvrdenie'); }}>Pridať</Btn>
              <IB n="x" label="Odmietnuť" cls="flat sm" onClick={() => { act('dropRequest', r.id); toast('Lucia uvidí, že to nekúpite'); }} />
            </div>
          ); })}
          {cats.map((c) => {
            const its = open.filter((i) => catOf(i) === c);
            if (!its.length) return null;
            const all2 = all.filter((i) => catOf(i) === c);
            return (
              <Fragment key={c}>
                <div className={'group' + (c === curCat ? ' cur' : '')} ref={(n) => (refs.current[c] = n)}><E k={CATS[c].e} /><span className="gl">{c === curCat ? 'Teraz: ' : ''}{CATS[c].n}</span><span className="cnt">{all2.length - its.length} / {all2.length}</span></div>
                <div className={'lst big' + (g ? ' glass2' : '')}>
                  {its.map((it) => (
                    <div key={it.id} className={'row tap' + (it.flash && Date.now() - it.flash < 1500 ? ' flash' : '')} onClick={() => toggle(it)} onContextMenu={(e) => { e.preventDefault(); setMenu(it.id); }}>
                      {g && <Check on={false} label={'Odškrtnúť ' + itemName(it)} />}
                      {!g && <span className="th"><E k={pe(it.pid)} /></span>}
                      <div className="tx"><b>{itemName(it)}</b><span className="sub">{fmtQty(it.q, unitOf(it))} · <PriceLine it={it} S={S} store={list.store} /></span></div>
                      {g ? <span className="th"><E k={pe(it.pid)} /></span> : <Check on={false} label={'Odškrtnúť ' + itemName(it)} />}
                      <button type="button" className="more" aria-label="Viac možností" onClick={(e) => { e.stopPropagation(); setMenu(menu === it.id ? null : it.id); }}><I n="dots-three-vertical" w="bold" /></button>
                      {menu === it.id && <div className="rmenu" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => { act('patchItem', list.id, it.id, { na: true }); setMenu(null); toast(`${itemName(it)} – nemali, ostane na budúce`, { icon: 'prohibit' }); }}><I n="prohibit" />Nemali</button><button type="button" onClick={() => setMenu(null)}><I n="x" w="bold" />Zrušiť</button></div>}
                    </div>
                  ))}
                </div>
              </Fragment>
            );
          })}
          {!open.length && <div className={'card alldone' + (g ? ' glass2' : '')}><E k="party" s={56} /><div><div className="ttl">Všetko v košíku</div><div className="meta">{t.done} položiek · ~{eur(t.doneV)}</div></div></div>}
          {na.length > 0 && <><div className="group plain"><I n="prohibit" /><span className="gl">Nemali</span></div><div className={'lst' + (g ? ' glass2' : '')}>{na.map((it) => <div key={it.id} className="row done"><span className="th"><E k={pe(it.pid)} /></span><div className="tx"><b>{itemName(it)}</b><span className="sub">ostane v zozname na budúce</span></div><button type="button" className="qty" onClick={() => act('patchItem', list.id, it.id, { na: false })} aria-label="Vrátiť"><I n="arrow-counter-clockwise" w="bold" /></button></div>)}</div></>}
          {t.done > 0 && <>
            <button type="button" className="group plain tgl-g" onClick={() => setShowDone(!showDone)}><I n="check-circle" /><span className="gl">V košíku ({t.done})</span><I n={showDone ? 'caret-up' : 'caret-down'} w="bold" /></button>
            {showDone && <div className={'lst' + (g ? ' glass2' : '')}>{all.filter((i) => i.done).map((it) => <div key={it.id} className="row done tap" onClick={() => toggle(it)}>{g && <Check on label="Vrátiť" />}<span className="th"><E k={pe(it.pid)} /></span><div className="tx"><b>{itemName(it)}</b><span className="sub">{fmtQty(it.q, unitOf(it))}</span></div>{!g && <Check on label="Vrátiť" />}</div>)}</div>}
          </>}
        </div>
      </div>
      <div className="dock solo">
        <Btn cls={(open.length ? 'soft' : 'pri') + ' full big' + (g ? (open.length ? ' gl' : ' a') : '')} onClick={finish} disabled={!t.done}>{open.length ? (t.done ? `Dokončiť nákup · ešte ${open.length}` : 'Odškrtnite, čo dáte do košíka') : 'Dokončiť nákup'}</Btn>
      </div>
    </div>
  );
}

export function FinishSheet({ open, close, listId }) {
  const { S, act, closeModal, modal, toast, theme } = useApp();
  const list = S.lists.find((l) => l.id === listId);
  const [keep, setKeep] = useState(true);
  if (!list) return <Sheet open={false} onClose={close} />;
  const t = listTotals({ ...list, items: list.items.filter((i) => !i.na) }, S);
  const left = list.items.filter((i) => !i.done && !i.na).length;
  const end = () => { act((s) => ({ ...s, shopping: null, requests: s.requests.filter((r) => r.listId !== listId), lists: keep ? s.lists : s.lists.map((l) => l.id === listId ? { ...l, items: l.items.filter((i) => i.done) } : l) })); };
  return (
    <Sheet open={open} onClose={close} label="Dokončiť nákup">
      <div className="finish">
        <E k="bags" s={72} />
        <h2>Nákup dokončený?</h2>
        <p className="meta">{t.done} z {t.n} položiek · odhad ~{eur(t.doneV)}</p>
        {left > 0 && <div className="tgrow"><span>Nekúpené ({left}) nechať v zozname</span><Toggle on={keep} onChange={setKeep} label="Nechať nekúpené" /></div>}
        <div className="callout"><I n="lightbulb" /><span>Odfoťte bloček – skutočné ceny sa zapíšu k položkám a nabudúce bude odhad presnejší.</span></div>
        <Btn cls={'pri full big' + (theme === 'g' ? ' a' : '')} onClick={() => { end(); close(); closeModal(); setTimeout(() => modal('scan', { listId }), 320); }}><I n="camera" />Odfotiť bloček</Btn>
        <Btn cls="soft full" onClick={() => { end(); close(); closeModal(); toast('Nákup uložený – bloček môžete pridať neskôr'); }}>Teraz nie</Btn>
      </div>
    </Sheet>
  );
}

// Sledovanie Luciinho nákupu
export function Follow() {
  const { S, act, closeModal, theme, toast } = useApp();
  const g = theme === 'g';
  const list = S.live && S.lists.find((l) => l.id === S.live.listId);
  const [txt, setTxt] = useState('');
  if (!list) return <div className="scr"><div className="sc"><header className="nb"><IB n="caret-left" onClick={closeModal} label="Späť" /></header><Empty e="cart" t="Nikto práve nenakupuje" /></div></div>;
  const t = listTotals(list, S);
  const fin = t.done === t.n;
  const send = (e) => {
    e.preventDefault(); const v = txt.trim(); if (!v) return;
    const x = parseChunk(v);
    act('addItems', list.id, [x ? (x.pid ? { pid: x.pid, q: x.q, u: x.u } : { n: x.n, q: x.q, u: x.u }) : { n: v, q: 1 }], 'm');
    toast('Lucia to uvidí hneď v zozname');
    setTxt('');
  };
  const items = [...list.items].sort((a, b) => (a.done === b.done ? (b.doneAt || 0) - (a.doneAt || 0) : a.done ? 1 : -1));
  return (
    <div className="scr follow">
      {g && <div className="bgl"><div className="bgb pic-trh_p" /><div className="veil" /></div>}
      <div className="sc">
        <header className="nb"><IB n="caret-left" label="Späť" onClick={closeModal} /><span className="nbt sh">Nakupuje: Lucia</span><span className="ibs" /></header>
        <div className="body">
          <div className={'card ' + (g ? 'glass2' : 'live')}>
            <div className="rowc"><StoreTile k={list.store} s={48} /><div className="grow"><div className={g ? 't1' : 't'}>{storeName(list.store)}</div><div className={g ? 't2' : 's'}>{fin ? 'Hotovo' : 'Nakupuje ' + ago(S.live.started).replace('pred ', '')} · {t.done} z {t.n}</div></div><div className="ra"><div className={g ? 'num' : 'sv'}>{eur(t.doneV)}</div><div className={g ? 't2' : 's'}>v košíku</div></div></div>
            {!fin && <div className={g ? 'bar' : 'prog'}><i style={{ width: (t.done / t.n) * 100 + '%' }} /></div>}
          </div>
          <p className="hint c">Zoznam sa mení naživo – keď Lucia niečo vloží do košíka, uvidíte to tu.</p>
          <div className={'lst' + (g ? ' glass2' : '')}>
            {items.map((it) => (
              <div key={it.id} className={'row' + (it.done ? ' done' : '') + (it.doneAt && Date.now() - it.doneAt < 4000 ? ' flash' : '')}>
                <span className="th"><E k={pe(it.pid)} /></span>
                <div className="tx"><b>{itemName(it)}</b><span className="sub">{fmtQty(it.q, unitOf(it))}{it.done && it.doneAt ? ' · v košíku ' + ago(it.doneAt) : it.by === 'm' ? ' · pridali ste vy' : ''}</span></div>
                <Check on={it.done} label={it.done ? 'V košíku' : 'Ešte nie'} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {!fin && <div className="dock">
        <form className={'field' + (g ? ' glass2' : '')} onSubmit={send}><input id="ask-lucia" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Poprosiť o…, napr. „smotana“" autoComplete="off" aria-label="Poprosiť Luciu" /><button type="submit" className="m" aria-label="Poslať"><I n="paper-plane-right" /></button></form>
      </div>}
    </div>
  );
}
