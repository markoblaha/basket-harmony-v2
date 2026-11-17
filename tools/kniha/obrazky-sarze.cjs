// Obrázky skúšobnej šarže: karta s 3D ikonou jedla, názvom a číslom šarže. node tools/kniha/obrazky-sarze.cjs <priečinok> → <id>.png;
// Argumenty: <priečinok> <číslo šarže> <dátum>. Potom PIL: <id>-1.webp (1080×1350) a <id>-1s.webp (432×540) do public/kniha.
const { chromium } = require("playwright");
const fs = require("fs");
const EM = require("path").resolve(__dirname, "../../public/mk/em") + "/";
const OUT = process.argv[2];
const BATCH = Number(process.argv[3] || 1);
const DATE = process.argv[4] || "17. 11. 2026";
const R1 = [
  ["cesnakova", "Cesnaková polievka", "Polievky", "soup", ["#f6d365", "#fda085"]],
  ["gulas", "Hovädzí guláš", "Mäso", "stew", ["#f8b195", "#c06c84"]],
  ["segedin", "Segedínsky guláš", "Mäso", "pot", ["#f7c59f", "#e07a5f"]],
  ["paprikas", "Kurací paprikáš", "Hydina", "poultry", ["#ffd194", "#ff8a65"]],
  ["halusky", "Bryndzové halušky", "Slovenská klasika", "dumpling", ["#fdfbfb", "#c9d6df"]],
  ["carbonara", "Špagety carbonara", "Cestoviny", "spaghetti", ["#fff1c1", "#f6b26b"]],
  ["salat", "Zemiakový šalát", "Šaláty", "salad", ["#d4fc79", "#96e6a1"]],
  ["palacinky", "Tenké palacinky", "Sladké", "pancakes", ["#ffecd2", "#fcb69f"]],
  ["babovka", "Mramorová bábovka", "Koláče", "cake", ["#e6d5c3", "#a47551"]],
  ["cheesecake", "New York cheesecake", "Torty a dezerty", "cheese", ["#fff6e5", "#f3c98b"]],
];
const R2 = [
  ["svieckova", "Sviečková na smotane", "Mäso", "meat", ["#f3d9b1", "#c98b5a"]],
  ["kulajda", "Juhočeská kulajda", "Polievky", "mushroom", ["#fdfcf0", "#d8d3a8"]],
  ["kapustnica", "Slovenská kapustnica", "Polievky", "cabbage", ["#fbe3b8", "#e39b5b"]],
  ["plnena_paprika", "Plnené papriky", "Mäso", "pepper", ["#ffd6c2", "#e5736a"]],
  ["sekana", "Babkina sekaná", "Mäso", "meatbone", ["#f7d6bf", "#b8735a"]],
  ["syr", "Vyprážaný syr", "Bez mäsa", "cheese2", ["#fff3c4", "#f2c14e"]],
  ["bramboraky", "Zemiakové placky", "Bez mäsa", "potato", ["#f8e7c9", "#d9a65f"]],
  ["knedle", "Marhuľové knedle", "Sladké", "peach", ["#ffe9cf", "#f5a35c"]],
  ["strudla", "Jablková štrúdľa", "Koláče", "apple", ["#f9efd9", "#c8a26b"]],
  ["lievance", "Nadýchané lievance", "Raňajky", "pancakes", ["#fff1d6", "#f0b860"]],
];
const R3 = [
  ["hrachova", "Hrachová polievka", "Polievky", "soup", ["#e3f0c8", "#a9c97a"]],
  ["bramborova", "Zemiaková polievka", "Polievky", "potato", ["#fbe9c6", "#e0b36a"]],
  ["bramborovy_gulas", "Zemiakový guláš", "Hlavné jedlá", "stew", ["#f7c9a8", "#d97b4a"]],
  ["lasagne", "Lasagne", "Cestoviny", "spaghetti", ["#ffd9b8", "#e0824f"]],
  ["buchty", "Buchty s jablkami", "Sladké", "bread", ["#fff0d2", "#e8b66a"]],
  ["tvarohovy_kolac", "Tvarohový koláč", "Sladké", "cake", ["#fff6e0", "#edc984"]],
  ["jablkovy_kolac", "Jablkový koláč", "Sladké", "apple", ["#f9e8c8", "#c9a15d"]],
  ["zemiakova_kasa", "Zemiaková kaša", "Prílohy", "potato", ["#fff4d6", "#e6c27a"]],
  ["gulasovka", "Gulášová polievka", "Polievky", "stew", ["#f8c9b0", "#cf6f4a"]],
];
const R = BATCH === 3 ? R3 : BATCH === 2 ? R2 : R1;
const html = ([, name, cat, em, [a, b]]) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box} body{width:1080px;height:1350px;font-family:Inter,"Segoe UI",system-ui,sans-serif;overflow:hidden}
.c{position:relative;width:100%;height:100%;background:linear-gradient(135deg,${a},${b});display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#2b211b}
.c:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.10) 0 28px,transparent 28px 56px)}
.em{width:250px;height:250px;margin:8px 0;background:url(data:image/webp;base64,${fs.readFileSync(EM + em + ".webp").toString("base64")}) center/contain no-repeat;filter:drop-shadow(0 24px 34px rgba(0,0,0,.25));position:relative}
.n{font-size:58px;line-height:1.05;font-weight:800;letter-spacing:-1.5px;position:relative;text-align:center;max-width:600px}
.k{font-size:28px;font-weight:600;opacity:.65;position:relative}
.b{position:relative;background:#2b211b;color:#fff;font-weight:800;font-size:28px;padding:12px 24px;border-radius:999px;letter-spacing:.5px}
.v{position:relative;background:rgba(255,255,255,.75);font-weight:700;font-size:24px;padding:8px 18px;border-radius:999px}
.f{position:absolute;bottom:60px;font-size:24px;font-weight:600;opacity:.6;text-align:center;max-width:600px}
</style><div class="c"><div class="b">TESTOVACIA ŠARŽA ${BATCH}</div><div class="em"></div><div class="n">${name}</div><div class="k">${cat}</div><div class="v">v1 · ${DATE}</div><div class="f">Skutočná fotka príde, keď bude kniha hotová</div></div>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  for (const r of R) {
    await p.setContent(html(r), { waitUntil: "load" });
    await p.screenshot({ path: `${OUT}/${r[0]}.png` });
  }
  await b.close();
})();
