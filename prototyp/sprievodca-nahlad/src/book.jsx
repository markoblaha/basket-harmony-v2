import { useApp, Back, useState, useEffect, useRef, I, E, IB, Btn, Check, Av } from './ui.jsx';
import { PRODUCTS, RECIPES, RCATS, MEMBERS } from './data.js';
import { BOOK, PLAN } from './book.js';
import { plural, recipeById, recipeCost, haveCount, eur, norm, hasHome, homeDefault, toggleRecipeHave } from './logic.js';
import { nextOpenList } from './store.js';
/* icons: heart x thumbs-up thumbs-down flag images sparkle timer flame fire check-circle warning lightbulb info caret-right caret-up hand-swipe-left hand-tap shopping-cart book-open-text map-trifold magnifying-glass knife arrow-right play users-three chef-hat */

// ---------- množstvá pri inom počte porcií ----------
const fmtN = (v) => {
  if (v >= 50) return String(Math.round(v / 5) * 5);
  if (v >= 10) return String(Math.round(v));
  const r = Math.round(v * 2) / 2; const w = Math.floor(r);
  return r === w ? String(w) : (w ? w : '') + '½';
};
// Prepočíta čísla v popise („800 g“, „2 PL (15 g)“, „1½ ČL“), ale nie percentá a rozmery formy.
export function scaleLabel(label, k) {
  if (!label || k === 1) return label;
  return label.replace(/(\d+(?:,\d+)?)?(½)?(\s*)(%|×)?/g, (m, a, h, sp, after, off, s) => {
    if (!a && !h) return m;
    if (after) return m;
    if (/×\s*$/.test(s.slice(Math.max(0, off - 3), off))) return m;
    const v = (a ? parseFloat(a.replace(',', '.')) : 0) + (h ? .5 : 0);
    return fmtN(v * k) + sp;
  });
}

// ---------- AI odznak (na otestovanie) ----------
export const AiBadge = ({ sm }) => <span className={'aib' + (sm ? ' sm' : '')}><I n="sparkle" />AI recept · test</span>;

// ---------- galéria 3 fotiek ----------
export function Gallery({ r, cls = '', onPhoto }) {
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const pics = r.pics || [r.pic];
  const NAMES = ['Hlavná fotka', 'Porcia', 'Detail'];
  const go = (k) => { const el = ref.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); };
  return (
    <div className={'gal ' + cls}>
      <div className="gal-s" ref={ref} onScroll={(e) => { const el = e.currentTarget; const n = Math.round(el.scrollLeft / el.clientWidth); if (n !== i) { setI(n); onPhoto && onPhoto(n); } }}>
        {pics.map((p, k) => <div key={k} className={'gal-i pic-' + p} role="img" aria-label={`${r.n} – ${NAMES[k] || 'fotka'}`} />)}
      </div>
      {pics.length > 1 && <div className="gal-d">{pics.map((_, k) => <button type="button" key={k} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={NAMES[k]} />)}</div>}
      {r.aiTest && <span className="gal-l">{NAMES[i]} · ilustračná fotka (AI)</span>}
    </div>
  );
}

// ---------- detail receptu z knihy: suroviny v skupinách ----------
export function BookIngredients({ r, k }) {
  const { S, act } = useApp();
  return (
    <div className="bgroups">
      {r.groups.map((g, gi) => (
        <div key={gi} className="bgrp">
          <div className="bgh">{g.n}</div>
          <div className="ings">
            {g.items.map(([pid, use, label, home, nm], i) => {
              const pp = PRODUCTS[pid]; const have = pid ? hasHome(S, r.id, pid, home) : true; const def = pid && homeDefault(S, pid, home);
              return (
                <div key={i} className={'ing' + (have && pid ? ' home' : '') + (def && !have ? ' nohome' : '')} onClick={() => pid && act(toggleRecipeHave(r.id, pid, have))} role={pid ? 'button' : undefined} aria-pressed={pid ? !!have : undefined}>
                  <span className="th"><E k={pp ? pp.e : 'water'} /></span>
                  <div className="tx"><b>{nm || (pp ? pp.n.replace(/ ·.*$/, '') : '')}</b><span className="sub">{scaleLabel(label, k)}{!pid ? '' : have ? (home && !S.have.includes(pid) ? ' · bežne doma' : ' · mám doma') : def ? ' · nemám, kúpi sa' : ''}</span></div>
                  {pid ? <Check on={!!have} label={have ? 'Mám doma' : 'Nemám'} /> : <span className="bfree">netreba kupovať</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepBoxes({ x }) {
  if (!x) return null;
  return <>
    {x.ok && <div className="sbx ok"><I n="check-circle" /><span><b>Hotové je, keď:</b> {x.ok}</span></div>}
    {x.pz && <div className="sbx pz"><I n="warning" /><span><b>Pozor:</b> {x.pz}</span></div>}
    {x.tip && <div className="sbx tip"><I n="lightbulb" /><span><b>Tip:</b> {x.tip}</span></div>}
  </>;
}

export function BookSteps({ r }) {
  return (
    <ol className="bsteps">
      {r.steps.map(([t, m, x], i) => (
        <li key={i}>
          <span className="n">{i + 1}</span>
          <div className="grow">
            <p>{t}</p>
            {(m > 0 || (x && x.heat)) && <div className="schips">{m > 0 && <span><I n="timer" />{m} min</span>}{x && x.heat && <span><I n="flame" />{x.heat}</span>}</div>}
            <StepBoxes x={x} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BookInfo({ r }) {
  const { S, act, toast } = useApp();
  const rate = (S.aiRate || {})[r.id];
  const set = (v) => { act((s) => ({ ...s, aiRate: { ...(s.aiRate || {}), [r.id]: v } })); toast(v === 'up' ? 'Ďakujem, recept je označený ako dobrý' : v === 'down' ? 'Označené na opravu. V Mape knihy ho uvidíte.' : 'Chyba nahlásená', { icon: v === 'up' ? 'thumbs-up' : 'flag' }); };
  return <>
    {r.variants && r.variants.length > 0 && <div className="binfo">
      <div className="bgh">Obmeny</div>
      <div className="chips wrap">{r.variants.map(([n, st], i) => <span key={i} className={'chip plain vchip' + (st === 'plan' ? ' plan' : '')}>{n}{st === 'plan' && <small>pripravujeme</small>}</span>)}</div>
      <p className="meta sm">Jeden recept, viac obmien. Obmena mení len časť surovín, preto v knihe nie je 20 podobných receptov.</p>
    </div>}
    <div className="binfo grid">
      {r.tools && <div><div className="bgh">Náradie</div><p>{r.tools.join(' · ')}</p></div>}
      {r.allergens && <div><div className="bgh">Alergény</div><p>{r.allergens.join(', ')}</p></div>}
      {r.store && <div><div className="bgh">Skladovanie</div><p>{r.store}</p></div>}
    </div>
    {r.aiTest && <div className="aitest">
      <div className="t1"><I n="sparkle" />Na otestovanie</div>
      <p className="meta">Recept napísala AI podľa štandardu knihy, fotky vytvorila AI ako ilustračné. Ako sa vám páči?</p>
      <div className="aiv">
        <button type="button" className={rate === 'up' ? 'on' : ''} onClick={() => set('up')}><I n="thumbs-up" />Dobrý</button>
        <button type="button" className={rate === 'down' ? 'on' : ''} onClick={() => set('down')}><I n="thumbs-down" />Opraviť</button>
        <button type="button" className={rate === 'flag' ? 'on' : ''} onClick={() => set('flag')}><I n="flag" />Chyba</button>
      </div>
    </div>}
  </>;
}

// ---------- Ochutnávač: recepty ako TikTok ----------
const LUCIA_LIKES = ['segedin', 'lasagne', 'kulajda', 'palacinky', 'rizoto', 'medovnik'];
const LIMIT = 15;
function feedOrder(S) {
  const seen = (S.taste && S.taste.seen) || {};
  const pool = RECIPES.filter((r) => r.pic);
  const score = (r) => { const h = haveCount(r, S); return (r.aiTest ? 10 : 0) + (h.have / Math.max(1, h.all)) * 3 - (seen[r.id] ? 5 : 0) + ((r.id.charCodeAt(0) * 7) % 5) / 5; };
  return [...pool].sort((a, b) => score(b) - score(a)).slice(0, LIMIT).map((r) => r.id);
}

export function Taste() {
  const { S, act, closeModal, push, jump, sheet, toast } = useApp();
  const [ids] = useState(() => feedOrder(S));
  const [cur, setCur] = useState(0);
  const [burst, setBurst] = useState(null);
  const [match, setMatch] = useState(null);
  const [hint, setHint] = useState(!(S.tips && S.tips.taste));
  const ref = useRef(null);
  const tap = useRef(0);
  const likes = (S.taste && S.taste.likes) || [];
  const like = (id, on = true) => {
    act((s) => { const t = s.taste || {}; const l = t.likes || []; return { ...s, taste: { ...t, likes: on ? [...new Set([...l, id])] : l.filter((x) => x !== id) } }; });
    if (on) { setBurst(id + ':' + Date.now()); if (LUCIA_LIKES.includes(id)) setTimeout(() => setMatch(id), 450); }
  };
  const next = () => { const el = ref.current; if (el) el.scrollBy({ top: el.clientHeight, behavior: 'smooth' }); };
  const onScroll = (e) => {
    const el = e.currentTarget; const n = Math.round(el.scrollTop / el.clientHeight);
    if (n !== cur) { setCur(n); if (hint) { setHint(false); act((s) => ({ ...s, tips: { ...(s.tips || {}), taste: true } })); } if (ids[n]) act((s) => ({ ...s, taste: { ...(s.taste || {}), seen: { ...((s.taste || {}).seen || {}), [ids[n]]: Date.now() } } })); }
  };
  const dbl = (id) => { const t = Date.now(); if (t - tap.current < 320) { like(id); tap.current = 0; } else tap.current = t; };
  const open = (id) => jump('recipes', 'recipe', { id, ids: likes.includes(id) ? likes : [id] });
  const target = nextOpenList(S);
  const liked = ids.filter((id) => likes.includes(id)).map((id) => recipeById(id, S)).filter(Boolean);
  return (
    <div className="taste">
      <div className="tst-top">
        <IB n="x" label="Zavrieť Ochutnávač" cls="glass2" onClick={closeModal} />
        <div className="tst-prog" aria-label={`Recept ${Math.min(cur + 1, ids.length)} z ${ids.length}`}>{ids.map((_, k) => <i key={k} className={k < cur ? 'd' : k === cur ? 'c' : ''} />)}</div>
        <span className="tst-cnt"><I n="heart" w="fill" />{liked.length}</span>
      </div>
      <div className="tst-feed" ref={ref} onScroll={onScroll}>
        {ids.map((id, k) => {
          const r = recipeById(id, S); if (!r) return null;
          const h = haveCount(r, S); const on = likes.includes(id);
          return (
            <section key={id} className="tst-card" aria-label={r.n}>
              <div className="tst-ph" onClick={() => dbl(id)}>
                {Math.abs(k - cur) <= 2 ? <Gallery r={r} cls="tst-gal" /> : <div className="gal-i ph-wait" />}
              </div>
              <div className="tst-shade" />
              <div className="tst-info">
                <div className="tst-tags">{r.aiTest && <AiBadge sm />}{r.cuisine && <span className="tg">{r.cuisine}</span>}</div>
                <h2>{r.n}</h2>
                <div className="tst-meta"><span><I n="timer" />{r.min >= 60 ? `${Math.floor(r.min / 60)} h ${r.min % 60 ? (r.min % 60) + ' min' : ''}` : r.min + ' min'}</span><span>{eur(recipeCost(r, S))} / porcia</span>{r.diff && <span>{r.diff}</span>}</div>
                <div className="tst-have">Doma máte {h.have} z {h.all} surovín{LUCIA_LIKES.includes(id) && <span className="tst-who"><Av id="l" s={20} />Lucii sa páči</span>}</div>
                <button type="button" className="tst-open" onClick={() => open(id)}>Celý recept<I n="caret-right" w="bold" /></button>
              </div>
              <div className="tst-rail">
                <button type="button" className={'tr-b' + (on ? ' on' : '')} onClick={() => like(id, !on)} aria-pressed={on}><I n="heart" w={on ? 'fill' : 'bold'} /><span>Chcem</span></button>
                <button type="button" className="tr-b" onClick={next}><I n="thumbs-down" w="bold" /><span>Nie</span></button>
                <button type="button" className="tr-b" onClick={() => sheet('addRecipe', { rid: id, por: r.por })} disabled={!target}><I n="shopping-cart" w="bold" /><span>Nákup</span></button>
                <button type="button" className="tr-b" onClick={() => sheet('plan', { rid: id })}><I n="calendar-blank" w="bold" /><span>Plán</span></button>
              </div>
              {burst && burst.startsWith(id + ':') && <span key={burst} className="tst-burst"><I n="heart" w="fill" /></span>}
            </section>
          );
        })}
        <section className="tst-card tst-end">
          <div className="tst-endin">
            <E k="party" s={64} />
            <h2>Na dnes stačilo</h2>
            <p>Prešli ste {ids.length} receptov. {liked.length ? `Páčili sa vám ${plural(liked.length, 'recept', 'recepty', 'receptov')}:` : 'Nič vás nezaujalo? Zajtra budú iné.'}</p>
            {liked.length > 0 && <div className="tst-liked">{liked.map((r) => <button type="button" key={r.id} onClick={() => open(r.id)}><span className={'th pic-' + r.pic} /><b>{r.n}</b>{LUCIA_LIKES.includes(r.id) && <Av id="l" s={22} />}</button>)}</div>}
            <Btn cls="pri full" onClick={closeModal}>Hotovo</Btn>
          </div>
        </section>
      </div>
      {hint && <div className="tst-hint" onClick={() => { setHint(false); act((s) => ({ ...s, tips: { ...(s.tips || {}), taste: true } })); }}>
        <div><I n="caret-up" w="bold" /><b>Potiahnite hore</b><span>ďalší recept</span></div>
        <div><I n="hand-swipe-left" /><b>Do strany</b><span>ďalšia fotka</span></div>
        <div><I n="heart" w="fill" /><b>Dvakrát ťuknite</b><span>chcem to uvariť</span></div>
      </div>}
      {match && (() => { const r = recipeById(match, S); return (
        <div className="tst-match" onClick={() => setMatch(null)} role="dialog" aria-label="Rodinná zhoda">
          <div className="tm-in">
            <div className="tm-av"><Av id="m" s={58} /><span className="tm-h"><I n="heart" w="fill" /></span><Av id="l" s={58} /></div>
            <h3>Zhoda!</h3>
            <p><b>{r.n}</b> chce aj Lucia.</p>
            <div className="tm-b"><Btn cls="soft" onClick={() => setMatch(null)}>Pokračovať</Btn><Btn cls="pri" onClick={() => { setMatch(null); sheet('plan', { rid: match }); }}><I n="calendar-blank" />Naplánovať</Btn></div>
          </div>
        </div>
      ); })()}
    </div>
  );
}

// Vstup do Ochutnávača na obrazovke Recepty
export function TasteEntry() {
  const { modal, S } = useApp();
  const n = ((S.taste && S.taste.likes) || []).length;
  return (
    <button type="button" className="tentry" onClick={() => modal('taste')}>
      <span className="te-ph"><i className="pic-a_las1" /><i className="pic-a_seg2" /><i className="pic-a_med1" /></span>
      <span className="te-tx"><b>Ochutnávač</b><small>Listujte recepty ako videá. Čo sa páči vám aj Lucii, appka ukáže.</small>{n > 0 && <em><I n="heart" w="fill" />{n} sa vám páči</em>}</span>
      <span className="te-go"><I n="play" w="fill" /></span>
    </button>
  );
}

// ---------- Mapa knihy (pre majiteľa) ----------
const DEMO_MISS = [['kulajda', 0], ['sviečková', 7], ['bryndzové pirohy', 5], ['krémeš', 4], ['rizoto s hríbmi', 3]];
export function BookMap() {
  const { S } = useApp();
  const wishes = S.wishes || [];
  const miss = new Map(DEMO_MISS.filter(([, n]) => n));
  for (const w of wishes) miss.set(w.q, (miss.get(w.q) || 0) + 1);
  const top = [...miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cats = RCATS.filter((c) => c.id !== 'all').map((c) => { const goal = (PLAN.find(([n]) => n === c.n) || [0, 60])[1]; const n = RECIPES.filter((r) => r.cat === c.id).length; const t = RECIPES.filter((r) => r.cat === c.id && r.aiTest).length; return { c, n, t, goal }; });
  const total = RECIPES.length; const goal = cats.reduce((a, x) => a + x.goal, 0);
  const rate = S.aiRate || {};
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">Mapa knihy</span><span className="ibs" /></header>
      <div className="body">
        <div><h1 className="lt">Mapa knihy</h1><p className="meta">Čo v knihe máme, čo chýba a čo ľudia hľadajú. Len pre správcu.</p></div>
        <div className="bm-kpi">
          <div><b>{total}</b><span>receptov</span></div>
          <div><b>{BOOK.length}</b><span>na otestovanie</span></div>
          <div><b>{goal}</b><span>cieľ v pláne</span></div>
        </div>
        <div className="h2 sm">Kategórie</div>
        <div className="bm-keys"><span className="a">zverejnené</span><span className="b">AI test</span><span className="c">chýba do cieľa</span></div>
        <div className="card bm-cats">
          {cats.map(({ c, n, t, goal: g }) => (
            <div key={c.id} className="bm-row">
              <span className="bm-n">{c.n}{n < 12 && <small className="bm-min">pod minimom 12</small>}</span>
              <span className="bm-tr"><i className="a" style={{ width: ((n - t) / g) * 100 + '%' }} /><i className="b" style={{ width: (t / g) * 100 + '%' }} /></span>
              <em>{n} / {g}</em>
            </div>
          ))}
        </div>
        <div className="h2 sm">Hľadali a nenašli</div>
        <div className="lst">
          {top.map(([q, n]) => <div className="row" key={q}><span className="th ic"><I n="magnifying-glass" /></span><div className="tx"><b>{q}</b><span className="sub">{plural(n, 'domácnosť', 'domácnosti', 'domácností')} · {n >= 3 ? 'zaradené do plánu' : 'návrh, čaká na 3 domácnosti'}</span></div><span className={'stat' + (n >= 3 ? ' ok' : '')}>{n >= 3 ? 'v pláne' : 'návrh'}</span></div>)}
        </div>
        <div className="h2 sm">Várky</div>
        <div className="lst">
          <div className="row"><span className="th ic"><I n="sparkle" /></span><div className="tx"><b>Várka 1 · skúšobná</b><span className="sub">{BOOK.length} receptov · 15 fotiek · čaká na vaše hodnotenie</span></div></div>
          <div className="row"><span className="th ic"><I n="calendar-blank" /></span><div className="tx"><b>Várka 2 · návrh</b><span className="sub">20 receptov podľa priority: hľadané, sezóna, kategórie pod minimom</span></div></div>
        </div>
        <div className="h2 sm">Na otestovanie</div>
        <div className="lst">
          {BOOK.map((r) => <div className="row" key={r.id}><span className={'th pic-' + r.pic} /><div className="tx"><b>{r.n}</b><span className="sub">{r.steps.length} krokov · {r.ing.length} surovín · 3 fotky</span></div><span className={'stat' + (rate[r.id] === 'up' ? ' ok' : '')}>{rate[r.id] === 'up' ? 'dobrý' : rate[r.id] === 'down' ? 'opraviť' : rate[r.id] === 'flag' ? 'chyba' : 'nehodnotené'}</span></div>)}
        </div>
      </div>
    </div>
  );
}

// hľadanie: je dopyt jedlo, ktoré v knihe nie je?
export function wishName(q) { return norm(q).replace(/\b(recept|recepty|na|ako|urobit|uvarit)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
