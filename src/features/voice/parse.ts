/**
 * Rozbor nadiktovanej vety na operácie so zoznamom.
 *
 * Hlavný rozbor robí AI na serveri (funkcia parse-voice) – rozumie skloňovaniu,
 * preklepom rozpoznávania reči a pozná, čo sa kupuje na váhu. Tento súbor je
 * záloha bez internetu/AI: pozná slovenské čísla slovom („dvesto päťdesiat“),
 * jednotky („gramov“, „kila“) a príkazy („zmaž…“, „hotovo“). Obe cesty vracajú
 * rovnaký tvar, takže obrazovka nevie, ktorá odpovedala.
 */
import { normalizeName, PRODUCT_STEMS } from "@/lib/categories";

export type VoiceUnit = "ks" | "kg" | "g" | "dkg" | "l" | "ml" | "dl" | "bal";
export const VOICE_UNITS: VoiceUnit[] = ["ks", "kg", "g", "dkg", "l", "ml", "dl", "bal"];

export type VoiceOp =
  | {
      op: "add";
      name: string;
      quantity: number | null;
      unit: VoiceUnit | null;
      categoryId: string | null;
      /** ok = jasné · needs_qty = chýba množstvo pri tovare na váhu · unclear = asi zle rozpoznané */
      status: "ok" | "needs_qty" | "unclear";
      suggestions: string[];
    }
  | { op: "change"; target: string; quantity: number | null; unit: VoiceUnit | null; delta: number | null; name: string | null }
  | { op: "remove"; target: string }
  | { op: "done" };

const NUM: Record<string, number> = {
  jeden: 1, jedna: 1, jedno: 1, jedny: 1, jednu: 1, jednym: 1,
  dva: 2, dve: 2, dvoje: 2, dvoch: 2, tri: 3, troje: 3, styri: 4, stvoro: 4,
  pat: 5, sest: 6, sedem: 7, osem: 8, devat: 9, desat: 10,
  jedenast: 11, dvanast: 12, trinast: 13, strnast: 14, patnast: 15, sestnast: 16,
  sedemnast: 17, osemnast: 18, devatnast: 19, dvadsat: 20, tridsat: 30, styridsat: 40,
  patdesiat: 50, sestdesiat: 60, sedemdesiat: 70, osemdesiat: 80, devatdesiat: 90,
  sto: 100, dvesto: 200, tristo: 300, styristo: 400, patsto: 500, seststo: 600,
  sedemsto: 700, osemsto: 800, devatsto: 900, tisic: 1000,
  pol: 0.5, stvrt: 0.25, poldruha: 1.5,
};

/** Začiatky slov → jednotka ("gramov" → g, "kila" → kg). Poradie je dôležité (deka pred dl…). */
const UNIT_WORDS: [RegExp, VoiceUnit][] = [
  [/^(g|gr|gram|gramy|gramov|gramu)$/, "g"],
  [/^(dkg|dag|deka|dekagram\w*|dekáč\w*)$/, "dkg"],
  [/^(kg|kil|kila|kilo|kil[aá]|kilogram\w*)$/, "kg"],
  [/^(ml|mililitr\w*|mililiter)$/, "ml"],
  [/^(dl|deci|decilitr\w*|deciliter)$/, "dl"],
  [/^(l|liter|litre|litrov|litra|litry)$/, "l"],
  [/^(ks|kus|kusy|kusov|kusky|kusok|krat|x)$/, "ks"],
  [/^(bal|balenie|balenia|baleni|balik|baliky|balikov|balicek)$/, "bal"],
];

const FILLERS = new Set(["este", "potom", "tiez", "aj", "prosim", "kupit", "treba", "daj", "pridaj", "chcem", "mi", "nam", "zober", "zoberte", "kup", "kupte", "dalej", "nejake", "nejaky", "nejaku", "nejakeho"]);
const SEPARATORS = new Set(["a", "potom", "plus"]);
const REMOVE = /^(zmaz|vymaz|odstran|zrus|vyhod|vymazat|zmazat|odstranit)/;
const DONE = /^(hotovo|koniec|to je vsetko|to je asi vsetko|uz nic|nic viac|staci)$/;

type Tok = { raw: string; key: string };

function tokens(text: string): Tok[] {
  return text
    .replace(/(\d)([a-zA-Zá-žÁ-Ž])/g, "$1 $2")
    .replace(/[.!?;:]+/g, " , ")
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw: raw.replace(/^[„“"']+|[„“"']+$/g, ""), key: normalizeName(raw).replace(/[^a-z0-9,.]/g, "") }))
    .filter((t) => t.raw);
}

export function numberOf(key: string): number | null {
  if (/^\d+([.,]\d+)?$/.test(key)) {
    const n = Number(key.replace(",", "."));
    return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
  }
  if (NUM[key] !== undefined) return NUM[key]!;
  // Zložené slovo „dvadsaťpäť“, „tristopäťdesiat“: odtrhávame známe čísla zo začiatku.
  let rest = key;
  let sum = 0;
  const words = Object.keys(NUM).filter((w) => w.length > 2).sort((a, b) => b.length - a.length);
  while (rest) {
    const w = words.find((x) => rest.startsWith(x));
    if (!w) return null;
    sum += NUM[w]!;
    rest = rest.slice(w.length);
  }
  return sum || null;
}

function unitOf(key: string): VoiceUnit | null {
  for (const [re, u] of UNIT_WORDS) if (re.test(key)) return u;
  return null;
}

/** Rozdelí vetu na úseky podľa „,“ „a“ „potom“ – okrem „jeden a pol“. */
function segments(text: string): Tok[][] {
  const out: Tok[][] = [];
  let cur: Tok[] = [];
  const toks = tokens(text);
  toks.forEach((t, i) => {
    const comma = t.key === "," || t.raw.endsWith(",");
    if (t.key === ",") {
      if (cur.length) out.push(cur);
      cur = [];
      return;
    }
    const prev = toks[i - 1];
    const next = toks[i + 1];
    const halfJoin = t.key === "a" && prev && numberOf(prev.key) !== null && next?.key === "pol";
    if (SEPARATORS.has(t.key) && !halfJoin) {
      if (cur.length) out.push(cur);
      cur = [];
      return;
    }
    cur.push(comma ? { raw: t.raw.replace(/,$/, ""), key: t.key.replace(/,$/, "") } : t);
    if (comma) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Prečíta číslo zo začiatku úseku: „dvesto päťdesiat“ = 250, „jeden a pol“ = 1,5, „pol“ = 0,5. */
function readNumber(toks: Tok[], from: number): { value: number; next: number } | null {
  let i = from;
  let total = 0;
  let any = false;
  while (i < toks.length) {
    const k = toks[i]!.key;
    if (k === "a" && any && toks[i + 1]?.key === "pol") {
      total += 0.5;
      i += 2;
      continue;
    }
    const n = numberOf(k);
    if (n === null) break;
    // Slovenské čísla sa skladajú sčítaním („dvesto päťdesiat“); iba „tisíc“ násobí („dva tisíc“).
    total = n === 1000 && total > 0 ? total * 1000 : total + n;
    any = true;
    i++;
  }
  return any ? { value: Math.round(total * 1000) / 1000, next: i } : null;
}

function cap(s: string): string {
  const t = s.trim();
  return t ? t[0]!.toLocaleUpperCase("sk-SK") + t.slice(1) : t;
}

function stripFillers(toks: Tok[]): Tok[] {
  let i = 0;
  while (i < toks.length && FILLERS.has(toks[i]!.key)) i++;
  return toks.slice(i);
}

/** Slovo, ktoré vyzerá ako prídavné meno pred podstatným („hovädzie“, „nugátové“, „kuracie“). */
const ADJ = /(ie|ove|ova|ovy|ych|sky|ska|ske|cie|zie)$/;
const isAdj = (key: string) => key.length > 4 && ADJ.test(key);
/** Slovo začína známym produktom z kategórií („mrkv…“, „pivo“, „sunk…“). */
const isHead = (key: string) => key.length > 2 && PRODUCT_STEMS.some((s) => key.startsWith(s));

/**
 * Rozpoznávanie reči nedáva čiarky, takže „banány 3 rožky maslo šunka“ príde ako jeden prúd.
 * Delíme ho takto:
 *  - číslo bez jednotky začína novú položku („… 3 rožky“),
 *  - číslo s jednotkou za názvom patrí k nemu („pivo 6 kusov šunka“ → pivo 6 ks | šunka),
 *  - druhé podstatné meno produktu začína novú položku („maslo šunka“), prídavné meno ide s nasledujúcim.
 */
export function splitProducts(toks: Tok[]): { name: string; quantity: number | null; unit: VoiceUnit | null }[] {
  type Part = { toks: Tok[]; quantity: number | null; unit: VoiceUnit | null; noun: boolean };
  const parts: Part[] = [];
  let cur: Part = { toks: [], quantity: null, unit: null, noun: false };
  const flush = () => {
    if (cur.toks.length) parts.push(cur);
    else if (cur.quantity != null && parts.length) {
      // osamotené množstvo na konci patrí k predošlej položke
      const last = parts[parts.length - 1]!;
      if (last.quantity == null) Object.assign(last, { quantity: cur.quantity, unit: cur.unit });
    }
    cur = { toks: [], quantity: null, unit: null, noun: false };
  };
  let i = 0;
  while (i < toks.length) {
    const t = toks[i]!;
    if (FILLERS.has(t.key)) {
      i++;
      continue;
    }
    const num = readNumber(toks, i);
    if (num) {
      let j = num.next;
      const u = toks[j] ? unitOf(toks[j]!.key) : null;
      if (u) j++;
      if (u && cur.toks.length && cur.quantity == null) {
        Object.assign(cur, { quantity: num.value, unit: u });
      } else {
        flush();
        Object.assign(cur, { quantity: num.value, unit: u ?? (num.value % 1 ? null : "ks") });
      }
      i = j;
      continue;
    }
    const adj = isAdj(t.key);
    const head = !adj && isHead(t.key);
    if (cur.noun && (head || adj)) flush();
    cur.toks.push(t);
    if (head) cur.noun = true;
    i++;
  }
  flush();
  return parts.map((p) => ({ name: cap(p.toks.map((t) => t.raw).join(" ")), quantity: p.quantity, unit: p.unit }));
}

/**
 * Lokálny rozbor jednej vety.
 * @param target – ak používateľ ťukol na položku, veta ju upravuje („pol kila“).
 */
export function parseLocal(text: string, target?: string | null): VoiceOp[] {
  const whole = normalizeName(text).replace(/[^a-z0-9 ]/g, "").trim();
  if (!whole) return [];
  if (DONE.test(whole)) return [{ op: "done" }];

  if (target) {
    const toks = stripFillers(tokens(text).filter((t) => t.key !== ","));
    const num = readNumber(toks, 0);
    if (num) {
      const u = toks[num.next] ? unitOf(toks[num.next]!.key) : null;
      const word = toks.slice(0, 1).map((t) => t.key).join(" ");
      const isDelta = word === "o" || /viac$/.test(whole);
      return [{ op: "change", target, quantity: isDelta ? null : num.value, unit: u, delta: isDelta ? num.value : null, name: null }];
    }
    if (/^o (jeden|jednu|jedno) viac$|^este (jeden|jednu|jedno|jedny)$/.test(whole)) return [{ op: "change", target, quantity: null, unit: null, delta: 1, name: null }];
    return [{ op: "change", target, quantity: null, unit: null, delta: null, name: cap(toks.map((t) => t.raw).join(" ")) }];
  }

  const ops: VoiceOp[] = [];
  for (const seg of segments(text)) {
    const first = seg[0]?.key ?? "";
    if (REMOVE.test(first)) {
      const rest = seg.slice(1);
      if (rest.length) ops.push({ op: "remove", target: cap(rest.map((t) => t.raw).join(" ")) });
      continue;
    }
    const clean = stripFillers(seg);
    if (!clean.length) continue;
    const segText = normalizeName(clean.map((t) => t.raw).join(" "));
    if (DONE.test(segText)) {
      ops.push({ op: "done" });
      continue;
    }
    for (const it of splitProducts(clean)) {
      if (!it.name) continue;
      ops.push({ op: "add", name: it.name, quantity: it.quantity, unit: it.unit, categoryId: null, status: "ok", suggestions: [] });
    }
  }
  return ops;
}

/** Známa predajňa v nadiktovanej vete („idem do Lidla“ → Lidl). */
export function matchStore(text: string, stores: string[]): string | null {
  const said = normalizeName(text);
  for (const s of stores) {
    const key = normalizeName(s);
    const stem = key.length > 5 ? key.slice(0, key.length - 1) : key.slice(0, 4);
    if (said.includes(key) || said.split(" ").some((w) => w.startsWith(stem))) return s;
  }
  const m = text.match(/(?:idem|ideme|pôjdem|pojdem|nákup|nakup|going|heading|shopping)\s+(?:do|v|na|to|at)\s+(.+)$/i);
  return m ? cap(m[1]!.replace(/[.!?]+$/, "")) : null;
}

const GO_WORDS = new Set(["idem", "ideme", "pojdem", "pojdeme", "nakupujem", "nakupujeme", "do", "v", "vo", "na", "going", "heading", "go", "im", "to", "at", "shopping"]);

/**
 * Oddelí z vety predajňu („idem do Lidla, mlieko a rožky“ → Lidl + „mlieko a rožky“).
 * Známe predajne spozná aj v inom páde („do Kauflandu“); neznámu len za „idem do …“.
 */
export function splitStore(text: string, stores: string[]): { store: string | null; rest: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const keys = words.map((w) => normalizeName(w).replace(/[^a-z0-9]/g, ""));
  const cut = (from: number, to: number) => {
    let a = from;
    while (a > 0 && GO_WORDS.has(keys[a - 1]!)) a--;
    const rest = [...words.slice(0, a), ...words.slice(to)].join(" ").replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, "");
    return rest;
  };
  for (const s of stores) {
    const parts = normalizeName(s).split(/\s+/);
    const head = parts[0] ?? "";
    if (!head) continue;
    const stem = head.length > 5 ? head.slice(0, head.length - 1) : head.length >= 4 ? head : null;
    const i = keys.findIndex((k) => (stem ? k.startsWith(stem) : k === head));
    if (i < 0) continue;
    // Viacslovný názov („Coop Jednota“) – zhltne aj ďalšie slová názvu, ak zazneli.
    let j = i + 1;
    for (const p of parts.slice(1)) if (keys[j]?.startsWith(p.slice(0, 4))) j++;
    return { store: s, rest: cut(i, j) };
  }
  const m = /^(?:idem|ideme|pôjdem|pojdem|going|heading)\s+(?:do|vo|v|na|to)\s+(\S+)(.*)$/i.exec(text.trim());
  if (m) return { store: cap(m[1]!.replace(/[.,!?]+$/, "")), rest: m[2]!.replace(/^[\s,.;:–-]+/, "").trim() };
  return { store: null, rest: text.trim() };
}

/**
 * Pravidlo „appka nič nedomýšľa“ pre výsledok AI: z navrhnutého názvu ostanú len slová, ktoré naozaj zazneli
 * („dve mlieka“ → nie „Mlieko plnotučné“, ale „Mlieko“). Keď nezaznelo žiadne slovo názvu (napr. „plzeň“ →
 * „Pilsner Urquell“), názov sa nechá – to je preklad značky, nie domýšľanie.
 */
export function keepSaidWords(name: string, said: string): string {
  const heard = normalizeName(said).split(/[^a-z0-9]+/).filter(Boolean);
  const stem = (w: string) => w.slice(0, Math.max(3, Math.min(w.length - 1, 5)));
  const was = (w: string) => heard.some((h) => h === w || (w.length >= 4 && h.length >= 4 && h.startsWith(stem(w))));
  const parts = name.split(/\s+/).filter(Boolean);
  const words = parts.map((p) => normalizeName(p).replace(/[^a-z0-9]/g, ""));
  const keep = parts.filter((_, i) => !words[i] || /^\d/.test(words[i]!) || words[i]!.length < 3 || was(words[i]!));
  if (!parts.some((_, i) => words[i]!.length >= 3 && !/^\d/.test(words[i]!) && was(words[i]!))) return name;
  const out = keep.join(" ").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : name;
}

/**
 * Slová, ktoré samy osebe nie sú nákup: citoslovcia, súhlas, pozdravy, poďakovanie (aj anglicky).
 * Hovorená veta len z nich („hm“, „dobre, jasné“, „ďakujem“) sa ani neposiela na server.
 */
const CHATTER = new Set([
  "hm", "hmm", "hmmm", "ehm", "eh", "ee", "eee", "mm", "mmm", "mhm", "aha", "aa", "aaa", "oh", "och", "jaj", "joj", "fuj", "au", "wow",
  "no", "nuz", "tak", "takze", "teda", "proste", "vlastne", "dobre", "dobra", "jasne", "ok", "okej", "oki", "ano", "hej", "nie", "neviem",
  "ahoj", "cau", "cauko", "dakujem", "dakujeme", "vdaka", "diky", "prosim", "pockaj", "moment", "super", "fajn", "presne", "halo",
  "vidis", "vies", "ja", "ty", "to", "ze", "a", "aj", "tu", "tam", "uz", "este", "teraz", "potom",
  "um", "uh", "yeah", "yes", "okay", "thanks", "hello", "hi", "hey", "so", "well", "the",
]);
/** Typické výmysly prepisu pri šume či hudbe („Titulky vytvoril…“, „[hudba]“). */
const NOISE = /^(titulky|hudba|potlesk|smiech|music|applause|laughter|thanks for watching|dakujem za pozornost|dakujem za pozretie)/;
/** Citoslovcia a reakcie z rozhovoru („ty kokos“ nie je kokos, „ale to je“ nie je víno). */
const EXCLAIM = /^(ty kokos|ty vole|ty brdo|do kelu|do pekla|do frasa|boze moj|boze|paneboze|jezis maria|jezismaria|jezis|no teda|no nazdar|no to je|ale to je|to je ale|to snad nie|to je super|to je dobre|to je jedno|fakt|naozaj|vazne)\b/;

/**
 * Hovorená veta, ktorá určite nie je nákup – netreba ju ani rozoberať:
 * šum a výmysly prepisu, samé výplňové slová, citoslovcia („ty kokos“) a ozvena slovníka živého prepisu
 * (pri šume model niekedy vypíše výrazy oddelené pomlčkami: „Max - Golden Turtle - Finish - …“).
 */
export function isChatter(text: string): boolean {
  if (/^\s*[[(*].*[\])*]\s*$/.test(text)) return true;
  if ((text.match(/\s[-–—](\s|$)/g) ?? []).length >= 2) return true;
  const k = normalizeName(text).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!k || NOISE.test(k)) return true;
  const ex = EXCLAIM.exec(k);
  const rest = ex ? k.slice(ex[0].length).trim() : k;
  return !rest || rest.split(" ").every((w) => CHATTER.has(w));
}

/** Názov položky z hovorenej vety, ktorý je skôr celá veta než tovar (najviac 40 znakov a 6 slov). */
export const tooLong = (name: string) => name.length > 40 || name.trim().split(/\s+/).length > 6;

/** Obchod, ktorý dáva zmysel (aspoň 2 písmená, nie „.“ ani celá veta). */
export function cleanStore(s: string | null | undefined): string | null {
  const v = (s ?? "").trim().replace(/[.,!?;:]+$/, "");
  return v.length <= 30 && /\p{L}{2,}/u.test(v) ? v : null;
}

/**
 * Ozvena slovníka živého prepisu: pri šume model niekedy namiesto reči vypíše výrazy zo slovníka za sebou.
 * Slovník sa pri každom spojení náhodne zamieša (voice-live-token), takže výrazy v jeho poradí (4 a viac za sebou)
 * alebo priveľa výrazov naraz (12+) znamenajú výpis, nie diktovanie.
 */
export function isVocabEcho(text: string, vocab: string[]): boolean {
  if (vocab.length < 8) return false;
  const clean = (s: string) => normalizeName(s).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const t = ` ${clean(text)} `;
  const hits: { at: number; idx: number }[] = [];
  vocab.forEach((v, idx) => {
    const k = clean(v);
    const at = k.length >= 3 ? t.indexOf(` ${k} `) : -1;
    if (at >= 0) hits.push({ at, idx });
  });
  if (hits.length >= 12) return true;
  hits.sort((a, b) => a.at - b.at);
  let run = 1;
  for (let i = 1; i < hits.length; i++) {
    const d = hits[i]!.idx - hits[i - 1]!.idx;
    run = d >= 1 && d <= 3 ? run + 1 : 1;
    if (run >= 4) return true;
  }
  return false;
}
