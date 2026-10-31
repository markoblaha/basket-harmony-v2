import { useApp, Back, MeBtn, useState, useMemo, Fragment, I, E, IB, Btn, StoreTile, Sheet, Seg, Empty } from './ui.jsx';
import { PRODUCTS, CATS, STORES } from './data.js';
import { eur, eur0, monthCats, monthTotal, octReceipts, monthReceipts, allReceipts, catsOf, productsOf, insights, weeks, history, unitPrice, storeName, shortDate, catName, num, dkey, addDays, plural, lineEmoji, kindsOf, kindDetail, variantDetail, qtyTxt, perTxt, sizeTxt, variantName } from './logic.js';
import { storeKeyOf } from './real.js';
import { nextOpenList } from './store.js';

/* icons: calendar-blank caret-right caret-left trend-up trend-down storefront receipt camera plus target wallet chart-bar list-bullets */

function usePeriod(per) {
  const { S } = useApp();
  return useMemo(() => {
    const all = allReceipts(S);
    if (per === 'week') {
      const from = dkey(addDays(new Date(), -6)); const w = all.filter((r) => r.date >= from);
      return { title: 'Tento týždeň', total: w.reduce((a, r) => a + r.total, 0), cats: catsOf(w), cnt: w.length, prev: null, receipts: w };
    }
    if (per === 'year') return { title: 'Rok 2026', total: all.reduce((a, r) => a + r.total, 0), cats: catsOf(all), cnt: all.length, prev: null, note: 'od augusta – odkedy sa bločky zbierajú', receipts: all };
    const rs = octReceipts(S);
    return { title: 'Október', total: monthTotal(S), cats: monthCats(S), cnt: rs.length, prev: monthTotal(S, '2026-09'), receipts: rs };
  }, [S, per]);
}

function Donut({ cats, total, center, sub, size = 132 }) {
  const top = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const sum = top.reduce((a, [, v]) => a + v, 0) || 1;
  let acc = 0;
  const stops = top.slice(0, 6).map(([k, v]) => { const a = acc; acc += v / sum * 100; return `${CATS[k] ? CATS[k].col : '#999'} ${a.toFixed(2)}% ${acc.toFixed(2)}%`; });
  stops.push(`var(--card2) ${acc.toFixed(2)}% 100%`);
  return <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${stops.join(',')})` }}><span><b>{center}</b><small>{sub}</small></span></div>;
}

function CatRows({ cats, onOpen, limit = 6, g }) {
  const [all, setAll] = useState(false);
  const top = Object.entries(cats).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  const max = top.length ? top[0][1] : 1;
  return (
    <>
      <div className={'card cats' + (g ? ' glass2' : '')}>
        {(all ? top : top.slice(0, limit)).map(([k, v]) => (
          <button type="button" key={k} className="cat" onClick={() => onOpen(k)}>
            <span className="tile" style={{ '--tc': CATS[k] ? CATS[k].col : '#999' }}><E k={CATS[k] ? CATS[k].e : 'basket'} /></span>
            <div className="g1"><div className="cr"><span>{catName(k)}</span><em>{eur(v)}</em></div><div className="ln"><i style={{ width: Math.max(3, v / max * 100) + '%', background: CATS[k] ? CATS[k].col : '#999' }} /></div></div>
            <I n="caret-right" w="bold" cls="chev" />
          </button>
        ))}
      </div>
      {top.length > limit && <button type="button" className="lnk c" onClick={() => setAll(!all)}>{all ? 'Menej kategórií' : `Všetky kategórie (${top.length})`}</button>}
    </>
  );
}

function storeTotals(rs) {
  const m = {};
  for (const r of rs) { const k = r.storeName; m[k] = m[k] || { name: k, key: r.store || storeKeyOf(k), v: 0, n: 0 }; m[k].v += r.total; m[k].n++; }
  return Object.values(m).sort((a, b) => b.v - a.v);
}


export function Money() {
  const { S, push, sheet, theme, modal } = useApp();
  const g = theme === 'g';
  const [per, setPer] = useState('month');
  const P = usePeriod(per);
  const budget = S.budget;
  const used = per === 'month' ? P.total / budget : null;
  const diff = P.prev ? (P.total - P.prev) / P.prev : null;
  const stores = storeTotals(P.receipts).slice(0, 6);
  const wk = weeks(S); const wmax = Math.max(...wk.map((w) => w.v), 1);
  const topCat = Object.entries(P.cats).sort((a, b) => b[1] - a[1])[0];
  const openCat = (k) => push('category', { cat: k });
  const rbtns = <div className="rbtns"><Btn cls="pri grow" onClick={() => modal('scan', {})}><I n="camera" />Odfotiť bloček</Btn><Btn cls="soft grow" onClick={() => push('receipts')}><I n="receipt" />Všetky bločky</Btn></div>;
  const seg = <Seg items={[['week', 'Týždeň'], ['month', 'Október'], ['year', 'Rok']]} value={per} onChange={setPer} />;
  const empty = !P.total && <Empty e="receipt" t="Tento týždeň zatiaľ žiadny bloček" d="Údaje z bločkov končia 21. 10. Odfoťte bloček po nákupe a hneď sa tu ukáže."><Btn cls={'pri sm' + (g ? ' a' : '')} onClick={() => modal('scan', {})}><I n="camera" />Odfotiť bloček</Btn></Empty>;

  const rest = (
    <>
      {empty || <>
        <div className="h2">Kam peniaze odišli</div>
        <CatRows cats={P.cats} onOpen={openCat} g={g} />
        <div className="h2">Obchody</div>
        <div className="storeg">{stores.map((s) => (
          <button type="button" key={s.name} className={'card stc tapc' + (g ? ' glass2' : '')} onClick={() => push('store', { name: s.name })}>
            <StoreTile k={s.key || s.name} s={40} /><b>{s.name}</b><span className="v">{eur0(s.v)}</span><small>{s.n} {s.n === 1 ? 'nákup' : s.n < 5 ? 'nákupy' : 'nákupov'}</small>
          </button>
        ))}</div>
      </>}
      <div className="h2">Oplatí sa vedieť</div>
      {insights(S).map((x) => <button type="button" key={x.t} className={'card insight tapc' + (g ? ' glass2' : '')} onClick={() => push('product', { pid: x.pid })}><span className="tile"><E k={x.e} /></span><div className="grow"><div className="ib-t">{x.t}</div><div className="meta">{x.d}</div></div><I n="caret-right" w="bold" cls="chev" /></button>)}
      <p className="src-note">Všetko je spočítané zo skutočných bločkov domácnosti (testovacia databáza, august – október 2026) a z bločkov, ktoré odfotíte tu.</p>
    </>
  );

  if (g) return (
    <>
      <div className="sc">
        <header className="nb"><MeBtn /><span className="nbt">Výdavky · {P.title}</span><span className="ibs" /></header>
        <div className="body">
          <div className="wx">
            <span className="place">{P.title}</span>
            <span className="temp">{eur0(P.total).replace(' €', '')}<small>€</small></span>
            {diff != null && <span className="cond">o {Math.abs(Math.round(diff * 100))} % {diff > 0 ? 'viac' : 'menej'} ako september</span>}
            {P.note && <span className="cond">{P.note}</span>}
            {used != null && <button type="button" className="cond bud" onClick={() => sheet('budget')}>Rozpočet {eur0(budget)} · {budget - P.total >= 0 ? `zostáva ${eur0(budget - P.total)}` : `prekročený o ${eur0(P.total - budget)}`}</button>}
          </div>
          {rbtns}
          {seg}
          {per === 'month' && <div className="card glass2 wkc"><span className="kk"><I n="calendar-blank" />Týždne v októbri</span><div className="wk">{wk.map((w) => <div key={w.label}><span>{w.label}</span><span className="tr"><i style={{ width: Math.max(2, w.v / wmax * 100) + '%' }} /></span><em>{eur0(w.v)}</em></div>)}</div></div>}
          {per === 'year' && <div className="card glass2 wkc"><span className="kk"><I n="calendar-blank" />Mesiace</span><div className="wk">{[{ n: 'August', sum: monthTotal(S, '2026-08') }, { n: 'September', sum: monthTotal(S, '2026-09') }, { n: 'Október', sum: monthTotal(S) }].map((m) => <div key={m.n}><span>{m.n.slice(0, 3)}.</span><span className="tr"><i style={{ width: Math.max(2, m.sum / 1000 * 100) + '%' }} /></span><em>{eur0(m.sum)}</em></div>)}</div></div>}
          {P.total > 0 && <div className="mods">
            {topCat && <button type="button" className="mod glass2" onClick={() => openCat(topCat[0])}><span className="kk"><E k={CATS[topCat[0]].e} s={16} />Najviac</span><span className="v">{eur0(topCat[1])}</span><span className="d">{catName(topCat[0])}</span></button>}
            {stores[0] && <button type="button" className="mod glass2" onClick={() => push('store', { name: stores[0].name })}><span className="kk"><I n="storefront" />Obchod</span><span className="v">{eur0(stores[0].v)}</span><span className="d">{stores[0].name} · {stores[0].n} nákupov</span></button>}
            <button type="button" className="mod glass2" onClick={() => push('receipts')}><span className="kk"><I n="receipt" />Bločky</span><span className="v">{P.cnt}</span><span className="d">priemerne {eur0(P.total / Math.max(1, P.cnt))} na nákup</span></button>
            <button type="button" className="mod glass2" onClick={() => sheet('budget')}><span className="kk"><I n="target" />Rozpočet</span><span className="v">{used != null ? Math.round(used * 100) + ' %' : eur0(budget)}</span><span className="d">{used != null ? `z ${eur0(budget)} na mesiac` : 'mesačne'}</span></button>
          </div>}
          {rest}
        </div>
      </div>
    </>
  );
  return (
    <div className="sc">
      <header className="nb"><MeBtn /><span className="nbt">Výdavky</span><span className="ibs" /></header>
      <div className="body">
        <h1 className="lt">Výdavky</h1>
        {rbtns}
        {seg}
        {P.total > 0 && <button type="button" className="card sum tapc" onClick={() => per === 'month' && sheet('budget')}>
          <Donut cats={P.cats} center={used != null ? Math.round(used * 100) + ' %' : eur0(P.total)} sub={used != null ? 'z ' + eur0(budget) : P.title.toLowerCase()} />
          <div className="grow"><div className="meta">Minuli ste</div><div className="price xl">{eur(P.total)}</div>
            {diff != null && <div className={'trend ' + (diff > 0 ? 'up' : 'dn')}><I n={diff > 0 ? 'trend-up' : 'trend-down'} w="bold" />o {Math.abs(Math.round(diff * 100))} % {diff > 0 ? 'viac' : 'menej'}<br />ako v septembri</div>}
            {P.note && <div className="meta sm">{P.note}</div>}
          </div>
        </button>}
        {per === 'month' && <div className="budl"><span>Rozpočet {eur0(budget)}</span><span className={budget - P.total < 0 ? 'over' : ''}>{budget - P.total >= 0 ? `zostáva ${eur0(budget - P.total)}` : `prekročený o ${eur0(P.total - budget)}`}</span></div>}
        {per === 'month' && <div className="card wkc"><div className="k">Týždne v októbri</div><div className="bars">{wk.map((w) => <div key={w.label}><span className="bv">{eur0(w.v)}</span><span className="bb"><i style={{ height: Math.max(3, w.v / wmax * 100) + '%' }} /></span><span className="bl">{w.label}</span></div>)}</div></div>}
        {rest}
      </div>
    </div>
  );
}

// Kategória → druhy (Pivo, Kuracie prsia…). Druh spája značky a balenia; detail ukáže, ktoré presne.
export function CategoryScreen({ p }) {
  const { S, push, theme } = useApp();
  const g = theme === 'g';
  const k = p.cat; const c = CATS[k] || { n: k, e: 'basket', col: '#999' };
  const v = monthCats(S)[k] || 0; const prev = monthCats(S, '2026-09')[k] || 0;
  const kinds = kindsOf(octReceipts(S), k);
  const max = kinds.length ? kinds[0].sum : 1;
  return (
    <>
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">{c.n}</span><span className="ibs" /></header>
        <div className="body">
          <div className="lhead"><span className="tile lg" style={{ '--tc': c.col }}><E k={c.e} s={40} /></span><div className="grow"><h1 className="lt">{c.n}</h1><div className="meta">Október 2026 · {plural(kinds.length, 'druh', 'druhy', 'druhov')}</div></div></div>
          <div className={'card match' + (g ? ' mg' : '')}><div><div className="k">Október</div><div className="price">{eur(v)}</div></div><div className="ra"><div className="k">September</div><div className="price mut">{eur(prev)}</div>{prev > 0 && <div className={'trend sm ' + (v > prev ? 'up' : 'dn')}><I n={v > prev ? 'trend-up' : 'trend-down'} w="bold" />{Math.abs(Math.round((v - prev) / prev * 100))} %</div>}</div></div>
          <div className="h2 sm">Čo ste kúpili</div>
          <div className={'lst' + (g ? ' glass2' : '')}>
            {kinds.map((x) => (
              <button type="button" key={x.kind} className="row tap" onClick={() => push('kind', { kind: x.kind, mo: '2026-10' })}>
                <span className="th"><E k={lineEmoji(x.ls[0])} /></span>
                <div className="tx"><b>{x.kind}</b>
                  <span className="sub">{[`${x.cnt}×`, x.qty ? qtyTxt(x.qty, x.basis) : null, x.avg ? perTxt(x.avg, x.basis) : null].filter(Boolean).join(' · ')}</span>
                  {(x.brands.length > 0 || x.variants > 1) && <span className="sub br">{x.brands.length ? x.brands.slice(0, 3).join(', ') + (x.brands.length > 3 ? '…' : '') : ''}{x.variants > 1 ? `${x.brands.length ? ' · ' : ''}${plural(x.variants, 'výrobok', 'výrobky', 'výrobkov')}` : ''}</span>}
                  <span className="ln"><i style={{ width: x.sum / max * 100 + '%', background: c.col }} /></span></div>
                <b className="amt">{eur(x.sum)}</b><I n="caret-right" w="bold" cls="chev" />
              </button>
            ))}
            {!kinds.length && <p className="meta pad">V októbri v tejto kategórii nič.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

// Druh: koľko, za koľko a za akú cenu za kg/l/ks; podľa značky; výrobky; kde je najlacnejší; nákupy.
const MOS = [['2026-10', 'Október'], ['2026-09', 'September'], ['', 'Aug – Okt']];
export function KindScreen({ p }) {
  const { S, push, theme } = useApp();
  const g = theme === 'g';
  const [mo, setMo] = useState(p.mo ?? '2026-10');
  const d = kindDetail(S, p.kind, mo);
  const c = d.cat ? CATS[d.cat] : null;
  const B = d.basis;
  const bmax = d.brands.length ? d.brands[0].sum : 1;
  const hasBrands = d.brands.some((b) => b.k !== 'Bez značky');
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">{p.kind}</span><span className="ibs" /></header>
      <div className="body">
        <div className="lhead"><span className="tile lg" style={{ '--tc': c ? c.col : '#999' }}><E k={d.ls[0] ? lineEmoji(d.ls[0]) : 'basket'} s={40} /></span><div className="grow"><h1 className="lt">{p.kind}</h1><div className="meta">{c ? c.n : 'Druh'} · všetky značky a balenia</div></div></div>
        <Seg items={MOS} value={mo} onChange={setMo} />
        {!d.cnt ? <p className="vnote"><I n="info" />V tomto období ste tento druh nekúpili.</p> : <>
          <div className={'card kstat' + (g ? ' glass2' : '')}>
            <div><div className="k">Spolu</div><div className="price">{eur(d.sum)}</div><div className="meta sm">{d.cnt}× nákup</div></div>
            <div><div className="k">Nakúpené</div><div className="price">{d.qty ? qtyTxt(d.qty, B) : '–'}</div></div>
            <div><div className="k">Priemer</div><div className="price">{d.avg ? perTxt(d.avg, B) : '–'}</div></div>
          </div>
          {d.min && d.max && d.max.up > d.min.up + .005 && <div className={'card insight' + (g ? ' glass2' : '')}><span className="tile"><E k="moneybag" /></span><div className="grow"><div className="ib-t">Najlacnejšie {perTxt(d.min.up, B)}</div><div className="meta">{variantName(d.min.l)} · {d.min.l.r.storeName} {shortDate(d.min.l.r.date)}<br />Najdrahšie {perTxt(d.max.up, B)} · {variantName(d.max.l)} · {d.max.l.r.storeName}</div></div></div>}
          {hasBrands && <><div className="h2 sm">Podľa značky</div>
            <div className={'lst' + (g ? ' glass2' : '')}>{d.brands.map((b) => (
              <div key={b.k} className="row"><div className="tx"><b>{b.k}</b><span className="sub">{[`${Math.round(b.sum / d.sum * 100)} %`, b.qty ? qtyTxt(b.qty, B) : null, b.avg ? perTxt(b.avg, B) : null].filter(Boolean).join(' · ')}</span><span className="ln"><i style={{ width: b.sum / bmax * 100 + '%', background: c ? c.col : 'var(--acc)' }} /></span></div><b className="amt">{eur(b.sum)}</b></div>
            ))}</div></>}
          <div className="h2 sm">Výrobky</div>
          <div className={'lst' + (g ? ' glass2' : '')}>{d.variants.map((v) => (
            <button type="button" key={v.k} className="row tap" onClick={() => push('variant', { vkey: v.k, kind: p.kind })}>
              <div className="tx"><b>{variantName(v.l)}</b><span className="sub">{[sizeTxt(v.l.size), `${v.cnt}×`, v.qty ? qtyTxt(v.qty, B) : null, v.avg ? perTxt(v.avg, B) : null].filter(Boolean).join(' · ')}</span><span className="sub">naposledy {v.ls[v.ls.length - 1].r.storeName} · {shortDate(v.ls[v.ls.length - 1].r.date)}</span></div>
              <b className="amt">{eur(v.sum)}</b><I n="caret-right" w="bold" cls="chev" />
            </button>
          ))}</div>
          {d.stores.length > 0 && <><div className="h2 sm">Kde je najlacnejší · priemer za {B}</div>
            <div className={'lst' + (g ? ' glass2' : '')}>{d.stores.map((s, i) => (
              <div key={s.k} className="row"><StoreTile k={storeKeyOf(s.k) || s.k} s={34} /><div className="tx"><b>{s.k}</b><span className="sub">{s.cnt}× · spolu {eur(s.sum)}</span></div><div className="kra"><b className="amt">{perTxt(s.avg, B)}</b>{i === 0 && d.stores.length > 1 && <span className="okb">najlacnejšie</span>}</div></div>
            ))}</div></>}
          <div className="h2 sm">Nákupy</div>
          <div className={'lst' + (g ? ' glass2' : '')}>{d.purchases.map((l) => { const q = d.qOf(l); return (
            <button type="button" key={l.id} className="row tap" onClick={() => push('receipt', { id: l.r.id, hl: l.id })}>
              <StoreTile k={storeKeyOf(l.r.storeName) || l.r.storeName} s={34} />
              <div className="tx"><b>{variantName(l)}{l.size ? ` · ${sizeTxt(l.size)}` : ''}</b><span className="sub">{shortDate(l.r.date)} · {l.r.storeName} · {l.u === 'kg' ? `${num(l.q)} kg` : `${num(l.q)} ks`}{q > 0 ? ` · ${perTxt(l.t / q, B)}` : ''}</span></div>
              <b className="amt">{eur(l.t)}</b><I n="caret-right" w="bold" cls="chev" />
            </button>
          ); })}</div>
        </>}
      </div>
    </div>
  );
}

// Výrobok = konkrétna značka a balenie: cena za jednotku v čase a v obchodoch, všetky nákupy.
export function VariantScreen({ p }) {
  const { S, push, theme } = useApp();
  const g = theme === 'g';
  const d = variantDetail(S, p.vkey);
  if (!d.l) return <div className="sc"><header className="nb"><Back /></header><Empty e="receipt" t="Výrobok sa nenašiel" /></div>;
  const l = d.l; const B = d.basis; const c = CATS[l.c] || { col: '#999', n: '' };
  const byStore = {}; for (const x of d.h) (byStore[x.s] = byStore[x.s] || []).push(x.p);
  const stores = Object.entries(byStore).map(([s, a]) => [s, a.reduce((x, y) => x + y, 0) / a.length, a.length]).sort((a, b) => a[1] - b[1]);
  const sum = d.ls.reduce((a, x) => a + x.t, 0);
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">{l.brand || l.n}</span><span className="ibs" /></header>
      <div className="body">
        <div className="lhead"><span className="tile lg" style={{ '--tc': c.col }}><E k={lineEmoji(l)} s={44} /></span><div className="grow"><h1 className="lt">{l.n}</h1><div className="meta">{[l.brand, sizeTxt(l.size), c.n].filter(Boolean).join(' · ')}</div></div></div>
        {<button type="button" className={'card krow' + (g ? ' glass2' : '')} onClick={() => push('kind', { kind: l.kind || l.n })}><span className="kc"><span className="k">Druh</span><b>{l.kind || l.n}</b></span><span className="meta">porovnať všetky značky</span><I n="caret-right" w="bold" cls="chev" /></button>}
        <div className={'card kstat' + (g ? ' glass2' : '')}>
          <div><div className="k">Priemer</div><div className="price">{d.avg ? perTxt(d.avg, B) : '–'}</div></div>
          <div><div className="k">Naposledy</div><div className="price">{d.h.length ? perTxt(d.h[d.h.length - 1].p, B) : eur(l.t)}</div><div className="meta sm">{l.r.storeName} · {shortDate(l.r.date)}</div></div>
          <div><div className="k">Spolu</div><div className="price">{eur(sum)}</div><div className="meta sm">{d.ls.length}× nákup</div></div>
        </div>
        {d.h.length > 1 && <div className={'card' + (g ? ' glass2' : '')}><div className="k">Cena za {B} v čase</div><PriceChart h={d.h} /><div className="legend">{Object.keys(byStore).map((s) => <span key={s}><i style={{ background: storeColors(d.h)[s] }} />{storeName(s)}</span>)}</div></div>}
        {stores.length > 1 && <div className={'card insight' + (g ? ' glass2' : '')}><span className="tile"><E k="moneybag" /></span><div className="grow"><div className="ib-t">Najlacnejšie: {storeName(stores[0][0])} {perTxt(stores[0][1], B)}</div><div className="meta">{stores.slice(1).map(([s, v]) => `${storeName(s)} ${perTxt(v, B)}`).join(' · ')}</div></div></div>}
        <div className="h2 sm">Nákupy z bločkov</div>
        <div className={'lst' + (g ? ' glass2' : '')}>{[...d.ls].reverse().map((x) => { const q = d.qOf(x); return (
          <button type="button" className="row tap" key={x.id} onClick={() => push('receipt', { id: x.r.id, hl: x.id })}>
            <StoreTile k={storeKeyOf(x.r.storeName) || x.r.storeName} s={34} />
            <div className="tx"><b>{x.r.storeName}</b><span className="sub">{shortDate(x.r.date)} · {x.u === 'kg' ? `${num(x.q)} kg` : `${num(x.q)} ks`} za {eur(x.t)}</span></div>
            <b className="amt">{q > 0 ? perTxt(x.t / q, B) : eur(x.t)}</b><I n="caret-right" w="bold" cls="chev" />
          </button>
        ); })}</div>
      </div>
    </div>
  );
}

const PAL = ['#3d7ccf', '#e09a2e', '#c0507a', '#2fa36b', '#8a6fd1', '#6b7280'];
export const storeColors = (h) => { const m = {}; for (const x of h) if (!(x.s in m)) m[x.s] = PAL[Object.keys(m).length % PAL.length]; return m; };
function PriceChart({ h }) {
  if (!h.length) return null;
  const SC = storeColors(h);
  const W = 330, H = 150, L = 34, R = 10, T = 14, B = 26;
  const xs = h.map((x) => new Date(x.d).getTime()); const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1;
  const ps = h.map((x) => x.p); const lo = Math.min(...ps) * .85, hi = Math.max(...ps) * 1.08;
  const X = (t) => L + (t - x0) / (x1 - x0 || 1) * (W - L - R); const Y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const ticks = [lo + (hi - lo) * .15, (lo + hi) / 2, hi - (hi - lo) * .1];
  const path = h.map((x, i) => `${i ? 'L' : 'M'}${X(new Date(x.d).getTime()).toFixed(1)},${Y(x.p).toFixed(1)}`).join(' ');
  return (
    <svg className="pchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vývoj ceny">
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="grid" /><text x={L - 6} y={Y(t) + 4} textAnchor="end" className="axl">{t.toFixed(2).replace('.', ',')}</text></g>)}
      <path d={path} className="pl" fill="none" />
      {h.map((x, i) => <circle key={i} cx={X(new Date(x.d).getTime())} cy={Y(x.p)} r={i === h.length - 1 ? 5.5 : 4} fill={SC[x.s]} className="pt" />)}
      <text x={L} y={H - 6} className="axl">{shortDate(h[0].d)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" className="axl">{shortDate(h[h.length - 1].d)}</text>
    </svg>
  );
}

export function ProductScreen({ p }) {
  const { S, act, pop, push, theme, toast, jump } = useApp();
  const g = theme === 'g';
  const pp = PRODUCTS[p.pid];
  if (!pp) return null;
  const h = history(p.pid, S);
  const u = unitPrice(p.pid, S);
  const per = pp.u === 'kg' ? '/kg' : pp.u === 'l' ? '/l' : pp.u === 'bal' ? '/bal.' : '/ks';
  const byStore = {};
  for (const x of h) (byStore[x.s] = byStore[x.s] || []).push(x.p);
  const cheapest = Object.entries(byStore).map(([s, a]) => [s, Math.min(...a)]).sort((a, b) => a[1] - b[1]);
  const target = nextOpenList(S);
  return (
    <>
      
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">{pp.n}</span><span className="ibs" /></header>
        <div className="body">
          <div className="lhead"><span className="tile lg" style={{ '--tc': CATS[pp.c].col }}><E k={pp.e} s={44} /></span><div className="grow"><h1 className="lt">{pp.n}</h1><div className="meta">{CATS[pp.c].n}{pp.real ? ' · z vašich bločkov' : ''}</div></div></div>
          <div className={'card match' + (g ? ' mg' : '')}>
            <div><div className="k">Bežná cena</div><div className="price">{u ? eur(u.up) : '–'}<small>{per}</small></div><div className="meta sm">{u && !u.approx ? 'medián posledných 3 nákupov' : 'orientačne'}</div></div>
            {u && !u.approx && <div className="ra"><div className="k">Naposledy</div><div className="price mut">{eur(u.last.p)}</div><div className="meta sm">{storeName(u.last.s)} · {shortDate(u.last.d)}</div></div>}
          </div>
          {h.length > 1 && <div className={'card' + (g ? ' glass2' : '')}><div className="k">Vývoj ceny {per}</div><PriceChart h={h} /><div className="legend">{Object.keys(byStore).map((s) => <span key={s}><i style={{ background: storeColors(h)[s] }} />{storeName(s)}</span>)}</div></div>}
          {cheapest.length > 1 && <div className={'card insight' + (g ? ' glass2' : '')}><span className="tile"><E k="moneybag" /></span><div className="grow"><div className="ib-t">Najlacnejšie: {storeName(cheapest[0][0])} {eur(cheapest[0][1])}</div><div className="meta">{cheapest.slice(1).map(([s, v]) => `${storeName(s)} ${eur(v)}`).join(' · ')}</div></div></div>}
          {h.length > 0 && <><div className="h2 sm">Nákupy z bločkov</div><div className={'lst' + (g ? ' glass2' : '')}>{[...h].reverse().map((x, i) => <button type="button" className={'row' + (x.rid ? ' tap' : '')} key={i} disabled={!x.rid} onClick={() => x.rid && push('receipt', { id: x.rid })}><StoreTile k={storeKeyOf(x.s) || x.s} s={34} /><div className="tx"><b>{storeName(x.s)}</b><span className="sub">{shortDate(x.d)}{x.rid ? ' · otvoriť bloček' : ''}</span></div><b className="amt">{eur(x.p)}{per}</b></button>)}</div></>}
          {!h.length && <p className="vnote"><I n="info" />Tento produkt zatiaľ nie je v žiadnom bločku. Cena je orientačná.</p>}
          {target && <Btn cls={'pri' + (g ? ' a' : '')} onClick={() => { act('addItems', target.id, [{ pid: pp.id, q: 1, u: 'ks' }]); toast(`${pp.n} – v zozname ${target.name}`, { action: { label: 'Zobraziť', fn: () => jump('lists', 'list', { id: target.id }) } }); }}><I n="plus" w="bold" />Pridať do zoznamu</Btn>}
        </div>
      </div>
    </>
  );
}

export function StoreScreen({ p }) {
  const { S, pop, push, theme, sheet } = useApp();
  const g = theme === 'g';
  const rs = octReceipts(S).filter((r) => r.storeName === p.name);
  const tot = rs.reduce((a, r) => a + r.total, 0);
  const cats = catsOf(rs);
  const max = Math.max(1, ...Object.values(cats));
  const key = storeKeyOf(p.name);
  return (
    <>
      
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">{p.name}</span><span className="ibs" /></header>
        <div className="body">
          <div className="lhead"><StoreTile k={key || p.name} s={60} /><div className="grow"><h1 className="lt">{p.name}</h1><div className="meta">Október 2026</div></div></div>
          <div className={'card match' + (g ? ' mg' : '')}><div><div className="k">Spolu</div><div className="price">{eur(tot)}</div></div><div className="ra"><div className="k">Nákupy</div><div className="price mut">{rs.length}</div><div className="meta sm">priemerne {eur(tot / Math.max(1, rs.length))}</div></div></div>
          {Object.keys(cats).length > 0 && <><div className="h2 sm">Čo tu kupujete</div><div className={'card cats' + (g ? ' glass2' : '')}>{Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => <button type="button" key={k} className="cat" onClick={() => push('category', { cat: k })}><span className="tile" style={{ '--tc': CATS[k].col }}><E k={CATS[k].e} /></span><div className="g1"><div className="cr"><span>{CATS[k].n}</span><em>{eur(v)}</em></div><div className="ln"><i style={{ width: v / max * 100 + '%', background: CATS[k].col }} /></div></div></button>)}</div></>}
          <div className="h2 sm">Bločky</div>
          <div className={'lst' + (g ? ' glass2' : '')}>{rs.map((r) => <button type="button" key={r.id} className="row tap" onClick={() => push('receipt', { id: r.id })}><span className="th"><E k="receipt" /></span><div className="tx"><b>{shortDate(r.date)} {r.time}</b><span className="sub">{plural(r.lines.length, 'položka', 'položky', 'položiek')}</span></div><b className="amt">{eur(r.total)}</b></button>)}</div>
        </div>
      </div>
    </>
  );
}

export function BudgetSheet({ open, close }) {
  const { S, act, toast } = useApp();
  const [v, setV] = useState(S.budget);
  const spent = monthTotal(S);
  return (
    <Sheet open={open} onClose={close} label="Mesačný rozpočet">
      <div className="sh-head"><h2>Mesačný rozpočet</h2></div>
      <div className="sh-body">
        <div className="bigv">{eur0(v)}</div>
        <input id="budget" type="range" min="300" max="2000" step="50" value={v} onChange={(e) => setV(+e.target.value)} aria-label="Rozpočet" />
        <div className="chips wrap c">{[600, 800, 1000, 1200].map((x) => <button type="button" key={x} className={'chip plain' + (v === x ? ' on' : '')} onClick={() => setV(x)}>{eur0(x)}</button>)}</div>
        <p className="meta c">V októbri ste zatiaľ minuli {eur(spent)} – {Math.round(spent / v * 100)} % z tohto rozpočtu.</p>
        <Btn cls="pri full" onClick={() => { act((s) => ({ ...s, budget: v })); toast('Rozpočet uložený'); close(); }}>Uložiť</Btn>
      </div>
    </Sheet>
  );
}
