const { chromium } = require('playwright');
const FLOW = process.env.FLOW || 'basics'; let restDone = false;
const VW = +(process.env.VW || 393), VH = +(process.env.VH || 852), TH = +(process.env.TH || 1), SCH = process.env.SCH || 'dark';
(async () => {
  const b = await chromium.launch(); const errs = []; const log = [];
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: VW > 500 ? 1 : 2, colorScheme: SCH });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('console ' + m.text()));
  await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'test.html')); await p.waitForTimeout(900);
  await p.locator('.intro .tp').nth(TH).click(); await p.waitForTimeout(700);
  const tag = VW + (TH ? 'g' : 'w');
  let n = 0; const shot = async (name) => p.screenshot({ path: `${__dirname}/../dist/shots/${tag}-${String(n++).padStart(2, '0')}-${name}.png` });
  await shot('welcome');
  if (FLOW === 'all') { await p.locator('#tx .tx-opt').nth(1).click(); await p.waitForTimeout(800); await p.evaluate(() => window.__bh.push('more')); await p.waitForTimeout(800); await p.locator('.scr.top button:has-text("Spustiť ukážku")').click(); await p.waitForTimeout(1200); }
  else { await p.locator('#tx .tx-opt.rec').click(); await p.waitForTimeout(500); await shot('intro'); await p.locator('#tx .tx-wide.p').click(); await p.waitForTimeout(900); }
  let last = '', same = 0;
  for (let it = 0; it < 260; it++) {
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => { const T = window.__bh.S.tour; const c = document.querySelector('#tx .tx-card'); return { T: T && { ch: T.ch, st: T.st, phase: T.phase }, cc: !!document.querySelector('#tx .tx-chcard'), end: !!document.querySelector('#tx .tx-full.end'), title: c && c.querySelector('b.t') && c.querySelector('b.t').textContent, ok: !!(c && c.querySelector('.tx-ok')), ghost: !!(c && c.querySelector('.tx-ghost:not([disabled])')), play: !!document.querySelector('#tx.playing'), hole: !!document.querySelector('#tx .tx-hole'), where: (document.querySelector('.mdl:not(.out)') || {}).className || (document.querySelector('.scr.top') || {}).className }; });
    if (!st.T) { log.push('tour ended'); break; }
    const key = JSON.stringify([st.T, st.title, st.ok, st.cc, st.end]);
    if (key === last) same++; else { same = 0; last = key; }
    if (same > 12) { log.push('STUCK ' + key + ' where=' + st.where); await shot('stuck'); await p.locator('#tx .tx-skip').first().click().catch(() => {}); same = 0; continue; }
    if (st.play) continue;
    if (st.end && FLOW === 'rest' && !restDone) { restDone = true; await shot('end-basics'); await p.locator('#tx .tx-endb .tx-wide.s').click(); await p.waitForTimeout(800); continue; }
    if (st.end) { await shot('end'); await p.locator('#tx .tx-endb .tx-wide.p').click(); await p.waitForTimeout(500); await shot('cleaning'); await p.waitForTimeout(1800); await shot('empty'); break; }
    if (st.cc) { if (same === 0) { log.push(`chapter card ch=${st.T.ch} phase=${st.T.phase}`); await shot('chap' + st.T.ch); } await p.locator('#tx .tx-chcard .tx-wide.p').click(); continue; }
    if (same === 1) { const pos = await p.evaluate(() => { const c = document.querySelector('#tx .tx-card'), h = document.querySelector('#tx .tx-hole'); const f = (e) => e && Math.round(e.getBoundingClientRect().top) + '-' + Math.round(e.getBoundingClientRect().bottom); return 'card ' + f(c) + ' hole ' + f(h); }); log.push('   pos ' + pos); }
    if (same === 0) { log.push(`${st.T.ch + 1}.${st.T.st + 1} ${st.title} ok=${st.ok} hole=${st.hole} | ${st.where}`); await shot(`c${st.T.ch + 1}s${st.T.st + 1}${st.ok ? 'ok' : ''}`); }
    if (st.ok) { await p.locator('#tx .tx-card .tx-ok').click(); continue; }
    if (!st.ghost) continue;
    // ako človek
    if (st.title === 'Lucia práve nakupuje' && same === 0) {
      await p.mouse.click(Math.round(VW * .02) + 2, Math.round(VH * .5)); await p.waitForTimeout(400);
      const nud = await p.locator('#tx .tx-nudge').count(); log.push('  nudge after off-target tap: ' + nud); await shot('nudge');
      const r = await p.locator('#tx .tx-hole').boundingBox(); await p.mouse.click(r.x + r.width * .4, r.y + r.height / 2); await p.waitForTimeout(800); continue;
    }
    if (st.title === 'Napíšte, čo treba kúpiť' && same === 0) { await p.locator('.scr.top .dock input').click(); await p.keyboard.type('maslo', { delay: 60 }); await p.keyboard.press('Enter'); await p.waitForTimeout(800); continue; }
    if (same === 0 || same === 6) await p.locator('#tx .tx-card .tx-ghost').click().catch(() => {});
  }
  const fin = await p.evaluate(() => { const S = window.__bh.S; return { lists: S.lists.length, receipts: (S.receipts || []).length, first: S.first, solo: S.solo, noReal: S.noReal, onb: S.onb, tour: S.tour, sections: [...document.querySelectorAll('.scr.top .hsec')].map((e) => e.getAttribute('aria-label')) }; });
  console.log(JSON.stringify({ log, fin, errs }, null, 1)); await b.close();
})();
