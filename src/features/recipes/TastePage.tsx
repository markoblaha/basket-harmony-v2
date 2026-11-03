/**
 * Ochutnávač – recepty ako videá (mockup prototyp/src/book.jsx Taste), verzia 2:
 * - nekonečný feed: potiahnutím hore ďalší recept, kolá receptov s pestrým poradím (taste.ts),
 *   po 12 receptoch prestávka so súhrnom a „Listovať ďalej“,
 * - fotky receptu do strán (Photos.tsx): samy sa posúvajú s pásikmi, kým sa ich nedotkneš,
 * - dvakrát ťuknúť = Chcem (srdce tam, kde si ťukol, vibrácia), „Nie“ = ďalší a recept pôjde dozadu,
 * - návrat z celého receptu na to isté miesto (poradie a pozícia v relácii),
 * - výkon: aktuálny recept sleduje IntersectionObserver (nie prepočet pri každom posune), obrázky len pre
 *   recepty okolo, ďalšie sa prednačítajú, karty sa neprekresľujú pri posúvaní (memo).
 * „Chcem“ je za každého člena (recipe_likes); keď recept chce aj niekto iný z domácnosti → Zhoda!
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/toast";
import { haptic } from "@/components/kit";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { E, I, IB } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Av, Btn, eur } from "@/mockup/kit";
import { useRecipeLikes, useRecipes, useToggleLike } from "./api";
import { duration } from "./book";
import { bookPhotos } from "./kniha";
import { RCATS, art, useRecipeFacts } from "./mk";
import { PhotoSwiper } from "./Photos";
import { AddRecipeSheet, PlanSheet } from "./sheets";
import { feedRound, isBreak, withBreaks, type FeedRecipe } from "./taste";
import type { Recipe } from "./types";

/* ------------------------------------------------------------------ pamäť v zariadení */
const SEEN = "bh.tasteSeen";
const NO = "bh.tasteNo";
const HINT = "bh.tasteHint";
const SESSION = "bh.tasteSession";
const SESSION_MS = 30 * 60 * 1000;
function read<T>(store: () => Storage, key: string, fallback: T): T {
  try {
    const v = store().getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(store: () => Storage, key: string, v: unknown) {
  try {
    store().setItem(key, JSON.stringify(v));
  } catch {
    /* bez úložiska – nevadí */
  }
}
const local = () => localStorage;
const session = () => sessionStorage;
type Session = { ids: string[]; cur: number; at: number };

/** Koľko kariet okolo aktuálnej má obsah (ostatné sú prázdne a nič nestoja). */
const WINDOW = 3;

export function TastePage() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const names = useProfiles().data;
  const likes = useRecipeLikes(household.id).data ?? [];
  const { mutate: toggleLike } = useToggleLike(household.id);
  const { facts } = useRecipeFacts(household.id, recipes.catalog, recipes.find);
  const restored = useRef(read<Session | null>(session, SESSION, null)).current;
  const fresh = !!restored && Date.now() - restored.at < SESSION_MS && restored.ids.length > 0;
  const [items, setItems] = useState<string[]>(fresh ? restored.ids : []);
  const [cur, setCur] = useState(fresh ? restored.cur : 0);
  const [match, setMatch] = useState<{ id: string; who: string } | null>(null);
  const [sheet, setSheet] = useState<null | { kind: "add" | "plan"; r: Recipe }>(null);
  const [hint, setHint] = useState(() => !read<boolean>(local, HINT, false));
  const ref = useRef<HTMLDivElement>(null);

  // Recepty do feedu: len s fotkou (z knihy sada fotiek, inak fotka z mockupu).
  const pool = useMemo<FeedRecipe[]>(
    () =>
      recipes.catalog
        .filter((r) => r.book || art(r).pic)
        .map((r) => ({ id: r.id, book: !!r.book, cat: RCATS.find((c) => c.id !== "all" && c.test(r))?.id ?? "all" })),
    [recipes.catalog],
  );
  const round = useCallback(
    (after?: string) => {
      const rnd = new Map(pool.map((r) => [r.id, Math.random() * 1.5]));
      return feedRound(
        pool,
        {
          have: (id) => {
            const f = facts.get(id);
            return f ? f.have / Math.max(1, f.all) : 0;
          },
          seen: read(local, SEEN, {}),
          no: read(local, NO, {}),
          rnd: (id) => rnd.get(id) ?? 0,
        },
        pool.find((r) => r.id === after),
      );
    },
    [pool, facts],
  );
  const recipeCount = (list: string[]) => list.filter((x) => !isBreak(x)).length;

  // Prvé kolo, keď sú recepty načítané.
  useEffect(() => {
    if (!items.length && pool.length) setItems(withBreaks(round(), 0));
  }, [pool.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nekonečný feed: pred koncom pribudne ďalšie kolo.
  useEffect(() => {
    if (items.length && cur >= items.length - 4 && pool.length) {
      setItems((prev) => {
        const last = [...prev].reverse().find((x) => !isBreak(x));
        return [...prev, ...withBreaks(round(last), recipeCount(prev))];
      });
    }
  }, [cur, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Návrat z receptu na to isté miesto.
  useLayoutEffect(() => {
    if (fresh && ref.current) ref.current.scrollTop = restored.cur * ref.current.clientHeight;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items.length) write(session, SESSION, { ids: items, cur, at: Date.now() } satisfies Session);
  }, [items, cur]);

  // Aktuálna karta: IntersectionObserver (lacné, nebeží pri každom posune).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.k));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll(".tst-card").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // Videný recept + prednačítanie ďalších dvoch (prvá fotka), aby sa nikdy nečakalo.
  useEffect(() => {
    const id = items[cur];
    if (id && !isBreak(id)) write(local, SEEN, { ...read(local, SEEN, {}), [id]: Date.now() });
    for (const k of [cur + 1, cur + 2, cur + 3]) {
      const r = items[k] && !isBreak(items[k]!) ? recipes.find(items[k]!) : undefined;
      const u = r ? bookPhotos(r).urls[0] : undefined;
      if (u) new Image().src = u;
    }
  }, [cur, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((d: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ top: d * el.clientHeight, behavior: "smooth" });
  }, []);

  const mine = useMemo(() => new Set(likes.filter((l) => l.user_id === me).map((l) => l.recipe_key)), [likes, me]);
  const othersOf = useCallback(
    (id: string) => likes.filter((l) => l.recipe_key === id && l.user_id !== me).map((l) => ({ id: l.user_id, name: names?.get(l.user_id) ?? t("household.fallbackName") })),
    [likes, me, names],
  );
  const likesRef = useRef({ mine, othersOf });
  likesRef.current = { mine, othersOf };

  const like = useCallback(
    (id: string, on: boolean) => {
      toggleLike({ key: id, on, me }, { onError: (e) => toast.show(errorMessage(e), "error") });
      if (on) {
        haptic(15);
        const o = likesRef.current.othersOf(id);
        if (o.length) setTimeout(() => setMatch({ id, who: o[0]!.name }), 450);
      }
    },
    [toggleLike, me, toast],
  );
  const no = useCallback(
    (id: string) => {
      write(local, NO, { ...read(local, NO, {}), [id]: Date.now() });
      go(1);
    },
    [go],
  );
  const open = useCallback(
    (id: string) => {
      const m = likesRef.current.mine;
      navigate(`/recipes/r/${encodeURIComponent(id)}`, { state: { ids: m.has(id) ? [...m] : [id] } });
    },
    [navigate],
  );
  const shop = useCallback((r: Recipe) => setSheet({ kind: "add", r }), []);
  const plan = useCallback((r: Recipe) => setSheet({ kind: "plan", r }), []);

  // Klávesy (počítač): ↓ ↑ medzerník, L = Chcem, Esc = zavrieť. ← → listujú fotky (Photos.tsx).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (sheet || match) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") go(1);
      else if (e.key === "ArrowUp" || e.key === "PageUp") go(-1);
      else if (e.key === "l" || e.key === "L") {
        const id = items[cur];
        if (id && !isBreak(id)) like(id, !likesRef.current.mine.has(id));
      } else if (e.key === "Escape") navigate(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, like, items, cur, sheet, match, navigate]);

  const sessionLiked = useMemo(
    () => [...new Set(items.slice(0, cur + 1))].filter((id) => mine.has(id)).map((id) => recipes.find(id)).filter((r): r is Recipe => !!r),
    [items, cur, mine, recipes],
  );
  const myName = names?.get(me) ?? "?";

  return (
    <div className="bhm bhm-full">
      <div className="taste">
        <div className="tst-top">
          <IB n="x" label={t("tst.close")} cls="glass2" onClick={() => navigate(-1)} />
          <span className="tst-ttl">{t("rk.tasteT")}</span>
          <span className="tst-cnt" aria-label={tn("tst.likedN", mine.size)}>
            <I n="heart" />
            {mine.size}
          </span>
          <HelpBtn screen="m-taste" />
        </div>
        <div className="tst-feed" ref={ref}>
          {items.map((id, k) => {
            const near = Math.abs(k - cur);
            if (isBreak(id)) {
              return (
                <section key={`${id}-${k}`} className="tst-card tst-end" data-k={k} aria-label={t("tst.breakAria")}>
                  {near <= WINDOW && (
                    <TasteBreak n={recipeCount(items.slice(0, k))} liked={sessionLiked} onOpen={open} onMore={() => go(1)} onDone={() => navigate(-1)} />
                  )}
                </section>
              );
            }
            const r = recipes.find(id);
            if (!r) return <section key={`${id}-${k}`} className="tst-card" data-k={k} />;
            return (
              <TasteCard
                key={`${id}-${k}`}
                k={k}
                r={r}
                active={k === cur && !hint && !sheet && !match}
                near={near <= 1}
                visible={near <= WINDOW}
                on={mine.has(id)}
                who={othersOf(id)}
                fact={facts.get(id)}
                onLike={like}
                onNo={no}
                onOpen={open}
                onShop={shop}
                onPlan={plan}
              />
            );
          })}
        </div>
        {hint && (
          <div
            className="tst-hint"
            role="dialog"
            aria-label={t("tst.hintAria")}
            onClick={() => {
              write(local, HINT, true);
              setHint(false);
            }}
          >
            <div>
              <I n="arrow-up" />
              <b>{t("tst.hintUp")}</b>
              <span>{t("tst.hintUpS")}</span>
            </div>
            <div>
              <I n="hand-swipe-left" />
              <b>{t("tst.hintSide")}</b>
              <span>{t("tst.hintSideS")}</span>
            </div>
            <div>
              <I n="heart" />
              <b>{t("tst.hintTap")}</b>
              <span>{t("tst.hintTapS")}</span>
            </div>
            <Btn cls="pri tst-hok">{t("tst.hintOk")}</Btn>
          </div>
        )}
        {match &&
          (() => {
            const r = recipes.find(match.id);
            const otherId = likes.find((l) => l.recipe_key === match.id && l.user_id !== me)?.user_id ?? "?";
            return (
              <div className="tst-match" onClick={() => setMatch(null)} role="dialog" aria-label={t("tst.matchT")}>
                <div className="tm-in" onClick={(e) => e.stopPropagation()}>
                  <div className="tm-av">
                    <Av id={me} name={myName} s={58} />
                    <span className="tm-h">
                      <I n="heart" />
                    </span>
                    <Av id={otherId} name={match.who} s={58} />
                  </div>
                  <h3>{t("tst.matchT")}</h3>
                  <p>
                    <b>{r?.name}</b> {t("tst.matchS", { name: match.who })}
                  </p>
                  <div className="tm-b">
                    <Btn cls="soft" onClick={() => setMatch(null)}>
                      {t("tst.continue")}
                    </Btn>
                    <Btn
                      cls="pri"
                      onClick={() => {
                        setMatch(null);
                        if (r) setSheet({ kind: "plan", r });
                      }}
                    >
                      <I n="calendar-blank" />
                      {t("rk.planBtn")}
                    </Btn>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
      {sheet?.kind === "add" && <AddRecipeSheet open onClose={() => setSheet(null)} r={sheet.r} portions={sheet.r.portions} />}
      {sheet?.kind === "plan" && <PlanSheet open onClose={() => setSheet(null)} rid={sheet.r.id} />}
    </div>
  );
}

/* ------------------------------------------------------------------ jedna karta (recept) */
type CardProps = {
  k: number;
  r: Recipe;
  active: boolean;
  near: boolean;
  visible: boolean;
  on: boolean;
  who: { id: string; name: string }[];
  fact?: { cost: number; have: number; all: number };
  onLike: (id: string, on: boolean) => void;
  onNo: (id: string) => void;
  onOpen: (id: string) => void;
  onShop: (r: Recipe) => void;
  onPlan: (r: Recipe) => void;
};

const TasteCard = memo(
  function TasteCard({ k, r, active, near, visible, on, who, fact, onLike, onNo, onOpen, onShop, onPlan }: CardProps) {
    const [burst, setBurst] = useState<{ x: number; y: number; key: number } | null>(null);
    const tap = useRef({ t: 0, x: 0, y: 0 });
    if (!visible) return <section className="tst-card" data-k={k} aria-label={r.name} />;

    // Dvakrát ťuknúť (blízko seba) = Chcem; srdce vyskočí tam, kde si ťukol.
    const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      const box = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const p = tap.current;
      if (now - p.t < 320 && Math.hypot(x - p.x, y - p.y) < 60) {
        if (!on) onLike(r.id, true);
        else haptic(10);
        setBurst({ x, y, key: now });
        tap.current = { t: 0, x: 0, y: 0 };
      } else tap.current = { t: now, x, y };
    };
    const kind = r.book?.cuisine;

    return (
      <section className="tst-card" data-k={k} aria-label={r.name}>
        <div className="tst-ph" onClick={onTap}>
          <PhotoSwiper r={r} feed active={active} near={near} />
        </div>
        <div className="tst-shade" />
        <div className="tst-info">
          {kind && <span className="tst-kind">{kind}</span>}
          <h2>{r.name}</h2>
          <div className="tst-meta">
            <span>
              <I n="timer" />
              {duration(r.minutes)}
            </span>
            {fact && fact.cost > 0 && <span>{t("rk.perPortion", { price: eur(fact.cost) })}</span>}
          </div>
          <div className="tst-have">
            {fact ? t("tst.have", { have: fact.have, all: fact.all }) : null}
            {who.length > 0 && (
              <span className="tst-who">
                <Av id={who[0]!.id} name={who[0]!.name} s={20} />
                {t("tst.likes", { name: who.map((w) => w.name).join(", ") })}
              </span>
            )}
          </div>
          <button type="button" className="tst-open" onClick={() => onOpen(r.id)}>
            {t("tst.full")}
            <I n="caret-right" w="bold" />
          </button>
          {r.book && <span className="tst-ai">{t("tst.aiPhotos")}</span>}
        </div>
        <div className="tst-rail">
          <button type="button" className={`tr-b${on ? " on" : ""}`} onClick={() => onLike(r.id, !on)} aria-pressed={on}>
            <I n="heart" w={on ? "fill" : "bold"} />
            <span>{t("tst.want")}</span>
          </button>
          <button type="button" className="tr-b" onClick={() => onNo(r.id)}>
            <I n="thumbs-down" w="bold" />
            <span>{t("tst.no")}</span>
          </button>
          <button type="button" className="tr-b" onClick={() => onShop(r)}>
            <I n="shopping-cart" w="bold" />
            <span>{t("tst.shop")}</span>
          </button>
          <button type="button" className="tr-b" onClick={() => onPlan(r)}>
            <I n="calendar-blank" w="bold" />
            <span>{t("tst.plan")}</span>
          </button>
        </div>
        {burst && (
          <span key={burst.key} className="tst-burst at" style={{ ["--x" as string]: `${burst.x}px`, ["--y" as string]: `${burst.y}px` }} onAnimationEnd={() => setBurst(null)}>
            <I n="heart" />
          </span>
        )}
      </section>
    );
  },
  // Karta sa prekreslí len keď sa zmení niečo, čo ukazuje (nie pri každom posune feedu).
  (a, b) =>
    a.r === b.r &&
    a.k === b.k &&
    a.active === b.active &&
    a.near === b.near &&
    a.visible === b.visible &&
    a.on === b.on &&
    a.fact?.cost === b.fact?.cost &&
    a.fact?.have === b.fact?.have &&
    a.who.map((w) => w.id).join() === b.who.map((w) => w.id).join() &&
    a.onLike === b.onLike,
);

/* ------------------------------------------------------------------ prestávka po 12 receptoch */
function TasteBreak({ n, liked, onOpen, onMore, onDone }: { n: number; liked: Recipe[]; onOpen: (id: string) => void; onMore: () => void; onDone: () => void }) {
  return (
    <div className="tst-endin">
      <E k="party" s={64} />
      <h2>{tn("tst.breakT", n)}</h2>
      <p>{liked.length ? t("tst.endLiked", { recipes: tn("rk.recipes", liked.length) }) : t("tst.breakNone")}</p>
      {liked.length > 0 && (
        <div className="tst-liked">
          {liked.map((r) => {
            const a = art(r);
            return (
              <button type="button" key={r.id} onClick={() => onOpen(r.id)}>
                <span className={`th${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}>{!a.pic && <E k={a.e} />}</span>
                <b>{r.name}</b>
              </button>
            );
          })}
        </div>
      )}
      <Btn cls="pri full" onClick={onMore}>
        <I n="caret-down" w="bold" />
        {t("tst.keep")}
      </Btn>
      <Btn cls="soft full" onClick={onDone}>
        {t("sp.done")}
      </Btn>
    </div>
  );
}
