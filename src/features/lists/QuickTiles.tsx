import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Star } from "lucide-react";
import { Button, Sheet, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { useFavoriteTiles, useFrequentItems, useRemoveFavorite, useSaveFavorite, type FavoriteTile, type Item } from "./api";
import { countOf, qtyLabel } from "./qty";
import type { FeedEntry } from "./feed";

const SLOTS = 12;
const MAX_FAVORITES = 12;
/** Po poslednom ťuknutí počkáme chvíľu – ďalšie ťuknutia pripočítavajú kusy. */
const COMMIT_MS = 1400;
const LONG_PRESS_MS = 480;

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
        if (!fill) break;
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

  return (
    <div>
      <div role="tablist" aria-label={t("shop.quickAdd")} className="grid grid-cols-2 rounded-[var(--radius-control)] bg-surface p-[3px]">
        {(
          [
            ["freq", t("tiles.frequent")],
            ["fav", t("tiles.favorites", { n: favs.length })],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              "h-9 rounded-[0.625rem] text-sm font-semibold transition-colors",
              tab === id ? "bg-elevated text-text shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-text-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {tab === "freq"
          ? slots.map((name, i) => {
              const p = pending[name];
              const fav = favByKey.has(normalizeName(name));
              return (
                <div key={`${i}-${slotKeys[i] ?? 0}`} className={cx("relative", (slotKeys[i] ?? 0) > 0 && "[animation:bh-tile-in_.5s_cubic-bezier(.2,.9,.3,1.1)]")}>
                  <Tile label={name} pending={p} onTap={() => tap(name)} aria={p ? t("tiles.addAriaPending", { name, qty: qtyLabel(p.n, null) }) : t("tiles.addAria", { name })} />
                  <button
                    type="button"
                    onClick={() => toggleStar(name)}
                    aria-label={fav ? t("tiles.unstar", { name }) : t("tiles.star", { name })}
                    aria-pressed={fav}
                    className={cx(
                      "absolute right-0 top-0 z-[2] grid size-8 place-items-center rounded-bl-[0.625rem] rounded-tr-[0.8125rem]",
                      fav ? "text-accent" : p ? "text-on-primary/50" : "text-line-strong",
                    )}
                  >
                    <Star key={String(fav)} className={cx("size-[0.9375rem]", "[animation:bh-tile-in_.45s_cubic-bezier(.2,.9,.3,1.6)]")} fill={fav ? "currentColor" : "none"} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              );
            })
          : [
              ...favs.map((f) => {
                const p = pending[f.item_name];
                const onList = openByKey.get(normalizeName(f.item_name));
                return (
                  <div key={f.id} className="relative">
                    <Tile
                      label={f.label}
                      pending={p}
                      badge={!p && onList ? qtyLabel(countOf(onList.quantity), onList.unit) : undefined}
                      onTap={() => tap(f.item_name)}
                      onLongPress={() => setEditor({ tile: f })}
                      aria={t("tiles.addFavAria", { name: f.item_name })}
                    />
                  </div>
                );
              }),
              favs.length < MAX_FAVORITES && (
                <button
                  key="new"
                  type="button"
                  onClick={() => setEditor({ tile: null })}
                  className="flex h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-[0.8125rem] border border-dashed border-line-strong text-[0.6875rem] font-bold text-accent active:scale-95"
                >
                  <Plus className="size-[1.125rem]" strokeWidth={2.4} aria-hidden />
                  {t("tiles.new")}
                </button>
              ),
            ]}
      </div>
      <p className="mt-2 px-0.5 text-xs leading-snug text-text-2">
        {tab === "freq"
          ? t("tiles.hintFrequent")
          : favs.length
            ? t("tiles.hintFavorites")
            : t("tiles.hintNoFavorites")}
      </p>

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
    </div>
  );
}

function nextPosition(favs: FavoriteTile[]) {
  return favs.reduce((m, f) => Math.max(m, f.position), 0) + 1;
}

function Tile({
  label,
  pending,
  badge,
  onTap,
  onLongPress,
  aria,
}: {
  label: string;
  pending?: { n: number; flip: boolean };
  badge?: string;
  onTap: () => void;
  onLongPress?: () => void;
  aria: string;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const [holding, setHolding] = useState(false);

  function down() {
    if (!onLongPress) return;
    fired.current = false;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      fired.current = true;
      setHolding(false);
      navigator.vibrate?.(12);
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function up() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  return (
    <button
      type="button"
      aria-label={aria}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        navigator.vibrate?.(6);
        onTap();
      }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      className={cx(
        "relative flex h-[3.75rem] w-full select-none items-end overflow-hidden rounded-[0.8125rem] border px-2 pb-2 pt-1.5 text-left transition-[transform,background-color,color,border-color] duration-200 [-webkit-touch-callout:none] active:scale-[0.94]",
        pending ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated text-text",
        holding && "scale-95 border-primary",
      )}
    >
      {holding && <span aria-hidden className="absolute inset-0 origin-left bg-primary/10 [animation:bh-hold_.48s_linear_forwards]" />}
      <span className={cx("line-clamp-2 pr-1 font-semibold leading-[1.15]", label.length > 14 ? "text-[0.71875rem]" : "text-[0.78125rem]")}>{label}</span>
      {pending && (
        <>
          <span
            key={String(pending.flip)}
            className="absolute left-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-md bg-accent px-1.5 text-[0.71875rem] font-bold text-on-accent [animation:bh-pop_.3s_ease]"
          >
            +{pending.n}
          </span>
          <span key={`bar-${pending.flip}`} aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-accent [animation:bh-shrink_1.4s_linear_forwards]" />
        </>
      )}
      {badge && (
        <span className="absolute left-2 top-1.5 flex items-center gap-1 text-[0.65625rem] font-bold text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          {badge}
        </span>
      )}
    </button>
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
          <div className="flex h-[3.75rem] w-24 shrink-0 items-end overflow-hidden rounded-[0.8125rem] border border-primary bg-bg px-2 pb-2 text-[0.78125rem] font-semibold leading-[1.15]">
            <span className="line-clamp-2">{finalLabel || t("tiles.previewDefault")}</span>
          </div>
          <p className="text-sm leading-snug text-text-2">{t("tiles.previewHelp")}</p>
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
