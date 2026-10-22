import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Check, Pencil, Plus, Star } from "lucide-react";
import { Button, Sheet, TextField, cx } from "@/components/ui";
import { BottomSheet, SheetHeader, Switch } from "@/components/kit";
import { CategoryGlyph } from "@/components/CategoryIcon";
import { useToast } from "@/components/toast";
import { category, guessCategory } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { useSetting } from "@/lib/settings";
import { t } from "@/i18n";
import { useFavoriteTiles, useFrequentItems, useRemoveFavorite, useSaveFavorite, useStapleItems, type FavoriteTile, type Item } from "./api";
import { candidates, keyOf, nextSlots, sameSlots } from "./quickSlots";
import { popOut, useTapCounter } from "./useTapCounter";
import type { AddOutcome } from "./useSmartAdd";

const TILES = 5;
const BUBBLES = 9;
export const MAX_FAVORITES = 11;

/** Pre novú domácnosť bez histórie, kým sa naučíme, čo kupujete (v jazyku rozhrania). */
export const starters = () => t("tiles.starters").split("|");

/**
 * Stabilné sloty nad zoznamom kandidátov: produkt ostáva na svojom mieste, kým ho nepridáš;
 * potom jeho miesto dostane ďalší. `ready` = história je načítaná (inak by sloty obsadili len štartovacie).
 */
export function useSlots(pool: string[], size: number, hold: ReadonlySet<string>, ready: boolean) {
  const [slots, setSlots] = useState<string[]>([]);
  const ref = useRef(slots);
  useEffect(() => {
    if (!ready) return;
    const next = nextSlots(ref.current, pool, size, hold);
    if (sameSlots(next, ref.current)) return;
    ref.current = next;
    setSlots(next);
  }, [pool, size, hold, ready]);
  return slots;
}

/**
 * Kandidáti rýchleho pridania pre jednu obrazovku zoznamu: čo už je v zozname (alebo sa práve pridáva),
 * sa neponúka. `committed` drží práve pridané, kým sa neobjavia v zozname.
 */
export function useQuickPool(householdId: string, items: Item[]) {
  const frequent = useFrequentItems(householdId);
  const staples = useStapleItems(householdId);
  const committed = useRef(new Set<string>());
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const onList = useMemo(() => new Set(items.filter((i) => i.status === "OPEN").map((i) => keyOf(i.name))), [items]);
  useEffect(() => {
    let changed = false;
    for (const k of [...committed.current])
      if (onList.has(k)) {
        committed.current.delete(k);
        changed = true;
      }
    if (changed) bump();
  }, [onList]);
  const exclude = useMemo(() => new Set([...onList, ...committed.current]), [onList, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const freq = useMemo(() => (frequent.data ?? []).map((f) => f.name), [frequent.data]);
  const staple = useMemo(() => (staples.data ?? []).map((f) => f.name), [staples.data]);
  const catOf = useMemo(() => {
    const m = new Map<string, string>();
    // „Iné“ a všeobecné „Potraviny“ nič nepovedia – vtedy radšej odhad podľa názvu.
    for (const f of [...(frequent.data ?? []), ...(staples.data ?? [])])
      if (f.category_id && f.category_id !== "other" && f.category_id !== "groceries") m.set(keyOf(f.name), f.category_id);
    return (name: string) => m.get(keyOf(name)) ?? guessCategory(name);
  }, [frequent.data, staples.data]);
  return {
    freq,
    staple,
    exclude,
    catOf,
    ready: !frequent.isPending && !staples.isPending,
    mark: (name: string, on: boolean) => {
      if (on) committed.current.add(keyOf(name));
      else committed.current.delete(keyOf(name));
      bump();
    },
  };
}

/**
 * Rýchle pridanie v doku pri palci (finálny návrh C):
 *  - „Pre teba“: 5 štvorcových dlaždíc = istý nákup (produkty, ktoré kupuješ pravidelne a sú na rade),
 *    pod nimi po „Všetky“ mriežka 3 × 3 rovnako veľkých bublín s ďalšími najčastejšími.
 *    Každé ťuknutie +1; po 2 s sa produkt pridá, odíde a na jeho miesto príde ďalší.
 *  - „Obľúbené“: tvoje vlastné karty, ostávajú na mieste (po pridaní len zasvietia).
 *  - Šípka vpravo zbalí celé rýchle pridanie; voľba „Otvárať s obľúbenými“ je v úprave obľúbených.
 */
export function QuickDock({
  householdId,
  items,
  onAdd,
}: {
  householdId: string;
  items: Item[];
  onAdd: (name: string, count: number) => Promise<AddOutcome>;
}) {
  const [open, setOpen] = useSetting("quickOpen");
  const [tab, setTab] = useSetting("quickTab");
  const [favFirst, setFavFirst] = useSetting("quickFavFirst");
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ok, setOk] = useState<Record<string, number>>({});
  const box = useRef<HTMLDivElement>(null);

  // Pri zapnutej voľbe sa rýchle pridanie po otvorení ukáže s obľúbenými.
  useEffect(() => {
    if (favFirst) setTab("fav");
    // len pri otvorení obrazovky
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pool = useQuickPool(householdId, items);
  const favorites = useFavoriteTiles(householdId);
  const favs = favorites.data ?? [];

  const commit = (key: string, n: number) => {
    if (key.startsWith("f:")) {
      const fav = favs.find((f) => f.id === key.slice(2));
      if (!fav) return;
      void onAdd(fav.item_name, n);
      setOk((o) => ({ ...o, [fav.id]: Date.now() }));
      window.setTimeout(() => setOk(({ [fav.id]: _gone, ...rest }) => rest), 1400);
      return;
    }
    const name = key.slice(2);
    popOut(box.current?.querySelector(`[data-q="${CSS.escape(key)}"]`) ?? null, () => {
      pool.mark(name, true);
      void onAdd(name, n).then((o) => o === "FAILED" && pool.mark(name, false));
    });
  };
  const { counts, tap } = useTapCounter(commit);

  const hold = useMemo(() => new Set(Object.keys(counts).map((k) => keyOf(k.slice(2)))), [counts]);
  const tilePool = useMemo(() => candidates([pool.staple, pool.freq, starters()], pool.exclude), [pool.staple, pool.freq, pool.exclude]);
  const tiles = useSlots(tilePool, TILES, hold, pool.ready);
  const bubblePool = useMemo(() => candidates([pool.freq, starters()], new Set([...pool.exclude, ...tiles.map(keyOf)])), [pool.freq, pool.exclude, tiles]);
  const bubbles = useSlots(bubblePool, BUBBLES, hold, pool.ready);

  const fold = () => {
    const next = !open;
    setOpen(next);
    setAll(false);
    if (next && favFirst) setTab("fav");
  };
  const favShown = favs.slice(0, all ? MAX_FAVORITES : 5);

  return (
    <div ref={box} className="qd">
      <div className="qd-head">
        <div className="qd-seg" role="tablist" aria-label={t("shop.quickAdd")}>
          <button type="button" role="tab" aria-selected={tab === "auto"} className={cx(tab === "auto" && "on")} onClick={() => (setTab("auto"), setOpen(true))}>
            {t("qd.forYou")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "fav"} className={cx(tab === "fav" && "on")} onClick={() => (setTab("fav"), setOpen(true))}>
            <Star size={14} fill={tab === "fav" ? "currentColor" : "none"} className={cx(tab === "fav" && "qd-star")} />
            {t("qd.favorites")}
          </button>
        </div>
        <span className="grow" />
        {open && (tab === "auto" || favs.length > 5) && (
          <button type="button" className="qd-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? t("qd.less") : t("qd.all")}
            <ChevronUp size={15} strokeWidth={2.6} style={{ transition: "transform .25s", transform: all ? "rotate(180deg)" : "none" }} />
          </button>
        )}
        <button type="button" className="ibtn sm" aria-expanded={open} aria-label={open ? t("qd.hide") : t("qd.show")} onClick={fold}>
          <ChevronDown size={18} strokeWidth={2.4} style={{ transition: "transform .25s", transform: open ? "none" : "rotate(180deg)" }} />
        </button>
      </div>

      {open && tab === "auto" && (
        <div className="qd-body">
          <div className="qd-tiles">
            {tiles.map((name) => {
              const key = `t:${name}`;
              const n = counts[key] ?? 0;
              const cat = pool.catOf(name);
              return (
                <button
                  key={key}
                  data-q={key}
                  type="button"
                  className={cx("qd-tile", n > 0 && "on")}
                  onClick={() => tap(key)}
                  aria-label={n ? t("tiles.addAriaPending", { name, qty: `${n}×` }) : t("tiles.addAria", { name })}
                >
                  <span className="qd-sq" style={{ "--h": category(cat).hue } as CSSProperties}>
                    {n ? (
                      <span key={n} className="qd-n">
                        {n}×
                      </span>
                    ) : (
                      <CategoryGlyph id={cat} className="size-[24px]" />
                    )}
                    {n > 0 && <span key={`b${n}`} className="qd-bar" />}
                  </span>
                  <span className="qd-nm">{name}</span>
                </button>
              );
            })}
          </div>
          {all && (
            <div className="qd-grid qd-drop">
              {bubbles.map((name) => {
                const key = `p:${name}`;
                return <Bubble key={key} id={key} name={name} n={counts[key] ?? 0} onTap={() => tap(key)} />;
              })}
            </div>
          )}
        </div>
      )}

      {open && tab === "fav" && (
        <div className="qd-body">
          {favs.length === 0 && <span className="t-xs t-2 qd-empty">{t("qd.favEmpty")}</span>}
          <div className="qd-grid fav">
            {favShown.map((f) => {
              const key = `f:${f.id}`;
              return <Bubble key={key} id={key} name={f.label} n={counts[key] ?? 0} ok={!!ok[f.id]} onTap={() => tap(key)} big />;
            })}
            <button type="button" className="qd-chip big qd-edit" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              {t("qd.edit")}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <FavoritesSheet
          householdId={householdId}
          favs={favs}
          names={[...pool.staple, ...pool.freq, ...starters()]}
          favFirst={favFirst}
          onFavFirst={(v) => {
            setFavFirst(v);
            if (v) setTab("fav");
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/** Bublina: rovnaká šírka aj výška pre krátke aj dlhé názvy (dlhý sa zalomí do 2 riadkov). */
export function Bubble({ id, name, n, ok, big, onTap }: { id: string; name: string; n: number; ok?: boolean; big?: boolean; onTap: () => void }) {
  return (
    <button
      data-q={id}
      type="button"
      className={cx("qd-chip", big && "big", n > 0 && "on", ok && !n && "ok")}
      onClick={onTap}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={n ? t("tiles.addAriaPending", { name, qty: `${n}×` }) : t("tiles.addAria", { name })}
    >
      {n > 0 && (
        <b key={n} className="qd-n">
          {n}×
        </b>
      )}
      {ok && !n && <Check size={15} strokeWidth={3} className="qd-n" />}
      <span className="qd-cl">{name}</span>
      {n > 0 && <span key={`b${n}`} className="qd-bar" />}
    </button>
  );
}

/** Úprava obľúbených: ťuknutím vyberáš produkty, vlastná karta s textom a voľba „Otvárať s obľúbenými“. */
function FavoritesSheet({
  householdId,
  favs,
  names,
  favFirst,
  onFavFirst,
  onClose,
}: {
  householdId: string;
  favs: FavoriteTile[];
  names: string[];
  favFirst: boolean;
  onFavFirst: (v: boolean) => void;
  onClose: () => void;
}) {
  const save = useSaveFavorite(householdId);
  const remove = useRemoveFavorite(householdId);
  const toast = useToast();
  const [custom, setCustom] = useState<FavoriteTile | null | "new">(null);
  const byKey = new Map(favs.map((f) => [keyOf(f.item_name), f]));
  const offer = candidates([favs.map((f) => f.item_name), names], new Set()).slice(0, 36);
  const nextPos = favs.reduce((m, f) => Math.max(m, f.position), 0) + 1;

  async function toggle(name: string) {
    const f = byKey.get(keyOf(name));
    try {
      if (f) await remove.mutateAsync(f.id);
      else if (favs.length >= MAX_FAVORITES) toast.show(t("tiles.maxFavorites", { max: MAX_FAVORITES }), "error");
      else await save.mutateAsync({ label: name, itemName: name, position: nextPos });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <BottomSheet open onClose={onClose} label={t("qd.favTitle")}>
      <SheetHeader title={t("qd.favTitle")} sub={t("qd.favSub", { n: favs.length, max: MAX_FAVORITES })} onClose={onClose} />
      <div className="sheet-body stack g-12">
        <div className="qd-grid">
          {offer.map((name) => {
            const f = byKey.get(keyOf(name));
            return (
              <button key={name} type="button" className={cx("qd-chip", f && "picked")} aria-pressed={!!f} onClick={() => void toggle(name)}>
                {f && <Star size={13} fill="currentColor" style={{ flex: "none" }} />}
                <span className="qd-cl">{f?.label ?? name}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-soft btn-block" onClick={() => setCustom("new")}>
          <Plus size={17} />
          {t("qd.custom")}
        </button>
        <div className="cells">
          <div className="cell">
            <span className="grow stack g-2">
              <span className="t-body fw-5">{t("qd.favFirst")}</span>
              <span className="t-sm t-2">{t("qd.favFirstSub")}</span>
            </span>
            <Switch on={favFirst} onChange={onFavFirst} label={t("qd.favFirst")} />
          </div>
        </div>
      </div>
      {custom && (
        <TileEditor
          tile={custom === "new" ? null : custom}
          saving={save.isPending}
          onClose={() => setCustom(null)}
          onSave={async (label, itemName) => {
            if (custom === "new" && favs.length >= MAX_FAVORITES) return toast.show(t("tiles.maxFavorites", { max: MAX_FAVORITES }), "error");
            try {
              await save.mutateAsync({ id: custom === "new" ? undefined : custom.id, label, itemName, position: nextPos });
              setCustom(null);
            } catch (err) {
              toast.show(errorMessage(err), "error");
            }
          }}
        />
      )}
    </BottomSheet>
  );
}

function TileEditor({
  tile,
  onClose,
  onSave,
  saving,
}: {
  tile: FavoriteTile | null;
  onClose: () => void;
  onSave: (label: string, itemName: string) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(tile?.label ?? "");
  const [itemName, setItemName] = useState(tile?.item_name ?? "");
  const finalName = itemName.trim() || label.trim();
  const finalLabel = label.trim() || itemName.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!finalName) return;
    onSave(finalLabel.slice(0, 40), finalName.slice(0, 120));
  }

  return (
    <Sheet open onClose={onClose} title={tile ? t("tiles.editTitle") : t("tiles.newTitle")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t("tiles.labelField")} placeholder={t("tiles.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus={!tile} />
        <TextField label={t("tiles.itemField")} placeholder={t("tiles.itemPlaceholder")} value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={120} />
        <Button type="submit" size="lg" loading={saving} disabled={!finalName}>
          {t("tiles.save")}
        </Button>
      </form>
    </Sheet>
  );
}
