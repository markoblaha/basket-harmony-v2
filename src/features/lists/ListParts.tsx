/**
 * Časti obrazovky zoznamu prenesené z mockupu 1:1 (prototyp/src/lists.jsx): riadok ceny, riadok položky
 * s potiahnutím, pole na pridávanie s návrhmi a dlaždicami „Často kupujete“, detail položky.
 * Rozpoznanie položky a ceny sú v itemCatalog.ts (pravidlo: appka nič nedomýšľa).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { refinements, resolveName, searchNames, spellFix, type Estimate, type Resolved } from "./itemCatalog";
import { sameProduct } from "./qty";
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
          {e.price.avg && kinds > 1 ? (
            <span className="mk ap">{t("li.avgKinds", { n: kinds })}</span>
          ) : e.price.store && storeKeyOf(e.price.store) !== listStore ? (
            <StoreMark store={e.price.store} />
          ) : null}
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
export type ComposerAdd = (input: { name: string; quantity: number | null; unit: string | null; categoryId?: string | null }) => Promise<AddOutcome>;

/** Text na položky: „mlieko, 2 rožky a maslo“ → tri položky. */
function chunks(text: string) {
  return text
    .split(/\s*[,;]\s*|\s+a\s+|\s+and\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2)
    .map((c) => parseItemInput(c))
    .filter((p) => p.name.length >= 2);
}

/** Čo napísaný názov znamená v zozname (malé písmeno na začiatku → veľké). */
function whatOf(r: Resolved | null) {
  if (!r) return null;
  if (r.level === "general") return r.kinds > 1 ? t("li.allKinds", { n: r.kinds }) : t("li.general");
  if (r.level === "brand") return t("li.brandOf", { kind: r.members[0]?.kind || r.members[0]?.name || "" });
  return t("li.exactKind");
}

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
  onAdded,
  onVoice,
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
  onAdded?: () => void;
  onVoice: () => void;
}) {
  const [txt, setTxt] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const cat = estimator.catalog;
  // Ťuk mimo poľa (do zoznamu) zavrie klávesnicu – iPhone to sám neurobí.
  useEffect(() => {
    if (!typing) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) inp.current?.blur();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [typing]);
  const open = useMemo(() => items.filter((i) => i.status === "OPEN"), [items]);
  const inList = (name: string) => open.some((i) => sameProduct(i.name, name));

  const enter = useMemo(() => (txt.trim().length >= 2 ? chunks(txt.trim()) : []), [txt]);
  const one = enter.length === 1 ? enter[0]! : null;
  // Enter pridá to, čo je napísané – len s opraveným pravopisom (pravidlo majiteľa 11. 11.), nikdy produkt z návrhov.
  // Rozpoznanie (cena, kategória) sa ráta z opraveného textu.
  const oneFix = useMemo(() => (one ? spellFix(cat, one.name) : null), [one?.name, cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const head = oneFix && cat ? resolveName(cat, oneFix.text) : null;
  // Návrhy: 1. čo pridá Enter, 2. konkrétne druhy a značky, 3. ďalšie zhody podľa začiatku slova
  const sugg = useMemo(() => {
    if (!one || !cat) return [];
    const out: Resolved[] = [];
    const seen = new Set<string>(head ? [normalizeName(head.label)] : []);
    const push = (r: Resolved | null) => {
      if (r && !seen.has(normalizeName(r.label))) {
        seen.add(normalizeName(r.label));
        out.push(r);
      }
    };
    refinements(cat, head, 6).forEach(push);
    const found = searchNames(cat, one.name, 6).sort((a, b) => Number(inList(a.label)) - Number(inList(b.label)));
    if (!head && found.length) {
      // rozpísané slovo („smot“): najprv všeobecná položka „Smotana“
      // (prídavné mená „smotanová“ sa preskočia – hľadá sa vec, nie jej vlastnosť)
      const lw = normalizeName(one.name).split(" ").pop() ?? "";
      const w = found
        .flatMap((f) => f.label.split(/\s+/))
        .find((x) => normalizeName(x).startsWith(lw) && !/(ova|ovy|ove|sky|ska|ske|cna|cne|cny)$/.test(normalizeName(x)));
      if (w) {
        const g = resolveName(cat, w);
        if (g?.level === "general") push(g);
      }
    }
    found.forEach(push);
    return out.slice(0, head ? 4 : 5);
  }, [one?.name, cat, head]); // eslint-disable-line react-hooks/exhaustive-deps

  // dlaždice „Často kupujete“ – ťuk = +1, po 2 s sa pridá a nahradí ďalšou
  const staplesQ = useStapleItems(householdId);
  const frequentQ = useFrequentItems(householdId);
  const staples = staplesQ.data;
  const frequent = frequentQ.data;
  // Kým sa návrhy načítavajú, riadok má vyhradené miesto – pole dole potom neposkočí.
  const chipsLoading = staplesQ.isPending || frequentQ.isPending;
  const [pend, setPend] = useState<Record<string, { n: number; k: number }>>({});
  const cnt = useRef<Record<string, number>>({});
  const tm = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(tm.current).forEach(clearTimeout), []);
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; cat: string }[] = [];
    for (const x of [...(staples ?? []), ...(frequent ?? [])]) {
      const k = normalizeName(x.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: x.name, cat: x.category_id });
    }
    return out;
  }, [staples, frequent]);
  const chips = pool.filter((p) => !inList(p.name) || pend[p.name]).slice(0, 8);
  const tapStaple = (p: { name: string; cat: string }) => {
    cnt.current[p.name] = (cnt.current[p.name] ?? 0) + 1;
    setPend((x) => ({ ...x, [p.name]: { n: cnt.current[p.name]!, k: Math.random() } }));
    clearTimeout(tm.current[p.name]);
    tm.current[p.name] = setTimeout(() => {
      const n = cnt.current[p.name] ?? 1;
      delete cnt.current[p.name];
      void onAdd({ name: p.name, quantity: n, unit: null, categoryId: p.cat }).finally(() =>
        setPend((x) => {
          const y = { ...x };
          delete y[p.name];
          return y;
        }),
      );
      onAdded?.();
    }, 2000);
  };

  const label = (name: string) => {
    const fixed = spellFix(cat, name).text;
    const r = cat ? resolveName(cat, fixed) : null;
    return { name: fixed, categoryId: r?.category ?? null };
  };

  // Naklikanie kusov priamo v bubline návrhu: ťuk = +1 (prvý ťuk = napísané množstvo alebo 1 ks), − / + ,
  // po 1,8 s bez ťuknutia sa položka pridá do zoznamu. Rozklikané bubliny sa pridajú aj pri ďalšom písaní.
  type Pick = { name: string; cat: string | null; q: number; u: string | null; k: number; done?: boolean };
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const pk = useRef<Record<string, Pick>>({});
  const ptm = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setPk = (key: string, v: Pick | null) => {
    if (v) pk.current[key] = v;
    else delete pk.current[key];
    setPicks({ ...pk.current });
  };
  const commit = (key: string) => {
    const p = pk.current[key];
    clearTimeout(ptm.current[key]);
    if (!p || p.done) return;
    setPk(key, { ...p, done: true });
    haptic([8, 40, 14]);
    void onAdd({ name: p.name, quantity: p.q, unit: p.u, categoryId: p.cat });
    onAdded?.();
    // klávesnica ostane otvorená – ďalšia položka sa dá hneď písať a „✓ Pridané“ je vidno
    inp.current?.focus();
    ptm.current[key] = setTimeout(() => {
      setPk(key, null);
      // posledná rozklikaná bublina → pole sa vyprázdni na ďalšiu položku
      if (!Object.keys(pk.current).length) setTxt("");
    }, 650);
  };
  const arm = (key: string) => {
    clearTimeout(ptm.current[key]);
    ptm.current[key] = setTimeout(() => commit(key), 1800);
  };
  const tap = (key: string, name: string, catId: string | null) => {
    const p = pk.current[key];
    if (p?.done) return;
    haptic(8);
    if (!p) setPk(key, { name, cat: catId, q: one?.quantity ?? 1, u: one?.quantity ? (one.unit ?? null) : null, k: Date.now() });
    else setPk(key, { ...p, q: bump(p.q, unitOf(p.u), 1), k: Date.now() });
    arm(key);
  };
  const less = (key: string) => {
    const p = pk.current[key];
    if (!p || p.done) return;
    haptic(6);
    if (p.q <= minQty(unitOf(p.u))) {
      clearTimeout(ptm.current[key]);
      setPk(key, null);
      return;
    }
    setPk(key, { ...p, q: bump(p.q, unitOf(p.u), -1), k: Date.now() });
    arm(key);
  };
  // ďalšie písanie: rozklikané bubliny sa pridajú hneď (inak by zmizli spolu s návrhmi)
  useEffect(() => {
    for (const key of Object.keys(pk.current)) commit(key);
  }, [one?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  // odchod z obrazovky: nič naklikané sa nestratí
  useEffect(
    () => () => {
      Object.values(ptm.current).forEach(clearTimeout);
      for (const p of Object.values(pk.current)) if (!p.done) void onAdd({ name: p.name, quantity: p.q, unit: p.u, categoryId: p.cat });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!enter.length) return;
    const before = txt;
    for (const x of enter) {
      const l = label(x.name);
      void onAdd({ name: l.name, quantity: x.quantity, unit: x.unit, categoryId: l.categoryId }).then((o) => o === "FAILED" && setTxt(before));
    }
    setTxt("");
    onAdded?.();
  };

  const keep = (e: React.PointerEvent) => e.preventDefault();
  const estOf = (name: string, p?: Pick) => estimator.est({ name, quantity: p ? p.q : (one?.quantity ?? null), unit: p ? p.u : (one?.unit ?? null) }, listStore);

  /** Riadok návrhu s naklikaním kusov. */
  const pickRow = (key: string, name: string, catId: string | null, icon: React.ReactNode, title: React.ReactNode, sub: React.ReactNode, priced: boolean, ent?: boolean) => {
    const p = picks[key];
    const e = priced ? estOf(name, p) : null;
    return (
      <div key={key} className={`sgr pk${ent ? " ent" : ""}${p ? " on" : ""}${p?.done ? " done" : ""}`}>
        <button type="button" className="sgm" onPointerDown={keep} onClick={() => tap(key, name, catId)} aria-label={t("li.pickAria", { name })}>
          <span className="sgi" key={p?.k ?? 0}>
            {icon}
          </span>
          <span className="sgt">
            <b>{title}</b>
            <small>{sub}</small>
          </span>
          {e && <span className="sgp">~{eur(e.v)}</span>}
        </button>
        {p?.done ? (
          <span className="pk-ok" role="status">
            <I n="check" w="bold" />
            {t("li.picked")}
          </span>
        ) : p ? (
          <span className="pk-step">
            <button type="button" className="pk-b" onPointerDown={keep} onClick={() => less(key)} aria-label={t("li.less")}>
              <I n={p.q <= minQty(unitOf(p.u)) ? "x" : "minus"} w="bold" />
            </button>
            <b className="pk-n" key={p.k} aria-live="polite">
              {fmtQty(p.q, p.u)}
            </b>
            <button type="button" className="pk-b" onPointerDown={keep} onClick={() => tap(key, name, catId)} aria-label={t("li.more")}>
              <I n="plus" w="bold" />
            </button>
          </span>
        ) : (
          <button type="button" className="pk-add" onPointerDown={keep} onClick={() => tap(key, name, catId)} aria-label={t("li.pickAria", { name })}>
            <I n="plus" w="bold" />
          </button>
        )}
        {p && !p.done && <i className="pk-bar" key={`b${p.k}`} aria-hidden="true" />}
        {p && !p.done && unitOf(p.u) === "ks" && (
          <span className="pk-fly" key={`f${p.k}`} aria-hidden="true">
            +1
          </span>
        )}
      </div>
    );
  };
  const showSugg = typing && txt.trim().length >= 2;

  return (
    <div className="dock" ref={root}>
      {showSugg ? (
        <div className={`sgl${glass ? " glass2" : ""}`} role="listbox" aria-label={t("li.suggestions")}>
          {enter.length > 1 && (
            <button type="button" className="sgr ent" onPointerDown={keep} onClick={() => submit()}>
              <span className="sgi nwi">
                <I n="plus" w="bold" />
              </span>
              <span className="sgt">
                <b>{tn("li.items", enter.length)}</b>
                <small>{enter.map((x) => label(x.name).name).join(", ")}</small>
              </span>
              <kbd aria-label="Enter">↵</kbd>
            </button>
          )}
          {one &&
            oneFix &&
            pickRow(
              "ent",
              oneFix.text,
              head?.category ?? null,
              head ? <E k={estimator.emoji(oneFix.text, head.category)} s={30} /> : <I n="plus" w="bold" />,
              oneFix.text,
              <>
                {fmtQty(picks.ent?.q ?? one.quantity, picks.ent ? picks.ent.u : one.unit)} ·{" "}
                {oneFix.typo ? t("li.typoFixed", { w: one.name }) : (whatOf(head) ?? t("li.newItem"))}
              </>,
              !!head,
              true,
            )}
          {sugg.map((r) =>
            pickRow(
              `${r.level}:${r.label}`,
              r.label,
              r.category,
              <E k={estimator.emoji(r.label, r.category)} s={30} />,
              r.label,
              r.level === "general" ? whatOf(r) : r.level === "brand" ? t("li.brand") : t("li.kind"),
              true,
            ),
          )}
        </div>
      ) : chipsLoading ? (
        <div className="chips staples" aria-hidden="true" style={{ visibility: "hidden" }}>
          <span className="chip">&nbsp;</span>
        </div>
      ) : (
        chips.length > 0 && (
          <div className="chips staples" aria-label={t("li.staples")}>
            {chips.map((p) => {
              const pd = pend[p.name];
              return (
                <button type="button" key={p.name} className={`chip${pd ? " pend" : ""}${glass ? " glass2" : ""}`} onPointerDown={typing ? keep : undefined} onClick={() => tapStaple(p)}>
                  <E k={estimator.emoji(p.name, p.cat)} />
                  {p.name}
                  {pd ? (
                    <span className="cnt" key={pd.k}>
                      +{pd.n}
                    </span>
                  ) : (
                    <span className="pl">
                      <I n="plus" w="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}
      <form className={`field${glass ? " glass2" : ""}`} onSubmit={submit}>
        <input
          ref={inp}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() =>
            setTimeout(() => {
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
          <button type="submit" className="m" aria-label={t("li.add")} onPointerDown={keep}>
            <I n="arrow-up" w="bold" />
          </button>
        ) : (
          <button type="button" className="m" onClick={onVoice} aria-label={t("li.voice")}>
            <I n="microphone" />
          </button>
        )}
      </form>
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
          {up && up.avg && r && (
            <p className="meta">
              {r.kinds > 1 ? t("li.avgNoteKinds", { k: up.k, n: r.kinds }) : t("li.avgNote", { k: up.k })}
              {up.same && store ? t("li.inStore", { store }) : ""}. {eur(up.min) !== eur(up.max) ? t("li.rangeNote", { min: eur(up.min), max: eur(up.max) }) : ""} {t("li.refineNote")}
            </p>
          )}
          {up && !up.avg && (
            <p className="meta">
              {r?.level === "brand" && r.brand ? `${t("li.brandOnly", { brand: r.brand })} ` : ""}
              {up.k === 1 ? t("li.lastBuy") : t("li.median", { k: up.k })}
              {up.same && store ? t("li.inStore", { store }) : listStore ? t("li.allStores") : ""}. {eur(up.min) !== eur(up.max) ? t("li.rangeNote", { min: eur(up.min), max: eur(up.max) }) : ""}
              {!up.same && listStore && up.store ? ` ${t("li.notHere", { store, other: storeName(storeKeyOf(up.store)) ?? up.store })}` : ""}
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
