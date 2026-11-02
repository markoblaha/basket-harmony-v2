// Upozornenia domácnosti – jeden zdroj pre zoznam vo Viac aj pre červenú bodku na avatare
import { listTotals, storeName } from './logic.js';
export function notifItems(S) {
  const live = S.live && S.lists.find((l) => l.id === S.live.listId);
  const lt = live && listTotals(live, S);
  const l1 = S.lists.find((l) => l.id === 'l1');
  const byL = l1 ? l1.items.filter((i) => i.by === 'l' && !i.done) : [];
  const miss = (S.missingReceipts || []).length;
  return [
    live && lt.done < lt.n && { id: 'live', av: 'l', t: `Nakupuje: Lucia · ${storeName(live.store)}`, d: `${lt.done} z ${lt.n} v košíku`, go: ['modal', 'follow'] },
    byL.length && { id: 'add' + byL.length, av: 'l', t: `Lucia pridala položky: ${byL.length}`, d: `do zoznamu ${l1.name}`, go: ['jump', 'lists', 'list', { id: l1.id }] },
    miss && { id: 'miss' + miss, e: 'receipt', t: `Chýba bloček: ${miss}`, d: 'odfoťte ho a ceny sa zapíšu samé', go: ['jump', 'money'] },
    !S.noReal && { id: 'pivo', e: 'beer', t: 'Pivo 12° je v Lidli najlacnejšie', d: '0,92 € oproti 1,15 € v Kauflande', go: ['jump', 'money', 'product', { pid: 'pivo' }] },
  ].filter(Boolean);
}
export const notifSig = (N) => N.map((n) => n.id).join('|');
export function runGo(go, ctx) { const [k, ...a] = go; if (k === 'modal') ctx.modal(...a); else ctx.jump(...a); }
