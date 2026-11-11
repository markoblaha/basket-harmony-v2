// Automatické preklikanie testovacej appky v telefónovej veľkosti (iPhone 393 × 852; iná: W=375 H=667).
//
// Prihlási testovací účet (len testovacia DB), prejde všetky obrazovky v každom vzhľade
// a hľadá: chyby JavaScriptu, neúspešné volania servera, chybové hlásenia na obrazovke,
// vodorovné pretekanie stránky, text mimo obrazovky a prekrývajúce sa texty.
// Fotky obrazoviek uloží do priečinka (predvolene testy/vysledky/, nie je v gite).
//
// Spustenie:
//   E2E_EMAIL=… E2E_PASSWORD=… node testy/preklikanie.cjs [adresa] [priečinok]
// Prihlasovacie údaje sú v trezore testovacej DB (vault: e2e_test_email, e2e_test_password).
// Predvolená adresa = nasadená testovacia appka. Lokálne: npx vite build --mode staging && npx vite preview.
// Skript nič nemení: len otvára obrazovky (žiadne ťuknutia, ktoré zapisujú).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev").replace(/\/$/, "");
const OUT = process.argv[3] || path.join(__dirname, "vysledky");
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Chýba E2E_EMAIL alebo E2E_PASSWORD (testovací účet z trezoru testovacej DB).");
  process.exit(2);
}
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "..", ".env.staging"), "utf8").split("\n")
    .filter((l) => /^VITE_/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);

// Vzhľady: obe témy z mockupu (Teplá kuchyňa, Fotky a sklo), každá svetlá a tmavá.
const LOOKS = [
  { name: "tepla-svetla", style: "warm", theme: "light", scheme: "light" },
  { name: "tepla-tmava", style: "warm", theme: "dark", scheme: "dark" },
  { name: "sklo-svetla", style: "glass", theme: "light", scheme: "light" },
  { name: "sklo-tmava", style: "glass", theme: "dark", scheme: "dark" },
];

/** Id-čka pre obrazovky s detailom – načítané cez API ako testovací účet (len čítanie). */
async function ids() {
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  if (!login.access_token) throw new Error("Prihlásenie zlyhalo: " + JSON.stringify(login).slice(0, 200));
  const get = (q) => fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${login.access_token}` } }).then((r) => r.json());
  const [list] = await get("shopping_lists?select=id&is_archived=eq.false&completed_at=is.null&order=updated_at.desc&limit=1");
  const [receipt] = await get("receipts?select=id,store_key&status=eq.OK&order=purchased_on.desc&limit=1");
  const [trip] = await get("shopping_lists?select=id&completed_at=not.is.null&order=completed_at.desc&limit=1");
  const [product] = await get("products?select=id,kind,name&kind=not.is.null&merged_into=is.null&limit=1");
  let kindKey = null;
  if (product) {
    kindKey = await fetch(`${url}/rest/v1/rpc/kind_key`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${login.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: product.kind, p_name: product.name }),
    }).then((r) => r.json());
  }
  return { trip: trip?.id, list: list?.id, receipt: receipt?.id, store: receipt?.store_key, product: product?.id, kind: typeof kindKey === "string" ? kindKey : null };
}

function screens(id) {
  return [
    ["domov", "/"],
    ["uvitanie", "/?uvitanie=1"],
    ["nakupy", "/lists"],
    id.list && ["zoznam", `/lists/${id.list}`],
    ["historia", "/history"],
    ["blocek", "/scan"],
    id.trip && ["nakup-detail", `/history/${id.trip}`],
    id.trip && ["zoznam-kupeny", `/lists/${id.trip}`],
    ["recepty", "/recipes"],
    ["recepty-moje", "/recipes?t=mine"],
    ["recepty-plan", "/recipes?t=plan"],
    ["recepty-kategoria", "/recipes/c/cat/all"],
    ["ochutnavac", "/recipes/taste"],
    ["varenie", "/recipes/r/segedin/cook"],
    ["recepty-hladat", "/recipes/search"],
    ["recept", "/recipes/r/segedin"],
    ["doklady", "/receipts"],
    id.receipt && ["doklad", `/receipts/${id.receipt}`],
    id.receipt && ["parovanie", `/receipts/${id.receipt}/match`],
    ["vypis", "/receipts/statement"],
    ["analytika", "/analytics"],
    ["analytika-kategorie", "/analytics/categories"],
    ["analytika-obchody", "/analytics/stores"],
    ["analytika-produkty", "/analytics/products"],
    ["kategoria", "/analytics/category/dairy_eggs"],
    id.store && ["obchod", `/analytics/store/${encodeURIComponent(id.store)}`],
    id.product && ["produkt", `/analytics/product/${id.product}`],
    id.kind && ["druh", `/analytics/kind/${encodeURIComponent(id.kind)}`],
    ["viac", "/more"],
    ["domacnost", "/more/household"],
    ["upozornenia", "/more/notifications"],
    ["obchody", "/more/stores"],
  ].filter(Boolean);
}

// Beží v stránke: vráti zoznam nálezov rozloženia.
const CHECK = () => {
  const W = innerWidth, out = [];
  const vis = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity !== 0 && !el.closest('[aria-hidden="true"]');
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return true;
    }
    return false;
  };
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const name = (el) => `${el.tagName.toLowerCase()} "${(el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 30)}"`;
  if (document.documentElement.scrollWidth > W + 1) out.push(["pageOverflowX", `${document.documentElement.scrollWidth} > ${W}`]);
  const all = [...document.body.querySelectorAll("*")].filter(vis);
  for (const el of all) {
    if (!ownText(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if ((r.right > W + 1 || r.left < -1) && !inScroller(el)) out.push(["offscreen", name(el), `${Math.round(r.left)}..${Math.round(r.right)}`]);
    if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis") out.push(["clipX", name(el), `${el.scrollWidth}>${el.clientWidth}`]);
  }
  // Texty v grafoch (svg) sa kontrolujú len na pretekanie, nie na prekrytie.
  const texts = all.filter((el) => ownText(el) && !el.closest("[aria-live]") && !el.closest("svg"));
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], c = texts[j];
    if (a.contains(c) || c.contains(a)) continue;
    const A = a.getBoundingClientRect(), C = c.getBoundingClientRect();
    const ix = Math.min(A.right, C.right) - Math.max(A.left, C.left), iy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
    if (ix > 3 && iy > 3) {
      // Pripnuté vrstvy (hlavička, lišta) prekrývajú obsah pri posúvaní zámerne.
      const layer = (el) => { for (let p = el; p; p = p.parentElement) if (/fixed|sticky/.test(getComputedStyle(p).position)) return p; return null; };
      // Text zakrytý inou vrstvou (napr. podklad riadku, ktorý sa ukáže až pri potiahnutí) sa nepočíta.
      const onTop = (el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (el.contains(hit) || hit.contains(el)); };
      if (layer(a) === layer(c) && onTop(a) && onTop(c)) out.push(["overlap", name(a), name(c)]);
    }
  }
  const alerts = [...document.querySelectorAll('[role="alert"]')].filter(vis).map((el) => (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 120));
  for (const a of alerts) out.push(["errorShown", a]);
  return out;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const id = await ids();
  // ONLY=nakupy,parovanie – len vybrané obrazovky (rýchla kontrola jednej zmeny)
  const only = (process.env.ONLY || "").split(",").filter(Boolean);
  const list = screens(id).filter(([n]) => !only.length || only.includes(n));
  const browser = await chromium.launch();
  const report = {};
  let problems = 0;
  for (const look of LOOKS) {
    const ctx = await browser.newContext({
      viewport: { width: Number(process.env.W) || 393, height: Number(process.env.H) || 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      colorScheme: look.scheme, locale: "sk-SK",
    });
    await ctx.addInitScript(([theme, style]) => {
      try { localStorage.setItem("bh.theme", theme); localStorage.setItem("bh.style", style); localStorage.setItem("bh.locale", "sk"); /* uvítanie len na obrazovke „uvitanie“, inak by prekrylo všetky */ if (location.search.includes("uvitanie")) localStorage.removeItem("bh.help"); else localStorage.setItem("bh.help", JSON.stringify({ started: true, off: true, firstHidden: true })); } catch { /* */ }
    }, [look.theme, look.style]);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(`js: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 200)}`); });
    page.on("response", (r) => {
      if (r.status() >= 400 && /supabase\.co/.test(r.url())) errs.push(`http ${r.status()}: ${r.url().replace(/\?.*/, "").slice(-80)}`);
    });

    // Prihlásenie cez obrazovku (rovnako ako človek).
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"], input[autocomplete="current-password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
    await page.waitForLoadState("networkidle");

    for (const [n, route] of list) {
      errs.length = 0;
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const found = [];
      const seen = new Set();
      for (let step = 0; step < 4; step++) {
        for (const x of await page.evaluate(CHECK)) {
          const k = x.join("|");
          if (!seen.has(k)) { seen.add(k); found.push(x); }
        }
        if (step === 0) await page.screenshot({ path: path.join(OUT, `${look.name}-${n}.png`) });
        const moved = await page.evaluate(() => { const t = scrollY; scrollBy(0, innerHeight * 0.8); return scrollY !== t; });
        if (!moved) break;
        await page.waitForTimeout(250);
      }
      for (const e of errs) found.push(["error", e]);
      if (found.length) {
        report[`${look.name} ${n}`] = found;
        problems += found.length;
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  console.log(`\n${LOOKS.length} vzhľady × ${list.length} obrazoviek, nálezov: ${problems}. Fotky: ${OUT}`);
  process.exit(problems ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
