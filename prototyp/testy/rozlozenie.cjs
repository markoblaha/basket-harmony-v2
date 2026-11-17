const { chromium } = require('playwright');
const OUT = process.argv[2] || 'shotsC'; const ONLY = process.argv[3];
const STATES = [
  ['home', (b) => b.jump('home')], ['lists', (b) => b.jump('lists')], ['list', (b) => b.jump('lists', 'list', { id: 'l1' })],
  ['recipes', (b) => b.jump('recipes')], ['recipe-new', (b) => b.jump('recipes', 'recipe', { id: 'segedin' })], ['recipe-old', (b) => b.jump('recipes', 'recipe', { id: 'gulas' })],
  ['rcol', (b) => b.jump('recipes', 'rcol', { cat: 'polievky' })], ['rcol-ai', (b) => b.jump('recipes', 'rcol', { col: 'aitest' })],
  ['money', (b) => b.jump('money')], ['category', (b) => b.jump('money', 'category', { cat: 'dairy_eggs' })], ['kind', (b) => b.jump('money', 'kind', { kind: 'Pivo' })],
  ['product', (b) => b.jump('money', 'product', { pid: 'mlieko' })], ['store', (b) => b.jump('money', 'store', { name: 'Lidl' })], ['receipts', (b) => b.jump('money', 'receipts')],
  ['receipt', (b) => b.jump('money', 'receipt', { id: b.S.receipts && b.S.receipts[0] ? b.S.receipts[0].id : 'r0' })], ['more', (b) => b.jump('home', 'more')], ['more-pantry', (b) => { b.jump('home', 'more'); setTimeout(() => { const r = [...document.querySelectorAll('.scr.top .row.tap')].find((x) => x.textContent.includes('Čo mám doma')); r && r.click(); }, 500); }], ['history', (b) => b.jump('lists', 'history')], ['m-voice-items', (b) => b.voice({})], ['bookmap', (b) => b.jump('home', 'bookmap')],
  ['m-shop', (b) => b.modal('shop', { listId: 'l1' })], ['m-follow', (b) => b.modal('follow')], ['m-cook', (b) => b.modal('cook', { id: 'segedin' })], ['m-scan', (b) => b.modal('scan', { listId: 'l1' })],
  ['m-voice', (b) => b.voice({})], ['m-taste', (b) => b.modal('taste')],
  ['s-item', (b) => { b.jump('lists', 'list', { id: 'l1' }); setTimeout(() => window.__bh.sheet('item', { listId: 'l1', itemId: window.__bh.S.lists.find((l) => l.id === 'l1').items[0].id }), 400); }],
  ['s-newList', (b) => b.sheet('newList')], ['s-listMenu', (b) => b.sheet('listMenu', { id: 'l1' })], ['s-finish', (b) => b.sheet('finish', { listId: 'l1' })], ['s-plan', (b) => b.sheet('plan', { rid: 'segedin' })],
  ['s-plan-day', (b) => b.sheet('plan', { day: new Date().toISOString().slice(0, 10) })], ['s-import', (b) => b.sheet('import', { start: 'link' })], ['s-addRecipe', (b) => b.sheet('addRecipe', { rid: 'segedin', por: 4 })],
  ['s-budget', (b) => b.sheet('budget')], ['s-notif', (b) => b.sheet('notif')],
];
const CHECK = () => {
  const W = innerWidth, out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0 && !el.closest('.scr.off') && !el.closest('[aria-hidden="true"]'); };
  const inScroller = (el) => { for (let p = el.parentElement; p && !p.classList.contains('app'); p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return true; } return false; };
  const name = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : el.tagName) + ' "' + (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const all = [...document.querySelectorAll('.app *')].filter(vis);
  for (const el of all) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // 1) mimo obrazovky do strán
    if ((r.right > W + 1 || r.left < -1) && r.width < W * 1.5 && !inScroller(el) && !el.closest('.gal-s,.tst-feed,.carousel,.rrow,.chips,.staples,.edgeb,.toast,.peek') && hasText) out.push(['offscreen', name(el), Math.round(r.left) + '..' + Math.round(r.right)]);
    // 2) orezaný text bez trojbodky
    if (hasText && cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && !/(auto|scroll)/.test(cs.overflowX)) out.push(['clipX', name(el), el.scrollWidth + '>' + el.clientWidth]);
    if (hasText && /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 3 && !cs.webkitLineClamp?.match(/\d/) && cs.textOverflow !== 'ellipsis') out.push(['clipY', name(el), el.scrollHeight + '>' + el.clientHeight]);
    // 3) text presahuje svoju kartu / bublinu
    if (hasText) { const box = el.parentElement.closest('.card,.bub,.chip,.btn,.rcard,.lcard,.tile,.dockc,.qab,.mod,.stc,.pb,.tentry,.aitest,.sbx,.wish,.tst-meta span,.facts > span,.seg > button,.ctile,.tip'); if (box && vis(box)) { const b = box.getBoundingClientRect(); if (r.right > b.right + 1.5 || r.left < b.left - 1.5 || r.bottom > b.bottom + 1.5 || r.top < b.top - 1.5) { const ov = getComputedStyle(box).overflow; out.push([ov === 'visible' ? 'escapes' : 'cutByBox', name(el), 'in ' + name(box).slice(0, 40)]); } } }
  }
  // 4) prekrývajúce sa súrodenecké texty
  const texts = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.closest('.tabbar,.toast,.coach'));
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], c = texts[j]; if (a.contains(c) || c.contains(a)) continue;
    const A = a.getBoundingClientRect(), C = c.getBoundingClientRect();
    const ix = Math.min(A.right, C.right) - Math.max(A.left, C.left), iy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
    if (ix > 3 && iy > 3) { const sameLayer = a.closest('.scr,.mdl,.sheetw,.dock') === c.closest('.scr,.mdl,.sheetw,.dock'); if (sameLayer && !a.closest('.dock') === !c.closest('.dock')) out.push(['overlap', name(a), name(c)]); }
  }
  return out;
};
(async () => {
  const b = await chromium.launch(); const res = {}; const errs = [];
  for (const [th, scheme] of [[0, 'light'], [1, 'dark']]) {
    const key = (th ? 'g' : 'w') + '-' + scheme;
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(key + ' ' + e.message));
    await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'test.html')); await p.waitForTimeout(900);
    await p.locator('.intro .tp').nth(th).click(); await p.waitForTimeout(400);
    await p.evaluate(() => window.__bh.act((s) => ({ ...s, onb: { started: true }, tips: { ...(s.tips || {}), all: 1, taste: 1, swipe: 1 }, coach: { off: true, welcomed: true, seen: {}, v: 2 } })));
    for (const [n, fn] of STATES) {
      if (ONLY && !n.includes(ONLY)) continue;
      await p.evaluate(() => { window.__bh.closeSheet && window.__bh.closeSheet(); window.__bh.closeModal(); }); await p.waitForTimeout(450);
      await p.evaluate(`(${fn.toString()})(window.__bh)`); await p.waitForTimeout(n.startsWith('s-item') ? 1300 : 900);
      const found = []; const seen = new Set();
      for (const y of [0, 1, 2, 3]) {
        const r = await p.evaluate(CHECK); for (const x of r) { const k = x.join('|'); if (!seen.has(k)) { seen.add(k); found.push(x); } }
        if (y === 0) await p.screenshot({ path: `${__dirname}/../dist/${OUT}/${key}-${n}.png` });
        const moved = await p.evaluate(() => { const s = document.querySelector('.sheet .sh-body') || document.querySelector('.mdl .sc, .mdl .cbody') || document.querySelector('.scr.top .sc'); if (!s) return false; const t = s.scrollTop; s.scrollTop = t + s.clientHeight * .8; return s.scrollTop !== t; });
        if (!moved) break; await p.waitForTimeout(250);
      }
      res[key + ' ' + n] = found;
    }
    await ctx.close();
  }
  console.log(JSON.stringify({ res, errs }, null, 1)); await b.close();
})();
