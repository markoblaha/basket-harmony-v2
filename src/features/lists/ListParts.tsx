/**
 * Časti obrazovky zoznamu prenesené z mockupu 1:1 (prototyp/src/lists.jsx): riadok ceny, riadok položky
 * s potiahnutím, pridávanie (rad bublín a pole, pri písaní okno so zoznamom nad klávesnicou), detail položky.
 * Rozpoznanie položky a ceny sú v itemCatalog.ts (pravidlo: appka nič nedomýšľa).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import { category, normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { parseItemInput, unitLabel } from "@/lib/parseItem";
import { formatDateTime, formatNumber, t, tn } from "@/i18n";
import { E, I, Seg, Stepper, SwipeRow } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Btn, STORES, StoreTile, eur, memberColor, storeKeyOf, storeName } from "@/mockup/kit";
import { haptic } from "@/components/kit";
import { useAddItem, useDeleteItem, useFrequentItems, useMoveItem, useStapleItems, useUpdateItem, type Item, type ShoppingList } from "./api";
import type { Estimator } from "./estimate";
import { productTag, refinements, resolveName, searchNames, spellFix, type Estimate, type Resolved } from "./itemCatalog";
import { isCountable, itemKey, sameProduct } from "./qty";
import type { AddOutcome } from "./useSmartAdd";

/* ------------------------------------------------------------------ množstvo (mockup logic.js) */
export const unitOf = (u: string | null | undefined) => (u === "bal" ? "bal" : u || "ks");
export const minQty = (u: string) => (u === "kg" ? 0.05 : u === "l" ? 0.25 : u === "g" ? 50 : u === "ml" ? 100 : 1);
function stepFor(q: number, u: string, dir: number) {
  if (u === "kg") return q < 0.5 || (q === 0.5 && dir < 0) ? 0.05 : q < 2 || (q === 2 && dir < 0) ? 0.1 : 0.25;
  if (u === "l") return 0.25;
  if (u === "g") return q < 500 || (q === 500 && dir < 0) ? 50 : 100;
  if (u === "ml") return q < 1000 || (q === 1000 && dir < 0) ? 100 : 250;
  return 1;
}
export function bump(q: number, u: string, dir: number) {
  return Math.max(minQty(u), Math.round((q + dir * stepFor(q, u, dir)) * 1000) / 1000);
}
const f2 = (x: number) => formatNumber(x, { maximumFractionDigits: 2 });
/** „3 ks“, „500 g“ (pri kg pod 1), „1,5 kg“, „2 bal.“ */
export function fmtQty(q: number | null, u: string | null): string {
  const n = q ?? 1;
  const uu = unitOf(u);
  // nezlomiteľná medzera: „800 g“ sa nerozdelí na dva riadky
  if (uu === "kg") return n < 1 ? `${f2(Math.round(n * 1000))}\u00a0g` : `${f2(Math.round(n * 100) / 100)}\u00a0kg`;
  if (uu === "l") return n < 1 ? `${f2(Math.round(n * 1000))}\u00a0ml` : `${f2(Math.round(n * 100) / 100)}\u00a0l`;
  if (uu === "ks" || uu === "bal") return `${f2(n)}\u00a0${unitLabel(uu)}`;
  return `${f2(n)}\u00a0${uu}`;
}
const qtyOf = (it: Pick<Item, "quantity">) => (it.quantity && it.quantity > 0 ? Number(it.quantity) : 1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ riadok ceny */
function StoreMark({ store }: { store: string }) {
  const k = storeKeyOf(store);
  return (
    <span className="mk" style={k ? ({ "--sc": STORES[k]!.c1 } as CSSProperties) : undefined}>
      {storeName(k) ?? cap(store.toLowerCase().split(" ")[0] ?? store)}
    </span>
  );
}

/** ~cena, „priemer N druhov“ alebo obchod, poznámka, kto pridal (mockup PriceLine). */
export function PriceLine({ e, kinds, listStore, note, by, bare }: { e: Estimate | null; kinds: number; listStore: string | null; note?: string | null; by?: { id: string; name: string }; /** Bez obalu – časť iného riadku („1 ks · ~1,09 €“). */ bare?: boolean }) {
  return (
    <span className={bare ? "sub-in" : "sub"}>
      {!e ? (
        <span className="noprice">{t("li.noPrice")}</span>
      ) : (
        <>
          <span>
            ~{eur(e.v)}
            {e.perKg ? <small className="pk"> · {eur(e.price.up)}/kg</small> : null}
          </span>
          {/* s akým výrobkom odhad počíta; obchod len keď cena nie je z obchodu zoznamu */}
          {kinds > 0 || e.price.product.brand ? <span className="mk ap">{productTag(e.price.product)}</span> : null}
          {e.price.store && !e.price.same && storeKeyOf(e.price.store) !== listStore ? <StoreMark store={e.price.store} /> : null}
        </>
      )}
      {note ? <span className="note">· {note}</span> : null}
      {by ? (
        <span className="avs sm">
          <i style={{ background: memberColor(by.id) }}>{by.name.trim().charAt(0).toUpperCase() || "?"}</i>
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ riadok položky */
export function ItemRow({
  it,
  label,
  em,
  e,
  kinds,
  listStore,
  note,
  by,
  sel,
  setSel,
  flash,
  onQty,
  onDelete,
  onOpen,
}: {
  it: Item;
  label: string;
  /** 3D ikona (Estimator.emoji). */
  em: string;
  e: Estimate | null;
  kinds: number;
  listStore: string | null;
  note: string | null;
  by?: { id: string; name: string };
  sel: boolean;
  setSel: (id: string | null) => void;
  flash: boolean;
  onQty: (q: number) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const u = unitOf(it.unit);
  const q = qtyOf(it);
  const atMin = q <= minQty(u);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (flash) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flash]);
  return (
    <SwipeRow atMin={atMin} onPlus={() => onQty(bump(q, u, 1))} onMinus={() => onQty(bump(q, u, -1))} onDelete={onDelete} cls={`${sel ? "sel " : ""}${flash ? "flash" : ""}`} onTap={onOpen}>
      <div className="row" ref={ref}>
        <span className="th">
          <E k={em} />
        </span>
        <div className="tx">
          <b>{label}</b>
          <PriceLine e={e} kinds={kinds} listStore={listStore} note={note} by={by} />
        </div>
        {sel ? (
          <Stepper label={fmtQty(q, u)} minDisabled={atMin} onMinus={() => onQty(bump(q, u, -1))} onPlus={() => onQty(bump(q, u, 1))} />
        ) : (
          <button
            type="button"
            className="qty"
            onClick={(ev) => {
              ev.stopPropagation();
              setSel(it.id);
            }}
            aria-label={t("li.qtyAria", { qty: fmtQty(q, u) })}
          >
            {fmtQty(q, u)}
          </button>
        )}
      </div>
    </SwipeRow>
  );
}

/* ------------------------------------------------------------------ pole na pridávanie */
export type ComposerAdd = (input: {
  name: string;
  quantity: number | null;
  unit: string | null;
  categoryId?: string | null;
  /** Bez hlášky – potvrdením je riadok v zozname. */
  quiet?: boolean;
  /** Nová položka sa v zozname ukáže hneď. */
  instant?: boolean;
}) => Promise<AddOutcome>;

/** Text na položky: „mlieko, 2 rožky a maslo“ → tri položky. */
function chunks(text: string) {
  return text
    .split(/\s*[,;]\s*|\s+a\s+|\s+and\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2)
    .map((c) => parseItemInput(c))
    .filter((p) => p.name.length >= 2);
}

/** Bublina nad klávesnicou: známa vec, napísaný text alebo viac vecí naraz. */
type Chip = {
  k: string;
  kind: "prod" | "typed" | "multi";
  name: string;
  cat: string | null;
  /** Počet z textu („banány 3“) – pridá sa prvým ťuknutím. */
  q0: number | null;
  u: string | null;
  /** Napísaný text, ktorý poznáme (má cenu a ikonu). */
  rec: boolean;
  tag?: string;
};

/** Ako dlho po poslednom ťuknutí sa bublina ešte dá ťukať (potom ✓ a odíde). */
const BURST_MS = 1500;
/** Odchod bubliny (✓ a zmiznutie) pred nahradením ďalšou. */
const OUT_MS = 420;

const prefersCalm = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Pridávanie do zoznamu (návrh prototyp/pridavanie-navrh.html, 13. 11.).
 *
 * Dole je rad bublín a pole – rovnaký prvok aj bez klávesnice. Ťuk do poľa zmení dok na okno cez viditeľnú
 * plochu nad klávesnicou (výška z visualViewport, to isté pole = klávesnica sa nezavrie): hlavička (názov,
 * počet a suma, Hotovo), v strede samotný zoznam (posúva sa, klávesnica ostáva), dole bubliny a pole.
 * Ťuk na bublinu pridá hneď (bez odpočítavania); číslo v bubline = počet v zozname, mínus uberie.
 * Po ťuknutí sa pole vyprázdni, ale bubliny ostanú na mieste, kým sa nezačne písať ďalšia vec.
 * Klávesnicu zavrie Hotovo, šípka, ťuk do zoznamu, potiahnutie doku nadol alebo jej skrytie telefónom.
 */
export function Composer({
  householdId,
  items,
  estimator,
  listStore,
  glass,
  requestMode,
  typing,
  onTyping,
  onAdd,
  onQty,
  onRemove,
  onVoice,
  title,
  summary,
  list,
}: {
  householdId: string;
  items: Item[];
  estimator: Estimator;
  listStore: string | null;
  glass?: boolean;
  requestMode?: boolean;
  typing: boolean;
  onTyping: (on: boolean) => void;
  onAdd: ComposerAdd;
  /** Mínus v bubline: nové množstvo / odobratie položky zo zoznamu. */
  onQty: (it: Item, quantity: number) => void;
  onRemove: (it: Item) => void;
  onVoice: () => void;
  /** Názov zoznamu v hlavičke okna pridávania. */
  title: string;
  /** „8 položiek · ~24 €“ pod názvom v okne. */
  summary: string;
  /** Zoznam v okne pridávania (rovnaké riadky ako na obrazovke). */
  list: ReactNode;
}) {
  const [txt, setTxt] = useState("");
  const txtRef = useRef(txt);
  txtRef.current = txt;
  const inp = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cat = estimator.catalog;

  // Ťuk mimo okna zavrie klávesnicu – iPhone to sám neurobí.
  useEffect(() => {
    if (!typing) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) inp.current?.blur();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [typing]);

  const open = useMemo(() => items.filter((i) => i.status === "OPEN"), [items]);
  const itemOf = (name: string) => open.find((i) => sameProduct(i.name, name)) ?? null;
  const openRef = useRef(open);
  openRef.current = open;

  // časté veci (istý nákup + často kupované)
  const staplesQ = useStapleItems(householdId);
  const frequentQ = useFrequentItems(householdId);
  const poolReady = !staplesQ.isPending && !frequentQ.isPending;
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; cat: string }[] = [];
    for (const x of [...(staplesQ.data ?? []), ...(frequentQ.data ?? [])]) {
      const k = itemKey(x.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: x.name, cat: x.category_id });
    }
    return out;
  }, [staplesQ.data, frequentQ.data]);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const label = (name: string) => {
    const fixed = spellFix(cat, name).text;
    const r = cat ? resolveName(cat, fixed) : null;
    return { name: fixed, categoryId: r?.category ?? null };
  };

  // Bubliny: prázdne pole = časté veci (čo ešte nie je v zozname), pri písaní návrhy k textu.
  const inList = (n: string) => openRef.current.some((i) => sameProduct(i.name, n));
  const freqChip = (p: { name: string; cat: string }): Chip => ({ k: `s:${itemKey(p.name)}`, kind: "prod", name: p.name, cat: p.cat, q0: null, u: null, rec: true });
  const computeChips = (text: string): Chip[] => {
    const t0 = text.trim();
    if (t0.length < 2) return poolRef.current.filter((p) => !inList(p.name)).slice(0, 8).map(freqChip);
    const parts = chunks(t0);
    if (parts.length > 1) {
      return [{ k: "multi", kind: "multi", name: parts.map((x) => spellFix(cat, x.name).text).join(", "), cat: null, q0: parts.length, u: null, rec: true }];
    }
    const one = parts[0];
    if (!one) return [];
    const fix = spellFix(cat, one.name).text;
    const head = cat ? resolveName(cat, fix) : null;
    const out: Chip[] = [];
    const seen = new Set<string>();
    const push = (c: Chip) => {
      const key = itemKey(c.name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    };
    const prod = (r: Resolved): Chip => ({
      k: `${r.level}:${itemKey(r.label)}`,
      kind: "prod",
      name: r.label,
      cat: r.category,
      q0: one.quantity,
      u: one.unit,
      rec: true,
      tag: r.level === "brand" ? t("li.brand") : undefined,
    });
    const typed: Chip = { k: `t:${itemKey(fix)}`, kind: "typed", name: fix, cat: head?.category ?? null, q0: one.quantity, u: one.unit, rec: !!head };
    // iný tvar toho istého slova („banan“ → Banány) = jedna bublina s bežným názvom
    if (head && sameProduct(head.label, fix)) push(prod(head));
    else if (head) {
      push(typed);
      push(prod(head));
    }
    if (cat) {
      refinements(cat, head, 6).forEach((r) => push(prod(r)));
      const found = searchNames(cat, one.name, 6).sort((a, b) => Number(inList(a.label)) - Number(inList(b.label)));
      if (!head && found.length) {
        // rozpísané slovo („smot“): najprv všeobecná položka „Smotana“ (prídavné mená „smotanová“ sa preskočia)
        const lw = normalizeName(one.name).split(" ").pop() ?? "";
        const w = found
          .flatMap((f) => f.label.split(/\s+/))
          .find((x) => normalizeName(x).startsWith(lw) && !/(ova|ovy|ove|sky|ska|ske|cna|cne|cny)$/.test(normalizeName(x)));
        if (w) {
          const g = resolveName(cat, w);
          if (g?.level === "general") push(prod(g));
        }
      }
      found.forEach((r) => push(prod(r)));
    }
    // nepoznaný text ide na koniec („+ ban“) – Enter ho pridá presne tak
    if (!head) push(typed);
    return out.slice(0, 7);
  };

  // Bubliny sa prepočítajú len pri zmene textu, otvorení/zavretí okna a načítaní častých vecí či zoznamu –
  // nie pri pridaní (bublina sa nesmie pohnúť spod prsta). Počas ťukania sa nemenia vôbec.
  const [chips, setChips] = useState<Chip[]>([]);
  const [mode, setMode] = useState<"freq" | "type">("freq");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const refill = (text: string) => {
    const m = text.trim().length >= 2 ? "type" : "freq";
    setMode(m);
    modeRef.current = m;
    setChips(computeChips(text));
    requestAnimationFrame(() => {
      if (stripRef.current) stripRef.current.scrollLeft = 0;
    });
  };

  // Ťukanie na bublinu: každý ťuk pridá kus hneď (počet v bubline). Keď sa chvíľu neťuká (pásik v bubline), bublina
  // sa označí ✓ a zmizne – časté veci nahradí ďalšia najčastejšie kupovaná vec, návrhy pri písaní sa vymenia za časté
  // veci (text je už preč, dá sa písať ďalší produkt). Počas cudzieho nákupu sa ťuky spoja do jednej žiadosti.
  type Burst = { n: number; u: string | null; t: number; st: "on" | "done" | "out" };
  const [bursts, setBursts] = useState<Record<string, Burst>>({});
  const bRef = useRef<Record<string, Burst>>({});
  const bTm = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const putBurst = (k: string, b: Burst | null) => {
    if (b) bRef.current[k] = b;
    else delete bRef.current[k];
    setBursts({ ...bRef.current });
  };
  const anyOn = () => Object.values(bRef.current).some((b) => b.st === "on");
  const sendReq = (k: string, c: Chip) => {
    const b = bRef.current[k];
    if (requestMode && b && b.n > 0) void onAdd({ name: c.name, quantity: b.n, unit: b.u, categoryId: c.cat });
  };
  /** Ukončí všetky ťukania hneď (nový text, Enter, zavretie okna) – žiadosti sa odošlú, bubliny sa neanimujú. */
  const stopBursts = () => {
    for (const k of Object.keys(bRef.current)) {
      clearTimeout(bTm.current[k]);
      const c = chipsRef.current.find((x) => x.k === k);
      if (c && bRef.current[k]?.st === "on") sendReq(k, c);
    }
    bRef.current = {};
    setBursts({});
  };
  const chipsRef = useRef(chips);
  chipsRef.current = chips;
  const finish = (k: string) => {
    const c = chipsRef.current.find((x) => x.k === k);
    const b = bRef.current[k];
    if (!c || !b) return;
    sendReq(k, c);
    if (modeRef.current === "freq") {
      // časté veci: bublina odíde a na jej miesto príde ďalšia (ostatné sa nepohnú)
      putBurst(k, { ...b, st: "out" });
      bTm.current[k] = setTimeout(() => {
        putBurst(k, null);
        setChips((cs) => {
          const shown = new Set(cs.map((x) => itemKey(x.name)));
          const next = poolRef.current.find((p) => !shown.has(itemKey(p.name)) && !inList(p.name));
          return next ? cs.map((x) => (x.k === k ? freqChip(next) : x)) : cs.filter((x) => x.k !== k);
        });
      }, OUT_MS);
      return;
    }
    // návrhy pri písaní: kým sa ťuká aj na inú bublinu, táto ostane s ✓; potom sa všetky vymenia za časté veci
    putBurst(k, { ...b, st: "done" });
    if (anyOn()) return;
    for (const x of Object.keys(bRef.current)) putBurst(x, { ...bRef.current[x]!, st: "out" });
    bTm.current[k] = setTimeout(() => {
      bRef.current = {};
      setBursts({});
      if (!txtRef.current.trim()) refill("");
    }, OUT_MS);
  };
  const arm = (k: string) => {
    clearTimeout(bTm.current[k]);
    bTm.current[k] = setTimeout(() => finish(k), BURST_MS);
  };
  useEffect(() => () => {
    Object.values(bTm.current).forEach(clearTimeout);
  }, []);

  /** Ikona preletí z bubliny do riadku v zozname. */
  const fly = (from: HTMLElement, c: Chip) => {
    if (prefersCalm()) return;
    const src = (from.querySelector(".em") as HTMLElement | null) ?? from;
    const a = src.getBoundingClientRect();
    setTimeout(() => {
      const scope = typing ? root.current?.querySelector(".aw-body") : document.querySelector(".bhm-list");
      if (!scope) return;
      const rows = [...scope.querySelectorAll<HTMLElement>(".row")];
      const row = rows.find((r) => sameProduct(r.querySelector(".tx > b")?.textContent ?? "", c.name)) ?? rows[0];
      const th = row?.querySelector<HTMLElement>(".th");
      if (!th) return;
      const b = th.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return;
      const n = document.createElement("span");
      n.className = "bb-fly";
      n.innerHTML = `<span class="em em-${estimator.emoji(c.name, c.cat)}"></span>`;
      n.style.left = `${a.left + a.width / 2 - 15}px`;
      n.style.top = `${a.top + a.height / 2 - 15}px`;
      (root.current?.parentElement ?? document.body).appendChild(n);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = n.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.5 - 34}px) scale(1.3)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(.85)`, opacity: 0.15 },
        ],
        { duration: 540, easing: "cubic-bezier(.3,.6,.3,1)" },
      );
      anim.onfinish = () => n.remove();
      anim.oncancel = () => n.remove();
    }, 70);
  };

  // Ťuk na bublinu: hneď do zoznamu. Prvý ťuk = počet z textu (alebo 1 ks), každý ďalší +1.
  const tap = (c: Chip, el: HTMLElement) => {
    if (c.kind === "multi") {
      submit();
      return;
    }
    const b = bRef.current[c.k];
    if (b && b.st !== "on") return; // už pridané, bublina odchádza
    haptic(8);
    const preset = !!c.q0 && (!b || !isCountable(c.u));
    const q = preset ? c.q0! : 1;
    const u = preset ? c.u : null;
    putBurst(c.k, { n: (b?.n ?? 0) + q, u: b?.u ?? u, t: Date.now(), st: "on" });
    arm(c.k);
    // pole sa vyprázdni hneď – dá sa písať ďalší produkt; bubliny ostávajú, kým sa ťuká
    if (txtRef.current) setTxt("");
    if (requestMode) return;
    void onAdd({ name: c.name, quantity: q, unit: u, categoryId: c.cat, quiet: true, instant: true });
    fly(el, c);
  };
  // Mínus počas ťukania: o kus menej (v zozname aj v počte bubliny).
  const less = (c: Chip) => {
    const b = bRef.current[c.k];
    if (!b || b.st !== "on") return;
    if (!requestMode) {
      // kým server nepotvrdí nový riadok, nemá ešte ID – úprava počká (najviac 3 s), počet v bubline sa zmení hneď
      const apply = (tries: number) => {
        const it = openRef.current.find((i) => sameProduct(i.name, c.name));
        if (!it) return;
        if (it.id.startsWith("tmp-")) {
          if (tries < 30) setTimeout(() => apply(tries + 1), 100);
          return;
        }
        const u = unitOf(it.unit);
        const q = qtyOf(it);
        if (q <= minQty(u)) onRemove(it);
        else onQty(it, bump(q, u, -1));
      };
      apply(0);
    }
    haptic(6);
    if (b.n <= 1) {
      clearTimeout(bTm.current[c.k]);
      putBurst(c.k, null);
      return;
    }
    putBurst(c.k, { ...b, n: b.n - 1, t: Date.now() });
    arm(c.k);
  };

  const closeWin = () => {
    inp.current?.blur();
    onTyping(false);
  };
  // otvorenie/zavretie okna: rozpísaný text preč, žiadosti sa odošlú, časté veci nanovo
  useEffect(() => {
    stopBursts();
    if (!typing) setTxt("");
    refill(typing ? txtRef.current : "");
  }, [typing]); // eslint-disable-line react-hooks/exhaustive-deps
  // časté veci a katalóg sa načítajú neskôr; zoznam tiež – kým sa neťuká, bubliny sa doplnia
  useEffect(() => {
    if (!Object.keys(bRef.current).length) refill(txtRef.current);
  }, [poolReady, !!cat, open.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Okno pridávania sa drží presne vo viditeľnej časti obrazovky nad klávesnicou (nič neposkakuje).
  const [vv, setVv] = useState<{ top: number; h: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!typing || !v) {
      setVv(null);
      return;
    }
    const up = () => setVv((o) => (o && o.top === Math.round(v.offsetTop) && o.h === Math.round(v.height) ? o : { top: Math.round(v.offsetTop), h: Math.round(v.height) }));
    up();
    v.addEventListener("resize", up);
    v.addEventListener("scroll", up);
    return () => {
      v.removeEventListener("resize", up);
      v.removeEventListener("scroll", up);
    };
  }, [typing]);
  // stránka pod oknom sa neposúva
  useEffect(() => {
    if (!typing) return;
    const r = document.documentElement;
    const prev = r.style.overflow;
    r.style.overflow = "hidden";
    return () => {
      r.style.overflow = prev;
    };
  }, [typing]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // Text priamo z poľa: klávesnica (napr. Gboard) môže mať posledné písmeno ešte len „rozpísané“
    // a stav by bol o písmeno pozadu („masl“ namiesto „maslo“).
    const now = inp.current?.value ?? txt;
    const parts = now.trim().length >= 2 ? chunks(now.trim()) : [];
    // „Hotovo“ na klávesnici pri prázdnom poli zavrie okno
    if (!parts.length) {
      if (typing && !now.trim()) closeWin();
      return;
    }
    const before = now;
    for (const x of parts) {
      const l = label(x.name);
      // neúspech: mimo žiadostí ostane v zozname riadok so „Skúsiť znova“, pri žiadosti sa text vráti do poľa
      void onAdd({ name: l.name, quantity: x.quantity, unit: x.unit, categoryId: l.categoryId, quiet: !requestMode, instant: !requestMode }).then(
        (o) => o === "FAILED" && requestMode && setTxt(before),
      );
    }
    haptic([8, 40, 14]);
    // pridané – text aj návrhy preč, späť časté veci (dá sa písať ďalší produkt)
    setTxt("");
    stopBursts();
    refill("");
  };

  // Potiahnutie doku (bubliny, pole) nadol = skryť klávesnicu.
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragDown = (e: React.PointerEvent) => {
    drag.current = typing ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  };
  const dragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    if (dy > 36 && dy > Math.abs(e.clientX - d.x) * 1.4) {
      drag.current = null;
      closeWin();
    }
  };
  const dragEnd = () => {
    drag.current = null;
  };

  // Ťuk do zoznamu v okne = skryť klávesnicu (posúvanie nie). Ďalší ťuk na riadok otvorí detail ako inde.
  const tapAt = useRef<{ x: number; y: number } | null>(null);
  const listDown = (e: React.PointerEvent) => {
    tapAt.current = { x: e.clientX, y: e.clientY };
  };
  const listClick = (e: React.MouseEvent) => {
    const s = tapAt.current;
    // po potiahnutí riadku (+1 / −1) prehliadač pošle aj „click“ – ten okno nezatvára
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) return;
    // „Skúsiť znova“ pri neúspešnom pridaní funguje aj s otvorenou klávesnicou
    if ((e.target as Element).closest("[data-keep]")) return;
    e.stopPropagation();
    e.preventDefault();
    closeWin();
  };

  // Ťuk na bublinu nesmie zobrať poľu fokus (inak iPhone zavrie klávesnicu): zabrániť pointerdown aj mousedown.
  const keep = (e: React.SyntheticEvent) => e.preventDefault();

  const chipEl = (c: Chip) => {
    if (c.kind === "multi") {
      return (
        <span className="bb rec" key={c.k}>
          <button type="button" className="bb-m" onPointerDown={keep} onMouseDown={keep} onClick={() => submit()}>
            <span className="bb-pl">
              <I n="plus" w="bold" />
            </span>
            <span className="bb-t">
              <b>{tn("li.items", c.q0 ?? 0)}</b>
              <small>{c.name}</small>
            </span>
          </button>
        </span>
      );
    }
    const b = bursts[c.k];
    const on = b?.st === "on";
    const it = requestMode ? null : itemOf(c.name);
    const q0 = c.q0 && !b ? c.q0 : null;
    const e = c.rec ? estimator.est({ name: c.name, quantity: q0, unit: q0 ? c.u : null }, listStore) : null;
    const sub: string[] = [];
    if (b) sub.push(t(requestMode ? "li.asked" : "li.addedQty", { q: fmtQty(b.n, b.u) }));
    else if (c.kind === "typed" && !c.rec) sub.push(q0 ? fmtQty(q0, c.u) : "", t("li.asTyped"));
    else {
      if (it) sub.push(t("li.inList"));
      if (q0) sub.push(`${it ? "+" : ""}${fmtQty(q0, c.u)}`);
      if (c.tag) sub.push(c.tag);
      sub.push(e ? `~${eur(e.v)}` : t("li.noPrice"));
    }
    const showIcon = c.kind !== "typed" || c.rec;
    const bu = b?.u ? unitOf(b.u) : "ks";
    return (
      <span className={`bb${on ? " act" : ""}${b && !on ? ` ok ${b.st}` : ""}${c.kind === "typed" && !c.rec ? " typed" : ""}`} key={c.k}>
        {on && (
          <button type="button" className="bb-min" onPointerDown={keep} onMouseDown={keep} onClick={() => less(c)} aria-label={t("li.lessAria", { name: c.name })}>
            <I n="minus" w="bold" />
          </button>
        )}
        <button
          type="button"
          className="bb-m"
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={(ev) => tap(c, ev.currentTarget)}
          aria-label={t("li.pickAria", { name: c.name })}
        >
          {showIcon ? (
            <E k={estimator.emoji(c.name, c.cat)} s={30} key={b ? `e${b.t}` : "e"} />
          ) : (
            <span className="bb-pl">
              <I n="plus" w="bold" />
            </span>
          )}
          <span className="bb-t">
            <b>{c.kind === "typed" && !c.rec ? `„${c.name}“` : c.name}</b>
            <small>{sub.filter(Boolean).join(" · ")}</small>
          </span>
          {b && (
            <span className="bb-n" key={on ? `n${b.n}` : "ok"} aria-live="polite">
              {on ? (bu === "ks" ? formatNumber(b.n) : fmtQty(b.n, bu)) : <I n="check" w="bold" />}
            </span>
          )}
        </button>
        {/* pásik: o chvíľu sa ťukanie skončí a bublina odíde */}
        {on && <i className="bb-bar" key={`b${b.t}`} aria-hidden="true" />}
      </span>
    );
  };

  const strip =
    chips.length > 0 ? (
      <div className="bb-row" ref={stripRef} aria-label={mode === "type" ? t("li.suggestions") : t("li.staples")}>
        {mode === "freq" && <span className="bb-lab">{t("li.staples")}</span>}
        {chips.map(chipEl)}
      </div>
    ) : typing ? (
      <div className="bb-row" ref={stripRef}>
        <span className="bb-lab wide">{t("li.typeHint")}</span>
      </div>
    ) : !poolReady ? (
      // kým sa časté veci načítavajú, rad má vyhradené miesto – pole dole potom neposkočí
      <div className="bb-row" aria-hidden="true" style={{ visibility: "hidden" }} ref={stripRef}>
        <span className="bb">&nbsp;</span>
      </div>
    ) : null;

  return (
    <div
      className={`dock${typing ? " addwin" : ""}${glass ? " g-win" : ""}`}
      ref={root}
      style={typing ? ({ top: vv ? vv.top : 0, height: vv ? vv.h : "100dvh" } as CSSProperties) : undefined}
    >
      {typing && (
        <div className="aw-head">
          {/* Späť = zavrieť okno a vrátiť sa do zoznamu (tam je Nakupovať a ‹ Nákupy) */}
          <button type="button" className="aw-back" onClick={closeWin} aria-label={t("li.backToList")}>
            <I n="caret-left" w="bold" />
          </button>
          <div className="aw-ti">
            <b>{/[\p{L}\d]/u.test(title) ? title : t("li.thisList")}</b>
            <small>{requestMode ? t("li.addAsk") : summary}</small>
          </div>
          <button type="button" className="aw-done" onClick={closeWin}>
            {t("li.done")}
          </button>
        </div>
      )}
      {typing && (
        <div className="aw-body" onPointerDownCapture={listDown} onClickCapture={listClick}>
          {list}
        </div>
      )}
      <div className="bb-dock" onPointerDown={dragDown} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
        {strip}
        <form className={`field${glass ? " glass2" : ""}`} onSubmit={submit}>
          <input
            ref={inp}
            value={txt}
            onChange={(e) => {
              // nový text = nové bubliny; rozťukané bubliny sú už pridané, len sa ukončia
              setTxt(e.target.value);
              stopBursts();
              refill(e.target.value);
            }}
            onFocus={() => onTyping(true)}
            onBlur={() =>
              setTimeout(() => {
                // klávesnicu skryl telefón (alebo ťuk mimo) – hneď späť do zoznamu, nič nečaká
                if (document.activeElement !== inp.current) onTyping(false);
              }, 150)
            }
            placeholder={requestMode ? t("ls.placeholderRequest") : t("li.placeholder")}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="done"
            maxLength={160}
            aria-label={t("li.addAria")}
          />
          {txt ? (
            <button type="submit" className="m" aria-label={t("li.add")} onPointerDown={keep} onMouseDown={keep}>
              <I n="arrow-up" w="bold" />
            </button>
          ) : (
            <button type="button" className="m" onPointerDown={typing ? keep : undefined} onMouseDown={typing ? keep : undefined} onClick={onVoice} aria-label={t("li.voice")}>
              <I n="microphone" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail položky */
const shortDate = (d: string) => formatDateTime(new Date(`${d}T00:00`), { day: "numeric", month: "numeric" });

export function ItemSheet({
  open,
  item,
  label,
  note: note0,
  householdId,
  estimator,
  listStore,
  otherLists,
  addedBy,
  onClose,
}: {
  open: boolean;
  item: Item | null;
  label: string;
  note: string | null;
  householdId: string;
  estimator: Estimator;
  listStore: string | null;
  otherLists: ShoppingList[];
  addedBy?: string;
  onClose: () => void;
}) {
  const [note, setNote] = useState(note0 ?? "");
  const [id, setId] = useState(item?.id);
  if (item && item.id !== id) {
    setId(item.id);
    setNote(note0 ?? "");
  }
  const listId = item?.list_id ?? "none";
  const update = useUpdateItem(listId);
  const remove = useDeleteItem(listId);
  const move = useMoveItem(householdId, listId);
  const restore = useRestoreItem();
  const toast = useToast();
  const fail = (err: unknown) => toast.show(errorMessage(err), "error");

  if (!item) return null;
  const it = item;
  const r = estimator.resolve(it.name);
  const u = unitOf(it.unit);
  const q = qtyOf(it);
  const e = estimator.est(it, listStore);
  const up = e?.price ?? null;
  const weighable = !r || u === "kg" || u === "l" || r.members.some((p) => p.buys.some((b) => /^(kg|g)$/i.test(b.u)));
  const refs = estimator.catalog ? refinements(estimator.catalog, r, 8) : [];
  const setQty = (quantity: number) => update.mutate({ id: it.id, patch: { quantity } }, { onError: fail });
  const save = () => {
    const n = note.trim();
    if (n !== (note0 ?? "").trim()) {
      // poznámka o recepte („na Guláš“) ostáva, mení sa len vlastná časť
      const full = it.note && note0 && it.note !== note0 ? it.note.replace(note0, n).replace(/^ · | · $/g, "") : n;
      update.mutate({ id: it.id, patch: { note: full || null } }, { onError: fail });
    }
    onClose();
  };
  const del = () => {
    remove.mutate(it.id, { onError: fail });
    toast.show(t("li.deleted", { name: label }), "info", { undo: () => void restore(it) });
    onClose();
  };
  const unitWord = e?.perKg ? "kg" : u === "l" ? "l" : unitLabel("ks");
  const store = listStore ? (storeName(listStore) ?? "") : "";

  return (
    <Sheet open={open} onClose={save} label={label}>
      <div className="sh-head">
        <span className="th lg">
          <E k={estimator.emoji(label, it.category_id)} s={44} />
        </span>
        <div className="grow">
          <h2>{label}</h2>
          <div className="meta">
            {r ? category(r.category).name : t("li.custom")}
            {addedBy ? ` · ${t("li.addedBy", { name: addedBy })}` : ""}
          </div>
        </div>
      </div>
      <div className="sh-body">
        <div className="qblock">
          <Stepper label={fmtQty(q, u)} minDisabled={q <= minQty(u)} onMinus={() => setQty(bump(q, u, -1))} onPlus={() => setQty(bump(q, u, 1))} />
          {weighable && (
            <Seg<"ks" | "x">
              value={u === "kg" || u === "g" || u === "l" || u === "ml" ? "x" : "ks"}
              onChange={(v) => {
                const cur = u === "kg" || u === "g" || u === "l" || u === "ml" ? "x" : "ks";
                if (v === cur) return;
                update.mutate({ id: it.id, patch: v === "ks" ? { unit: null, quantity: 1 } : { unit: u === "l" || u === "ml" ? "l" : "kg", quantity: 1 } }, { onError: fail });
              }}
              items={[
                ["ks", t("li.pieces")],
                ["x", u === "l" || u === "ml" ? t("li.liters") : t("li.weight")],
              ]}
            />
          )}
          <div className="qopts">
            {(u === "kg" ? [0.25, 0.5, 1, 2] : u === "l" ? [0.5, 1, 2, 3] : u === "g" ? [100, 250, 500, 1000] : [1, 2, 3, 6]).map((x) => (
              <button type="button" key={x} className={`chip plain${Math.abs(x - q) < 0.001 ? " on" : ""}`} onClick={() => setQty(x)}>
                {fmtQty(x, u)}
              </button>
            ))}
          </div>
        </div>
        <div className="pinfo">
          <div className="pi-top">
            <div>
              <div className="k">{t("li.estK")}</div>
              <div className="price">{e ? `~${eur(e.v)}` : "–"}</div>
            </div>
            {up && (
              <div className="ra">
                <div className="k">{t("li.usual")}</div>
                <div className="pv">
                  {eur(up.up)} / {unitWord}
                </div>
              </div>
            )}
          </div>
          {e?.perKg && <p className="meta">{e.kg != null ? t("li.weighNote", { kg: fmtQty(e.kg, "kg") }) : t("li.perKgNote")}</p>}
          {up && (
            <p className="meta">
              {t("li.withProduct", { product: productTag(up.product) })}{" "}
              {t(up.promo ? "li.priceFromPromo" : "li.priceFrom", { store: storeName(storeKeyOf(up.store ?? "")) ?? up.store ?? "", date: shortDate(up.date) })}
              {r && r.members.length > 1 && eur(up.min) !== eur(up.max) ? ` ${t("li.rangeProducts", { min: eur(up.min), max: eur(up.max) })}` : ""}
              {!up.same && listStore && store ? ` ${t("li.notHereYet", { store })}` : ""}
              {r && r.members.length > 1 ? ` ${t("li.refineProduct")}` : ""}
            </p>
          )}
          {!up && <p className="meta">{t("li.noPriceNote")}</p>}
          {up && up.history.length > 0 && (
            <div className="hist">
              {up.history.map((x, i) => (
                <div key={i}>
                  <span>{shortDate(x.d)}</span>
                  <StoreMark store={x.s} />
                  <b>{eur(x.p)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        {refs.length > 0 && (
          <div className="mv">
            <span className="k">
              {t("li.refine")} <small>· {t("li.optional")}</small>
            </span>
            <div className="chips wrap">
              {refs.map((x) => (
                <button
                  type="button"
                  key={`${x.level}:${x.label}`}
                  className="chip plain"
                  onClick={() => {
                    const prev = { name: it.name, category_id: it.category_id };
                    update.mutate({ id: it.id, patch: { name: x.label, category_id: x.category } }, { onError: fail });
                    toast.show(t("li.refined", { name: x.label }), "success", { undo: () => update.mutate({ id: it.id, patch: prev }, { onError: fail }) });
                  }}
                >
                  <E k={estimator.emoji(x.label, x.category)} />
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="fl">
          <span>{t("li.note")}</span>
          <input id="item-note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={t("li.notePh")} maxLength={200} />
        </label>
        {otherLists.length > 0 && (
          <div className="mv">
            <span className="k">{t("li.moveTo")}</span>
            <div className="chips wrap">
              {otherLists.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  className="chip plain"
                  onClick={() => {
                    move.mutate({ itemId: it.id, targetListId: l.id }, { onSuccess: () => toast.show(t("li.moved", { name: l.name }), "success"), onError: fail });
                    onClose();
                  }}
                >
                  <StoreTile k={storeKeyOf(l.name)} n={l.name} s={22} />
                  <span className="ell">{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="sh-act">
          <Btn cls="danger soft" onClick={del}>
            <I n="trash" />
            {t("li.delete")}
          </Btn>
          <Btn cls="pri" onClick={save}>
            {t("li.done")}
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ pomocníci */
/**
 * Kde začína klávesnica (horný okraj viditeľnej časti stránky). iPhone kreslí klávesnicu cez stránku
 * a výšku okna pritom hlási rôzne, preto sa meria priamo viditeľná oblasť – nie rozdiel výšok.
 * Na Androide sa stránka zmenší sama, vtedy je to spodok obrazovky. Mimo písania null.
 */
export function useKeyboardEdge(active: boolean) {
  const [edge, setEdge] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setEdge(null);
      return;
    }
    const update = () => setEdge(Math.round(vv.offsetTop + vv.height));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return edge;
}

/** „Vrátiť“ po odstránení: položka sa pridá znova s rovnakým množstvom, upresnením a kategóriou. */
export function useRestoreItem() {
  const add = useAddItem();
  const toast = useToast();
  return (item: Item) =>
    add
      .mutateAsync({ listId: item.list_id, name: item.name, quantity: item.quantity, unit: item.unit, note: item.note, categoryId: item.category_id })
      .catch((err) => toast.show(errorMessage(err), "error"));
}
