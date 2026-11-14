/**
 * Sada viet pre rozbor hlasu (funkcia parse-voice v testovacej DB): nákupy, opravy, recepty, obchod a rozhovory,
 * ktoré sa NESMÚ pridať. Pre každú vetu je v testy/hlas-vety.json očakávaný výsledok; test zmeria presnosť a čas.
 * Po každej zmene pokynov pre AI (supabase/functions/parse-voice) ho spusti znova – všetky vety musia prejsť.
 *
 * Spustenie: E2E_EMAIL=… E2E_PASSWORD=… node testy/hlas-vety.mjs
 * (testovací účet z trezoru testovacej DB; ~60 volaní AI ≈ 5 centov, limit domácnosti je 120 viet za hodinu)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.join(DIR, "..", ".env.staging"), "utf8").split("\n").filter((l) => /^VITE_/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const API = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const { E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("Chýba E2E_EMAIL alebo E2E_PASSWORD (testovací účet z trezoru testovacej DB).");
  process.exit(2);
}
const cases = JSON.parse(fs.readFileSync(path.join(DIR, "hlas-vety.json"), "utf8"));

const auth = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((r) => r.json());
const H = { apikey: KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
const hid = (await fetch(`${API}/rest/v1/household_members?select=household_id&user_id=eq.${auth.user.id}`, { headers: H }).then((r) => r.json()))[0].household_id;
/** Rozdiktovaný zoznam, voči ktorému sa vety rozoberajú („ešte jedny banány“ = zmena). */
const items = [{ name: "Mlieko", qty: "2 ks" }, { name: "Banány", qty: "-" }];

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/**
 * Názov sedí, keď každé očakávané slovo začína niektoré slovo názvu (tvary a poradie slov: „Vrecká“ ~ „Vreck“,
 * „Pivo Staropramen“ ~ „Staropramen“).
 */
const nameOk = (got, want) => {
  const g = norm(got).split(/\s+/);
  return norm(want).split(/\s+/).every((w) => g.some((x) => x.startsWith(w) || w.startsWith(x.slice(0, Math.max(4, x.length - 2)))));
};

function judge(c, r) {
  if (r.error) return `chyba ${r.error}`;
  const adds = (r.ops ?? []).filter((o) => o.op === "add");
  if (c.nie) return r.intent === "other" && !(r.ops ?? []).length && !(r.cook ?? []).length ? null : "rozhovor sa mal ignorovať";
  if (r.intent !== "list") return "nákup bol označený ako rozhovor";
  if (c.polozky) {
    for (const w of c.polozky) {
      const [, name, qty] = /^(.*?)(?:\s+([\d.]+))?$/.exec(w);
      const hit = adds.find((o) => nameOk(o.name, name) && (!qty || Number(o.quantity) === Number(qty)));
      if (!hit) return `chýba „${w}“`;
    }
    if (adds.length > c.polozky.length) return `navyše: ${adds.map((o) => o.name).join(", ")}`;
  }
  if (c.zmena && !(r.ops ?? []).some((o) => o.op === "change" && nameOk(o.target, c.zmena))) return `chýba zmena „${c.zmena}“`;
  if (c.zmazat && !(r.ops ?? []).some((o) => o.op === "remove" && nameOk(o.target, c.zmazat))) return `chýba mazanie „${c.zmazat}“`;
  if (c.hotovo && !(r.ops ?? []).some((o) => o.op === "done")) return "chýba „hotovo“";
  if (c.recept && !(r.cook ?? []).some((x) => nameOk(x, c.recept))) return `chýba recept „${c.recept}“`;
  if (c.obchod && norm(r.store) !== norm(c.obchod)) return `obchod „${r.store}“`;
  return null;
}

const show = (r) =>
  r.error
    ? r.error
    : `${r.intent} ${(r.ops ?? []).map((o) => (o.op === "add" ? `+${o.name}${o.quantity ? ` ${o.quantity}${o.unit ?? ""}` : ""}` : `${o.op}:${o.target ?? ""}`)).join(" ")}${r.cook?.length ? ` recept:${r.cook.join("/")}` : ""}${r.store ? ` obchod:${r.store}` : ""}`;

const results = [];
async function run(c) {
  const t0 = Date.now();
  const r = await fetch(`${API}/functions/v1/parse-voice`, { method: "POST", headers: H, body: JSON.stringify({ household_id: hid, text: c.veta, items, target: null, vocab: [], source: "speech" }) })
    .then((x) => x.json())
    .catch((e) => ({ error: String(e) }));
  results.push({ c, r, ms: Date.now() - t0, bad: judge(c, r) });
}
for (let i = 0; i < cases.length; i += 4) await Promise.all(cases.slice(i, i + 4).map(run));

const group = (c) => (c.nie ? "rozhovor" : c.polozky ? "nákup" : "povel");
for (const { c, r, ms, bad } of results) console.log(`${bad ? "CHYBA" : "  ok "} ${String(ms).padStart(5)} ms  [${group(c)}] „${c.veta}“ → ${show(r)}${bad ? `   ← ${bad}` : ""}`);
const ms = results.map((x) => x.ms).sort((a, b) => a - b);
const by = {};
for (const x of results) {
  const g = group(x.c);
  by[g] ??= [0, 0];
  by[g][1]++;
  if (!x.bad) by[g][0]++;
}
const bad = results.filter((x) => x.bad).length;
console.log(`\nSpolu ${results.length - bad}/${results.length} · ${Object.entries(by).map(([g, [ok, n]]) => `${g} ${ok}/${n}`).join(" · ")}`);
console.log(`Čas odpovede: medián ${ms[Math.floor(ms.length / 2)]} ms, 90 % do ${ms[Math.floor(ms.length * 0.9)]} ms`);
process.exit(bad ? 1 : 0);
