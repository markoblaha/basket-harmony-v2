import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Minus, Plus, Star } from "lucide-react";
import { Button, Sheet, TextField, cx } from "@/components/ui";
import { CatIcon, Seg, haptic, useLongPress } from "@/components/kit";
import { useToast } from "@/components/toast";
import { guessCategory, normalizeName } from "@/lib/categories";
import { unitLabel } from "@/lib/parseItem";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useFavoriteTiles, useFrequentItems, useRemoveFavorite, useSaveFavorite, type FavoriteTile, type Item } from "./api";
import { countOf, qtyLabel } from "./qty";
import type { FeedEntry } from "./useSmartAdd";

const SLOTS = 12;
const MAX_FAVORITES = 12;
/** Po poslednom ťuknutí počkáme chvíľu – ďalšie ťuknutia pripočítavajú kusy. */
const COMMIT_MS = 2000;

/** Pre novú domácnosť bez histórie, kým sa naučíme, čo kupujete (v jazyku rozhrania). */
const starters = () => t("tiles.starters").split("|");

type Pending = Record<string, { n: number; flip: boolean }>;

/**
 * Rýchle pridanie dlaždicami.
 *  - „Najčastejšie“: 12 dlaždíc podľa histórie domácnosti. Každé ťuknutie = +1 ks;
 *    keď prestaneš ťukať, položka sa pridá a na TO ISTÉ miesto príde ďalší produkt
 *    (ostatné dlaždice sa nepohnú, prst nič netrafí omylom). Hviezdička uloží do obľúbených.
 *  - „Obľúbené“: vlastné dlaždice, ostávajú stále. Podržaním sa upravia (vlastný text).
 */
export function QuickTiles({
  householdId,
  items,
  onAdd,
  onFeed,
}: {
  householdId: string;
  items: Item[];
  onAdd: (name: string, count: number) => void;
  onFeed: (entry: Omit<FeedEntry, "id" | "out">) => void;
}) {
  const [tab, setTab] = useState<"freq" | "fav">(() => {
    try {
      return localStorage.getItem("bh.tilesTab") === "fav" ? "fav" : "freq";
    } catch {
      return "freq";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("bh.tilesTab", tab);
    } catch {
      /* súkromné okno – nevadí */
    }
  }, [tab]);

  const frequent = useFrequentItems(householdId);
  const favorites = useFavoriteTiles(householdId);
  const save = useSaveFavorite(householdId);
  const remove = useRemoveFavorite(householdId);
  const toast = useToast();

  const [pending, setPending] = useState<Pending>({});
  const timers = useRef(new Map<string, number>());
  const committed = useRef(new Set<string>());
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const openByKey = useMemo(() => {
    const m = new Map<string, Item>();
    for (const i of items) if (i.status === "OPEN") m.set(normalizeName(i.name), i);
    return m;
  }, [items]);
  // Keď sa položka v zozname objaví, „čerstvo pridaná“ značka už netreba.
  useEffect(() => {
    for (const key of [...committed.current]) if (openByKey.has(key)) committed.current.delete(key);
  }, [openByKey]);

  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...(frequent.data ?? []).map((f) => f.name), ...starters()]) {
      const key = normalizeName(name);
      if (seen.has(key) || openByKey.has(key) || committed.current.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
    // „committed“ je ref – mení sa spolu s pending, preto je pending v závislostiach.
  }, [frequent.data, openByKey, pending]);

  // Stabilné sloty: dlaždica ostane na svojom mieste, kým jej produkt nie je v zozname.
  const [slots, setSlots] = useState<string[]>([]);
  const [slotKeys, setSlotKeys] = useState<number[]>([]);
  const slotsRef = useRef<string[]>([]);
  useEffect(() => {
    // Kým sa nenačíta história, nič nevypĺňaj – inak by sloty obsadili len štartovacie produkty.
    if (frequent.isPending) return;
    const prev = slotsRef.current;
    const ok = new Set(candidates.map(normalizeName));
    const kept = prev.map((n) => (ok.has(normalizeName(n)) || pending[n] ? n : null));
    const used = new Set(kept.filter((n): n is string => !!n).map(normalizeName));
    const pool = candidates.filter((c) => !used.has(normalizeName(c)));
    const next: string[] = [];
    const changed = new Set<number>();
    for (let i = 0; i < SLOTS; i++) {
      const k = kept[i];
      if (k) next.push(k);
      else {
        const fill = pool.shift();
        if (!fill) continue;
        next.push(fill);
        if (prev.length) changed.add(i);
      }
    }
    const same = next.length === prev.length && next.every((n, i) => n === prev[i]);
    if (same) return;
    slotsRef.current = next;
    setSlots(next);
    setSlotKeys((keys) => next.map((_, i) => (keys[i] ?? 0) + (changed.has(i) ? 1 : 0)));
  }, [candidates, pending, frequent.isPending]);

  const pendingRef = useRef<Pending>({});
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  function tap(name: string) {
    setPending((p) => ({ ...p, [name]: { n: (p[name]?.n ?? 0) + 1, flip: !p[name]?.flip } }));
    const old = timers.current.get(name);
    if (old) window.clearTimeout(old);
    timers.current.set(
      name,
      window.setTimeout(() => {
        timers.current.delete(name);
        const entry = pendingRef.current[name];
        setPending((p) => {
          const { [name]: _gone, ...rest } = p;
          return rest;
        });
        if (entry) {
          committed.current.add(normalizeName(name));
          onAdd(name, entry.n);
        }
      }, COMMIT_MS),
    );
  }

  const favs = favorites.data ?? [];
  const favByKey = new Map(favs.map((f) => [normalizeName(f.item_name), f]));

  async function toggleStar(name: string) {
    const existing = favByKey.get(normalizeName(name));
    try {
      if (existing) {
        await remove.mutateAsync(existing.id);
        onFeed({ name, tail: t("tiles.feed.unstarred") });
      } else {
        if (favs.length >= MAX_FAVORITES) {
          toast.show(t("tiles.maxFavorites", { max: MAX_FAVORITES }), "error");
          return;
        }
        await save.mutateAsync({ label: name, itemName: name, position: nextPosition(favs) });
        onFeed({ name, tail: t("tiles.feed.starred") });
      }
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const [editor, setEditor] = useState<{ tile: FavoriteTile | null } | null>(null);

  function dec(name: string) {
    const cur = pendingRef.current[name];
    if (!cur) return;
    const old = timers.current.get(name);
    if (old) window.clearTimeout(old);
    timers.current.delete(name);
    if (cur.n <= 1) {
      setPending((p) => {
        const { [name]: _gone, ...rest } = p;
        return rest;
      });
      return;
    }
    // Menej o jeden a odpočet znova od začiatku.
    setPending((p) => ({ ...p, [name]: { n: cur.n - 1, flip: !cur.flip } }));
    timers.current.set(
      name,
      window.setTimeout(() => {
        timers.current.delete(name);
        const entry = pendingRef.current[name];
        setPending((p) => {
          const { [name]: _gone, ...rest } = p;
          return rest;
        });
        if (entry) {
          committed.current.add(normalizeName(name));
          onAdd(name, entry.n);
        }
      }, COMMIT_MS),
    );
  }

  const tile = (key: string, label: string, itemName: string, fav: boolean, extra?: { onLong?: () => void; className?: string }) => {
    const p = pending[itemName];
    const onList = openByKey.get(normalizeName(itemName));
    return (
      <Tile
        key={key}
        label={label}
        category={guessCategory(itemName)}
        pending={p}
        sub={p ? unitLabel("ks") : onList ? t("tiles.onList", { qty: qtyLabel(countOf(onList.quantity), onList.unit) }) : ""}
        fav={fav}
        className={extra?.className}
        onTap={() => tap(itemName)}
        onMinus={() => dec(itemName)}
        onStar={() => void toggleStar(itemName)}
        onLong={extra?.onLong}
        aria={p ? t("tiles.addAriaPending", { name: label, qty: qtyLabel(p.n, null) }) : t("tiles.addAria", { name: label })}
        starAria={fav ? t("tiles.unstar", { name: label }) : t("tiles.star", { name: label })}
      />
    );
  };

  return (
    <section className="stack g-10">
      <div className="row between g-8">
        <span className="section-title" style={{ whiteSpace: "nowrap" }}>{t("shop.quickAdd")}</span>
        <Seg
          value={tab}
          onChange={setTab}
          style={{ width: 220 }}
          options={[
            { value: "freq", label: t("tiles.frequent") },
            { value: "fav", label: t("tiles.favorites", { n: favs.length }) },
          ]}
        />
      </div>
      <div className="tiles">
        {tab === "freq"
          ? slots.map((name, i) =>
              tile(`${i}-${slotKeys[i] ?? 0}`, name, name, favByKey.has(normalizeName(name)), {
                className: (slotKeys[i] ?? 0) > 0 ? "anim-pop" : undefined,
              }),
            )
          : [
              ...favs.map((f) => tile(f.id, f.label, f.item_name, true, { onLong: () => setEditor({ tile: f }) })),
              favs.length < MAX_FAVORITES && (
                <button key="new" type="button" className="ls-tile" onClick={() => setEditor({ tile: null })} style={{ color: "var(--accent-text)" }}>
                  <Plus size={20} strokeWidth={2.4} aria-hidden />
                  <span className="nm">{t("tiles.new")}</span>
                </button>
              ),
            ]}
      </div>
      <span className="t-xs t-3" style={{ padding: "0 4px" }}>
        {tab === "freq" ? t("tiles.hintFrequent") : favs.length ? t("tiles.hintFavorites") : t("tiles.hintNoFavorites")}
      </span>

      {editor && (
        <TileEditor
          tile={editor.tile}
          onClose={() => setEditor(null)}
          onSave={async (label, itemName) => {
            try {
              await save.mutateAsync({ id: editor.tile?.id, label, itemName, position: nextPosition(favs) });
              onFeed({ name: label, tail: t("tiles.feed.saved") });
              setEditor(null);
            } catch (err) {
              toast.show(errorMessage(err), "error");
            }
          }}
          onRemove={
            editor.tile
              ? async () => {
                  const tile = editor.tile!;
                  setEditor(null);
                  try {
                    await remove.mutateAsync(tile.id);
                    onFeed({ name: tile.label, tail: t("tiles.feed.unstarred") });
                  } catch (err) {
                    toast.show(errorMessage(err), "error");
                  }
                }
              : undefined
          }
          saving={save.isPending}
        />
      )}
    </section>
  );
}

function nextPosition(favs: FavoriteTile[]) {
  return favs.reduce((m, f) => Math.max(m, f.position), 0) + 1;
}

/** Dlaždica rýchleho pridania (prototyp): ikona kategórie, názov, ťuk = +1, po 2 s sa pridá (odpočet okolo okraja). */
function Tile({
  label,
  category,
  pending,
  sub,
  fav,
  className,
  onTap,
  onMinus,
  onStar,
  onLong,
  aria,
  starAria,
}: {
  label: string;
  category: string;
  pending?: { n: number; flip: boolean };
  sub: string;
  fav: boolean;
  className?: string;
  onTap: () => void;
  onMinus: () => void;
  onStar: () => void;
  onLong?: () => void;
  aria: string;
  starAria: string;
}) {
  const lp = useLongPress({
    onTap: () => {
      haptic(8);
      onTap();
    },
    onLong,
  });
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onPointerUp: (e: React.PointerEvent) => e.stopPropagation() };
  return (
    <div className={cx("ls-tile", className)} role="button" tabIndex={0} aria-label={aria} {...lp}>
      {pending && (
        <svg key={String(pending.flip)} className="lsring" viewBox="0 0 100 104" preserveAspectRatio="none" aria-hidden>
          <rect x="1.2" y="1.2" width="97.6" height="101.6" rx="16" ry="16" pathLength="100" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {pending ? (
        <span className="big" key={pending.n}>
          +{pending.n}
        </span>
      ) : (
        <CatIcon id={category} size="sm" />
      )}
      <span className="nm">{label}</span>
      <span className="t-xs t-3" style={{ fontSize: 10.5, lineHeight: "12px", minHeight: 12 }}>
        {sub}
      </span>
      {pending && (
        <button type="button" className="minus" aria-label={t("tiles.oneLess")} {...stop} onClick={(e) => (e.stopPropagation(), onMinus())}>
          <Minus size={15} />
        </button>
      )}
      <button type="button" className={cx("star", fav && "on")} aria-label={starAria} aria-pressed={fav} {...stop} onClick={(e) => (e.stopPropagation(), onStar())}>
        <Star size={13} fill={fav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function TileEditor({
  tile,
  onClose,
  onSave,
  onRemove,
  saving,
}: {
  tile: FavoriteTile | null;
  onClose: () => void;
  onSave: (label: string, itemName: string) => void;
  onRemove?: () => void;
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
        <div className="flex items-center gap-3">
          <div className="flex h-[3.75rem] w-24 shrink-0 items-end overflow-hidden rounded-lg bg-surface px-2 pb-2 text-footnote font-strong leading-[1.15] shadow-[inset_0_0_0_1.5px_var(--primary)]">
            <span className="line-clamp-2">{finalLabel || t("tiles.previewDefault")}</span>
          </div>
          <p className="text-sm text-text-2">{t("tiles.previewHelp")}</p>
        </div>
        <TextField label={t("tiles.labelField")} placeholder={t("tiles.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus={!tile} />
        <TextField label={t("tiles.itemField")} placeholder={t("tiles.itemPlaceholder")} value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={120} />
        <div className="flex gap-2">
          {onRemove && (
            <Button type="button" variant="danger" size="lg" onClick={onRemove}>
              {t("tiles.remove")}
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={saving} disabled={!finalName}>
            {t("tiles.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
