import { useApp, useState, useEffect, useRef, useLayoutEffect, I, Sheet } from './ui.jsx';
import { initialState } from './store.js';
import { PANTRY } from './data.js';
/* icons: hand-pointing hand-tap house link lock-simple play pause x check arrow-right lightbulb question timer caret-right check-circle arrow-counter-clockwise user-plus note-pencil microphone basket receipt cooking-pot wallet sparkle */

// ===================== Ukážka a sprievodca =====================
// Prvé spustenie: Vitajte (ukážka / naprázdno / pozvánka).
// Ukážka beží na ukážkových údajoch (kópia); vlastné údaje sa pri spustení z „?“ odložia a potom vrátia.
// Kapitola = niekoľko krokov. Krok „info“ má Ďalej, krok „task“ postúpi, až keď človek urobí, čo treba.
// Ťuknúť sa dá len do zvýrazneného miesta; vedľa = jemná rada. „Ukáž mi to“ urobí krok za človeka pred očami.

const q = (root, sel) => (typeof sel === 'function' ? sel(root) : root && root.querySelector(sel));
const byText = (sel, txt) => (root) => [...root.querySelectorAll(sel)].find((e) => e.textContent.includes(txt));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listOf = (S, id) => S.lists.find((l) => l.id === id);
const sig = (x) => JSON.stringify(x || null);

export const CHAPTERS = [
  { n: 'Čo je na Domove', short: 'Domov', ic: 'house', time: '30 s', learn: ['Kde vidíte, čo sa deje dnes', 'Ako sledovať, čo kupuje Lucia', 'Kde je pomoc, keď si neviete rady'], steps: [
    { kind: 'info', go: (c) => c.jump('home'), at: 'home', sel: '.scr.top .home-a', t: 'Toto je Domov', x: 'Tu vidíte, čo sa deje dnes: kto práve nakupuje, najbližší nákup a recepty, ktoré čakajú na uvarenie.' },
    { kind: 'task', at: 'home', sel: '.scr.top .hrow[aria-label="Luciin nákup"]', hand: [.35, .55], t: 'Lucia práve nakupuje', x: 'Čo už má v košíku, vidíte naživo. Ťuknite na riadok s Luciou.',
      done: (S, w) => w.scr === 'm-follow', ok: 'Toto je Luciin nákup. Čo v obchode odškrtne, uvidíte hneď aj vy.' },
    { kind: 'info', go: (c) => { c.closeModal(); c.jump('home'); }, at: 'home', sel: '.tabbar', t: 'Štyri časti appky', x: 'Domov, Nákupy, Recepty a Výdavky. V strede je mikrofón – nákup môžete aj nadiktovať.' },
    { kind: 'info', at: 'home', sel: '.scr.top .nb .helpb', t: 'Pomoc je vždy tu', x: 'Keď si nebudete istí, ťuknite na otáznik vpravo hore. Ukáže tipy k obrazovke alebo časť tejto ukážky.' },
  ] },
  { n: 'Pridať položku', short: 'Písanie', ic: 'note-pencil', time: '40 s', learn: ['Ako napísať, čo treba kúpiť', 'Appka spozná produkt a odhadne cenu', 'Preklep sama neprepíše, len sa opýta'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.jump('home'); }, at: 'home', sel: '.tabbar > button:nth-child(2)', hand: [.5, .45], t: 'Otvorte Nákupy', x: 'Všetky nákupné zoznamy domácnosti sú v časti Nákupy. Ťuknite na ňu dole.',
      done: (S, w) => w.scr === 'lists' },
    { kind: 'task', go: (c) => { c.closeModal(); c.jump('lists'); }, at: 'lists', sel: '.scr.top .lcard', hand: [.3, .4], t: 'Otvorte zoznam', x: 'Ťuknite na zoznam „Veľký nákup“ do Kauflandu.',
      done: (S, w) => w.scr === 'list' },
    { kind: 'task', go: (c) => { c.closeModal(); c.jump('lists', 'list', { id: 'l1' }); }, at: 'list', sel: '.scr.top .dock .field', hand: [.25, .5], t: 'Napíšte, čo treba kúpiť', x: 'Ťuknite do poľa a napíšte „maslo“. Potom ťuknite na šípku alebo Enter.',
      base: (S) => sig(listOf(S, 'l1') && listOf(S, 'l1').items.map((i) => i.id + i.q)), done: (S, w, b) => sig(listOf(S, 'l1') && listOf(S, 'l1').items.map((i) => i.id + i.q)) !== b,
      ok: 'Maslo je v zozname. Appka spoznala produkt a doplnila odhad ceny z bločkov.',
      auto: async (h) => { const inp = h.el('.scr.top .dock input'); await h.tapEl(inp); await h.type(inp, 'maslo'); await sleep(500); await h.tapEl(h.el('.scr.top .dock .field button[type="submit"], .scr.top .dock .field .send') || inp, () => h.submit(inp)); } },
  ] },
  { n: 'Pridať hlasom', short: 'Hlas', ic: 'microphone', time: '30 s', learn: ['Povedať viac vecí naraz', 'Appka pochopí množstvo aj obchod', 'Opraviť hlasom: „radšej kilo“, „zmaž pivo“'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.jump('home'); }, at: 'home', sel: '.tabbar .tmic', hand: [.5, .5], t: 'Ťuknite na mikrofón', x: 'Mikrofón je v strede spodnej lišty. Funguje z každej obrazovky.',
      done: (S, w) => w.scr === 'm-voice' },
    { kind: 'task', go: (c) => c.voice(), at: 'm-voice', sel: '.mdl .vx-ex', hand: [.5, .2], pos: 'top', t: 'Povedzte, čo treba', x: 'Napríklad „dve mlieka a chlieb“. V ukážke stačí ťuknúť na jednu z viet – appka ju „začuje“.',
      done: (S) => !!(S.voiceDraft && S.voiceDraft.items && S.voiceDraft.items.length), okDelay: 1600,
      ok: 'Appka rozumie: položky, množstvo aj obchod. Keď niečo nesedí, stačí povedať „radšej kilo“.',
      auto: async (h) => { await h.tapEl(h.el('.mdl .vx-ex button')); } },
    { kind: 'task', at: 'm-voice', sel: '.mdl .vx-done', hand: [.5, .5], pos: 'top', t: 'Uložte do zoznamu', x: 'Ťuknite na Hotovo. Položky sa pridajú do zoznamu.',
      done: (S, w) => w.scr !== 'm-voice' && !S.voiceDraft, ok: 'Položky sú v zozname. Kto z domácnosti nakupuje, uvidí ich hneď.' },
  ] },
  { n: 'Nakupovať', short: 'Nákup', ic: 'basket', time: '40 s', learn: ['Odškrtávať v obchode', 'Žiadosti od domácnosti naživo', 'Ukončiť nákup'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.closeSheet(); c.jump('lists'); }, at: 'lists', sel: '.scr.top .lcard .lgo', hand: [.5, .5], t: 'Choďte nakupovať', x: 'Ste v obchode? Ťuknite na košík pri zozname „Veľký nákup“.',
      done: (S, w) => w.scr === 'm-shop' },
    { kind: 'task', go: (c) => c.modal('shop', { listId: 'l1' }), at: 'm-shop', sel: '.mdl .lst.big .row', hand: [.3, .5], t: 'Dali ste to do košíka?', x: 'Ťuknite na prvú položku. Odškrtne sa a pásik hore ukáže, koľko ešte zostáva.',
      base: (S) => (listOf(S, 'l1') || { items: [] }).items.filter((i) => i.done).length, done: (S, w, b) => (listOf(S, 'l1') || { items: [] }).items.filter((i) => i.done).length > b },
    { kind: 'task', at: 'm-shop', sel: '.mdl .req', hand: [.85, .5], t: 'Lucia vám niečo poslala', x: 'Kým nakupujete, domácnosť vás môže o niečo požiadať. Ťuknite „Pridať“.',
      setup: (c) => c.act((s) => (s.requests.some((r) => r.listId === 'l1') ? { ...s, shopping: { ...(s.shopping || {}), req: true } } : { ...s, requests: [...s.requests, { id: 'tour-rq', ts: Date.now(), from: 'l', pid: 'smotana', q: 2, listId: 'l1', note: 'na kari' }], shopping: { ...(s.shopping || {}), req: true } })),
      done: (S) => !S.requests.some((r) => r.listId === 'l1'), ok: 'Smotana je v zozname a Lucia dostane potvrdenie, že ju kúpite.',
      auto: async (h) => { await h.tapEl(h.el('.mdl .req .btn')); } },
    { kind: 'task', at: 'm-shop', sel: '.mdl .lst.big', t: 'Dokončite nákup', x: 'Odškrtnite zvyšok. Alebo ťuknite „Ukáž mi to“ a appka to urobí za vás.',
      done: (S, w) => w.sheet === 'finish',
      auto: async (h) => { const r = h.el('.mdl .lst.big .row'); await h.tapEl(r, () => h.act((s) => ({ ...s, lists: s.lists.map((l) => (l.id === 'l1' ? { ...l, items: l.items.map((i) => ({ ...i, done: true })) } : l)) }))); } },
  ] },
  { n: 'Odfotiť bloček', short: 'Bloček', ic: 'receipt', time: '30 s', learn: ['Skutočné ceny k položkám', 'Výdavky sa spočítajú samé', 'Chýbajúci bloček si appka zapamätá'], steps: [
    { kind: 'task', go: (c, S) => { c.closeSheet(); c.modal('scan', { listId: (S.history || [])[0] ? S.history[0].id : 'l1' }); }, at: 's-finish', sel: byText('.sheet .btn', 'Odfotiť'), hand: [.5, .5], pos: 'top', t: 'Nákup je hotový', x: 'Odfoťte bloček a skutočné ceny sa zapíšu samé. V ukážke použijeme pripravenú fotku.',
      done: (S, w) => w.scr === 'm-scan' },
    { kind: 'task', at: 'm-scan', sel: '.mdl .capfoot .btn.pri', hand: [.5, .5], pos: 'top', t: 'Odfoťte bloček', x: 'V ukážke sa fotoaparát nezapne – appka použije pripravenú fotku bločku z Kauflandu.',
      done: (S, w, b, app) => !!app.querySelector('.mdl .scan.res') },
    { kind: 'task', at: 'm-scan', sel: byText('.mdl .scan.res .btn', 'Uložiť'), hand: [.5, .5], pos: 'top', t: 'Skontrolujte a uložte', x: 'Pri každej položke je skutočná cena z bločku. Ťuknite „Uložiť“.',
      done: (S, w) => w.scr !== 'm-scan', ok: 'Bloček je uložený, ceny sú pri položkách a výdavky sa spočítali samé. Keď v obchode ťuknete „Teraz nie“, appka si chýbajúci bloček zapamätá.' },
  ] },
  { n: 'Recept do nákupu', short: 'Recept', ic: 'cooking-pot', time: '40 s', learn: ['Naplánované recepty na Domove', 'Označiť, čo máte doma', 'Suroviny jedným ťuknutím do nákupu'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.closeSheet(); c.jump('home'); }, at: 'home', sel: '.scr.top .hsec[aria-label="Naplánované recepty"] .hrow', hand: [.35, .5], t: 'Recept, ktorý čaká', x: 'V Naplánovaných receptoch je jedlo, ktoré ste si vybrali na tento týždeň. Ťuknite naň.',
      done: (S, w) => w.scr === 'recipe' },
    { kind: 'task', go: (c, S) => { c.closeModal(); c.jump('recipes', 'recipe', { id: S.week[Object.keys(S.week).sort()[0]] || 'rizoto' }); }, at: 'recipe', sel: '.scr.top .ings .ing[role="button"]:not(.home)', hand: [.25, .5], pos: 'top', t: 'Čo máte doma?', x: 'Zelená fajka znamená „mám doma“. Ťuknite na surovinu, ktorú máte – do nákupu pôjde len to, čo chýba.',
      base: (S) => sig(S.recipeHave), done: (S, w, b) => sig(S.recipeHave) !== b },
    { kind: 'task', at: 'recipe', sel: '.scr.top .dock .btn.pri', hand: [.5, .5], pos: 'top', t: 'Suroviny do nákupu', x: 'Ťuknite „Pridať“. Appka sa opýta, do ktorého zoznamu.',
      done: (S, w) => w.sheet === 'addRecipe' },
    { kind: 'task', at: 's-addRecipe', sel: (r) => [...r.querySelectorAll('.sheet .btn.pri')].pop(), hand: [.5, .5], pos: 'top', t: 'Potvrďte', x: 'Predvolene vznikne nový zoznam s menom receptu. Ťuknite na tlačidlo dole.',
      base: (S) => sig(S.lists.map((l) => l.items.length)), done: (S, w, b) => !w.sheet && sig(S.lists.map((l) => l.items.length)) !== b,
      ok: 'Suroviny sú v nákupe. Na karte zoznamu vidno, ku ktorému receptu patria.' },
  ] },
  { n: 'Koľko míňate', short: 'Výdavky', ic: 'wallet', time: '30 s', learn: ['Súčet za mesiac', 'Kategórie a obchody', 'Kde je čo najlacnejšie'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.closeSheet(); c.jump('home'); }, at: 'home', sel: '.tabbar > button:nth-child(5)', hand: [.5, .45], t: 'Otvorte Výdavky', x: 'Všetko, čo domácnosť minula, je v časti Výdavky. Ťuknite na ňu dole.',
      done: (S, w) => w.scr === 'money' },
    { kind: 'info', go: (c) => c.jump('money'), at: 'money', sel: '.scr.top .wx, .scr.top .card.sum', t: 'Koľko ste minuli', x: 'Súčet za mesiac zo všetkých bločkov domácnosti a porovnanie s minulým mesiacom.' },
    { kind: 'task', at: 'money', sel: '.scr.top .card.insight', hand: [.4, .5], t: 'Kde je čo najlacnejšie', x: 'Appka porovnáva ceny z vašich bločkov. Ťuknite na tip.',
      done: (S, w) => w.scr === 'product', ok: 'Tu vidíte, v ktorom obchode je výrobok najlacnejší a ako sa menila cena.' },
  ] },
  { n: 'Pozvať partnera', short: 'Domácnosť', ic: 'user-plus', time: '20 s', learn: ['Kde sú členovia domácnosti', 'Ako poslať pozvánku'], steps: [
    { kind: 'task', go: (c) => { c.closeModal(); c.closeSheet(); c.jump('home'); }, at: 'home', sel: '.scr.top .avbtn', hand: [.5, .6], t: 'Vaša domácnosť', x: 'Ťuknite na avatary vľavo hore. Sú tam členovia domácnosti a nastavenia.',
      done: (S, w) => w.scr === 'more' },
    { kind: 'task', go: (c) => { c.jump('home'); setTimeout(() => c.push('more'), 300); }, at: 'more', sel: byText('.scr.top button.row', 'Pozvať'), hand: [.4, .5], t: 'Pozvite partnera', x: 'Ťuknite na „Pozvať do domácnosti“.',
      done: (S, w, b, app) => !!app.querySelector('.scr.top .invite') },
    { kind: 'info', at: 'more', sel: '.scr.top .invite', pos: 'top', t: 'Kód pre partnera', x: 'Kód pošlite SMS-kou alebo cez WhatsApp. Partner ho zadá v appke a uvidíte rovnaké zoznamy. V ukážke sa nič neodošle.', next: 'Dokončiť ukážku' },
  ] },
];
export const CH_FOR = { home: 0, lists: 1, list: 1, history: 3, histlist: 3, recipes: 5, recipe: 5, rcol: 5, money: 6, receipts: 4, receipt: 4, category: 6, product: 6, store: 6, kind: 6, more: 7 };

// ---------- údaje ----------
const KEEP = ['theme', 'mode', 'coach', 'onb', 'tour', 'v'];
const strip = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !KEEP.includes(k)));
export function demoData(s) { const d = initialState(); return { ...strip(d), noReal: false, solo: false, first: null }; }
export function emptyData() {
  return { lists: [], history: [], missingReceipts: [], week: {}, requests: [], sentRequests: [], shopping: null, live: null, receipts: [], priceLog: {}, favorites: [], aiRecipes: [], cooked: {}, recipeHave: {}, voiceDraft: null,
    have: [...PANTRY], budget: 1000, noReal: true, solo: true, first: { invited: false } };
}
export const startTour = (act, nav, o = {}) => act((s) => {
  const backup = o.fromHelp ? strip(s) : null;
  return { ...s, ...demoData(s), tour: { on: true, ch: o.ch || 0, st: 0, phase: o.only != null || o.ch ? 'step' : 'chapter', only: o.only, backup, fromHelp: !!o.fromHelp, k: Date.now() } };
});

// ---------- vrstva sprievodcu ----------
const PAD = 6;
export function Tour({ appRef, where }) {
  const ctx = useApp();
  const { S, act, jump, closeModal, closeSheet, sheet, toast } = ctx;
  const T = S.tour;
  const [box, setBox] = useState(null);
  const [okS, setOkS] = useState(null); // 'ok' | 'flash'
  const [nudge, setNudge] = useState(0);
  const [play, setPlay] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [resume, setResume] = useState(() => !!(S.tour && S.tour.on && S.tour.phase === 'step'));
  const [cleaning, setCleaning] = useState(false);
  const [waited, setWaited] = useState(false);
  const cardRef = useRef(null);
  const baseRef = useRef(null);
  const stopRef = useRef(false);
  const handRef = useRef(null);
  const tapRef = useRef(null);
  const offAt = useRef(0);

  const C = T && CHAPTERS[T.ch];
  const step = T && T.phase === 'step' && C ? C.steps[T.st] : null;
  const set = (o) => act((s) => (s.tour ? { ...s, tour: { ...s.tour, ...o } } : s));

  const app = () => appRef.current;
  const rootEl = () => app();
  const measure = (el) => { const a = app(); const A = a.getBoundingClientRect(); const s = A.width / a.offsetWidth || 1; const r = el.getBoundingClientRect(); return { x: (r.left - A.left) / s, y: (r.top - A.top) / s, w: r.width / s, h: r.height / s, W: a.offsetWidth, H: a.offsetHeight, rad: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14 }; };
  const findEl = () => step && app() && q(app(), step.sel);

  // vstup do kroku: obrazovka, príprava, východiskový stav
  useEffect(() => {
    if (!step) return;
    setOkS(null); setNudge(0); setBox(null); stopRef.current = true; setPlay(false); setWaited(false);
    const tw = setTimeout(() => setWaited(true), 1200);
    if (step.go && where.scr !== step.at && !(step.at && step.at.startsWith('s-') && where.sheet === step.at.slice(2))) step.go(ctx, S);
    if (step.setup) step.setup(ctx);
    baseRef.current = step.base ? step.base(S) : null;
    return () => clearTimeout(tw);
  }, [T && T.k, T && T.ch, T && T.st, T && T.phase]);

  // splnenie úlohy – kontroluje sa pri každej zmene aj priebežne (niektoré obrazovky menia len svoj vnútorný stav)
  const live = useRef({}); live.current = { S, where };
  const fired = useRef(0);
  useEffect(() => {
    if (!step || okS || step.kind !== 'task') return;
    const k = T.k;
    const check = () => {
      if (!app() || fired.current === k) return;
      if (step.done(live.current.S, live.current.where, baseRef.current, app())) {
        fired.current = k; stopRef.current = true; setPlay(false);
        if (step.ok) setTimeout(() => setOkS('ok'), step.okDelay || 350); else { setOkS('flash'); setTimeout(() => nextRef.current(), 650); }
      }
    };
    check(); const id = setInterval(check, 350);
    return () => clearInterval(id);
  });
  const nextRef = useRef(null);
  // zablúdil (Späť, iné okno) – sprievodca ho vráti
  useEffect(() => {
    if (!step || okS || !step.go || play) return;
    const here = step.at && (step.at.startsWith('s-') ? where.sheet === step.at.slice(2) : where.scr === step.at);
    if (here) { offAt.current = 0; return; }
    const t = setTimeout(() => { if (!findEl()) step.go(ctx, S); }, 1400);
    return () => clearTimeout(t);
  }, [where.scr, where.sheet, step, okS, play]);

  // poloha zvýrazneného miesta
  useEffect(() => {
    if (!step || okS === 'ok') { setBox(null); return; }
    let alive = true; let scrolled = false;
    const tick = () => {
      if (!alive) return; const el = findEl();
      if (!el) { setBox(null); return; }
      const m = measure(el);
      if (!scrolled && (m.y < 60 || m.y + Math.min(m.h, 200) > m.H - 90) && !el.closest('.tabbar') && !el.closest('.dock') && !el.closest('.nb')) { scrolled = true; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      setBox((b) => (!b || Math.abs(b.x - m.x) + Math.abs(b.y - m.y) + Math.abs(b.w - m.w) + Math.abs(b.h - m.h) > 1 ? m : b));
    };
    const t0 = setTimeout(tick, 120); const id = setInterval(tick, 250);
    return () => { alive = false; clearTimeout(t0); clearInterval(id); };
  }, [step, okS, T && T.k]);

  const [chh, setChh] = useState(220);
  useEffect(() => { const a = app(); if (a) a.classList.toggle('cleaning', cleaning); }, [cleaning]);
  useLayoutEffect(() => { if (cardRef.current) { const h = cardRef.current.offsetHeight; if (Math.abs(h - chh) > 2) setChh(h); } });

  if (!T || !T.on) return null;

  // ---------- pomocník „Ukáž mi to“ ----------
  const hand = (x, y, show = true) => { const h = handRef.current; if (!h) return; h.style.opacity = show ? '1' : '0'; h.style.left = x - 14 + 'px'; h.style.top = y - 4 + 'px'; };
  const H = {
    el: (sel) => q(app(), sel),
    act,
    stopped: () => stopRef.current,
    tapEl: async (el, alt, wait = 520) => {
      if (!el || stopRef.current) return; const m = measure(el); hand(m.x + m.w * .5, m.y + m.h * .5); await sleep(wait);
      if (stopRef.current) return; const hh = handRef.current; if (hh) { hh.classList.remove('tap'); void hh.offsetWidth; hh.classList.add('tap'); }
      await sleep(160); if (stopRef.current) return; if (alt) alt(); else { el.focus && el.focus(); el.click(); }
    },
    type: async (inp, text) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (let i = 1; i <= text.length; i++) { if (stopRef.current) return; setter.call(inp, text.slice(0, i)); inp.dispatchEvent(new Event('input', { bubbles: true })); await sleep(125); }
    },
    submit: (inp) => { const f = inp.closest('form'); if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); },
  };
  const showMe = async () => {
    if (!step) return; stopRef.current = false; setPlay(true); setNudge(0);
    try {
      if (step.auto) await step.auto(H);
      else { const el = findEl(); await H.tapEl(el); }
    } finally { setTimeout(() => { setPlay(false); hand(0, 0, false); }, 300); }
  };
  const stopShow = () => { stopRef.current = true; setPlay(false); hand(0, 0, false); };

  // ---------- pohyb v ukážke ----------
  nextRef.current = () => next();
  function next() {
    setOkS(null); setNudge(0);
    if (!C) return;
    if (T.st + 1 < C.steps.length) { set({ st: T.st + 1, k: Date.now() }); return; }
    // kapitola hotová
    const doneCh = { ...((S.onb && S.onb.ch) || {}), [T.ch]: true };
    act((s) => ({ ...s, onb: { ...(s.onb || {}), ch: doneCh } }));
    if (T.only != null) { finish(false); return; }
    if (T.ch + 1 < CHAPTERS.length) set({ phase: 'done', k: Date.now() }); else set({ phase: 'end', k: Date.now() });
  }
  const skipStep = () => { stopShow(); next(); };
  const startChapter = (i) => { set({ ch: i, st: 0, phase: 'step', k: Date.now() }); };
  // koniec ukážky: z „?“ sa vrátia vlastné údaje, po prvom spustení prázdna appka
  function finish(fromEnd) {
    stopShow();
    const T0 = S.tour;
    if (T0.fromHelp && T0.backup) {
      act((s) => ({ ...s, ...T0.backup, tour: null, onb: { ...(s.onb || {}), started: true } }));
      closeModal(); closeSheet(); jump('home');
      setTimeout(() => toast('Ukážka skončila – vaše údaje sú späť', { icon: 'check-circle' }), 300);
      return;
    }
    setCleaning(true); closeModal(); closeSheet(); jump('home');
    setTimeout(() => {
      act((s) => ({ ...s, ...emptyData(), tour: null, onb: { ...(s.onb || {}), started: true, tourDone: !!fromEnd }, coach: { ...(s.coach || {}), welcomed: true, off: false, seen: Object.fromEntries(['mic', 'tabs', 'quick', 'help', 'lcard', 'lgo', 'composer', 'shopbtn', 'shrow', 'shhead', 'vtarget', 'vorb', 'vdone', 'recadd', 'ing', 'scan', 'mrc'].map((x) => [x, 1])) } }));
      setCleaning(false);
    }, 1300);
  }


  // ---------- rozloženie ----------
  const W = app() ? app().offsetWidth : 393, Hh = app() ? app().offsetHeight : 852;
  const tb = app() && app().querySelector('.tabbar');
  const tbY = tb ? measure(tb).y : Hh;
  let hole = null;
  if (box && step) hole = { left: Math.max(3, box.x - PAD), top: Math.max(3, box.y - PAD), width: Math.min(W - 6, box.w + PAD * 2), height: box.h + PAD * 2, r: Math.min((box.h + PAD * 2) / 2, box.rad + PAD) };
  const botOff = Hh - tbY + 10 > Hh * .5 ? 16 : Hh - tbY + 10;
  let cardTop = Hh - botOff - chh;
  if (hole && (step.pos === 'top' || hole.top + hole.height > cardTop - 10)) {
    cardTop = hole.top > Hh * .45 ? Math.max(58, hole.top - chh - 16) : hole.top + hole.height + 16;
    if (step.pos === 'top' && hole.top > chh + 80) cardTop = 58;
  }
  cardTop = Math.max(50, Math.min(Hh - chh - 12, cardTop));
  const taskOpen = step && step.kind === 'task' && !okS;
  const blockClick = (e) => { e.stopPropagation(); e.preventDefault(); if (taskOpen) { setNudge((n) => n + 1); } };
  const blockers = hole && taskOpen && !play
    ? [{ left: 0, top: 0, width: W, height: hole.top }, { left: 0, top: hole.top + hole.height, width: W, height: Hh - hole.top - hole.height }, { left: 0, top: hole.top, width: hole.left, height: hole.height }, { left: hole.left + hole.width, top: hole.top, width: W - hole.left - hole.width, height: hole.height }]
    : [{ left: 0, top: 0, width: W, height: Hh }];
  const prog = (chI, part) => <div className="tx-prog">{CHAPTERS.map((_, i) => <i key={i} className={i < chI ? 'd' : i === chI ? 'c' : ''} style={{ '--p': part + '%' }} />)}</div>;
  const rich = (s) => s.split(/(„[^“]+“)/).map((p, i) => (p.startsWith('„') ? <q key={i}>{p.slice(1, -1)}</q> : p));
  const exitBtn = <button type="button" className="tx-x" onClick={() => setConfirm(true)} aria-label="Ukončiť ukážku">Ukážka<I n="x" w="bold" /></button>;

  // ---------- obrazovky mimo krokov ----------
  if (cleaning) return <div id="tx" className="tx-lay"><div className="tx-label"><span className="tx-spin" /><span>Upratujem ukážku…</span><small>Zoznamy, bločky a recepty Blahovcov odchádzajú. Vaša appka začína od nuly.</small></div></div>;
  if (resume) return (
    <div id="tx" className="tx-lay"><div className="tx-frame" /><div className="tx-scrim" />
      <div className="tx-dlg" role="dialog" aria-modal="true" aria-labelledby="tx-rt">
        <span className="tx-logo sm"><I n="hand-tap" /></span><h2 className="tx-h2" id="tx-rt">Pokračovať v ukážke?</h2>
        <p className="tx-lede">Minule ste skončili pri kapitole {T.ch + 1} – {CHAPTERS[T.ch].n}.</p>
        <div className="tx-st">{prog(T.ch, 0)}</div>
        <button type="button" className="tx-wide p" onClick={() => { setResume(false); set({ st: 0, k: Date.now() }); }}>Pokračovať od kapitoly {T.ch + 1}</button>
        <button type="button" className="tx-wide s" onClick={() => { setResume(false); finish(false); }}>Ukončiť ukážku</button>
        <button type="button" className="tx-skip" onClick={() => { setResume(false); set({ ch: 0, st: 0, phase: 'chapter', k: Date.now() }); }}>Začať odznova</button>
      </div></div>
  );
  const confirmDlg = confirm && (
    <><div className="tx-scrim" onClick={() => setConfirm(false)} /><div className="tx-dlg" role="dialog" aria-modal="true" aria-labelledby="tx-ct">
      <h2 className="tx-h2" id="tx-ct">Ukončiť ukážku?</h2>
      <p className="tx-lede">{T.fromHelp ? 'Vrátite sa k svojim údajom. Ukážku si môžete pustiť znova cez otáznik.' : 'Ukážkové údaje zmiznú a začnete s prázdnou appkou. Ukážku nájdete vo Viac → Pomoc a ukážka.'}</p>
      <button type="button" className="tx-wide p" onClick={() => { setConfirm(false); finish(false); }}>Ukončiť ukážku</button>
      <button type="button" className="tx-wide s" onClick={() => setConfirm(false)}>Pokračovať v ukážke</button>
    </div></>
  );

  if (T.phase === 'paused') return (
    <div id="tx" className="tx-lay free"><div className="tx-frame" />
      <div className="tx-paused"><span className="dot" />{T.endFree ? 'Ukážka' : 'Ukážka · prestávka'}
        {T.endFree ? <button type="button" className="go" onClick={() => set({ phase: 'end', k: Date.now() })}>Ukončiť<I n="arrow-right" w="bold" /></button>
          : <button type="button" className="go" onClick={() => startChapter(T.ch + 1 < CHAPTERS.length ? T.ch + 1 : T.ch)}><I n="play" />Pokračovať</button>}
      </div>{confirmDlg}</div>
  );

  if (T.phase === 'chapter' || T.phase === 'done') {
    const nI = T.phase === 'done' ? T.ch + 1 : T.ch; const N = CHAPTERS[nI]; const D = T.phase === 'done' ? CHAPTERS[T.ch] : null;
    return (
      <div id="tx" className="tx-lay"><div className="tx-frame" /><div className="tx-dim" />
        <div className="tx-chcard" role="dialog" aria-modal="true" aria-labelledby="tx-cht" key={T.k}>
          <div className="tx-top">{D ? <span className="tx-chap ok"><span className="n"><I n="check" w="bold" /></span>Hotovo</span> : <span className="tx-chap">Ukážka · 8 kapitol</span>}{exitBtn}</div>
          {D && <p className="tx-done">Kapitola {T.ch + 1} „{D.n}“ je za vami · {T.ch + 1} z 8</p>}
          {prog(T.phase === 'done' ? T.ch + 1 : T.ch, 0)}
          <div className="tx-big"><span className="num"><I n={N.ic} /></span><span><small>Kapitola {nI + 1} z 8 · {N.time}</small><h2 className="tx-h2" id="tx-cht">{N.n}</h2></span></div>
          <div className="tx-learn">{N.learn.map((l) => <div key={l}><I n="check-circle" />{l}</div>)}</div>
          <button type="button" className="tx-wide p" onClick={() => startChapter(nI)} autoFocus>{D ? 'Pokračovať' : 'Začať kapitolu'}<I n="arrow-right" w="bold" /></button>
          <div className="tx-row2">
            <button type="button" className="tx-skip" onClick={() => (nI + 1 < CHAPTERS.length ? set({ ch: nI, phase: 'done', k: Date.now() }) : set({ phase: 'end', k: Date.now() }))}>Preskočiť kapitolu</button>
            {D && <button type="button" className="tx-skip" onClick={() => set({ phase: 'paused', k: Date.now() })}>Prestávka</button>}
          </div>
        </div>{confirmDlg}</div>
    );
  }

  if (T.phase === 'end') {
    const conf = Array.from({ length: 28 }, (_, i) => <i key={i} className="tx-confetti" style={{ left: (i * 53) % 370 + 8, animationDelay: (i % 7) * 70 + 'ms', background: ['#ff8a52', '#2fb36a', '#5b8db8', '#e8b85c', '#e07a5f'][i % 5], '--r': (i * 47) % 360 + 'deg', '--x': ((i % 5) - 2) * 14 + 'px' }} />);
    return (
      <div id="tx" className="tx-lay"><div className="tx-full end" role="dialog" aria-modal="true" aria-labelledby="tx-et">
        <div className="tx-conf" aria-hidden="true">{conf}</div>
        <span className="tx-logo ok"><I n="check" w="bold" /></span>
        <h1 className="tx-h1" id="tx-et">{T.fromHelp ? 'Hotovo!' : 'Hotovo! Teraz vaša appka'}</h1>
        <p className="tx-lede">{T.fromHelp ? 'Prešli ste ukážku. Teraz sa vrátite k svojim údajom.' : 'Prešli ste ukážku. Ukážkovú domácnosť teraz upracem a pripravím appku pre vás.'}</p>
        <div className="tx-chl">{CHAPTERS.map((c, i) => <div key={i}><span className={'n' + ((S.onb && S.onb.ch && S.onb.ch[i]) ? ' ok' : '')}>{(S.onb && S.onb.ch && S.onb.ch[i]) ? <I n="check" w="bold" /> : i + 1}</span>{c.n}</div>)}</div>
        <div className="tx-note"><I n="question" /><span>Keď niečo zabudnete, ťuknite na <b>?</b> vpravo hore. Celá ukážka je vo Viac → Pomoc a ukážka.</span></div>
        <div className="tx-endb"><button type="button" className="tx-wide p" onClick={() => finish(true)} autoFocus>{T.fromHelp ? 'Späť k mojim údajom' : 'Pripraviť moju appku'}</button>
          <button type="button" className="tx-wide s" onClick={() => set({ phase: 'paused', endFree: true, k: Date.now() })}>Ešte sa tu porozhliadnem</button></div>
      </div></div>
    );
  }

  if (!step) return null;
  const nSteps = C.steps.length;
  const part = Math.round(((T.st + (okS ? 1 : 0)) / nSteps) * 100);
  const hx = box && step.hand ? box.x + box.w * step.hand[0] : 0, hy = box && step.hand ? box.y + box.h * step.hand[1] : 0;
  return (
    <div id="tx" className={'tx-lay' + (play ? ' playing' : '')}>
      <div className="tx-frame" />
      {blockers.map((b, i) => <div key={i} className="tx-blk" style={b} onClick={blockClick} onPointerDown={(e) => e.stopPropagation()} />)}
      {okS === 'ok' ? <div className="tx-dim soft" /> : hole ? <><div className={'tx-hole' + (okS === 'flash' ? ' fl' : '')} style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height, borderRadius: hole.r }} /><div className="tx-ring" style={{ left: hole.left - 6, top: hole.top - 6, width: hole.width + 12, height: hole.height + 12, borderRadius: hole.r + 6 }} /></> : <div className="tx-dim" />}
      {hole && step.hand && !okS && !play && <span className="tx-hand idle" style={{ left: hx - 14, top: hy - 4 }} aria-hidden="true"><I n="hand-pointing" /></span>}
      <span ref={handRef} className="tx-hand" style={{ opacity: 0 }} aria-hidden="true"><I n="hand-pointing" /></span>
      <div ref={cardRef} className={'tx-card' + (nudge ? ' nudged' : '') + (!box && !waited && okS !== 'ok' ? ' wait' : '')} key={nudge ? 'n' + nudge : 'c'} style={{ top: okS === 'ok' ? Math.max(58, Hh - botOff - chh) : cardTop }} role="dialog" aria-live="polite" aria-labelledby="tx-t">
        <div className="tx-top"><span className="tx-chap"><span className="n">{T.ch + 1}</span>{C.short}<span className="k">· krok {T.st + 1}/{nSteps}</span></span>{exitBtn}</div>
        {okS === 'ok' ? <b className="t" id="tx-t"><span className="tx-okic"><I n="check" w="bold" /></span>Výborne!</b> : <b className="t" id="tx-t">{okS === 'flash' && <span className="tx-okic"><I n="check" w="bold" /></span>}{step.t}</b>}
        <p>{rich(okS === 'ok' ? step.ok : step.x)}</p>
        {nudge > 0 && !okS && <div className="tx-nudge"><I n="hand-tap" />{nudge > 1 ? 'Ťuknite na zvýraznené miesto – alebo nechajte appku, nech to ukáže.' : 'Ťuknite na zvýraznené miesto.'}</div>}
        {play ? <div className="tx-act"><span className="tx-play"><span className="bars"><i /><i /><i /><i /></span><span>Appka to robí za vás…</span></span><button type="button" className="tx-ghost" onClick={stopShow}><I n="pause" />Zastaviť</button></div>
          : okS === 'ok' || step.kind === 'info' ? <div className="tx-act"><span /><button type="button" className="tx-ok" onClick={() => { if (step.next) { set({ phase: 'end', k: Date.now() }); act((s) => ({ ...s, onb: { ...(s.onb || {}), ch: { ...((s.onb && s.onb.ch) || {}), [T.ch]: true } } })); } else next(); }} autoFocus>{step.next || 'Ďalej'}{!step.next && <I n="arrow-right" w="bold" />}</button></div>
          : okS === 'flash' ? <div className="tx-act"><span /></div>
          : <div className="tx-act"><button type="button" className="tx-skip" onClick={skipStep}>Preskočiť</button><button type="button" className={'tx-ghost' + (nudge > 1 ? ' hot' : '')} onClick={showMe} disabled={!box}><I n="play" />Ukáž mi to</button></div>}
        {prog(T.ch, part)}
      </div>
      {confirmDlg}
    </div>
  );
}

// ---------- Vitajte (prvé spustenie) ----------
export function Welcome() {
  const { S, act, jump } = useApp();
  const [v, setV] = useState('main'); // main | intro | invite | joined
  const [code, setCode] = useState('');
  if (!S.theme || (S.onb && S.onb.started) || (S.tour && S.tour.on)) return null;
  const startEmpty = () => { act((s) => ({ ...s, ...emptyData(), onb: { ...(s.onb || {}), started: true, path: 'empty' }, coach: { ...(s.coach || {}), welcomed: true, off: false, seen: {} } })); jump('home'); };
  const startDemo = () => { act((s) => ({ ...s, ...demoData(s), onb: { ...(s.onb || {}), started: true, path: 'tour' }, coach: { ...(s.coach || {}), welcomed: true, off: true }, tour: { on: true, ch: 0, st: 0, phase: 'chapter', k: Date.now() } })); jump('home'); };
  const join = (tourIt) => { act((s) => ({ ...s, ...demoData(s), onb: { ...(s.onb || {}), started: true, path: 'invite' }, coach: { seen: {}, welcomed: true, off: !tourIt, replay: tourIt ? { screen: 'home', k: Date.now() } : undefined } })); jump('home'); };
  if (v === 'intro') return (
    <div id="tx" className="tx-lay"><div className="tx-scrim" />
      <div className="tx-sheet" role="dialog" aria-modal="true" aria-labelledby="tx-it"><span className="tx-grab" />
        <h2 className="tx-h2" id="tx-it">Zoznámte sa s domácnosťou</h2>
        <div className="tx-fam"><div><span className="tx-av m">M</span><span><b>Marek</b><small>to ste vy</small></span></div><div><span className="tx-av l">L</span><span><b>Lucia</b><small>práve v Lidli</small></span></div></div>
        <p className="tx-lede">Prevediem vás 8 krátkymi kapitolami. V každej si to sami vyskúšate – ťuknete, napíšete, odškrtnete.</p>
        <div className="tx-chl">{CHAPTERS.map((c, i) => <div key={i}><span className="n">{i + 1}</span>{c.n}</div>)}</div>
        <div className="tx-note"><I n="lock-simple" /><span>Je to ukážka: nič sa neuloží ani nikomu neodošle. Kedykoľvek môžete skončiť.</span></div>
        <button type="button" className="tx-wide p" onClick={startDemo} autoFocus><I n="play" />Začať prehliadku</button>
        <button type="button" className="tx-wide s" onClick={() => setV('main')}>Späť</button>
      </div></div>
  );
  if (v === 'invite') return (
    <div id="tx" className="tx-lay"><div className="tx-scrim" />
      <form className="tx-sheet" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) setV('joined'); }} aria-labelledby="tx-vt"><span className="tx-grab" />
        <h2 className="tx-h2" id="tx-vt">Mám pozvánku</h2>
        <p className="tx-lede">Zadajte kód, ktorý vám poslal partner. Nájde ho v appke vo Viac → Pozvať do domácnosti.</p>
        <label className="tx-code"><span>Kód pozvánky</span><input id="tx-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BH-7K2Q" autoComplete="off" autoFocus maxLength={10} /></label>
        <p className="tx-hint">V náhľade funguje akýkoľvek kód so 4 a viac znakmi.</p>
        <button type="submit" className="tx-wide p" disabled={code.trim().length < 4}>Pripojiť sa</button>
        <button type="button" className="tx-wide s" onClick={() => setV('main')}>Späť</button>
      </form></div>
  );
  if (v === 'joined') return (
    <div id="tx" className="tx-lay"><div className="tx-scrim" />
      <div className="tx-dlg" role="dialog" aria-modal="true" aria-labelledby="tx-jt">
        <div className="tx-pair"><span className="tx-av l">L</span><span className="tx-av m">M</span></div>
        <h2 className="tx-h2" id="tx-jt">Vitajte u Blahovcov</h2>
        <p className="tx-lede">Lucia vás pridala do domácnosti. Zoznamy, recepty a výdavky máte odteraz spoločné.</p>
        <button type="button" className="tx-wide p" onClick={() => join(true)} autoFocus><I n="play" />Krátka prehliadka · 1 min</button>
        <button type="button" className="tx-wide s" onClick={() => join(false)}>Rovno do appky</button>
      </div></div>
  );
  return (
    <div id="tx" className="tx-lay"><div className="tx-full" role="dialog" aria-modal="true" aria-labelledby="tx-wt">
      <span className="tx-logo"><I n="basket" /></span>
      <h1 className="tx-h1" id="tx-wt">Vitajte v Basket Harmony</h1>
      <p className="tx-lede">Spoločný nákupný zoznam, recepty a výdavky pre celú domácnosť.</p>
      <div className="tx-opts">
        <button type="button" className="tx-opt rec" onClick={() => setV('intro')} autoFocus><span className="oi"><I n="hand-tap" /></span><span className="ot"><span className="badge">Odporúčame · 4 min</span><b>Prezrieť si ukážku</b><span>Vyskúšate si appku na domácnosti, ktorá ju už používa. Nič sa neuloží.</span></span><I n="caret-right" w="bold" cls="chev" /></button>
        <button type="button" className="tx-opt" onClick={startEmpty}><span className="oi"><I n="house" /></span><span className="ot"><b>Začať naprázdno</b><span>Hneď si vytvoríte vlastnú domácnosť.</span></span><I n="caret-right" w="bold" cls="chev" /></button>
        <button type="button" className="tx-opt" onClick={() => setV('invite')}><span className="oi"><I n="link" /></span><span className="ot"><b>Mám pozvánku</b><span>Pridáte sa k domácnosti cez kód od partnera.</span></span><I n="caret-right" w="bold" cls="chev" /></button>
      </div>
      <p className="tx-foot">Ukážku si môžete pustiť aj neskôr: Viac → Pomoc a ukážka</p>
    </div></div>
  );
}

// ---------- „?“ – ponuka pomoci ----------
const SCR_NAME = { home: 'Domov', lists: 'Nákupy', list: 'Zoznam', recipes: 'Recepty', recipe: 'Recept', money: 'Výdavky', more: 'Viac' };
export function HelpSheet({ open, close, screen }) {
  const { act, jump, closeModal } = useApp();
  const ci = CH_FOR[screen] != null ? CH_FOR[screen] : 0; const c = CHAPTERS[ci];
  const run = (o) => { close(); setTimeout(() => { closeModal(); jump('home'); startTour(act, null, { fromHelp: true, ...o }); }, 280); };
  return (
    <Sheet open={open} onClose={close} label="Pomoc" cls="helpsh">
      <div className="sh-head"><div className="grow"><h2>Pomoc · {SCR_NAME[screen] || 'appka'}</h2><div className="meta">Vyberte, koľko chcete vidieť</div></div></div>
      <div className="sh-body tx-help">
        <button type="button" className="tx-hrow" onClick={() => { close(); act((s) => ({ ...s, coach: { ...(s.coach || {}), welcomed: true, replay: { screen, k: Date.now() } } })); }}><span className="oi"><I n="lightbulb" /></span><span className="ot"><b>Nápovedy na tejto obrazovke</b><span>krátke tipy priamo tu, na vašich údajoch</span></span><I n="caret-right" w="bold" cls="chev" /></button>
        <button type="button" className="tx-hrow" onClick={() => run({ ch: ci, only: ci })}><span className="oi"><I n="play" /></span><span className="ot"><b>Kapitola: {c.n}</b><span>asi {c.time} v ukážke · vaše údaje sa nezmenia</span></span><I n="caret-right" w="bold" cls="chev" /></button>
        <button type="button" className="tx-hrow" onClick={() => run({})}><span className="oi"><I n="hand-tap" /></span><span className="ot"><b>Celá ukážka</b><span>8 kapitol · asi 4 minúty</span></span><I n="caret-right" w="bold" cls="chev" /></button>
      </div>
    </Sheet>
  );
}

// ---------- Viac → Pomoc a ukážka ----------
export function HelpSection({ g }) {
  const { S, act, toast, jump } = useApp();
  const done = (S.onb && S.onb.ch) || {};
  const n = Object.keys(done).length;
  const off = S.coach && S.coach.off;
  return (
    <>
      <div className="h2 sm">Pomoc a ukážka</div>
      <div className={'lst' + (g ? ' glass2' : '')}>
        <button type="button" className="row tap" onClick={() => { jump('home'); startTour(act, null, { fromHelp: true }); }}><span className="th ic"><I n="hand-tap" /></span><div className="tx"><b>Spustiť ukážku</b><span className="sub">8 kapitol · {n ? `${n} z 8 prejdené` : 'asi 4 minúty'} · vaše údaje sa nezmenia</span></div><I n="caret-right" w="bold" cls="chev" /></button>
        <div className="tx-chl inl">{CHAPTERS.map((c, i) => <button type="button" key={i} onClick={() => { jump('home'); startTour(act, null, { fromHelp: true, ch: i, only: i }); }}><span className={'n' + (done[i] ? ' ok' : '')}>{done[i] ? <I n="check" w="bold" /> : i + 1}</span>{c.n}</button>)}</div>
        <button type="button" className="row tap" onClick={() => act((s) => ({ ...s, coach: { ...(s.coach || {}), off: !off, welcomed: true } }))} role="switch" aria-checked={!off}><span className="th ic"><I n="lightbulb" /></span><div className="tx"><b>Nápovedy na obrazovkách</b><span className="sub">krátke tipy pri prvej návšteve obrazovky</span></div><span className={'tx-sw' + (off ? '' : ' on')}><i /></span></button>
        <button type="button" className="row tap" onClick={() => { act((s) => ({ ...s, coach: { seen: {}, off: false, welcomed: true }, tips: {} })); toast('Nápovedy sa znova ukážu na každej obrazovke', { icon: 'lightbulb' }); }}><span className="th ic"><I n="arrow-counter-clockwise" /></span><div className="tx"><b>Ukázať nápovedy znova</b><span className="sub">všetky, ako pri prvom spustení</span></div></button>
      </div>
    </>
  );
}

// ---------- Prvé kroky na prázdnom Domove ----------
export function FirstSteps({ g }) {
  const { S, act, sheet, push, modal } = useApp();
  const F = S.first; if (!F) return null;
  const st = [
    { k: 'list', ok: S.lists.length > 0, t: 'Vytvorte prvý zoznam', d: 'napríklad „Veľký nákup“ na sobotu', b: 'Vytvoriť', fn: () => sheet('newList') },
    { k: 'inv', ok: !!F.invited, t: 'Pozvite domácnosť', d: 'partner uvidí rovnaké zoznamy', b: 'Pozvať', fn: () => push('more', { invite: true }) },
    { k: 'rc', ok: (S.receipts || []).length > 0, t: 'Odfoťte prvý bloček', d: 'výdavky sa začnú počítať samé', b: 'Odfotiť', fn: () => modal('scan', {}) },
  ];
  const n = st.filter((x) => x.ok).length;
  if (n === st.length) return null;
  const firstOpen = st.findIndex((x) => !x.ok);
  return (
    <section className="hsec" aria-label="Prvé kroky">
      <div className={'card tx-first' + (g ? ' glass2' : '')}>
        <div className="hd"><b>Prvé kroky</b><span>{n} z {st.length}</span></div>
        {st.map((x, i) => <div key={x.k} className={'tx-fs' + (x.ok ? ' ok' : '')}><span className="c">{x.ok ? <I n="check" w="bold" /> : i + 1}</span><span className="ot"><b>{x.t}</b><small>{x.d}</small></span>{!x.ok && <button type="button" className={'go' + (i === firstOpen ? '' : ' s')} onClick={x.fn}>{x.b}</button>}</div>)}
        <button type="button" className="tx-hide" onClick={() => act((s) => ({ ...s, first: null }))}>Skryť</button>
      </div>
    </section>
  );
}
