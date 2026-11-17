const { chromium } = require('playwright');
const CASES = [
  ['home', (b) => b.jump('home'), '.scr.top .helpb'], ['lists', (b) => b.jump('lists'), '.scr.top .helpb'], ['list', (b) => b.jump('lists', 'list', { id: 'l1' }), '.scr.top .helpb'],
  ['recipes', (b) => b.jump('recipes'), '.scr.top .helpb'], ['recipe', (b) => b.jump('recipes', 'recipe', { id: 'gulas' }), '.scr.top .helpb'], ['money', (b) => b.jump('money'), '.scr.top .helpb'],
  ['history', (b) => { b.act((s) => ({ ...s, history: [{ id: 'h1', srcId: 'x', name: 'Drogéria', store: 'dm', shared: true, started: Date.now(), closedAt: Date.now(), items: [], total: 12, n: 3 }] })); b.jump('lists', 'history'); }, '.scr.top .helpb'],
  ['more', (b) => b.jump('home', 'more'), '.scr.top .helpb'],
  ['m-shop', (b) => b.modal('shop', { listId: 'l1' }), '.mdl .helpb'], ['m-follow', (b) => b.modal('follow'), '.mdl .helpb'], ['m-voice', (b) => b.voice({}), '.mdl .helpb'],
  ['m-cook', (b) => b.modal('cook', { id: 'gulas' }), '.mdl .helpb'], ['m-taste', (b) => b.modal('taste'), '.mdl .helpb'],
];
(async () => {
  const b = await chromium.launch(); const errs = []; const R = {};
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: 'dark' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'test.html')); await p.waitForTimeout(800); await p.locator('.intro .tp').nth(1).click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.__bh.act((s) => ({ ...s, onb: { started: true }, coach: { off: true, welcomed: true, seen: {}, v: 2 } }))); await p.waitForTimeout(300);
  for (const [n, fn, sel] of CASES) {
    await p.evaluate(() => { window.__bh.closeSheet(); window.__bh.closeModal(); }); await p.waitForTimeout(450);
    await p.evaluate(`(${fn.toString()})(window.__bh)`); await p.waitForTimeout(1100);
    const titles = [];
    try { await p.locator(sel).first().click({ timeout: 3000 }); await p.waitForTimeout(600); await p.locator('.tx-hrow').first().click({ timeout: 3000 }); await p.waitForTimeout(1500);
      for (let i = 0; i < 8; i++) { const t = await p.locator('.coach .co-bub b').first().textContent({ timeout: 1500 }).catch(() => null); if (!t) break; titles.push(t); if (i === 0) await p.screenshot({ path: `${__dirname}/../dist/shots/hint-${n}.png` }); await p.locator('.coach .co-ok').click(); await p.waitForTimeout(900); }
    } catch (e) { titles.push('ERR ' + e.message.split('\n')[0]); }
    R[n] = titles;
  }
  // upozornenia: bodka a vynulovanie
  await p.evaluate(() => { window.__bh.closeModal(); window.__bh.jump('home'); }); await p.waitForTimeout(600);
  R.dotBefore = await p.locator('.scr.top .mebtn .mdot').count();
  await p.locator('.scr.top .mebtn').click(); await p.waitForTimeout(900); R.notifRows = await p.locator('.scr.top .notifsec .row').count();
  await p.evaluate(() => window.__bh.pop()); await p.waitForTimeout(700); R.dotAfter = await p.locator('.scr.top .mebtn .mdot').count();
  console.log(JSON.stringify({ R, errs }, null, 1)); await b.close();
})();
