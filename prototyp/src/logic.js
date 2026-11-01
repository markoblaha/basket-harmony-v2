import { PRODUCTS, STORES, CATS, RECIPES, PANTRY, SHOP_STORES } from './data.js';
import './book.js';
import { REAL } from './real.js';
import { picFor } from './pics.js';

// ---------- formátovanie ----------
const nfE = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfE0 = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nfN = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 });
export const eur = (v) => nfE.format(v || 0).replace(/ /g, ' ');
export const eur0 = (v) => nfE0.format(Math.round(v || 0)).replace(/ /g, ' ');
export const num = (v) => nfN.format(v);
export const pct = (v) => Math.round(v * 100) + ' %';
export const signed = (v) => (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',');

const DAYS = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
const DAYS_S = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
const DAYS_LOC = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const MON_G = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
export const dayName = (d) => DAYS[d.getDay()];
export const dayShort = (d) => DAYS_S[d.getDay()];
export const dayLower = (d) => DAYS_LOC[d.getDay()];
export const longDate = (d) => `${DAYS[d.getDay()]} ${d.getDate()}. ${MON_G[d.getMonth()]}`;
export const shortDate = (iso) => { const d = new Date(iso); return `${d.getDate()}. ${d.getMonth() + 1}.`; };
export const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý deň' : 'Dobrý večer';
}
export function relDay(iso) {
  const d = new Date(iso); const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((x - t) / 864e5);
  if (diff === 0) return 'dnes'; if (diff === 1) return 'zajtra'; if (diff === -1) return 'včera';
  if (diff > 1 && diff < 7) return dayLower(d);
  return shortDate(iso);
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'práve teraz'; if (m < 60) return `pred ${m} min`;
  const h = Math.round(m / 60); return h < 24 ? `pred ${h} h` : `pred ${Math.round(h / 24)} d`;
}
export const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n > 1 && n < 5 ? few : many}`;
export const uid = () => Math.random().toString(36).slice(2, 9);

// ---------- množstvá ----------
export function fmtQty(q, u) {
  if (q == null) return '';
  if (u === 'kg') return q < 1 ? `${Math.round(q * 1000)} g` : `${num(Math.round(q * 100) / 100)} kg`;
  if (u === 'l') return q < 1 ? `${Math.round(q * 1000)} ml` : `${num(Math.round(q * 100) / 100)} l`;
  if (u === 'bal') return `${num(q)} bal.`;
  return `${num(q)} ks`;
}
export function stepFor(q, u, dir = 1) {
  if (u === 'kg') { const s = q < .5 || (q === .5 && dir < 0) ? .05 : q < 2 || (q === 2 && dir < 0) ? .1 : .25; return s; }
  if (u === 'l') return .5;
  return 1;
}
export function bump(q, u, dir) {
  const s = stepFor(q, u, dir);
  const min = u === 'kg' ? .05 : u === 'l' ? .25 : 1;
  const v = Math.round((q + dir * s) * 1000) / 1000;
  return Math.max(min, v);
}
// Jednotka položky v zozname: 'ks' = počet (kus, balík, strapec – čo vezmete do ruky),
// 'kg'/'l' = presné množstvo, len keď ho niekto vyslovene napísal alebo ho určil recept.
export function itemUnit(i) {
  if (i.u) return i.u === 'bal' ? 'ks' : i.u;
  const p = i.pid && PRODUCTS[i.pid];
  return p && (p.u === 'kg' || p.u === 'l') ? p.u : 'ks'; // staršie uložené položky
}
export function toItemQty(n, unit) {
  const r = (x) => Math.round(x * 1000) / 1000;
  if (n == null && ['g', 'dkg', 'ml', 'dl'].includes(unit)) return { q: 1, u: 'ks' };
  if (unit === 'g') return { q: r(n / 1000), u: 'kg' };
  if (unit === 'dkg') return { q: r(n / 100), u: 'kg' };
  if (unit === 'kg') return { q: n || 1, u: 'kg' };
  if (unit === 'ml') return { q: r(n / 1000), u: 'l' };
  if (unit === 'dl') return { q: r(n / 10), u: 'l' };
  if (unit === 'l') return { q: n || 1, u: 'l' };
  return { q: n || 1, u: 'ks' };
}
// Koľko kg je „1 ks“ váženého produktu: pri pár kusoch váš bežný nákup z bločkov (strapec banánov, balík mrkvy),
// pri viacerých kusoch váha jedného kusu (6 jabĺk). Slúži len na odhad ceny, nikde sa nezobrazuje.
export const PIECE = { banany: .18, jablka: .2, paprika: .15, citrony: .12, mrkva: .1, cuketa: .3, zemiaky: .15, kuracie: .2, hovadzie: .25, pliecko: .25, stehna: .3, losos: .2, rostenec: .25, tekvica: 1.2, cibula: .15, uhorka: .35, avokado: .2 };
export function typicalKg(pid, S) {
  const qs = history(pid, S).filter((h) => h.q > 0).slice(-3).map((h) => h.q);
  return qs.length ? median(qs) : (PRODUCTS[pid] && PRODUCTS[pid].dq) || .5;
}
export function weightOf(item, S) {
  if (itemUnit(item) === 'kg') return item.q;
  if (!item.pid) return item.q;
  return Math.round(item.q * (item.q >= 3 && PIECE[item.pid] ? PIECE[item.pid] : typicalKg(item.pid, S)) * 1000) / 1000;
}
export const minQty = (u) => (u === 'kg' ? .05 : u === 'l' ? .25 : 1);
export function qtyOptions(p) {
  if (p.u === 'kg') return p.dq >= 1 ? [.5, 1, 2] : [.3, .5, 1];
  if (p.u === 'l') return [1, 2, 3];
  return p.dq >= 4 ? [p.dq / 2, p.dq, p.dq * 2] : [1, 2, 3];
}

// ---------- ceny ----------
const DAY = 864e5;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function history(pid, S) {
  const p = PRODUCTS[pid]; if (!p) return [];
  return [...p.h, ...((S && S.priceLog && S.priceLog[pid]) || [])].sort((a, b) => a.d.localeCompare(b.d));
}
// Bežná cena = medián posledných 3 nákupov za 120 dní; ak sa kupovalo v tom istom obchode, berie sa ten.
export function unitPrice(pid, S, store) {
  const p = PRODUCTS[pid]; if (!p) return null;
  const now = Date.now();
  const all = history(pid, S).filter((h) => now - new Date(h.d).getTime() <= 120 * DAY);
  if (!all.length) return p.approx ? { up: p.approx, approx: true, min: p.approx * .9, max: p.approx * 1.15, n: 0 } : null;
  const same = store ? all.filter((h) => h.s === store) : [];
  const pool = same.length ? same : all;
  const up = median(pool.slice(-3).map((h) => h.p));
  const last = pool[pool.length - 1];
  const ps = all.map((h) => h.p);
  return { up, last, store: last.s, same: same.length > 0, k: Math.min(3, pool.length), min: Math.min(...ps), max: Math.max(...ps), n: all.length };
}
export function estimate(item, S, store) {
  if (item.paid != null) return { v: item.paid, lo: item.paid, hi: item.paid, actual: true, store: item.paidStore };
  if (!item.pid) return null;
  const u = unitPrice(item.pid, S, store); if (!u) return null;
  const pu = PRODUCTS[item.pid].u; const iu = itemUnit(item);
  if (pu === 'kg' && iu === 'ks') { const kg = weightOf(item, S); return { ...u, v: u.up * kg, lo: u.min * kg, hi: u.max * kg, perKg: true }; }
  if (pu !== 'kg' && pu !== 'l' && iu !== 'ks') {
    // presné množstvo pri produkte predávanom na kusy („mleté 500 g“): orientačne cena kusov/balení
    const n = iu === 'kg' && PIECE[item.pid] ? Math.max(1, Math.round(item.q / PIECE[item.pid])) : 1;
    return { ...u, v: u.up * n, lo: u.min * n, hi: u.max * n, approx: true };
  }
  if (pu === 'kg' ? iu !== 'kg' : iu === 'kg') return null;
  return { ...u, v: u.up * item.q, lo: u.min * item.q, hi: u.max * item.q };
}
export function listTotals(list, S, onlyOpen = false) {
  let v = 0, lo = 0, hi = 0, priced = 0, n = 0, done = 0, doneV = 0;
  for (const it of list.items) {
    if (onlyOpen && it.done) continue;
    n++; if (it.done) done++;
    const e = estimate(it, S, list.store);
    if (e) { v += e.v; lo += e.lo; hi += e.hi; priced++; if (it.done) doneV += e.v; }
  }
  return { v, lo, hi, priced, n, done, doneV };
}
export function rangeText(t) {
  const lo = Math.floor(t.lo), hi = Math.ceil(t.hi);
  return lo === hi ? eur0(t.v) : `${lo} – ${hi} €`;
}
export const storeName = (k) => (STORES[k] ? STORES[k].n : k || 'Obchod');

// ---------- rozpoznanie textu (miestne, keď AI nie je k dispozícii) ----------
export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.,%° ]+/g, ' ').replace(/\s+/g, ' ').trim();
const NUMW = { jeden: 1, jedna: 1, jedno: 1, jednu: 1, dva: 2, dve: 2, dvoje: 2, tri: 3, troje: 3, styri: 4, pat: 5, sest: 6, sedem: 7, osem: 8, devat: 9, desat: 10, jedenast: 11, dvanast: 12, patnast: 15, dvadsat: 20, tridsat: 30, styridsat: 40, patdesiat: 50, sto: 100, dvesto: 200, tristo: 300, styristo: 400, patsto: 500, pol: .5, stvrt: .25, poldruha: 1.5 };
const UNITW = {
  kg: ['kg', 'kila', 'kilo', 'kil', 'kilogram', 'kilogramy', 'kilogramov', 'kile'], g: ['g', 'gram', 'gramov', 'gramy', 'gramu', 'gr'], dkg: ['dkg', 'deka', 'dekagramov', 'deko', 'dek'],
  l: ['l', 'liter', 'litre', 'litrov', 'litra', 'litry', 'litri', 'litrik', 'litriky'], ml: ['ml', 'mililitrov', 'mililiter', 'mililitre', 'mililitra'], dl: ['dl', 'dcl', 'deci', 'decilitre', 'decilitrov', 'decilitra', 'decak'], ks: ['ks', 'kus', 'kusy', 'kusov', 'kusky', 'kusok'],
  bal: ['bal', 'balenie', 'balenia', 'baleni', 'balik', 'baliky', 'balicky', 'balicek', 'krabicu', 'krabice', 'flasu', 'flase', 'flias', 'flasa', 'plechovky', 'plechovku', 'plechoviek', 'vrecko', 'vrecka'],
};
const UNITMAP = {}; for (const [u, ws] of Object.entries(UNITW)) ws.forEach((w) => (UNITMAP[w] = u));
const FILL = new Set('kup kupit kupte kupim kupis pridaj pridajte daj dajte este prosim mi nam tam nejake nejaky nejaku nejakych trochu do zoznamu na zoznam zoznamu zoznam a aj tiez potrebujem potrebujeme treba chcem chceme by bolo dobre ze uz lucia marek nech tak no takze teda aby si s sa'.split(' '));

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = Object.values(PRODUCTS).map((p) => {
    const nameT = norm(p.n.replace(/·.*$/, '')).split(' ').filter((w) => w.length > 2);
    const synT = norm(p.syn).split(' ').filter((w) => w.length > 2);
    return { p, nameT, all: [...new Set([...nameT, ...synT])] };
  });
  return INDEX;
}
const pre = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const ENDS = new Set(['', 'a', 'e', 'i', 'o', 'u', 'y', 'ov', 'om', 'ou', 'ach', 'ami', 'iek', 'ok', 'ek', 'ky', 'ka', 'ko', 'ie', 'ia', 'ej', 'ych', 'ymi', 'ym', 'eho', 'emu', 'ich', 'im', 'iu', 'ce', 'ca', 'ku', 'mi']);
// Slovo patrí k produktu len vtedy, keď je rovnaké alebo sa líši iba v koncovke (mlieka/mlieko, rožky/rožkov,
// mletého/mleté). Spoločný začiatok nestačí: „silikon“ nie je „silikónová lyžička“, „parad“ nie sú paradajky.
// Na takéto prípady sú bubliny s návrhmi nad poľom – Enter pridá text tak, ako bol napísaný.
function wordScore(w, t) {
  if (w === t) return 3;
  const c = pre(w, t);
  for (let k = c; k >= Math.max(3, c - 3); k--) {
    if (ENDS.has(w.slice(k)) && ENDS.has(t.slice(k)) && (k >= 4 || (w.length <= 4 && t.length <= 5))) return 2; // salám ≠ šalát
  }
  return 0;
}
// Možný preklep: slovo, ktoré sa od známeho slova líši o 1 písmeno (o 2 pri dlhých slovách).
export function editDist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function typoProduct(text) {
  const ws = norm(text).split(' ').filter((w) => w.length >= 4 && !FILL.has(w) && !UNITMAP[w] && NUMW[w] == null && !/^\d/.test(w));
  if (!ws.length) return null;
  let best = null, bs = 9;
  for (const e of index()) {
    let tot = 0;
    for (const w of ws) { let m = 9; for (const t of e.nameT) { if (w.slice(0, -1) === t.slice(0, -1) && w.length === t.length) continue; m = Math.min(m, editDist(w, t)); } if (m > (w.length >= 7 ? 2 : 1)) { tot = 99; break; } tot += m; }
    if (tot > 0 && tot < bs) { bs = tot; best = e.p; }
  }
  return best;
}
const GENERIC = new Set(['syr', 'syry', 'syra', 'maso', 'masa', 'ovocie', 'zelenina', 'zeleninu', 'pecivo', 'napoj', 'napoje', 'sladkosti', 'drogeria', 'kozmetika', 'ryba', 'ryby', 'salat', 'salaty']);
export function matchProduct(text) {
  const ws = norm(text).split(' ').filter((w) => w.length > 2 && !FILL.has(w) && !UNITMAP[w] && NUMW[w] == null && !/^\d/.test(w));
  if (!ws.length) return null;
  // všeobecné slovo samo osebe („syr“, „mäso“) nevyberie konkrétny produkt – pridá sa, ako je, a návrhy ponúknu druhy
  if (ws.length === 1 && GENERIC.has(ws[0])) return null;
  let best = null, bs = 0;
  for (const e of index()) {
    let s = 0, firstHit = false;
    let miss = false;
    for (const w of ws) {
      let m = 0; for (const t of e.all) m = Math.max(m, wordScore(w, t));
      if (!m) { miss = true; break; } // každé napísané slovo musí k produktu patriť („ovocné jogurty“ ≠ „ovocné rolky“)
      s += m;
      if (e.nameT.some((t) => wordScore(w, t) === 3)) s += .5; // presná zhoda s názvom má prednosť pred synonymom
      if (m && e.nameT[0] && wordScore(w, e.nameT[0])) firstHit = true;
    }
    if (miss || !s) continue;
    if (firstHit) s += .6; // základný názov má prednosť („mlieko“ ≠ „telové mlieko“)
    s -= Math.max(0, e.nameT.length - ws.length) * .1;
    if (s > bs) { bs = s; best = e.p; }
  }
  return bs >= 1.9 ? best : null;
}
// Diakritika pre nové položky: slovo napísané bez mäkčeňov a dĺžňov sa doplní podľa známych slov
// z katalógu („ovocne jogurty“ → „Ovocné jogurty“). Slová s diakritikou sa nemenia.
let DIA = null;
const EXTRA_WORDS = 'ovocné ovocný ovocná ovocie čokoládový čokoládové čokoláda mäso mäsové mliečne mliečna jogurtový zemiaky zemiakové cestoviny špagety šťava džús sirup čaj káva múka cukor soľ olej ocot korenie bylinky zelenina šalát paradajky uhorky cibuľa cesnak hrášok fazuľa šošovica ryža pečivo chlieb rožky žemle syr šunka saláma salám klobása párky vajcia maslo smotana tvaroh bryndza oriešky orechy mandle hrozienka sušené mrazené zmrzlina keksy sušienky piškóty čipsy limonáda minerálka pivo víno nealko plienky obrúsky servítky vrecká batérie žiarovka čistiaci prostriedok šampón mydlo zubná pasta kefka toaletný papier kuchynské utierky detské dojčenské kozmetické biele červené žlté zelené čierne malé veľké celé krájané strúhané údené čerstvé'.split(' ');
export function fixDiacritics(text) {
  if (!DIA) {
    DIA = {};
    const put = (w) => { const k = norm(w); if (k.length > 2 && k !== w.toLowerCase() && !DIA[k]) DIA[k] = w.toLowerCase(); };
    EXTRA_WORDS.forEach(put);
    for (const p of Object.values(PRODUCTS)) p.n.split(/[\s·,()/]+/).forEach(put);
  }
  return text.split(' ').map((w) => { const k = norm(w); return k === w.toLowerCase() && DIA[k] ? (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? DIA[k][0].toUpperCase() + DIA[k].slice(1) : DIA[k]) : w; }).join(' ');
}
export function splitChunks(text) {
  return text.replace(/([a-záäčďéíĺľňóôŕšťúýž])(\d)/gi, '$1 $2').replace(/(\d)([a-záäčďéíĺľňóôŕšťúýž]{3,})/gi, '$1 $2')
    
    .split(/(?<!\d),|,(?!\d)|[;\n]+|\s+(?:a|aj|plus|potom|este|ešte|a tiež|a este|a ešte)\s+|\.\s+/i).map((s) => s.trim()).filter(Boolean);
}
export function parseChunk(chunk) {
  const raw = chunk.trim();
  let t = norm(raw).replace(/(\d)\s*x\b/g, '$1 ').replace(/\bx\s*(\d)/g, ' $1').replace(/(\d)([a-z]+)/g, '$1 $2');
  let n = null, unit = null;
  const words = t.split(' ');
  const rest = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d+([.,]\d+)?$/.test(w)) { const v = parseFloat(w.replace(',', '.')); n = n == null ? v : n; continue; }
    if (NUMW[w] != null) { n = n == null ? NUMW[w] : n * (NUMW[w] < 1 ? 1 : NUMW[w]); continue; }
    if (UNITMAP[w]) { unit = UNITMAP[w]; continue; }
    rest.push(w); // aj „12°“ či „30%“ – patrí k názvu, nie k množstvu
  }
  const { q, u } = toItemQty(n, unit);
  const name = rest.filter((w) => !FILL.has(w)).join(' ');
  const p = matchProduct(name || raw);
  if (p) return { pid: p.id, q, u, raw };
  // nová položka: presne podľa napísaného textu, bez čísel a jednotiek, s doplnenou diakritikou
  const toks = raw.split(/\s+/).filter((tk) => {
    const k = norm(tk);
    if (!k) return false;
    const m = k.match(/^(\d+([.,]\d+)?)(x|[a-z]+)?$/);
    if (m && (!m[3] || m[3] === 'x' || UNITMAP[m[3]])) return false;
    return !UNITMAP[k] && NUMW[k] == null;
  });
  while (toks.length && FILL.has(norm(toks[0]))) toks.shift();
  const nm = fixDiacritics(toks.join(' ').replace(/[,;.]+$/, '').trim());
  if (!nm) return null;
  return { pid: null, n: nm.charAt(0).toUpperCase() + nm.slice(1), q, u, raw };
}
export function detectIntent(text) {
  const t = norm(text);
  if (/\b(recept|uvarit|uvarime|uvarim|navar|navrhni|napad|co na obed|co na veceru|co k veceri|jedlo z|co spravit)\b/.test(t)) return 'recipe_search';
  for (const r of RECIPES) { const rn = norm(r.n).split(' ')[0]; if (rn.length > 3 && new RegExp(`\\bna ${rn.slice(0, 5)}`).test(t)) return 'recipe_add:' + r.id; }
  return 'items';
}
export function parseLocal(text) {
  const intent = detectIntent(text);
  if (intent !== 'items') return { intent, items: [] };
  const items = splitChunks(text).map(parseChunk).filter(Boolean);
  return { intent: 'items', items };
}
// Rozpoznanie písaného textu v poli („pivo6“, „6x pivo“, „2 l mlieka“).
export const parseOne = (text) => parseChunk(text);

// ---------- recepty ----------
// Každý recept má fotku: vlastnú, alebo podľa názvu a štítku (recepty z AI a z importu ju nemajú)
for (const r of RECIPES) if (!r.pic) { const p = picFor(r); if (p) r.pic = p; }
const picCache = new WeakMap();
const withPic = (r) => { if (!r || r.pic) return r; if (!picCache.has(r)) { const p = picFor(r); picCache.set(r, p ? { ...r, pic: p } : r); } return picCache.get(r); };
export function recipeById(id, S) { return RECIPES.find((r) => r.id === id) || withPic(S && S.aiRecipes.find((r) => r.id === id)); }
export function allRecipes(S) { return [...RECIPES, ...((S && S.aiRecipes) || []).map(withPic)]; }
export function recipeCost(r, S, store) {
  let c = 0;
  for (const [pid, use] of r.ing) { const u = unitPrice(pid, S, store); if (u) c += u.up * use; }
  return c / r.por;
}
export function haveCount(r, S) {
  const have = new Set(S.have);
  const inList = new Set(S.lists.flatMap((l) => l.items.filter((i) => !i.done).map((i) => i.pid)));
  let h = 0; for (const x of r.ing) if (have.has(x[0]) || inList.has(x[0])) h++;
  return { have: h, all: r.ing.length };
}
export function buyQty(pid, use) {
  const p = PRODUCTS[pid]; if (!p) return use;
  if (p.u === 'kg') return Math.max(.1, Math.round(use * 20) / 20);
  if (p.u === 'l') return Math.max(.5, Math.ceil(use * 2) / 2);
  return Math.max(1, Math.ceil(use - .001));
}

// ---------- bloček ----------
function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function rawName(n) {
  const w = norm(n).toUpperCase().split(' ');
  return (w[0].slice(0, 9) + (w[1] ? (w[0].length > 6 ? '.' : ' ') + w[1].slice(0, 6) : '')).replace(/\s+$/, '');
}
// Ukážkový bloček z nakúpených položiek: váhy sa mierne líšia, raz je cena iná ako zvyčajne, jedna položka je navyše.
export function demoReceipt(list, S) {
  const store = list.store; const r = rng(list.id + list.items.length);
  const items = list.items.filter((i) => i.done && !i.na);
  const src = items.length ? items : list.items.filter((i) => !i.na);
  const lines = [];
  src.forEach((it, idx) => {
    const p = PRODUCTS[it.pid];
    const u = it.pid ? unitPrice(it.pid, S, store) : null;
    let up = u ? u.up : 1 + Math.round(r() * 200) / 100;
    if (idx === 1) up = Math.round((up * 1.12) * 100) / 100 - .01; // zdraženie
    if (idx === 3) up = Math.round((up * .9) * 100) / 100 + .09; // akcia
    up = Math.round(up * 100) / 100;
    let q = it.q;
    if (p && p.u === 'kg') q = Math.round(weightOf(it, S) * (1 + (r() * .14 - .03)) * 1000) / 1000; // „banány 1 ks“ → odvážené kg
    const t = Math.round(up * q * 100) / 100;
    lines.push({ id: uid(), raw: rawName(p ? p.n : it.n) + (p && p.u === 'kg' ? ` ${num(q)}` : q > 1 ? ` ${num(q)}x` : ''), pid: it.pid, itemId: it.id, n: p ? p.n : it.n, q, u: p ? p.u : 'ks', up, t });
  });
  lines.push({ id: uid(), raw: 'ŽUVAČKY ORBIT', pid: null, itemId: null, n: 'Žuvačky', q: 1, u: 'ks', up: 1.29, t: 1.29, extra: true });
  const total = Math.round(lines.reduce((a, l) => a + l.t, 0) * 100) / 100;
  const d = new Date();
  return { store, date: dkey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, total, lines, listId: list.id, demo: true };
}
// Párovanie riadkov bločku (z AI) s položkami zoznamu.
export function matchReceipt(rec, list) {
  const used = new Set();
  for (const l of rec.lines) {
    if (l.itemId) { used.add(l.itemId); continue; }
    const p = l.pid ? PRODUCTS[l.pid] : matchProduct(l.n || l.raw || '');
    if (p) l.pid = p.id;
    const it = list && list.items.find((i) => !used.has(i.id) && ((p && i.pid === p.id) || (!i.pid && norm(i.n || '') === norm(l.n || ''))));
    if (it) { l.itemId = it.id; used.add(it.id); } else l.extra = true;
  }
  return rec;
}

// ---------- výdavky (počítané zo skutočných bločkov + nových odfotených) ----------
// Najčastejšie navštevované obchody (podľa bločkov), doplnené bežnými
export function frequentStores(S, n = 6) {
  const c = {};
  for (const r of allReceipts(S)) if (r.store && STORES[r.store]) c[r.store] = (c[r.store] || 0) + 1;
  const keys = Object.keys(c).sort((a, b) => c[b] - c[a]);
  return [...keys, ...SHOP_STORES.filter((k) => !keys.includes(k))].slice(0, n).map((k) => ({ k, cnt: c[k] || 0 }));
}
// „Lidl · Zajtra“ – obchod sa uvádza, len ak je pri zozname zvolený
export const withStore = (l, rest) => (l.store ? `${storeName(l.store)} · ${rest}` : rest);
export function allReceipts(S) {
  const mine = ((S && S.receipts) || []).map((r) => ({ id: r.id, storeName: storeName(r.store), store: r.store, date: r.date, time: r.time || '', total: r.total, mine: true, demo: r.demo,
    lines: r.lines.map((l) => ({ ...l, c: (l.pid && PRODUCTS[l.pid] && PRODUCTS[l.pid].c) || 'other', kind: (l.pid && PRODUCTS[l.pid] && PRODUCTS[l.pid].n.replace(/ ·.*$/, '')) || l.n, vkey: l.pid ? 'p:' + l.pid : null })) }));
  return [...mine, ...REAL].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
export const inMonth = (r, mo) => r.date.startsWith(mo);
export function catsOf(rs) { const c = {}; for (const r of rs) for (const l of r.lines) { if (l.c === 'deposit') continue; c[l.c] = (c[l.c] || 0) + l.t; } return c; }
export const monthReceipts = (S, mo = '2026-10') => allReceipts(S).filter((r) => inMonth(r, mo));
export const monthCats = (S, mo = '2026-10') => catsOf(monthReceipts(S, mo));
export const monthTotal = (S, mo = '2026-10') => monthReceipts(S, mo).reduce((a, r) => a + r.total, 0);
export const octReceipts = (S) => monthReceipts(S, '2026-10');
export function weeks(S) {
  const rs = octReceipts(S);
  return [[1, 7], [8, 14], [15, 21], [22, 31]].map(([a, b]) => ({ label: `${a}.–${b}.`, v: rs.filter((r) => { const d = +r.date.slice(8); return d >= a && d <= b; }).reduce((x, r) => x + r.total, 0) }));
}
// Súhrn produktov z bločkov (pre kategóriu, obchod)
export function productsOf(rs, cat) {
  const m = {};
  for (const r of rs) for (const l of r.lines) {
    if (cat && l.c !== cat) continue; if (l.c === 'deposit') continue;
    const k = l.pid || 'x' + (l.dbi != null ? l.dbi : l.n);
    const e = (m[k] = m[k] || { k, n: l.pid && PRODUCTS[l.pid] && !PRODUCTS[l.pid].real ? PRODUCTS[l.pid].n.replace(/ ·.*$/, '') : l.n, pid: l.pid, c: l.c, sum: 0, cnt: 0, stores: new Set() });
    e.sum += l.t; e.cnt++; e.stores.add(r.storeName);
  }
  return Object.values(m).sort((a, b) => b.sum - a.sum);
}
export const lineEmoji = (l) => (l.pid && PRODUCTS[l.pid] ? PRODUCTS[l.pid].e : CATS[l.c] ? CATS[l.c].e : 'basket');
// Čo sa oplatí vedieť – vypočítané z histórie cien
export function insights(S) {
  const out = [];
  for (const p of Object.values(PRODUCTS)) {
    const h = history(p.id, S).filter((x) => x.d >= '2026-09-01'); if (h.length < 2) continue;
    const by = {}; for (const x of h) by[x.s] = Math.min(by[x.s] == null ? 1e9 : by[x.s], x.p);
    const st = Object.entries(by).sort((a, b) => a[1] - b[1]);
    const ps = h.map((x) => x.p).sort((a, b) => a - b); const med = ps[ps.length >> 1];
    const per = p.u === 'kg' ? ' €/kg' : ' €';
    if (st.length >= 2 && (st[st.length - 1][1] - st[0][1]) / st[st.length - 1][1] > .15) out.push({ score: (st[st.length - 1][1] - st[0][1]) / st[st.length - 1][1] + h.length / 20, pid: p.id, e: p.e, t: `${p.n.replace(/ ·.*$/, '')}: najlacnejšie v obchode ${storeName(st[0][0])}`, d: st.map(([s, v]) => `${storeName(s)} ${num(v)}${per}`).join(' · ') });
    const low = h.find((x) => x.p < med * .78);
    if (low) out.push({ score: (med - low.p) / med + h.length / 20, pid: p.id, e: p.e, t: `${p.n.replace(/ ·.*$/, '')} ${shortDate(low.d)} v akcii`, d: `${num(low.p)}${per} v obchode ${storeName(low.s)}, bežne ${num(med)}${per}` });
  }
  const seen = new Set();
  return out.sort((a, b) => b.score - a.score).filter((x) => (seen.has(x.pid) ? false : seen.add(x.pid))).slice(0, 4);
}
export const catName = (k) => (CATS[k] ? CATS[k].n : k);

export function haveDefault() { return [...PANTRY]; }

// ---------- druh → značka a výrobok (analytika z bločkov) ----------
// Množstvo riadku bločku v základnej jednotke: kg (vážené, balenie v g), l (balenie v ml), ks.
export function lineUnits(l) {
  const m = /^(\d+(?:\.\d+)?)(g|ml|ks)$/.exec(l.size || '');
  if (l.u === 'kg') return { basis: 'kg', units: l.q, pieces: null };
  if (m) { const v = +m[1]; if (m[2] === 'g') return { basis: 'kg', units: l.q * v / 1000, pieces: l.q }; if (m[2] === 'ml') return { basis: 'l', units: l.q * v / 1000, pieces: l.q }; return { basis: 'ks', units: l.q * v, pieces: l.q * v }; }
  return { basis: 'ks', units: l.q, pieces: l.q };
}
export const sizeTxt = (s) => { const m = /^(\d+(?:\.\d+)?)(g|ml|ks)$/.exec(s || ''); if (!m) return null; const v = +m[1]; return m[2] === 'g' ? (v >= 1000 ? num(v / 1000) + ' kg' : v + ' g') : m[2] === 'ml' ? (v >= 1000 ? num(v / 1000) + ' l' : num(v / 1000) + ' l') : v + ' ks'; };
export const qtyTxt = (q, basis) => (q == null ? '' : basis === 'ks' ? `${num(Math.round(q))} ks` : `${num(Math.round(q * 100) / 100)} ${basis}`);
export const perTxt = (v, basis) => (v == null ? '–' : `${eur(v)}/${basis}`);
const kindLines = (rs, f) => rs.flatMap((r) => r.lines.filter((l) => l.c !== 'deposit' && l.t > 0 && f(l)).map((l) => ({ ...l, r, lu: lineUnits(l) })));
// Množstvo a cena za jednotku druhu: jednotka = najčastejšia; pri kusoch sa rátajú aj balenia v l (0,5 l pivo = 1 ks).
export function unitStats(ls) {
  const cnt = {}; for (const l of ls) cnt[l.lu.basis] = (cnt[l.lu.basis] || 0) + 1;
  const basis = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'ks';
  const q0 = (l) => (basis === 'ks' ? l.lu.pieces : l.lu.basis === basis ? l.lu.units : null);
  // chybne zapísané balenie na bločku (napr. 6 ks počítané dvakrát) by pokazilo priemer – také riadky sa vynechajú
  const ups = ls.map((l) => { const q = q0(l); return q > 0 ? l.t / q : null; }).filter((x) => x != null).sort((a, b) => a - b);
  const med = ups.length ? ups[ups.length >> 1] : 0;
  const qOf = (l) => { const q = q0(l); return q > 0 && (!med || (l.t / q > med * .3 && l.t / q < med * 3.5)) ? q : null; };
  let qty = 0, paid = 0, min = null, max = null;
  for (const l of ls) { const q = qOf(l); if (!(q > 0)) continue; qty += q; paid += l.t; const up = l.t / q; if (!min || up < min.up) min = { up, l }; if (!max || up > max.up) max = { up, l }; }
  return { basis, qty: qty || null, avg: qty ? paid / qty : null, min, max, qOf };
}
export function kindsOf(rs, cat) {
  const m = {};
  for (const l of kindLines(rs, (x) => x.c === cat)) { const k = l.kind || l.n; (m[k] = m[k] || []).push(l); }
  return Object.entries(m).map(([kind, ls]) => ({ kind, ls, sum: ls.reduce((a, l) => a + l.t, 0), cnt: ls.length, brands: [...new Set(ls.map((l) => l.brand).filter(Boolean))], variants: new Set(ls.map((l) => l.vkey || l.n)).size, ...unitStats(ls) })).sort((a, b) => b.sum - a.sum);
}
export const variantName = (l) => [l.brand, l.n].filter(Boolean).join(' · ');
// Detail druhu za obdobie: značky, výrobky (značka + balenie), obchody podľa ceny za jednotku, nákupy.
export function kindDetail(S, kind, mo) {
  const rs = allReceipts(S).filter((r) => !mo || r.date.startsWith(mo));
  const ls = kindLines(rs, (l) => (l.kind || l.n) === kind);
  const st = unitStats(ls);
  const group = (key) => { const m = {}; for (const l of ls) { const k = key(l); (m[k] = m[k] || []).push(l); } return Object.entries(m).map(([k, a]) => { let q = 0, p = 0; for (const l of a) { const x = st.qOf(l); if (x > 0) { q += x; p += l.t; } } return { k, ls: a, l: a[a.length - 1], sum: a.reduce((s, l) => s + l.t, 0), cnt: a.length, qty: q || null, avg: q ? p / q : null }; }).sort((a, b) => b.sum - a.sum); };
  const sum = ls.reduce((a, l) => a + l.t, 0);
  return { ls, sum, cnt: ls.length, ...st, cat: ls[0] ? ls[0].c : null,
    brands: group((l) => l.brand || 'Bez značky'), variants: group((l) => l.vkey || l.n),
    stores: group((l) => l.r.storeName).filter((x) => x.avg != null).sort((a, b) => a.avg - b.avg),
    purchases: [...ls].sort((a, b) => (b.r.date + b.r.time).localeCompare(a.r.date + a.r.time)) };
}
// Výrobok (konkrétna značka a balenie) – všetky nákupy s cenou za jednotku.
export function variantDetail(S, vkey) {
  const ls = kindLines(allReceipts(S), (l) => (l.vkey || l.n) === vkey).sort((a, b) => (a.r.date + a.r.time).localeCompare(b.r.date + b.r.time));
  const st = unitStats(ls);
  const h = ls.map((l) => { const q = st.qOf(l); return q > 0 ? { s: l.r.store || l.r.storeName, p: l.t / q, d: l.r.date, rid: l.r.id, lid: l.id } : null; }).filter(Boolean);
  return { ls, h, ...st, l: ls[ls.length - 1] };
}
