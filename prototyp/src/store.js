import { PRODUCTS, RECIPES, PANTRY } from './data.js';
import { uid, dkey, addDays, buyQty, recipeById, dayLower, unitPrice, itemUnit } from './logic.js';

const KEY = 'bh-proto-v3';
const now = Date.now();
const it = (pid, q, by = 'm', extra = {}) => ({ id: uid(), pid, q, u: 'ks', by, t: now - Math.random() * 3e6, done: false, ...extra });

export function initialState() {
  const today = new Date();
  const fri = (() => { let d = new Date(today); for (let i = 0; i < 7; i++) { if (d.getDay() === 5) return d; d = addDays(d, 1); } return addDays(today, 1); })();
  const grp = { rid: 'gulas', label: `Na hovädzí guláš · ${dayLower(fri)}`, day: dkey(fri) };
  const tomorrow = addDays(today, 1); tomorrow.setHours(17, 30, 0, 0);
  const week = {};
  week[dkey(today)] = 'rizoto';
  week[dkey(fri)] = 'gulas';
  week[dkey(addDays(fri, 1))] = 'palacinky';
  week[dkey(addDays(today, 5))] = week[dkey(addDays(today, 5))] || 'salat';
  return {
    v: 3,
    theme: null, mode: 'system',
    lists: [
      { id: 'l1', name: 'Veľký nákup', store: 'kaufland', when: tomorrow.toISOString(), shared: ['m', 'l'], items: [
        it('kuracie', .35, 'l', { t: now - 6e5, u: 'kg' }), it('mlieko', 2, 'm', { u: 'ks' }), it('rozky', 6), it('banany', 1, 'l', { u: 'ks' }), it('vajcia', 1), it('jogurt', 4, 'l'), it('pivo', 6),
        it('hovadzie', .8, 'm', { grp, u: 'kg' }), it('cibula', 3, 'm', { grp, u: 'ks' }), it('paprika', 2, 'm', { grp, u: 'ks' }),
      ] },
      { id: 'l2', name: 'Drogéria', store: 'dm', when: addDays(today, 3).toISOString(), shared: ['m', 'l'], items: [it('plienky', 1, 'l'), it('vlhcene', 2, 'l'), it('pasta', 1), it('mydlo', 1)] },
      { id: 'l3', name: 'Rýchly nákup', store: 'lidl', when: today.toISOString(), shared: ['m', 'l'], live: true, items: [
        it('chlieb', 1, 'l', { done: true }), it('sunka', 2, 'l', { done: true }), it('eidam', 1, 'l', { done: true }), it('jablka', 1, 'l', { done: true }), it('kofola', 1, 'l', { done: true }),
        it('horalky', 3, 'l'), it('voda', 6, 'l'), it('avokado', 2, 'l'), it('salat', 1, 'l'),
      ] },
    ],
    live: { listId: 'l3', by: 'l', started: now - 12 * 6e4 },
    shopping: null,
    requests: [],
    sentRequests: [],
    week,
    favorites: ['gulas', 'palacinky'],
    aiRecipes: [],
    receipts: [],
    priceLog: {},
    budget: 1000,
    have: [...PANTRY],
    cooked: {},
    ai: true,
  };
}

export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 3) return s; } catch {}
  return initialState();
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function clearSaved() { try { localStorage.removeItem(KEY); } catch {} }

// ---------- akcie (čisté funkcie: stav → nový stav) ----------
// recept určuje presné množstvo (kg, l), inak kusy
const exactUnit = (pid) => (PRODUCTS[pid] && (PRODUCTS[pid].u === 'kg' || PRODUCTS[pid].u === 'l') ? PRODUCTS[pid].u : 'ks');
const mapList = (S, id, f) => ({ ...S, lists: S.lists.map((l) => (l.id === id ? f(l) : l)) });
export const A = {
  addItems(S, listId, items, by = 'm') {
    return mapList(S, listId, (l) => {
      let arr = [...l.items];
      const added = [];
      for (const x of items) {
        const xu = x.u || 'ks';
        const ex = x.pid && arr.find((i) => i.pid === x.pid && !i.done && itemUnit(i) === xu && !i.grp === !x.grp && (!i.grp || i.grp.rid === x.grp.rid)); // 2 ks a 500 g sa nespájajú
        if (ex) { arr = arr.map((i) => (i === ex ? { ...i, q: Math.round((i.q + x.q) * 1000) / 1000, t: Date.now(), flash: Date.now() } : i)); added.push(ex.id); }
        else { const n = { id: uid(), pid: x.pid || null, n: x.n || null, q: x.q, u: xu, by, t: Date.now(), done: false, grp: x.grp || null, flash: Date.now() }; arr = [n, ...arr]; added.push(n.id); }
      }
      return { ...l, items: arr };
    });
  },
  setQty: (S, listId, id, q) => mapList(S, listId, (l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, q } : i)) })),
  patchItem: (S, listId, id, patch) => mapList(S, listId, (l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  removeItem: (S, listId, id) => mapList(S, listId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== id) })),
  restoreItem: (S, listId, item, idx) => mapList(S, listId, (l) => { const a = [...l.items]; a.splice(Math.min(idx, a.length), 0, item); return { ...l, items: a }; }),
  toggleDone: (S, listId, id) => mapList(S, listId, (l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, done: !i.done, na: false, doneAt: Date.now() } : i)) })),
  addList(S, l) { return { ...S, lists: [...S.lists.filter((x) => !x.live), { id: uid(), items: [], shared: ['m', 'l'], ...l }, ...S.lists.filter((x) => x.live)] }; },
  patchList: (S, id, patch) => mapList(S, id, (l) => ({ ...l, ...patch })),
  deleteList: (S, id) => ({ ...S, lists: S.lists.filter((l) => l.id !== id) }),
  clearDone: (S, id) => mapList(S, id, (l) => ({ ...l, items: l.items.filter((i) => !i.done) })),
  addRecipe(S, rid, listId, portions, dayKey) {
    const r = recipeById(rid, S); if (!r) return S;
    const k = portions / r.por;
    const label = `Na ${r.n.charAt(0).toLowerCase() + r.n.slice(1)}` + (dayKey ? ` · ${dayLower(new Date(dayKey))}` : '');
    const grp = { rid, label, day: dayKey || null };
    const items = r.ing.filter((x) => !x[3] && !S.have.includes(x[0]) && x[0] && PRODUCTS[x[0]]).map(([pid, use]) => ({ pid, q: buyQty(pid, use * k), u: exactUnit(pid), grp }));
    const S2 = A.addItems(S, listId, items);
    return dayKey ? { ...S2, week: { ...S2.week, [dayKey]: rid } } : S2;
  },
  planDay: (S, day, rid) => { const w = { ...S.week }; if (rid) w[day] = rid; else delete w[day]; return { ...S, week: w }; },
  toggleFav: (S, rid) => ({ ...S, favorites: S.favorites.includes(rid) ? S.favorites.filter((x) => x !== rid) : [...S.favorites, rid] }),
  toggleHave: (S, pid) => ({ ...S, have: S.have.includes(pid) ? S.have.filter((x) => x !== pid) : [...S.have, pid] }),
  startShopping: (S, listId) => ({ ...S, shopping: { listId, started: Date.now(), req: false } }),
  endShopping: (S) => ({ ...S, shopping: null }),
  pushRequest: (S, r) => ({ ...S, requests: [...S.requests, { id: uid(), ts: Date.now(), ...r }] }),
  dropRequest: (S, id) => ({ ...S, requests: S.requests.filter((r) => r.id !== id) }),
  saveReceipt(S, rec, list, writePrices) {
    const id = uid();
    let S2 = { ...S, receipts: [{ ...rec, id }, ...S.receipts] };
    rec = { ...rec, id };
    if (writePrices) {
      const log = { ...S2.priceLog };
      for (const l of rec.lines) if (l.pid && l.up > 0) log[l.pid] = [...(log[l.pid] || []), { s: rec.store, p: l.up, d: rec.date, rid: rec.id, q: l.u === 'kg' ? l.q : undefined }];
      S2 = { ...S2, priceLog: log };
      if (list) S2 = mapList(S2, list.id, (L) => ({ ...L, items: L.items.map((i) => { const ln = rec.lines.find((x) => x.itemId === i.id); return ln ? { ...i, paid: ln.t, paidQ: ln.q, paidUp: ln.up, paidStore: rec.store, done: true } : i; }) }));
    }
    return { S: S2, id };
  },
  liveTick(S) {
    if (!S.live) return S;
    const l = S.lists.find((x) => x.id === S.live.listId); if (!l) return S;
    const next = l.items.find((i) => !i.done); if (!next) return S;
    return mapList(S, l.id, (L) => ({ ...L, items: L.items.map((i) => (i.id === next.id ? { ...i, done: true, doneAt: Date.now() } : i)) }));
  },
};

export function nextOpenList(S) {
  return S.lists.filter((l) => !l.live && l.items.some((i) => !i.done)).sort((a, b) => new Date(a.when) - new Date(b.when))[0] || S.lists.find((l) => !l.live);
}
export function staplePrice(pid, S) { const u = unitPrice(pid, S); return u ? u.up : null; }
