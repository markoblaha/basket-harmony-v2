const { chromium } = require('playwright');
const STATES = require('./states.js');
const M = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .05 && !el.closest('.scr.off') && !el.closest('[aria-hidden="true"]') && r.bottom > 0 && r.top < innerHeight; };
  const nm = (el) => ((el.getAttribute('aria-label') || el.innerText || el.title || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30)) || ('<' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.') + '>');
  const out = { small: [], noname: [], tiny: [], lowc: [], sizes: {} };
  const inter = [...document.querySelectorAll('.app button, .app a, .app [role="button"], .app input, .app [role="switch"], .app select, .app textarea')].filter(vis);
  for (const el of inter) {
    if (el.closest('.tabbar') && el.tagName !== 'BUTTON') continue;
    const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 43.5 && !el.matches('input[type=range]')) { const cs = getComputedStyle(el); out.small.push(nm(el) + ` ${Math.round(r.width)}×${Math.round(r.height)} .` + String(el.className).split(' ').slice(0,2).join('.')); }
    const hasName = (el.getAttribute('aria-label') || el.innerText || el.title || el.placeholder || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length)) ; if (!hasName) out.noname.push(nm(el));
  }
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const appBg = parse(getComputedStyle(document.querySelector('.app')).backgroundColor) || { r: 128, g: 128, b: 128, a: 1 };
  const bgOf = (el) => { let layers = []; for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('gradient')) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= .95) break; } } let base = appBg; for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 }; } return base; };
  const texts = [...document.querySelectorAll('.app *')].filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  for (const el of texts) {
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); out.sizes[fs] = (out.sizes[fs] || 0) + 1;
    const t = el.innerText.trim().replace(/\s+/g, ' ').slice(0, 26);
    if (fs < 12.5) out.tiny.push(`${fs}px "${t}"`);
    const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg) continue;
    const op = [...Array(6)].reduce((a, _, i) => a, 1); let o = 1; for (let p = el; p && p !== document.body; p = p.parentElement) o *= +getComputedStyle(p).opacity;
    const f = { r: fg.r * fg.a * o + bg.r * (1 - fg.a * o), g: fg.g * fg.a * o + bg.g * (1 - fg.a * o), b: fg.b * fg.a * o + bg.b * (1 - fg.a * o) };
    const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
    if (cr < (large ? 3 : 4.5) && !el.closest('.tabbar .on') ) out.lowc.push(`${cr.toFixed(1)} ${fs}px "${t}"`);
  }
  return out;
};
(async () => {
  const b = await chromium.launch(); const res = {}; const errs = [];
  for (const [th, scheme] of [[0, 'light'], [0, 'dark'], [1, 'light'], [1, 'dark']]) {
    const key = (th ? 'g' : 'w') + '-' + scheme;
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(key + ' ' + e.message));
    await p.goto('file://' + require('path').join(__dirname, '..', 'dist', 'test.html')); await p.waitForTimeout(900);
    await p.locator('.intro .tp').nth(th).click(); await p.waitForTimeout(400);
    await p.evaluate(() => window.__bh.act((s) => ({ ...s, onb: { started: true }, tips: { ...(s.tips || {}), all: 1, taste: 1, swipe: 1 }, coach: { off: true, welcomed: true, seen: {}, v: 2 } })));
    for (const [n, fn] of STATES) {
      await p.evaluate(() => { window.__bh.closeSheet && window.__bh.closeSheet(); window.__bh.closeModal(); }); await p.waitForTimeout(450);
      await p.evaluate(`(${fn.toString()})(window.__bh)`); await p.waitForTimeout(n.startsWith('s-item') ? 1300 : 1000);
      res[key + ' ' + n] = await p.evaluate(M);
      if (key === 'g-dark' || key === 'w-light') await p.screenshot({ path: `${__dirname}/../dist/shots/${key}-${n}.png` });
    }
    await ctx.close();
  }
  require('fs').writeFileSync(__dirname + '/ux2.json', JSON.stringify({ res, errs }, null, 1)); console.log('done', errs.length); await b.close();
})();
