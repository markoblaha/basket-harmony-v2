/**
 * Rozpoznanie napísanej položky a odhad ceny – prenesené z mockupu (prototyp/src/logic.js resolveName,
 * refinements, unitPrice, groupPrice, estimate) na skutočné produkty domácnosti (item_catalog v DB).
 *
 * Pravidlo majiteľa: appka nič nedomýšľa, rozhoduje len to, čo je napísané:
 *  1. značka („radegast“, „plzeň“) → cena len z nákupov tejto značky (jej hlavného druhu),
 *  2. všeobecná položka („pivo“, „smotana“, „chleba“) → priemer nákupov všetkých druhov tejto veci
 *     v rovnakej kategórii (telové mlieko nie je mlieko),
 *  3. druh („svetlé pivo 12°“, „kyslá smotana 16 %“) → len nákupy tohto druhu,
 *  inak sa položka pridá presne tak, ako je napísaná, bez ceny.
 */

export type Buy = { d: string; s: string; t: number; q: number | null; u: string };
export type CatProduct = {
  id: string;
  name: string;
  kind: string | null;
  brand: string | null;
  category_id: string;
  size_value: number | null;
  size_unit: string | null;
  buys: Buy[];
};

export type Level = "general" | "kind" | "brand";
export type Resolved = {
  level: Level;
  /** Názov položky v zozname. */
  label: string;
  category: string;
  /** Produkty, z ktorých nákupov sa ráta cena. */
  members: CatProduct[];
  /** Pri všeobecnej položke počet druhov, pri značke jej meno. */
  kinds: number;
  brand?: string;
};

/** Text bez diakritiky, malými písmenami; ponechá číslice, ° a %. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9°% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const FILL = new Set(["pre", "bez", "alebo", "nejake", "nejaky", "nejaku", "ten", "tie", "ako"]);
/** Široké slová – samé o sebe nie sú položka s cenou (ostanú ako text). */
const BROAD = new Set(["maso", "masa", "ovocie", "zelenina", "zeleninu", "pecivo", "napoj", "napoje", "sladkosti", "drogeria", "kozmetika", "potraviny"]);
/** Hovorové tvary → slovo z názvu produktu („chleba“ = chlieb). */
const SYN: Record<string, string> = { chleba: "chlieb", chlebik: "chlieb", krumple: "zemiaky", zemiacky: "zemiaky", mliecko: "mlieko", zemle: "zemla", zemlicky: "zemla" };
/** Značky, ktoré ľudia volajú inak ako na bločku. */
const BRAND_ALIAS: Record<string, string[]> = {
  "pilsner urquell": ["plzen", "plzne", "plzni", "plzenske", "plzensky", "plzenskeho", "pilsner", "prazdroj"],
  "velkopopovicky kozel": ["kozel", "kozla", "kozlik"],
  staropramen: ["smichov"],
  "capri sun": ["caprisun"],
};

const isNum = (w: string) => /^\d+([.,]\d+)?$/.test(w);
const words = (s: string) => norm(s).split(" ").filter(Boolean);
/** Slová, podľa ktorých sa rozhoduje (bez čísel a výplňových slov). */
export const typedWords = (text: string) =>
  words(text)
    .filter((w) => w.length > 2 && !FILL.has(w) && !isNum(w))
    .map((w) => SYN[w] ?? w);
const qual = (toks: string[]) => toks.filter((t) => t.length > 1 && !FILL.has(t) && !isNum(t) && t !== "%");

/**
 * Zhoda slov: rovnaké slovo = 2, iný pád toho istého slova („mlieka“/„mlieko“, „banán“/„banány“) = 1.
 * Prídavné meno nie je to isté („smotanová nátierka“ nie je smotana).
 */
function wordScore(w: string, t: string): number {
  if (w === t) return 2;
  if (w.length < 4 || t.length < 4 || Math.abs(w.length - t.length) > 1) return 0;
  const n = Math.max(4, Math.min(w.length, t.length) - 2);
  return w.slice(0, n) === t.slice(0, n) ? 1 : 0;
}
const hits = (w: string, toks: string[]) => toks.some((t) => wordScore(w, t) > 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Group = { key: string; label: string; toks: string[]; members: CatProduct[]; category: string; count: number };
type BrandGroup = Group & { aliases: string[] };

export type ItemCatalog = {
  products: CatProduct[];
  kinds: Group[];
  names: Group[];
  brands: BrandGroup[];
};

function groupBy(products: CatProduct[], keyOf: (p: CatProduct) => string | null, labelOf: (p: CatProduct) => string): Group[] {
  const m = new Map<string, CatProduct[]>();
  for (const p of products) {
    const k = keyOf(p);
    if (!k) continue;
    const arr = m.get(k) ?? [];
    arr.push(p);
    m.set(k, arr);
  }
  return [...m.entries()].map(([key, members]) => {
    const cats = new Map<string, number>();
    for (const p of members) cats.set(p.category_id, (cats.get(p.category_id) ?? 0) + 1 + p.buys.length);
    const category = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const top = [...members].sort((a, b) => b.buys.length - a.buys.length)[0]!;
    return { key, label: labelOf(top), toks: words(labelOf(top)), members, category, count: members.reduce((a, p) => a + p.buys.length, 0) };
  });
}

export function buildCatalog(products: CatProduct[]): ItemCatalog {
  const kinds = groupBy(products, (p) => norm(p.kind || p.name) || null, (p) => p.kind || p.name);
  const names = groupBy(products, (p) => norm(p.name) || null, (p) => p.name);
  const productToks = new Set(products.flatMap((p) => words(`${p.name} ${p.kind ?? ""}`)));
  const brands = groupBy(products, (p) => (p.brand ? norm(p.brand) : null), (p) => p.brand!).map((b) => ({
    ...b,
    // slovo, ktoré je aj v názve produktu („Kofola“), patrí produktu, nie značke
    aliases: [...new Set([...b.toks.filter((t) => t.length > 2 && !productToks.has(t)), ...(BRAND_ALIAS[b.key] ?? [])])],
  }));
  return { products, kinds, names, brands };
}

/** Slovo s diakritikou: rovnaké slovo z názvov produktov („svetle“ → „svetlé“), inak tak, ako bolo napísané. */
function origWord(labels: string[], text: string, w: string): string {
  for (const l of labels) for (const x of l.split(/[\s,()/]+/)) if (norm(x) === w) return x.toLowerCase();
  for (const x of text.split(/\s+/)) if (norm(x) === w || SYN[norm(x)] === w) return x.toLowerCase();
  return w;
}

function brandMatch(c: ItemCatalog, ws: string[]): Resolved | null {
  let best: { b: BrandGroup; members: CatProduct[]; sc: number; rest: string[] } | null = null;
  for (const b of c.brands) {
    const bw = ws.filter((w) => b.aliases.some((a) => w === a || (wordScore(w, a) >= 1 && w.length >= 5)));
    if (!bw.length) continue;
    const rest = ws.filter((w) => !bw.includes(w));
    let members = b.members.filter((p) => rest.every((w) => hits(w, words(`${p.name} ${p.kind ?? ""}`))));
    if (!members.length) continue;
    if (!rest.length) {
      // bez upresnenia: hlavný druh značky (Staropramen = pivo, nie nealko)
      const kc = new Map<string, number>();
      for (const p of members) kc.set(norm(p.kind || p.name), (kc.get(norm(p.kind || p.name)) ?? 0) + 1 + p.buys.length);
      const main = [...kc.entries()].sort((a, x) => x[1] - a[1])[0]![0];
      members = members.filter((p) => norm(p.kind || p.name) === main);
    }
    const sc = bw.length * 2 + rest.length;
    if (!best || sc > best.sc) best = { b, members, sc, rest };
  }
  if (!best) return null;
  const extra = best.rest.map((w) => origWord(best!.members.map((p) => p.name), "", w));
  return { level: "brand", label: [best.b.label, ...extra].join(" "), category: best.b.category, members: best.members, kinds: 1, brand: best.b.label };
}

/**
 * Všeobecná položka: druhy, ktoré obsahujú všetky napísané slová, v kategórii hlavného druhu.
 * Keď také slovo nie je v žiadnom druhu, hľadá sa v názvoch produktov („kofola“ → Kofola Cirkulka).
 */
function generalFor(c: ItemCatalog, ws: string[]): { prim: Group; members: Group[] } | null {
  let cands = c.kinds.filter((k) => ws.every((w) => hits(w, k.toks)));
  if (!cands.length) cands = c.names.filter((k) => ws.every((w) => hits(w, k.toks)));
  if (!cands.length) return null;
  const exact = (k: Group) => (qual(k.toks).length === ws.length && ws.every((w) => k.toks.includes(w)) ? 1 : 0);
  const head = (k: Group) => (ws.some((w) => wordScore(w, qual(k.toks)[0] ?? "") > 0) ? 1 : 0);
  const prim = [...cands].sort((a, b) => exact(b) - exact(a) || head(b) - head(a) || b.count - a.count || a.toks.length - b.toks.length)[0]!;
  return { prim, members: cands.filter((k) => k.category === prim.category) };
}

/** Hlavné rozhodnutie: čo znamená napísaný názov (bez množstva). null = pridá sa presne takto, bez ceny. */
export function resolveName(c: ItemCatalog, text: string): Resolved | null {
  const ws = typedWords(text);
  if (!ws.length) return null;
  if (ws.length === 1 && BROAD.has(ws[0]!)) return null;
  const br = brandMatch(c, ws);
  if (br) return br;
  const g = generalFor(c, ws);
  const exactKind = g && qual(g.prim.toks).length === ws.length && ws.every((w) => g.prim.toks.some((t) => wordScore(w, t) > 0));
  // druh: napísané všetky rozlišujúce slová jeho názvu
  if (!exactKind) {
    const exact = c.names.filter((n) => {
      const q = qual(n.toks);
      return q.length > 0 && ws.every((w) => hits(w, n.toks)) && q.every((t) => ws.some((w) => wordScore(w, t) > 0));
    });
    if (exact.length) {
      const sc = (n: Group) => ws.reduce((a, w) => a + Math.max(...n.toks.map((t) => wordScore(w, t)), 0), 0) * 10 - qual(n.toks).length + Math.min(n.count, 9) / 10;
      const n = exact.sort((a, b) => sc(b) - sc(a))[0]!;
      return { level: "kind", label: n.label, category: n.category, members: n.members, kinds: 1 };
    }
  }
  if (!g) return null;
  const members = g.members.flatMap((k) => k.members);
  if (exactKind && new Set(members.map((p) => norm(p.name))).size === 1) {
    // jediný druh (napr. „kyslá smotana“ = Kyslá smotana 16 %) – cena ako pri druhu
    return { level: "kind", label: g.prim.label, category: g.prim.category, members, kinds: 1 };
  }
  const labels = [g.prim.label, ...members.map((p) => p.name)];
  const label = exactKind ? g.prim.label : cap(ws.map((w) => origWord(labels, text, w)).join(" "));
  return { level: "general", label, category: g.prim.category, members, kinds: new Set(members.map((p) => norm(p.name))).size };
}

/** Spresnenie všeobecnej položky: konkrétne druhy (názvy produktov) a značky, od najkupovanejších. */
export function refinements(c: ItemCatalog, r: Resolved | null, n = 6): Resolved[] {
  if (!r || r.level !== "general") return [];
  const ids = new Set(r.members.map((p) => p.id));
  const kinds = c.names
    .filter((g) => g.members.some((p) => ids.has(p.id)))
    .sort((a, b) => b.count - a.count)
    .map((g) => ({ level: "kind" as const, label: g.label, category: g.category, members: g.members, kinds: 1 }));
  const brands = c.brands
    .filter((b) => b.members.some((p) => ids.has(p.id)))
    .sort((a, b) => b.count - a.count)
    .map((b) => ({ level: "brand" as const, label: b.label, category: b.category, members: b.members.filter((p) => ids.has(p.id)), kinds: 1, brand: b.label }));
  const out: Resolved[] = [];
  for (const x of [...kinds, ...brands]) if (norm(x.label) !== norm(r.label) && !out.some((o) => norm(o.label) === norm(x.label))) out.push(x);
  return out.slice(0, n);
}

/** Kategórie jedla a pitia – pri rovnakej zhode idú pred drogériou („mlie“ → mlieko pred telovým mliekom). */
const FOOD = new Set(["alcohol", "bakery", "beverages", "breakfast", "dairy_eggs", "deli_chilled", "frozen", "groceries", "meat_fish", "pantry", "produce", "snacks_sweets"]);

/** Iné položky podľa začiatku písaného slova („smot“ → Smotana, Kyslá smotana…). */
export function searchNames(c: ItemCatalog, text: string, n = 5): Resolved[] {
  const t = norm(text).replace(/\b\d+([.,]\d+)?\b/g, "").trim();
  if (t.length < 2) return [];
  const ws = t.split(" ").filter(Boolean);
  const found = c.names
    .map((g) => {
      const base = norm(g.label).startsWith(t) ? 10 : ws.every((w) => g.toks.some((x) => x.startsWith(w))) ? 6 : 0;
      return { g, s: base && base + (FOOD.has(g.category) ? 1 : 0) + Math.min(g.count, 9) / 10 };
    })
    .filter((x) => x.s > 0);
  if (!found.length) return [];
  // iná kategória ako najlepšia zhoda ide nižšie – hľadá sa tá istá vec, nie len rovnaké slovo
  const best = found.reduce((a, b) => (b.s > a.s ? b : a));
  return found
    .map((x) => ({ g: x.g, s: x.g.category === best.g.category ? x.s : x.s - 3 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(({ g }) => ({ level: "kind" as const, label: g.label, category: g.category, members: g.members, kinds: 1 }));
}

/** Preklep v jednom slove („zemaky“ → Zemiaky?) – ponúkne sa, nič sa nemení samo. */
export function typoFix(c: ItemCatalog, text: string): Resolved | null {
  const ws = typedWords(text);
  if (ws.length !== 1 || ws[0]!.length < 4 || BROAD.has(ws[0]!) || resolveName(c, text)) return null;
  const w = ws[0]!;
  // pri rovnakej vzdialenosti vyhrá kratší (všeobecnejší) názov: „mleko“ → Mlieko, nie Telové mlieko
  let best: { g: Group; d: number; len: number } | null = null;
  for (const g of c.kinds) {
    const len = qual(g.toks).length;
    for (const t of qual(g.toks)) {
      if (Math.abs(t.length - w.length) > 2) continue;
      const d = editDist(w, t);
      if (d > 0 && d <= (w.length > 6 ? 2 : 1) && (!best || d < best.d || (d === best.d && (len < best.len || (len === best.len && g.count > best.g.count)))))
        best = { g, d, len };
    }
  }
  return best ? resolveName(c, best.g.label) : null;
}

export function editDist(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

/* ------------------------------------------------------------------ ceny */
const DAY = 86_400_000;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const isKgBuy = (b: Buy) => /^(kg|g)$/i.test(b.u);

export type Price = {
  /** Cena za kus (alebo za kg pri váženom tovare v kg). */
  up: number;
  min: number;
  max: number;
  /** Počet nákupov, z ktorých sa rátalo. */
  k: number;
  /** Priemer druhov (všeobecná položka). */
  avg: boolean;
  /** Obchod posledného nákupu (pri druhu a značke). */
  store: string | null;
  /** Rátané len z nákupov v obchode zoznamu. */
  same: boolean;
  history: { d: string; s: string; p: number }[];
};

/** Jednotková cena z nákupov: za kus, alebo za kg, keď položka je v kg. */
function unitOf(b: Buy, perKg: boolean): number | null {
  if (perKg) return isKgBuy(b) && b.q ? (b.u.toLowerCase() === "g" ? (b.t / b.q) * 1000 : b.t / b.q) : null;
  // vážený tovar kupovaný na kg, položka v kusoch = bežný nákup (celý riadok bločku)
  if (isKgBuy(b)) return b.t;
  return b.t / Math.max(1, b.q ?? 1);
}

/**
 * Bežná cena: druh a značka = medián posledných 3 nákupov za 120 dní (v obchode zoznamu, ak tam boli);
 * všeobecná položka = priemer nákupov všetkých druhov (bez extrémov), v obchode zoznamu pri aspoň 2 nákupoch.
 */
export function unitPrice(r: Resolved, storeKey: string | null, keyOf: (s: string) => string | null, perKg = false, now = Date.now()): Price | null {
  const all = r.members
    .flatMap((p) => p.buys)
    .filter((b) => now - new Date(b.d).getTime() <= 120 * DAY)
    .map((b) => ({ b, p: unitOf(b, perKg) }))
    .filter((x): x is { b: Buy; p: number } => x.p != null && x.p > 0)
    .sort((a, b) => a.b.d.localeCompare(b.b.d));
  if (!all.length) return null;
  const same = storeKey ? all.filter((x) => keyOf(x.b.s) === storeKey) : [];
  const ps = all.map((x) => x.p);
  const history = all.slice(-5).reverse().map((x) => ({ d: x.b.d, s: x.b.s, p: x.p }));
  if (r.level === "general") {
    const pool = same.length >= 2 ? same : all;
    const md = median(pool.map((x) => x.p));
    const ok = pool.filter((x) => x.p <= md * 3 && x.p >= md / 3);
    return { up: ok.reduce((a, x) => a + x.p, 0) / ok.length, min: Math.min(...ps), max: Math.max(...ps), k: ok.length, avg: true, store: null, same: same.length >= 2, history };
  }
  const pool = same.length ? same : all;
  const last3 = pool.slice(-3);
  return { up: median(last3.map((x) => x.p)), min: Math.min(...ps), max: Math.max(...ps), k: last3.length, avg: false, store: pool[pool.length - 1]!.b.s, same: same.length > 0, history };
}

export type Estimate = { v: number; lo: number; hi: number; price: Price; perKg: boolean; /** Odhadnutá váha pri váženom tovare v kusoch. */ kg?: number };

/** Približná váha jedného kusu (pri 3 a viac kusoch: „6 banánov“), inak bežný nákup domácnosti. */
const PIECE: [string, number][] = [
  ["banan", 0.18], ["jablk", 0.2], ["jablc", 0.2], ["hrusk", 0.2], ["paprik", 0.15], ["citron", 0.12], ["limet", 0.08], ["mrkv", 0.1],
  ["cuket", 0.3], ["zemiak", 0.15], ["cibul", 0.15], ["uhork", 0.35], ["avokad", 0.2], ["pomaranc", 0.25], ["mandarin", 0.1],
  ["kiwi", 0.08], ["rajcin", 0.12], ["paradajk", 0.12], ["cesnak", 0.05],
];
const pieceKg = (label: string) => {
  for (const w of words(label)) for (const [k, kg] of PIECE) if (w.startsWith(k)) return kg;
  return null;
};

/**
 * Odhad za položku: cena × počet kusov (alebo × kg, keď je množstvo v kg/g). Vážený tovar zadaný v kusoch
 * („jablká 1 ks“ = jedno bežné balenie z bločkov, „6 banánov“ = 6 × váha kusu) sa ráta podľa ceny za kg.
 */
export function estimate(r: Resolved | null, quantity: number | null, unit: string | null, storeKey: string | null, keyOf: (s: string) => string | null, now = Date.now()): Estimate | null {
  if (!r) return null;
  const u = (unit ?? "").toLowerCase();
  const perKg = u === "kg" || u === "g" || u === "dkg";
  const qty = quantity ?? 1;
  const pieces = !perKg && (u === "" || u === "ks" || u === "bal");
  if (pieces) {
    const recent = r.members.flatMap((p) => p.buys).filter((b) => now - new Date(b.d).getTime() <= 120 * DAY);
    const kgBuys = recent.filter((b) => isKgBuy(b) && b.q);
    if (recent.length && kgBuys.length * 2 >= recent.length) {
      const price = unitPrice(r, storeKey, keyOf, true, now);
      if (price) {
        const typical = median(kgBuys.slice(-3).map((b) => (b.u.toLowerCase() === "g" ? b.q! / 1000 : b.q!)));
        const piece = qty >= 3 ? pieceKg(r.label) : null;
        const kg = Math.round(qty * (piece ?? typical) * 1000) / 1000;
        return { v: price.up * kg, lo: price.min * kg, hi: price.max * kg, price, perKg: true, kg };
      }
    }
  }
  const kg = u === "g" ? qty / 1000 : u === "dkg" ? qty / 100 : qty;
  const price = unitPrice(r, storeKey, keyOf, perKg, now);
  if (!price) return null;
  // ml a dl = jedno balenie (napr. 500 ml smotany), litre = počet fliaš
  const n = perKg ? kg : u === "ml" || u === "dl" ? 1 : Math.max(1, Math.round(qty));
  return { v: price.up * n, lo: price.min * n, hi: price.max * n, price, perKg };
}
