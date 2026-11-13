/**
 * Pridávanie do zoznamu ťukaním na bubliny (návrh prototyp/pridavanie-navrh.html): nový zoznam → okno pridávania →
 * „ban“ → 3 rýchle ťuky na prvú známu bublinu = jeden riadok s 3 ks (aj v databáze) → mínus = 2 ks →
 * „rozky 2“ + Enter → posúvanie zoznamu nechá klávesnicu (pole ostane aktívne) → ťuk do zoznamu okno zavrie.
 * Zapisuje do testovacej databázy (zoznam „Pridávanie …“ v testovacej domácnosti, na konci sa archivuje).
 *
 * Spustenie: E2E_EMAIL=… E2E_PASSWORD=… node testy/pridavanie.cjs [adresa] [priečinok na fotky]
 * Testovací účet je v trezore testovacej DB (e2e_test_email, e2e_test_password).
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = (process.argv[2] || "https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev").replace(/\/$/, "");
const OUT = process.argv[3] || path.join(__dirname, "vysledky", "pridavanie");
const { E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("Chýba E2E_EMAIL alebo E2E_PASSWORD (testovací účet z trezoru testovacej DB).");
  process.exit(2);
}
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, "..", ".env.staging"), "utf8").split("\n").filter((l) => /^VITE_/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const API = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tok = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((r) => r.json());
  const H = { apikey: KEY, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
  const dbItems = (listId) => fetch(`${API}/rest/v1/shopping_list_items?select=name,quantity,status&list_id=eq.${listId}`, { headers: H }).then((r) => r.json());

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "sk-SK" });
  await ctx.addInitScript(() => {
    localStorage.setItem("bh.locale", "sk");
    localStorage.setItem("bh.help", JSON.stringify({ started: true, off: true, firstHidden: true }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`js: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && /supabase\.co/.test(r.url())) errs.push(`http ${r.status()}: ${r.url().replace(/\?.*/, "").slice(-70)}`); });

  const name = `Pridávanie ${new Date().toISOString().slice(5, 16).replace("T", " ")}`;
  let listId = null;
  let n = 0;
  const fail = async (msg) => {
    await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}-CHYBA.png`) });
    console.log(`✗ ${n}. ${msg}`);
    if (errs.length) console.log("  chyby:", errs.join(" | "));
    if (listId) await fetch(`${API}/rest/v1/shopping_lists?id=eq.${listId}`, { method: "PATCH", headers: H, body: JSON.stringify({ is_archived: true }) });
    await browser.close();
    process.exit(1);
  };
  const step = async (title, fn) => {
    n++;
    try {
      const note = await fn();
      await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}.png`) });
      console.log(`✓ ${n}. ${title}${note ? ` – ${note}` : ""}`);
    } catch (e) {
      await fail(`${title}\n  ${String(e.message).split("\n")[0]}`);
    }
  };
  const expect = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  const box = () => page.locator(".dock .field input");
  const focused = () => page.evaluate(() => document.activeElement?.tagName === "INPUT");

  await step("prihlásenie", async () => {
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  });
  await step(`nový zoznam „${name}“`, async () => {
    await page.goto(`${BASE}/lists`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nový zoznam" }).first().click();
    await page.getByPlaceholder("Napr. Víkendový nákup alebo Metro").fill(name);
    await page.getByRole("button", { name: `Vytvoriť „${name}“` }).click();
    await page.waitForURL(/\/lists\/[0-9a-f-]{36}/, { timeout: 15000 });
    listId = page.url().match(/\/lists\/([0-9a-f-]{36})/)[1];
    await page.waitForLoadState("networkidle");
  });
  await step("ťuk do poľa = okno pridávania so zoznamom", async () => {
    await box().tap();
    await page.locator(".dock.addwin .aw-body").waitFor({ timeout: 5000 });
    expect(await focused(), "pole nie je aktívne");
  });
  let chipName = "";
  await step("„ban“ + 3 rýchle ťuky na bublinu = 1 riadok s 3 ks", async () => {
    await box().type("ban", { delay: 60 });
    await page.waitForTimeout(500);
    const chips = await page.locator(".bb-row .bb").evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, " | ")));
    const first = page.locator(".bb-row .bb:not(.typed) .bb-m").first();
    expect(await first.count(), `žiadna známa bublina pre „ban“: ${JSON.stringify(chips)}`);
    chipName = (await first.locator(".bb-t b").innerText()).trim();
    await first.tap();
    await page.waitForTimeout(110);
    await page.locator(".bb-row .bb.act .bb-m").tap();
    await page.waitForTimeout(110);
    await page.locator(".bb-row .bb.act .bb-m").tap();
    await page.waitForTimeout(200);
    const ui = await page.locator(".aw-body .row").first().innerText();
    expect(/3\s*ks/.test(ui), `riadok hneď po ťuknutiach: ${ui.replace(/\n/g, " | ")}`);
    expect(await focused(), "ťuk na bublinu zobral poľu kurzor");
    await page.waitForTimeout(2500);
    const rows = (await dbItems(listId)).filter((r) => r.status === "OPEN");
    expect(rows.length === 1 && Number(rows[0].quantity) === 3, `v databáze: ${JSON.stringify(rows)}`);
    return `${chipName}, bubliny: ${chips.join(" / ")}`;
  });
  await step("mínus v bubline = 2 ks", async () => {
    await page.locator(".bb-row .bb.act .bb-min").tap();
    await page.waitForTimeout(2000);
    const rows = (await dbItems(listId)).filter((r) => r.status === "OPEN");
    expect(rows.length === 1 && Number(rows[0].quantity) === 2, `v databáze: ${JSON.stringify(rows)}`);
  });
  await step("„rozky 2“ + Enter", async () => {
    await box().type("rozky 2", { delay: 40 });
    await box().press("Enter");
    await page.waitForTimeout(2500);
    expect((await box().inputValue()) === "", "pole sa nevyprázdnilo");
    const rows = (await dbItems(listId)).filter((r) => r.status === "OPEN");
    const r = rows.find((x) => /^ro[zž]k/i.test(x.name));
    expect(rows.length === 2 && r && Number(r.quantity) === 2, `v databáze: ${JSON.stringify(rows)}`);
    return rows.map((x) => `${x.name} ${x.quantity}`).join(", ");
  });
  await step("posúvanie zoznamu v okne nechá klávesnicu", async () => {
    await page.locator(".aw-body").evaluate((e) => e.scrollBy(0, 120));
    await page.waitForTimeout(300);
    expect(await page.locator(".dock.addwin").count(), "okno sa zavrelo");
    expect(await focused(), "pole stratilo kurzor");
  });
  await step("ťuk do zoznamu okno zavrie (detail sa neotvorí)", async () => {
    await page.locator(".aw-body .row").first().tap();
    await page.waitForTimeout(600);
    expect(!(await page.locator(".dock.addwin").count()), "okno ostalo otvorené");
    expect(!(await page.locator(".sheet .sh-head").count()), "otvoril sa detail");
  });
  await step("bez chýb servera a JS", async () => {
    expect(!errs.length, errs.join(" | "));
  });
  await fetch(`${API}/rest/v1/shopping_lists?id=eq.${listId}`, { method: "PATCH", headers: H, body: JSON.stringify({ is_archived: true }) });
  console.log(`  testovací zoznam „${name}“ archivovaný`);
  await browser.close();
})();
