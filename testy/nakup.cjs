/**
 * Tok nákupu cez obrazovky, ako ho robí človek: nový zoznam → 3 položky (písaním) → Nakupovať →
 * všetko do košíka → Dokončiť nákup → Teraz nie → zoznam je v Histórii nákupov.
 * Zapisuje do testovacej databázy (vznikne zoznam „Tok nákupu …“ v testovacej domácnosti).
 *
 * Spustenie: E2E_EMAIL=… E2E_PASSWORD=… node testy/nakup.cjs [adresa] [priečinok na fotky]
 * Testovací účet je v trezore testovacej DB (e2e_test_email, e2e_test_password).
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = (process.argv[2] || "https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev").replace(/\/$/, "");
const OUT = process.argv[3] || path.join(__dirname, "vysledky-nakup");
const { E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("Chýba E2E_EMAIL alebo E2E_PASSWORD (testovací účet z trezoru testovacej DB).");
  process.exit(2);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "sk-SK" });
  await ctx.addInitScript(() => {
    localStorage.setItem("bh.locale", "sk");
    localStorage.setItem("bh.help", JSON.stringify({ started: true, off: true, firstHidden: true }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`js: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && /supabase\.co/.test(r.url())) errs.push(`http ${r.status()}: ${r.url().replace(/\?.*/, "").slice(-70)}`); });

  const name = `Tok nákupu ${new Date().toISOString().slice(5, 16).replace("T", " ")}`;
  const items = ["mlieko", "chlieb", "2 jablká"];
  let n = 0;
  const step = async (title, fn) => {
    n++;
    try {
      await fn();
      await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}.png`) });
      console.log(`✓ ${n}. ${title}`);
    } catch (e) {
      await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}-CHYBA.png`) });
      console.log(`✗ ${n}. ${title}\n  ${String(e.message).split("\n")[0]}`);
      if (errs.length) console.log("  chyby:", errs.join(" | "));
      await browser.close();
      process.exit(1);
    }
  };

  await step("prihlásenie", async () => {
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  });
  await step("ukončenie rozbehnutého nákupu z minulého behu (ak je)", async () => {
    // Človek môže naraz nakupovať len jeden zoznam – zvyšok po prerušenom teste by zablokoval „Nakupovať“.
    const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, "..", ".env.staging"), "utf8").split("\n").filter((l) => /^VITE_/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)));
    const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const tok = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((r) => r.json());
    const h = { apikey: key, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
    const me = tok.user.id;
    const live = await fetch(`${url}/rest/v1/shopping_sessions?select=id&status=eq.ACTIVE&shopper_id=eq.${me}`, { headers: h }).then((r) => r.json());
    for (const s of live) await fetch(`${url}/rest/v1/rpc/end_shopping`, { method: "POST", headers: h, body: JSON.stringify({ p_session_id: s.id }) });
    if (live.length) console.log(`  ukončené: ${live.length}`);
  });
  await step(`nový zoznam „${name}“`, async () => {
    await page.goto(`${BASE}/lists`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nový zoznam" }).first().click();
    await page.getByPlaceholder("Napr. Víkendový nákup alebo Metro").fill(name);
    await page.getByRole("button", { name: `Vytvoriť „${name}“` }).click();
    await page.waitForURL(/\/lists\/[0-9a-f-]{36}/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
  });
  await step(`pridanie položiek: ${items.join(", ")}`, async () => {
    const box = page.locator('input[enterkeyhint="done"]').last();
    for (const it of items) {
      await box.click();
      await box.fill(it);
      await box.press("Enter");
      await page.waitForTimeout(700);
    }
    await box.blur();
    for (const w of ["Mlieko", "Chlieb", "Jablká"]) await page.locator(".lst .row", { hasText: w }).first().waitFor({ timeout: 10000 });
  });
  await step("Nakupovať", async () => {
    await page.getByRole("button", { name: /Nakupovať/ }).first().click();
    await page.getByRole("button", { name: /Odškrtni|Dokončiť nákup/ }).first().waitFor({ timeout: 10000 });
  });
  await step("všetko do košíka", async () => {
    // ťuk = položka sa označí a po chvíli presunie do košíka (druhý ťuk by ju vrátil)
    for (let i = 0; i < 10; i++) {
      const row = page.locator('.lst [role="checkbox"][aria-checked="false"]').first();
      if (!(await row.count())) break;
      await row.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("button", { name: "Dokončiť nákup", exact: true }).waitFor({ timeout: 10000 });
  });
  await step("Dokončiť nákup → Teraz nie", async () => {
    await page.getByRole("button", { name: "Dokončiť nákup", exact: true }).click();
    await page.getByRole("button", { name: "Teraz nie" }).click();
    await page.waitForTimeout(1500);
  });
  await step("zoznam je v Histórii nákupov", async () => {
    await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
    await page.getByText(name).first().waitFor({ timeout: 10000 });
  });

  await browser.close();
  if (errs.length) {
    console.log("Chyby počas toku:", errs.join(" | "));
    process.exit(1);
  }
  console.log(`Tok nákupu prešiel (${n} krokov). Fotky: ${OUT}`);
})();
