const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; const R = {};
  for (const [th, sch] of [[1, 'dark'], [0, 'light']]) {
    const k = (th ? 'g' : 'w') + sch;
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: sch, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'test.html')); await p.waitForTimeout(800); await p.locator('.intro .tp').nth(th).click(); await p.waitForTimeout(300);
    await p.evaluate(() => window.__bh.act((s) => ({ ...s, onb: { started: true }, coach: { off: true, welcomed: true, v: 2 }, lists: [{ id: 'lx', name: 'Test', store: 'lidl', when: new Date().toISOString(), shared: ['m', 'l'], items: [] }, ...s.lists] })));
    await p.evaluate(() => window.__bh.jump('lists', 'list', { id: 'lx' })); await p.waitForTimeout(900);
    const inp = p.locator('.scr.top .dock input');
    for (const t of ['Smotana', 'smot', 'pivo', 'plzeň', '2 mlieka', 'chleba', 'smotna', 'kyslá smotana']) {
      await inp.fill(''); await inp.click(); await inp.type(t, { delay: 15 }); await p.waitForTimeout(400);
      R[k + ' ' + t] = await p.locator('.sgl .sgr').evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, ' | ')));
      await p.screenshot({ path: `${__dirname}/../dist/shots/sg-${k}-${t.replace(/\W+/g, '_')}.png` });
    }
    await inp.fill(''); await inp.type('smotana'); await inp.press('Enter'); await p.waitForTimeout(500);
    await inp.fill(''); await inp.type('6 piv'); await inp.press('Enter'); await p.waitForTimeout(500);
    await inp.fill(''); await inp.type('plzen'); await inp.press('Enter'); await p.waitForTimeout(800);
    R[k + ' list'] = await p.locator('.scr.top .lst .row').evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, ' | ')));
    await p.locator('.scr.top .dock input').blur(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${__dirname}/../dist/shots/sg-${k}-list.png` });
    // detail všeobecnej položky + spresnenie
    await p.locator('.scr.top .lst .row:has-text("Pivo") .tx').first().click(); await p.waitForTimeout(900);
    R[k + ' sheet'] = await p.locator('.sheet .pinfo').innerText(); await p.screenshot({ path: `${__dirname}/../dist/shots/sg-${k}-sheet.png` });
    await p.locator('.sheet .mv .chip:has-text("Radegast")').first().click(); await p.waitForTimeout(600);
    R[k + ' refined'] = await p.evaluate(() => window.__bh.S.lists.find((l) => l.id === 'lx').items.map((i) => i.pid + ' ' + i.q));
    await ctx.close();
  }
  console.log(JSON.stringify({ R, errs }, null, 1)); await b.close();
})();
