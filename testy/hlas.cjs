/**
 * Hlasový režim – len nákup, nie rozhovor: falošný mikrofón (zvukové úseky v slučke), falošný živý prepis
 * (Gemini Live) „povie“ pripravené vety a test kontroluje, čo sa objaví v rozdiktovanom zozname:
 *  rozhovor → nič, „Nepridané“ + „Pridať aj tak“ (ťuk pridá) · nákup → položky · „hm“ → nič a bez volania AI ·
 *  „bol som v Bille“ → obchod sa nezmení · 4 vety rozhovoru za sebou → mikrofón sa sám pozastaví.
 * Rozbor viet (parse-voice) je predvolene podvrhnutý pripravenými odpoveďami; REAL=1 použije skutočnú funkciu
 * v testovacej DB (stojí ~8 volaní AI). Nič neukladá (Hotovo sa nestláča; rozdiktovaný zoznam sa na konci zahodí).
 *
 * Spustenie: E2E_EMAIL=… E2E_PASSWORD=… node testy/hlas.cjs [adresa] [priečinok na fotky]
 * (adresa napr. http://localhost:4173 po `npx vite build --mode staging && npx vite preview`)
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = (process.argv[2] || "https://design-v2-mobile-redesign-basket-harmony-v2.markoblaha.workers.dev").replace(/\/$/, "");
const OUT = process.argv[3] || path.join(__dirname, "vysledky", "hlas");
const { E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD, REAL } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("Chýba E2E_EMAIL alebo E2E_PASSWORD (testovací účet z trezoru testovacej DB).");
  process.exit(2);
}

/** Zvuk mikrofónu: 1,2 s hlasného šumu („reč“) a 1,6 s ticha, dookola. */
function burstsWav(file) {
  const rate = 16000;
  const pattern = [...Array(Math.round(rate * 1.6)).fill(0), ...Array.from({ length: Math.round(rate * 1.2) }, (_, i) => Math.sin(i / 7) * 0.25 + (Math.random() - 0.5) * 0.2)];
  const pcm = Buffer.alloc(pattern.length * 2);
  pattern.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

const add = (name, quantity = null, unit = null) => ({ op: "add", name, target: null, quantity, unit, delta: null, category_id: null, status: "ok", suggestions: [] });
/** Pripravené odpovede parse-voice (rovnaké, aké skutočná funkcia vrátila pri skúške 14. 11. 2026). */
const CANNED = {
  "speech:dve mlieka a chlieb": { intent: "list", ops: [add("Mlieko", 2, "ks"), add("Chlieb")] },
  "typed:kurkuma": { intent: "list", ops: [add("Kurkuma")] },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const wav = path.join(OUT, "mikrofon.wav");
  burstsWav(wav);
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "sk-SK", permissions: ["microphone"] });
  await ctx.addInitScript(() => {
    localStorage.setItem("bh.locale", "sk");
    localStorage.setItem("bh.help", JSON.stringify({ started: true, off: true, firstHidden: true }));
    // Falošný živý prepis: po konci vety (audioStreamEnd) vráti ďalšiu pripravenú vetu z window.__say.
    window.__say = [];
    const Real = window.WebSocket;
    window.WebSocket = function (url, p) {
      if (!String(url).includes("generativelanguage")) return new Real(url, p);
      const ws = { readyState: 0, onopen: null, onmessage: null, onerror: null, onclose: null };
      const emit = (m) => setTimeout(() => ws.onmessage?.({ data: JSON.stringify(m) }), 30);
      ws.send = (raw) => {
        const m = JSON.parse(raw);
        if (m.setup) emit({ setupComplete: {} });
        if (m.realtimeInput?.audioStreamEnd) {
          const text = window.__say.shift();
          if (text) emit({ serverContent: { inputTranscription: { text } } });
        }
      };
      ws.close = () => {
        if (ws.readyState === 3) return;
        ws.readyState = 3;
        setTimeout(() => ws.onclose?.({}), 0);
      };
      setTimeout(() => {
        ws.readyState = 1;
        ws.onopen?.({});
      }, 50);
      return ws;
    };
    window.WebSocket.OPEN = 1;
  });
  const page = await ctx.newPage();
  const errs = [];
  const calls = [];
  page.on("pageerror", (e) => errs.push(`js: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && /supabase\.co/.test(r.url())) errs.push(`http ${r.status()}: ${r.url().replace(/\?.*/, "").slice(-70)}`);
  });
  await page.route("**/functions/v1/voice-live-token", (route) =>
    route.fulfill({ json: { token: "falosny", setup: {}, expiresAt: new Date(Date.now() + 360000).toISOString() } }),
  );
  await page.route("**/functions/v1/parse-voice", async (route) => {
    const b = route.request().postDataJSON() ?? {};
    calls.push(`${b.source}:${b.text ?? "(zvuk)"}`);
    if (REAL) return route.continue();
    const c = CANNED[`${b.source}:${b.text}`] ?? { intent: "other", ops: [] };
    await new Promise((r) => setTimeout(r, 400));
    return route.fulfill({ json: { transcript: b.text ?? "", cook: [], store: null, ...c } });
  });

  let n = 0;
  const fail = async (msg) => {
    await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}-CHYBA.png`) });
    console.log(`✗ ${n}. ${msg}`);
    if (errs.length) console.log("  chyby:", errs.join(" | "));
    console.log("  volania parse-voice:", calls.join(" | "));
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
  const names = () => page.locator(".vx-list .vxi b").allInnerTexts();
  const say = (text) => page.evaluate((x) => window.__say.push(x), text);
  const skippedShows = (text) => page.locator(".vx-skip", { hasText: text }).waitFor({ timeout: 15000 });

  await step("prihlásenie", async () => {
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
  });
  await step("hlasový režim počúva", async () => {
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("bh.voiceDraft.")) localStorage.removeItem(k);
    });
    await page.locator("nav.tabbar").getByRole("button", { name: "Hlasový nákup" }).click();
    await page.locator(".vx-heard.st-listen, .vx-heard.st-hear").waitFor({ timeout: 15000 });
    expect((await names()).length === 0, "zoznam nie je prázdny");
  });
  const target = await page.locator(".vx-target").innerText();
  await step("rozhovor „kde máš kľúče od auta“ → nič nepribudne", async () => {
    await say("kde máš kľúče od auta");
    await skippedShows("kde máš kľúče od auta");
    expect((await names()).length === 0, `pribudlo: ${await names()}`);
  });
  await step("AI sa pomýli („kurkuma“ = rozhovor) → „Pridať aj tak“ ju pridá", async () => {
    await say("kurkuma");
    await skippedShows("kurkuma");
    expect((await names()).length === 0, `pribudlo: ${await names()}`);
    await page.getByRole("button", { name: "Pridať aj tak" }).click();
    await page.locator(".vx-list .vxi b", { hasText: "Kurkuma" }).waitFor({ timeout: 15000 });
    return (await names()).join(", ");
  });
  await step("nákup „dve mlieka a chlieb“ → 2 položky", async () => {
    await say("dve mlieka a chlieb");
    await page.waitForFunction(() => document.querySelectorAll(".vx-list .vxi b").length >= 3 && !document.querySelector('.vx-list .vxi[role="status"]'), null, { timeout: 15000 });
    const got = await names();
    expect(got.some((x) => /mliek/i.test(x)) && got.some((x) => /chlieb/i.test(x)), `položky: ${got}`);
    return got.join(", ");
  });
  await step("„hm“ → nič a bez volania AI", async () => {
    const before = calls.length;
    await say("hm");
    await skippedShows("hm");
    expect(calls.length === before, `volalo sa: ${calls.slice(before)}`);
    expect((await names()).length === 3, `položky: ${await names()}`);
  });
  await step("„bol som včera v Bille a bolo tam plno“ → obchod sa nezmení", async () => {
    await say("bol som včera v Bille a bolo tam plno");
    await skippedShows("bol som včera v Bille");
    await page.waitForTimeout(500);
    const now = await page.locator(".vx-target").innerText();
    expect(now === target, `cieľ sa zmenil: ${target} → ${now}`);
    expect((await names()).length === 3, `položky: ${await names()}`);
  });
  await step("4 vety rozhovoru za sebou → mikrofón sa sám pozastaví", async () => {
    await say("ahoj ako sa máš");
    await skippedShows("ahoj ako sa máš");
    await say("počkaj chvíľu");
    await page.getByText("Pozastavil som – okolo sa len rozpráva", { exact: false }).waitFor({ timeout: 15000 });
    expect(!(await page.locator(".vx-orb.on").count()), "mikrofón stále počúva");
  });
  await step("ťuk na mikrofón → počúva znova", async () => {
    await page.locator(".vx-orb").click();
    await page.locator(".vx-heard.st-listen, .vx-heard.st-hear").waitFor({ timeout: 15000 });
    expect(!(await page.getByText("Pozastavil som", { exact: false }).count()), "hláška ostala");
  });
  await step("zatvorenie, rozdiktovaný zoznam zahodený", async () => {
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("bh.voiceDraft.")) localStorage.removeItem(k);
    });
  });
  console.log("volania parse-voice:", calls.join(" | "));
  if (errs.length) console.log("chyby:", errs.join(" | "));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
