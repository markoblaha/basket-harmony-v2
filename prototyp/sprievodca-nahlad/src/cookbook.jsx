import { useApp, Back, MeBtn, useState, useEffect, useRef, Fragment, I, E, IB, Btn, pe, Seg, Stepper, Check, Empty } from './ui.jsx';
import { PRODUCTS, RECIPES, RCATS, RCOLS, RSOURCES } from './data.js';
import { plural, allRecipes, recipeById, recipeCost, haveCount, eur, unitPrice, buyQty, fmtQty, dkey, addDays, dayName, dayShort, relDay, norm, matchProduct } from './logic.js';
import { nextOpenList } from './store.js';
import { hasHome, homeDefault, toggleRecipeHave } from './logic.js';
import { AiBadge, Gallery, BookIngredients, BookSteps, BookInfo, TasteEntry, wishName } from './book.jsx';
import { BOOK } from './book.js';
import { HelpBtn } from './coach.jsx';

/* icons: globe magnifying-glass microphone x heart camera link play calendar-blank basket clock flame caret-left caret-right export sparkle check-circle plus info cooking-pot books timer */

const CHEAP = 1.2;
const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : m + ' min');
const mine = (r) => ['Nadiktovaný', 'Z fotky'].includes(r.src) || (r.ai && r.src !== 'AI návrh');
const srcLabel = (s) => (s === 'Vlastný recept' ? 'Recepty domácnosti' : s === 'AI návrh' ? 'Návrhy od AI' : s);

// Karta receptu – rovnaká všade: obrázok, názov, čas a cena za porciu
export function RCard({ r, onOpen, wide }) {
  const { S, theme } = useApp();
  const g = theme === 'g';
  const h = haveCount(r, S);
  const fav = S.favorites.includes(r.id);
  const meta = `${r.min} min · ${eur(recipeCost(r, S))} / porcia`;
  return (
    <button type="button" className={'rcard' + (wide ? ' wide' : '')} onClick={onOpen}>
      <span className={'rimg' + (r.pic ? ' pic-' + r.pic : ' bg-' + (r.bg || 'peach'))}>{!r.pic && <E k={r.e} />}{fav && <span className="rfav"><I n="heart" /></span>}{h.all && h.have === h.all && <span className="rok">Máte všetko</span>}{r.aiTest && <span className="raib"><I n="sparkle" />AI test</span>}</span>
      <span className="rtxt"><b>{r.n}</b><small>{meta}</small></span>
    </button>
  );
}
function Grid({ list, open }) { return <div className="rgrid2">{list.map((r) => <RCard key={r.id} r={r} onOpen={() => open(r, list)} />)}</div>; }

function CatTile({ c, n, onOpen, g }) {
  return (
    <button type="button" className={'ctile pic-' + c.pic} onClick={onOpen}>
      <span><b>{c.n}</b><small>{plural(n, 'recept', 'recepty', 'receptov')}</small></span>
    </button>
  );
}

const STOP = new Set('uvarit uvarime uvarim nieco recept recepty navrhni napad hodiny hodinu hodina minut minuty pol rychle rychlo jedlo dnes vecer obed chcem mame mam pre deti'.split(' '));
function localSearch(q, skip = 0) {
  const t = norm(q);
  const ws = t.split(' ').filter((w) => w.length > 3 && !STOP.has(w));
  const mm = t.match(/(\d+)\s*min/); const lim = mm ? +mm[1] : /pol hodin/.test(t) || /rychl/.test(t) ? 30 : /hodin/.test(t) ? 60 : null;
  const sweet = /sladk|ranajk/.test(t), soup = /polievk/.test(t), kids = /deti|dieta/.test(t);
  return RECIPES.map((r) => {
    const hay = norm(r.n + ' ' + r.tags.join(' ') + ' ' + r.ing.map((x) => (PRODUCTS[x[0]] ? PRODUCTS[x[0]].n + ' ' + PRODUCTS[x[0]].syn : '')).join(' '));
    let s = 0; for (const w of ws) if (hay.includes(w.slice(0, Math.max(4, w.length - 2)))) s += 2;
    if (lim) s += r.min <= lim ? 1 : -3;
    if (sweet && r.cat === 'sladke') s += 3; if (soup && r.cat === 'polievky') s += 3; if (kids && r.tags.includes('pre deti')) s += 2;
    return [s, r];
  }).sort((a, b) => b[0] - a[0] || a[1].min - b[1].min).map((x) => ({ s: x[0], r: x[1] })).slice(skip, skip + 4);
}

export function Recipes() {
  const { S, act, push, sheet, theme, voice, ai, modal } = useApp();
  const g = theme === 'g';
  const [sec, setSec] = useState('discover');
  const [q, setQ] = useState('');
  const [sr, setSr] = useState(null);
  const all = allRecipes(S);
  const open = (r, list) => push('recipe', { id: r.id, ids: list ? list.map((x) => x.id) : [r.id] });
  const run = async (query, more = false) => {
    const qq = (query || '').trim(); if (!qq) return;
    const prev = more && sr ? sr.ids : [];
    const hits = localSearch(qq, prev.length);
    const strong = hits.filter((x) => x.s > 1).map((x) => x.r.id);
    if (!more && !strong.length) {
      const w = wishName(qq);
      act((s) => ({ ...s, wishes: [...(s.wishes || []).filter((x) => x.q !== w), { q: w, at: Date.now() }] }));
      setSr({ q: qq, ids: hits.map((x) => x.r.id), miss: w }); return;
    }
    setSr({ q: qq, ids: [...prev, ...(more ? hits.map((x) => x.r.id) : strong)] });
  };
  useEffect(() => { if (S.recipeQuery) { setSec('discover'); setQ(S.recipeQuery.q); run(S.recipeQuery.q); } }, [S.recipeQuery && S.recipeQuery.k]);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); const k = dkey(d); return { d, k, i, r: S.week[k] && recipeById(S.week[k], S) }; });
  const favs = all.filter((r) => S.favorites.includes(r.id));
  const own = all.filter(mine);
  const cooked = Object.entries(S.cooked || {}).sort((a, b) => b[1] - a[1]).map(([id]) => recipeById(id, S)).filter(Boolean);
  const recom = [...RECIPES].filter((r) => !Object.values(S.week).includes(r.id)).sort((a, b) => { const ha = haveCount(a, S), hb = haveCount(b, S); return hb.have / hb.all - ha.have / ha.all; }).slice(0, 6);
  const target = nextOpenList(S);
  const planMissing = days.filter((x) => x.r).reduce((a, x) => { const h = haveCount(x.r, S); return a + (h.all - h.have); }, 0);

  return (
    <div className="sc">
      <header className="nb"><MeBtn /><span className="nbt">Recepty</span><HelpBtn screen="recipes" /></header>
      <div className="body">
        <h1 className="lt">Recepty</h1>
        <Seg items={[['discover', 'Kniha receptov'], ['mine', 'Moje'], ['plan', 'Plán týždňa']]} value={sec} onChange={(v) => { setSec(v); }} />

        {sec === 'discover' && <>
          <form className="search" onSubmit={(e) => { e.preventDefault(); run(q); e.currentTarget.querySelector('input').blur(); }}>
            <I n="magnifying-glass" w="bold" /><input id="recipe-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hľadať jedlo alebo surovinu" enterKeyHint="search" autoComplete="off" aria-label="Hľadať recept" />
            {q ? <button type="button" className="m soft" onClick={() => { setQ(''); setSr(null); }} aria-label="Vymazať hľadanie"><I n="x" w="bold" /></button>
              : <button type="button" className="m" onClick={() => voice({ mode: 'search' })} aria-label="Hľadať hlasom"><I n="microphone" /></button>}
          </form>
          {sr ? <>
            <div className="h2">{sr.miss ? 'Podobné recepty' : 'Výsledky'}<button type="button" className="a" onClick={() => { setSr(null); setQ(''); }}>Späť na knihu</button></div>
            {sr.miss && <div className="card wish"><span className="wi"><I n="book-open-text" /></span><div className="grow"><div className="t1">„{sr.q}“ v knihe zatiaľ nemáme</div><p className="meta">Pridali sme to do plánu knihy. Keď recept pribudne, dáme vám vedieť. Recepty si appka nevymýšľa naživo, každý najprv skontrolujeme.</p></div></div>}
            <div className="rgrid2">
              {sr.ids.map((id, i) => { const r = recipeById(id, S); return r ? <div key={id} className="rin" style={{ '--d': (i % 4) * 90 + 'ms' }}><RCard r={r} onOpen={() => push('recipe', { id, ids: sr.ids })} /></div> : null; })}
            </div>
            {!sr.miss && <Btn cls="soft full" onClick={() => run(sr.q, true)}><I n="magnifying-glass" />Ďalšie recepty</Btn>}
          </> : <>
            <TasteEntry />
            <div className="h2">Na otestovanie <span className="cnt">AI</span><button type="button" className="a" onClick={() => push('rcol', { col: 'aitest' })}>Všetky</button></div>
            <p className="meta sm aimeta">Nová kniha receptov: suroviny v skupinách, podrobný postup a 3 fotky. Recept aj fotky vytvorila AI, otestujte ich.</p>
            <div className="rrow">{BOOK.map((r) => <RCard key={r.id} r={r} wide onOpen={() => open(r, BOOK)} />)}</div>
            <div className="h2">Kategórie</div>
            <div className="cgrid">{RCATS.map((c) => <CatTile key={c.id} c={c} g={g} n={c.id === 'all' ? RECIPES.length : RECIPES.filter((r) => r.cat === c.id).length} onOpen={() => push('rcol', { cat: c.id })} />)}</div>
            <div className="h2">Rýchly výber</div>
            <div className="chips">{RCOLS.map((c) => { const n = c.test ? RECIPES.filter(c.test).length : RECIPES.filter((r) => recipeCost(r, S) <= CHEAP).length; return <button type="button" key={c.id} className="chip" onClick={() => push('rcol', { col: c.id })}><E k={c.e} />{c.n}<span className="cn">{n}</span></button>; })}</div>
            <div className="h2">Odporúčame tento týždeň</div>
            <div className="rrow">{recom.map((r) => <RCard key={r.id} r={r} wide onOpen={() => open(r, recom)} />)}</div>
            <div className="h2">Zdroje receptov</div>
            <div className="lst">{RSOURCES.filter((s) => all.some((r) => r.src === s)).map((s) => { const n = all.filter((r) => r.src === s).length; return (
              <button type="button" key={s} className="row tap" onClick={() => push('rcol', { src: s })}><span className="th ic"><I n={s === 'AI návrh' ? 'sparkle' : s.includes('.') ? 'globe' : 'books'} /></span><div className="tx"><b>{srcLabel(s)}</b><span className="sub">{plural(n, 'recept', 'recepty', 'receptov')}</span></div><I n="caret-right" w="bold" cls="chev" /></button>
            ); })}</div>
          </>}
        </>}

        {sec === 'mine' && <>
          <div className="card addrec">
            <div className="t1">Pridať vlastný recept</div>
            <div className="ar3">
              <button type="button" onClick={() => sheet('import', { start: 'photo' })}><I n="camera" />Odfotiť<small>z knihy či obrazovky</small></button>
              <button type="button" onClick={() => sheet('import', { start: 'link' })}><I n="link" />Odkaz<small>z webu</small></button>
              <button type="button" onClick={() => voice({ mode: 'recipe' })}><I n="microphone" />Nadiktovať<small>vlastnými slovami</small></button>
            </div>
          </div>
          <div className="h2">Obľúbené <span className="cnt">{favs.length}</span></div>
          {favs.length ? <Grid list={favs} open={open} /> : <p className="vnote"><I n="heart" />Srdiečkom pri recepte si ho uložíte sem.</p>}
          <div className="h2">Pridané vami <span className="cnt">{own.length}</span></div>
          {own.length ? <Grid list={own} open={open} /> : <p className="vnote"><I n="info" />Recepty, ktoré odfotíte, nadiktujete alebo pridáte odkazom, budú tu.</p>}
          {cooked.length > 0 && <><div className="h2">Naposledy varené</div><Grid list={cooked} open={open} /></>}
        </>}

        {sec === 'plan' && <>
          <p className="meta">Naplánujte jedlá na týždeň. Chýbajúce suroviny pridáte do nákupu jedným ťuknutím.</p>
          <div className="lst weekl">
            {days.map((x) => (
              <button type="button" key={x.k} className="row tap" onClick={() => (x.r ? push('recipe', { id: x.r.id, ids: days.filter((y) => y.r).map((y) => y.r.id) }) : sheet('plan', { day: x.k }))}>
                <span className="dayc"><b>{x.i === 0 ? 'Dnes' : dayShort(x.d)}</b><small>{x.d.getDate()}.</small></span>
                {x.r ? <><span className={'th' + (x.r.pic ? ' pic-' + x.r.pic : ' bg-' + x.r.bg)}>{!x.r.pic && <E k={x.r.e} />}</span><div className="tx"><b>{x.r.n}</b><span className="sub">{x.r.min} min · {(() => { const h = haveCount(x.r, S); return h.have === h.all ? 'všetko máte' : `chýba ${h.all - h.have}`; })()}</span></div></>
                  : <div className="tx"><span className="sub plan-empty"><I n="plus" w="bold" />Vybrať jedlo</span></div>}
              </button>
            ))}
          </div>
          {planMissing > 0 && target && <div className="card dockc"><div className="grow"><div className="t1">Na plán chýba {plural(planMissing, 'surovina', 'suroviny', 'surovín')}</div><div className="meta">pridajú sa do zoznamu {target.name}</div></div><Btn cls="pri sm" onClick={() => { days.filter((x) => x.r).forEach((x) => act('addRecipe', x.r.id, target.id, x.r.por, x.k)); }}>Pridať</Btn></div>}
          {planMissing === 0 && days.some((x) => x.r) && <p className="vnote"><I n="check-circle" />Na všetky naplánované jedlá máte suroviny doma alebo v zozname.</p>}
        </>}
      </div>
    </div>
  );
}

// Zoznam receptov jednej kategórie / výberu / zdroja
export function RecipeCollection({ p }) {
  const { S, pop, push } = useApp();
  const [sort, setSort] = useState('rec');
  const all = allRecipes(S);
  let title = '', list = [], sub = '';
  if (p.cat) { const c = RCATS.find((x) => x.id === p.cat); title = c.n; list = p.cat === 'all' ? RECIPES : RECIPES.filter((r) => r.cat === p.cat); }
  if (p.col && p.col !== 'aitest') { const c = RCOLS.find((x) => x.id === p.col); title = c.n; list = c.test ? RECIPES.filter(c.test) : RECIPES.filter((r) => recipeCost(r, S) <= CHEAP); sub = p.col === 'lacne' ? `do ${eur(CHEAP)} na porciu` : ''; }
  if (p.src) { title = srcLabel(p.src); list = all.filter((r) => r.src === p.src); }
  if (p.col === 'aitest') { title = 'Na otestovanie'; list = BOOK; sub = 'recepty a fotky z AI'; }
  const sorted = [...list].sort(sort === 'fast' ? (a, b) => a.min - b.min : sort === 'cheap' ? (a, b) => recipeCost(a, S) - recipeCost(b, S) : (a, b) => haveCount(b, S).have / haveCount(b, S).all - haveCount(a, S).have / haveCount(a, S).all);
  return (
    <div className="sc">
      <header className="nb"><Back /><span className="nbt">{title}</span><span className="ibs" /></header>
      <div className="body">
        <div><h1 className="lt">{title}</h1><p className="meta">{plural(list.length, 'recept', 'recepty', 'receptov')}{sub ? ' · ' + sub : ''}</p></div>
        <Seg items={[['rec', 'Z toho, čo mám'], ['fast', 'Najrýchlejšie'], ['cheap', 'Najlacnejšie']]} value={sort} onChange={setSort} />
        {sorted.length ? <div className="rgrid2">{sorted.map((r) => <RCard key={r.id} r={r} onOpen={() => push('recipe', { id: r.id, ids: sorted.map((x) => x.id) })} />)}</div> : <Empty e="cooking" t="Zatiaľ prázdne" />}
      </div>
    </div>
  );
}

// Detail receptu – dá sa listovať ako v knihe (šípky alebo potiahnutie obrázka)
export function RecipeScreen({ p }) {
  const { S, act, pop, sheet, modal, theme, toast } = useApp();
  const g = theme === 'g';
  const ids = p.ids && p.ids.length ? p.ids : [p.id];
  const [idx, setIdx] = useState(Math.max(0, ids.indexOf(p.id)));
  const [tab, setTab] = useState('ing');
  const r = recipeById(ids[idx], S);
  const [por, setPor] = useState(r ? r.por : 4);
  const sc = useRef(null); const sw = useRef(null);
  useEffect(() => { if (r) setPor(r.por); setTab('ing'); sc.current && sc.current.scrollTo({ top: 0 }); }, [idx]);
  if (!r) return <div className="sc"><header className="nb"><Back /></header><Empty e="cooking" t="Recept sa nenašiel" /></div>;
  const go = (d) => { const n = idx + d; if (n >= 0 && n < ids.length) setIdx(n); };
  const k = por / r.por;
  const target = nextOpenList(S);
  const inList = new Set(S.lists.flatMap((l) => l.items.filter((i) => !i.done).map((i) => i.pid)));
  const rows = r.ing.map(([pid, use, label, home, nm]) => {
    const pp = PRODUCTS[pid]; const have = hasHome(S, r.id, pid, home); const def = homeDefault(S, pid, home); const listed = inList.has(pid);
    const u = unitPrice(pid, S, target && target.store);
    return { def, pid, pp, label: k === 1 ? label : pp ? fmtQty(Math.round(use * k * 1000) / 1000, pp.u) : label, have, listed, home, cost: u ? u.up * buyQty(pid, use * k) : 0, nm };
  });
  const missing = rows.filter((x) => !x.have && x.pp);
  const mcost = missing.reduce((a, x) => a + x.cost, 0);
  const fav = S.favorites.includes(r.id);
  const share = () => {
    const txt = `${r.n} (${por} porcie)\n\nSuroviny:\n` + rows.map((x) => `• ${x.pp ? x.pp.n : x.nm} – ${x.label}`).join('\n') + '\n\nPostup:\n' + r.steps.map((s, i) => `${i + 1}. ${s[0]}`).join('\n');
    try { navigator.clipboard.writeText(txt).then(() => toast('Recept skopírovaný'), () => toast('Kopírovanie tu nie je povolené', { icon: 'warning-circle' })); } catch { toast('Kopírovanie tu nie je povolené', { icon: 'warning-circle' }); }
  };
  const down = (e) => { sw.current = e.clientX; };
  const up = (e) => { if (sw.current == null) return; const d = e.clientX - sw.current; sw.current = null; if (d < -60) go(1); else if (d > 60) go(-1); };
  const cat = RCATS.find((c) => c.id === r.cat);
  return (
    <>
      <div className="sc rsc" ref={sc} onScroll={(e) => e.currentTarget.classList.toggle('scrolled', e.currentTarget.scrollTop > 220)}>
        <header className="nb over"><Back w={g} /><span className="nbt">{r.n}</span><div className="nbr"><IB n="export" cls={g ? 'wg' : ''} label="Zdieľať" onClick={share} /><IB n="heart" w={fav ? 'fill' : 'bold'} cls={(g ? 'wg' : '') + (fav ? ' faved' : '')} label={fav ? 'Odobrať z obľúbených' : 'Uložiť medzi obľúbené'} onClick={() => { act('toggleFav', r.id); toast(fav ? 'Odobrané z obľúbených' : 'Uložené v Moje → Obľúbené', { icon: 'heart' }); }} /></div></header>
        {r.pics ? <div key={r.id} className="rhero2 rgal"><Gallery r={r} />{ids.length > 1 && <span className="rpos">{idx + 1} / {ids.length}</span>}</div>
          : <div key={r.id} className={'rhero2' + (r.pic ? ' pic-' + r.pic : ' bg-' + r.bg)} onPointerDown={down} onPointerUp={up} style={{ touchAction: 'pan-y' }}>{!r.pic && <E k={r.e} />}{ids.length > 1 && <span className="rpos">{idx + 1} / {ids.length}</span>}</div>}
        <div className="body rbody" key={'b' + r.id}>
          <div><div className="date">{[cat && cat.n, r.cuisine || r.src].filter(Boolean).join(' · ')}</div><h1 className="lt rt">{r.n}</h1>{r.aiTest && <AiBadge />}</div>
          {r.groups ? <div className="facts"><span><I n="clock" />{r.act < r.min ? `${r.act} min práce · ${hm(r.min)} spolu` : hm(r.min)}{r.wait ? ` + ${r.wait}` : ''}</span><span>{r.diff}</span>{r.form && <span>{r.form}</span>}<span><I n="flame" />{r.kcal} kcal</span><span className="gr">{eur(recipeCost(r, S, target && target.store))} / {r.unit ? 'kúsok' : 'porcia'}</span></div>
            : <div className="facts"><span><I n="clock" />{r.min} min</span><span><I n="flame" />{r.kcal} kcal</span><span className="gr">{eur(recipeCost(r, S, target && target.store))} / porcia</span></div>}
          <div className="acts2">
            <button type="button" onClick={() => sheet('plan', { rid: r.id })}><I n="calendar-blank" />Naplánovať</button>
            <button type="button" onClick={() => modal('cook', { id: r.id, por })}><I n="play" />Variť krok po kroku</button>
          </div>
          <Seg items={[['ing', `Suroviny (${r.groups ? r.groups.reduce((a, g) => a + g.items.length, 0) : rows.length})`], ['steps', `Postup (${r.steps.length})`]]} value={tab} onChange={setTab} />
          {r.groups ? (tab === 'ing' ? <>
            <div className="portion"><span className="meta">{r.unit ? 'Koľko kúskov' : 'Pre koľko ľudí'}</span><Stepper q={por} u="por" onChange={(v) => setPor(Math.max(1, Math.min(r.unit ? 48 : 12, v)))} label={r.unit ? `${por} ${r.unit}` : plural(por, 'porcia', 'porcie', 'porcií')} /></div>
            <BookIngredients r={r} k={k} />
            <p className="hint">Ťuknutím prepnete „mám doma“ / „nemám“. Kúpi sa len to, čo nemáte. Nastavenia sa tým nemenia.</p>
          </> : <BookSteps r={r} />) : tab === 'ing' ? <>
            <div className="portion"><span className="meta">Pre koľko ľudí</span><Stepper q={por} u="por" onChange={(v) => setPor(Math.max(1, Math.min(12, v)))} label={plural(por, 'porcia', 'porcie', 'porcií')} /></div>
            <div className="ings">
              {rows.map((x, i) => (
                <div key={i} className={'ing' + (x.have ? ' home' : '') + (x.def && !x.have ? ' nohome' : '')} onClick={() => x.pid && act(toggleRecipeHave(r.id, x.pid, x.have))} role={x.pid ? 'button' : undefined} aria-pressed={x.pid ? !!x.have : undefined}>
                  <span className="th"><E k={pe(x.pid)} /></span>
                  <div className="tx"><b>{x.pp ? x.pp.n.replace(/ ·.*$/, '') : x.nm}</b><span className="sub">{x.label}{x.have ? ' · mám doma' : x.def ? ' · nemám, kúpi sa' : x.cost ? ' · ~' + eur(x.cost) : ''}</span></div>
                  <Check on={x.have} label={x.have ? 'Mám doma' : 'Nemám'} />
                </div>
              ))}
            </div>
            <p className="hint">Ťuknutím prepnete „mám doma“ / „nemám“. Kúpi sa len to, čo nemáte. Nastavenia sa tým nemenia.</p>
          </> : <ol className="steps">{r.steps.map(([t, m], i) => <li key={i}><span className="n">{i + 1}</span><p>{t}{m ? <em> · {m} min</em> : null}</p></li>)}</ol>}
          {r.groups && <BookInfo r={r} />}
          {ids.length > 1 && <div className="pager">
            <button type="button" onClick={() => go(-1)} disabled={idx === 0}><I n="caret-left" w="bold" /><span><small>Predchádzajúci</small>{idx > 0 ? (recipeById(ids[idx - 1], S) || {}).n : ''}</span></button>
            <button type="button" onClick={() => go(1)} disabled={idx === ids.length - 1}><span><small>Ďalší</small>{idx < ids.length - 1 ? (recipeById(ids[idx + 1], S) || {}).n : ''}</span><I n="caret-right" w="bold" /></button>
          </div>}
        </div>
      </div>
      <div className="dock">
        {missing.length ? (
          <div className="card dockc"><div className="grow"><div className="t1">Kúpiť {plural(missing.length, 'surovinu', 'suroviny', 'surovín')}</div><div className="meta">~{eur(mcost)} · čo nemáte doma</div></div><Btn cls="pri sm" onClick={() => sheet('addRecipe', { rid: r.id, por })}><I n="basket" />Pridať</Btn></div>
        ) : (
          <div className="card dockc allok"><I n="check-circle" /><div className="grow"><div className="t1">Všetko máte doma</div><div className="meta">nič netreba kúpiť</div></div><Btn cls="pri sm" onClick={() => modal('cook', { id: r.id, por })}><I n="play" />Variť</Btn></div>
        )}
      </div>
    </>
  );
}
