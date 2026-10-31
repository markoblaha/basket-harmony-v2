import { useApp, I, E, IB, Btn, StoreTile, Avatars, Av, pe, useMemo, Sheet } from './ui.jsx';
import { RECIPES } from './data.js';
import { longDate, greeting, listTotals, eur, eur0, rangeText, relDay, dkey, addDays, dayShort, dayName, storeName, recipeById, haveCount, ago } from './logic.js';
import { nextOpenList } from './store.js';

function useHomeData() {
  const { S } = useApp();
  return useMemo(() => {
    const live = S.live && S.lists.find((l) => l.id === S.live.listId);
    const liveT = live && listTotals(live, S);
    const next = nextOpenList(S);
    const nextT = next && listTotals(next, S, true);
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); const k = dkey(d); return { d, k, r: S.week[k] && recipeById(S.week[k], S), today: i === 0 }; });
    const tonight = days[0].r ? days[0] : days.find((x) => x.r);
    return { live, liveT, next, nextT, days, tonight };
  }, [S]);
}

function when(l) {
  const d = new Date(l.when); const rd = relDay(l.when);
  const hm = d.getHours() || d.getMinutes() ? ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  return rd.charAt(0).toUpperCase() + rd.slice(1) + (rd === 'dnes' || rd === 'zajtra' ? hm : '');
}
export { when };

function LiveCard({ live, liveT, g }) {
  const { modal, S } = useApp();
  const fin = liveT.done === liveT.n;
  const pctv = Math.round((liveT.done / liveT.n) * 100);
  if (g) return (
    <button type="button" className="card glass2 tapc live-g" onClick={() => modal('follow')}>
      <div className="crow"><StoreTile k={live.store} /><div className="g1"><div className="t1">{fin ? 'Lucia dokončila nákup' : `Lucia v ${storeName(live.store) === 'Lidl' ? 'Lidli' : storeName(live.store)}`}{!fin && <span className="dot" />}</div><div className="t2">{fin ? `${liveT.n} položiek · ${eur(liveT.doneV)}` : `${liveT.done} z ${liveT.n} v košíku · ${eur(liveT.doneV)}`}</div></div><span className="pb gl sm">{fin ? 'Pozrieť' : 'Sledovať'}</span></div>
      {!fin && <div className="bar"><i style={{ width: pctv + '%' }} /></div>}
    </button>
  );
  return (
    <button type="button" className="card live tapc" onClick={() => modal('follow')}>
      <span className="k">{fin ? 'Nákup dokončený' : 'Práve nakupuje'}</span>
      <div><div className="t">{fin ? 'Lucia je hotová' : `Lucia v ${storeName(live.store) === 'Lidl' ? 'Lidli' : storeName(live.store)}`}</div><div className="s">{fin ? `${liveT.n} položiek · ${eur(liveT.doneV)}` : `${liveT.done} z ${liveT.n} v košíku · zatiaľ ${eur(liveT.doneV)}`}</div></div>
      <div className="rowc">{!fin && <div className="prog" style={{ flex: 1 }}><i style={{ width: pctv + '%' }} /></div>}<span className="chipbtn">{fin ? 'Pozrieť' : 'Sledovať'}<I n="arrow-right" w="bold" /></span></div>
      <E k="cart" cls="art" />
    </button>
  );
}

function NextCard({ next, nextT, g }) {
  const { jump, modal } = useApp();
  if (!next) return null;
  const open = next.items.filter((i) => !i.done);
  if (g) return (
    <div className="card glass2 tapc" role="button" tabIndex={0} onClick={() => jump('lists', 'list', { id: next.id })}>
      <div className="crow"><StoreTile k={next.store} n={next.name} /><div className="g1"><div className="t1">{next.store ? storeName(next.store) : next.name} · {relDay(next.when)}</div><div className="t2">{open.length} položiek · {rangeText(nextT)}</div></div><span className="num">~{eur0(nextT.v)}</span></div>
      <div className="crow" style={{ justifyContent: 'space-between' }}>
        <span className="stack">{open.slice(0, 4).map((i) => <span key={i.id}><E k={pe(i.pid)} /></span>)}{open.length > 4 && <span><b>+{open.length - 4}</b></span>}</span>
        <button type="button" className="pb a sm" onClick={(e) => { e.stopPropagation(); modal('shop', { listId: next.id }); }}><I n="basket" />Nakupovať</button>
      </div>
    </div>
  );
  return (
    <div className="card tapc" role="button" tabIndex={0} onClick={() => jump('lists', 'list', { id: next.id })}>
      <div className="rowc"><StoreTile k={next.store} n={next.name} s={54} /><div className="grow"><div className="ttl">{next.store ? storeName(next.store) : next.name}</div><div className="meta">{when(next)} · {open.length} položiek</div></div><div className="ra"><div className="price">~{eur0(nextT.v)}</div><div className="meta">{rangeText(nextT)}</div></div></div>
      <div className="rowc" style={{ justifyContent: 'space-between' }}>
        <span className="stack">{open.slice(0, 3).map((i) => <span key={i.id}><E k={pe(i.pid)} /></span>)}{open.length > 3 && <span><b>+{open.length - 3}</b></span>}</span>
        <Btn cls="pri sm" onClick={(e) => { e.stopPropagation(); modal('shop', { listId: next.id }); }}>Ísť nakupovať</Btn>
      </div>
    </div>
  );
}

function Insight({ g }) {
  const { jump } = useApp();
  return (
    <button type="button" className={'card insight tapc' + (g ? ' glass2' : '')} onClick={() => jump('money', 'product', { pid: 'pivo' })}>
      <span className="tile"><E k="beer" /></span>
      <div className="grow"><div className="ib-t">Pivo 12° je v Lidli najlacnejšie</div><div className="meta">0,92 € v Lidli, 1,15 € v Kauflande, 1,29 € v Tescu</div></div>
      <I n="caret-right" w="bold" cls="chev" />
    </button>
  );
}

function QuickActions({ next, g }) {
  const { jump, modal } = useApp();
  const A = [
    ['plus', 'Pridať do nákupu', 'napísať alebo nadiktovať', () => next && jump('lists', 'list', { id: next.id, focus: true })],
    ['camera', 'Odfotiť bloček', 'ceny sa zapíšu samé', () => modal('scan', { listId: next && next.id })],
    ['cooking-pot', 'Čo uvariť?', 'kniha receptov', () => jump('recipes')],
  ];
  return <div className="qa">{A.map(([ic, t, d, fn]) => <button type="button" key={t} className={'qab' + (g ? ' glass2' : '')} onClick={fn}><span className="qi"><I n={ic} w={ic === 'plus' ? 'bold' : 'fill'} /></span><b>{t}</b><small>{d}</small></button>)}</div>;
}

function Tonight({ x, g }) {
  const { push, modal, jump, S } = useApp();
  if (!x || !x.r) return (
    <button type="button" className={'card plan tapc' + (g ? ' glass2' : '')} onClick={() => jump('recipes')}>
      <span className="tile"><E k="cooking" /></span>
      <div className="grow"><div className="k acc">Dnes večer</div><div className="ttl serif">Zatiaľ nič naplánované</div><div className="meta">Vyberte jedlo v knihe receptov</div></div><I n="caret-right" w="bold" cls="chev" />
    </button>
  );
  const h = haveCount(x.r, S);
  return (
    <button type="button" className={'card plan tapc' + (g ? ' glass2' : '')} onClick={() => push('recipe', { id: x.r.id })}>
      {g && x.r.pic ? <span className={'tile tph pic-' + x.r.pic} /> : <span className={'tile bg-' + x.r.bg}><E k={x.r.e} /></span>}
      <div className="grow"><div className="k acc">{x.today ? 'Dnes večer' : dayName(x.d)}</div><div className="ttl serif">{x.r.n}</div><div className="meta">{x.r.min} min · {h.have === h.all ? 'suroviny máte' : `chýba ${h.all - h.have} surovín`}</div></div>
      <span className="btn sm round pri" role="button" aria-label="Variť" onClick={(e) => { e.stopPropagation(); modal('cook', { id: x.r.id }); }}><I n="play" /></span>
    </button>
  );
}

export function Home() {
  const { theme, push, modal, S } = useApp();
  const { live, liveT, next, nextT, days, tonight } = useHomeData();
  const g = theme === 'g';
  const today = days[0];
  return (
    <div className="sc">
      <header className="nb"><button type="button" className="avbtn" onClick={() => push('more')} aria-label="Domácnosť a nastavenia"><Avatars /></button><span className="nbt" /><IB n="gear-six" w="fill" label="Nastavenia" onClick={() => push('more')} /></header>
      <div className="body">
        <h1 className="lt">Domov</h1>
        <QuickActions next={next} g={g} />
        {live && <LiveCard live={live} liveT={liveT} g={g} />}
        <NextCard next={next} nextT={nextT} g={g} />
        <Tonight x={today.r ? today : null} g={g} />
      </div>
    </div>
  );
}

export function NotifSheet({ open, close }) {
  const { S, modal, jump } = useApp();
  const live = S.live && S.lists.find((l) => l.id === S.live.listId);
  const lt = live && listTotals(live, S);
  const l1 = S.lists.find((l) => l.id === 'l1');
  const byL = l1 ? l1.items.filter((i) => i.by === 'l' && !i.done) : [];
  const N = [
    live && lt.done < lt.n && { av: 'l', t: `Nakupuje: Lucia · ${storeName(live.store)}`, d: `${lt.done} z ${lt.n} v košíku`, fn: () => modal('follow') },
    byL.length && { av: 'l', t: `Lucia pridala ${byL.length} položky`, d: `${byL.map((i) => (i.pid ? i.pid : '')).length ? 'do zoznamu ' + l1.name : ''}`, fn: () => jump('lists', 'list', { id: l1.id }) },
    { e: 'beer', t: 'Pivo 12° je v Lidli najlacnejšie', d: '0,92 € oproti 1,15 € v Kauflande', fn: () => jump('money', 'product', { pid: 'pivo' }) },
    { e: 'receipt', t: 'Bloček z Kauflandu (21. 10.)', d: '19,79 € · 3 položky', fn: () => jump('money', 'receipts') },
  ].filter(Boolean);
  return (
    <Sheet open={open} onClose={close} label="Upozornenia">
      <div className="sh-head"><h2>Upozornenia</h2></div>
      <div className="sh-body"><div className="lst notif">{N.map((n, i) => <button type="button" key={i} className="row tap" onClick={() => { close(); setTimeout(n.fn, 200); }}>{n.av ? <Av id={n.av} s={40} /> : <span className="th"><E k={n.e} /></span>}<div className="tx"><b>{n.t}</b><span className="sub">{n.d}</span></div><I n="caret-right" w="bold" cls="chev" /></button>)}</div></div>
    </Sheet>
  );
}
