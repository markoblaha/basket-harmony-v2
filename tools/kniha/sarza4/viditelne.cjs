// Kontrola receptov podľa pokynu majiteľa: platí text viditeľný na stránke, nie skryté dáta. Vstup: {"result": "[{\"json_agg\": [{id, url}]}]"} (výstup execute_sql alebo REST book_sources).
// Stiahne viditeľný text (innerText) stránok receptov skutočným prehliadačom: node viditelne.cjs zdroje.json out.json
const { chromium } = require("playwright"); const fs = require("fs");
const raw = JSON.parse(fs.readFileSync(process.argv[2])).result;
const data = JSON.parse(raw)[0].json_agg; const out = {};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" });
  await ctx.route("**/*", (r) => ["image", "media", "font"].includes(r.request().resourceType()) ? r.abort() : r.continue());
  const urls = [...new Set(data.map((x) => x.url))]; let i = 0;
  async function worker() { const p = await ctx.newPage();
    while (i < urls.length) { const u = urls[i++];
      try { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 }); await p.waitForTimeout(1500); out[u] = await p.evaluate(() => document.body.innerText); }
      catch (e) { out[u] = "!!" + e.message.slice(0, 80); } }
    await p.close(); }
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  fs.writeFileSync(process.argv[3], JSON.stringify(out)); await b.close(); console.log("hotovo", Object.keys(out).length);
})();
