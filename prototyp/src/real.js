// Napojenie skutočných bločkov: produkty z bločkov sa spárujú s katalógom appky,
// ceny pri položkách, história cien a všetky výdavky sa počítajú z týchto riadkov.
import { RAW_PRODUCTS, RAW_RECEIPTS } from './realdata.js';
import { PRODUCTS, STORES, CATS, STAPLES } from './data.js';

export const storeKeyOf = (name) => { const n = (name || '').toLowerCase(); return Object.keys(STORES).find((k) => n.startsWith(STORES[k].n.toLowerCase()) || n.includes(STORES[k].n.toLowerCase())) || null; };

// Produkt z bločku → položka katalógu (rovnaký „základný“ produkt)
const MAP = [
  [/^svetlé pivo 12|^pivo$/i, 'pivo'], [/^kuracie prsné/i, 'kuracie'], [/^bio jogurt|^grécky jogurt|^jogurt čuč/i, 'jogurt'], [/^vajcia/i, 'vajcia'], [/^rožok/i, 'rozky'],
  [/^kaiserka/i, 'kaiserka'], [/^toastový chlieb/i, 'toast'], [/^bochník/i, 'chlieb'], [/^bageta z kamennej|^francúzska bageta/i, 'bageta'], [/^šiška/i, 'siska'],
  [/^kofola/i, 'kofola'], [/^minerálna voda/i, 'voda'], [/^toaletný/i, 'toaletak'], [/^kuchynské utierky/i, 'utierky'], [/^plienky/i, 'plienky'],
  [/^vlhčené utierky 99/i, 'vlhcene'], [/^podložky na preb/i, 'podlozky'], [/^detský príkrm/i, 'prikrm'], [/^zubná pasta/i, 'pasta'], [/^strúhaný syr eidam/i, 'eidam'],
  [/^syr camembert/i, 'camembert'], [/^mäsiarska šunka|^schwarzwald/i, 'sunka'], [/^bravčové párky/i, 'parky'], [/^chorizo/i, 'chorizo'], [/^feta/i, 'feta'],
  [/^syr mozzarella/i, 'mozzarella'], [/^paradajkový pretlak/i, 'pretlak'], [/^pesto/i, 'pesto'], [/^kečup/i, 'kecup'], [/^sójová/i, 'soja'], [/^kukurica/i, 'kukurica'],
  [/^kyslé uhorky/i, 'uhorkyk'], [/^ryža$/i, 'ryza'], [/^čierne korenie/i, 'korenie'], [/^trstinový cukor/i, 'cukor'], [/^banány/i, 'banany'], [/^jablká/i, 'jablka'],
  [/^avokádo/i, 'avokado'], [/^mrkva/i, 'mrkva'], [/^paprika červená/i, 'paprika'], [/^cherry paradajky|^mini ríbezľové/i, 'paradajky'], [/^šampiňóny/i, 'sampinony'],
  [/^citróny/i, 'citrony'], [/^ľadový šalát|^šalát s koreňom/i, 'salat'], [/^uhorka šalátová/i, 'uhorka'], [/^cuketa/i, 'cuketa'], [/^maliny/i, 'maliny'],
  [/^kyslá smotana/i, 'kyslasmotana'], [/^horalky|^oblátka horalky/i, 'horalky'], [/^zemiakové lupienky/i, 'lupienky'], [/^slané praclíky/i, 'praclik'],
  [/^nealkoholické pivo/i, 'nealko'], [/^tramín/i, 'vino'], [/^prací prostriedok/i, 'praci'], [/^prostriedok na riad/i, 'riad'], [/^tablety do umývačky/i, 'tablety'],
  [/^hliníková fólia/i, 'alobal'], [/^tekuté mydlo/i, 'mydlo'], [/^dezodorant|^antiperspirant/i, 'deo'], [/^spevňujúce telové/i, 'telove'], [/^kozmetické tampóny/i, 'tampony'],
  [/^detské chrumky/i, 'chrumky'], [/^probiotické kvapky/i, 'probio'], [/^univerzálna náplasť/i, 'naplast'], [/^zemiakové hranolky/i, 'hranolky'], [/^polievková zmes/i, 'zmes'],
  [/^káva zrnková/i, 'kava'], [/^krevety/i, 'krevety'], [/^bravčové mäso mleté/i, 'mlete'], [/^bravčový bok/i, 'bok'], [/^zmes olív/i, 'olivy'], [/^bryndza/i, 'bryndza'],
];
const FOOD = new Set(['bakery', 'produce', 'meat_fish', 'deli_chilled', 'dairy_eggs', 'frozen', 'pantry', 'breakfast', 'snacks_sweets', 'beverages', 'alcohol', 'household_cleaning', 'personal_care', 'baby', 'health']);
const CAT_EMOJI = { bakery: 'bread', produce: 'leafy', meat_fish: 'meat', deli_chilled: 'cheese', dairy_eggs: 'milk', frozen: 'ice', pantry: 'canned', breakfast: 'coffee', snacks_sweets: 'chocolate', beverages: 'juice', alcohol: 'wine', household_cleaning: 'sponge', personal_care: 'lotion', baby: 'babybottle', health: 'pill' };

// Produkt z bločku: názov|kategória|značka|balenie|druh (Pivo, Kuracie prsia…)
export const DBP = RAW_PRODUCTS.split('\n').map((l, ix) => { const [n, c, brand, size, kind] = l.split('|'); const m = MAP.find(([re]) => re.test(n)); return { ix, n, c, brand: brand || null, size: size || null, kind: kind || n, pid: m && PRODUCTS[m[1]] ? m[1] : null }; });

const lines0 = [];
export const REAL = RAW_RECEIPTS.split('\n').map((row, ri) => {
  const [s, d, t, tot, its] = row.split('|');
  const r = { id: 'r' + ri, storeName: s, store: storeKeyOf(s), date: '2026-' + d, time: t, total: +tot, real: true };
  r.lines = its.split(';').map((x, li) => {
    const [i, q, k, up, tt] = x.split(','); const p = DBP[+i]; const upn = up === '' ? null : +up; const tn = +tt;
    const qq = k && upn ? Math.round((tn / upn) * 1000) / 1000 : +q;
    const l = { id: r.id + 'l' + li, dbi: +i, vkey: 'v' + i, n: p.n, c: p.c, brand: p.brand, size: p.size, kind: p.kind, q: qq, u: k ? 'kg' : 'ks', up: upn, t: tn };
    lines0.push([l, r]);
    return l;
  });
  return r;
});

// Produkty z bločkov, ktoré v katalógu nie sú, sa doň pridajú (len potraviny a drogéria)
for (const p of DBP) {
  if (p.pid || !FOOD.has(p.c)) continue;
  const dup = DBP.find((x) => x.ix < p.ix && x.n === p.n && x.c === p.c && x.pid);
  if (dup) { p.pid = dup.pid; continue; }
  const id = 'db' + p.ix; const kg = lines0.some(([l]) => l.dbi === p.ix && l.u === 'kg');
  PRODUCTS[id] = { id, n: p.n, e: /pivo/i.test(p.n) ? 'beer' : CAT_EMOJI[p.c] || 'basket', c: p.c, u: kg ? 'kg' : 'ks', dq: kg ? .5 : 1, h: [], syn: '', approx: null, real: true };
  p.pid = id;
}
for (const [l] of lines0) l.pid = DBP[l.dbi].pid;

// História cien z bločkov (nahradí ručne zadané ceny)
const H = {};
for (const [l, r] of lines0) { if (!l.pid || !(l.up > 0)) continue; (H[l.pid] = H[l.pid] || []).push({ s: r.store || r.storeName, p: l.up, d: r.date, rid: r.id, q: l.u === 'kg' ? l.q : undefined }); }
for (const [pid, h] of Object.entries(H)) {
  const ps = h.map((x) => x.p).sort((a, b) => a - b); const med = ps[ps.length >> 1];
  PRODUCTS[pid].h = h.filter((x) => x.p >= med * .3).sort((a, b) => a.d.localeCompare(b.d)); // vyradí zálohy omylom priradené k produktu
  PRODUCTS[pid].approx = null;
}

// Časté položky = čo sa v októbri kupovalo najčastejšie
const cnt = {};
for (const [l, r] of lines0) if (l.pid && PRODUCTS[l.pid] && !PRODUCTS[l.pid].real && r.date >= '2026-09-01') cnt[l.pid] = (cnt[l.pid] || 0) + 1;
const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k]) => k);
STAPLES.splice(0, STAPLES.length, ...[...top, ...STAPLES.filter((x) => !top.includes(x))].slice(0, 16));

export const realCount = () => ({ receipts: REAL.length, lines: lines0.length });
