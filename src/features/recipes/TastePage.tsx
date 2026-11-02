/**
 * Ochutnávač – recepty ako videá (mockup prototyp/src/book.jsx Taste): potiahnutím hore ďalší recept,
 * dvakrát ťuknúť alebo „Chcem“ = páči sa mi, „Nie“ = ďalší, „Nákup“ = suroviny do zoznamu, „Plán“ = deň.
 * „Chcem“ je za každého člena (recipe_likes); keď recept chce aj niekto iný z domácnosti → Zhoda!
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { E, I, IB } from "@/mockup/ui";
import { Av, Btn, eur } from "@/mockup/kit";
import { useRecipeLikes, useRecipes, useToggleLike } from "./api";
import { art, useRecipeFacts } from "./mk";
import { AddRecipeSheet, PlanSheet } from "./sheets";
import type { Recipe } from "./types";

const LIMIT = 15;
const SEEN = "bh.tasteSeen";
function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN, JSON.stringify({ ...readSeen(), [id]: Date.now() }));
  } catch {
    /* bez úložiska – nevadí */
  }
}
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

export function TastePage() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useRecipes(household.id);
  const names = useProfiles().data;
  const likes = useRecipeLikes(household.id).data ?? [];
  const toggle = useToggleLike(household.id);
  const { facts } = useRecipeFacts(household.id, recipes.catalog, recipes.find);
  const [cur, setCur] = useState(0);
  const [burst, setBurst] = useState<string | null>(null);
  const [match, setMatch] = useState<{ id: string; who: string } | null>(null);
  const [sheet, setSheet] = useState<null | { kind: "add" | "plan"; r: Recipe }>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tap = useRef(0);

  // Poradie: najprv recepty s fotkou, ktoré ste ešte nevideli, potom podľa toho, čo máte doma.
  const ids = useMemo(() => {
    const seen = readSeen();
    const score = (r: Recipe) => {
      const f = facts.get(r.id);
      return (art(r).pic ? 4 : 0) + (f ? (f.have / Math.max(1, f.all)) * 3 : 0) - (seen[r.id] ? 5 : 0) + ((r.id.charCodeAt(0) * 7) % 5) / 5;
    };
    return [...recipes.catalog].sort((a, b) => score(b) - score(a)).slice(0, LIMIT).map((r) => r.id);
  }, [recipes.catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = new Set(likes.filter((l) => l.user_id === me).map((l) => l.recipe_key));
  const others = (id: string) => likes.filter((l) => l.recipe_key === id && l.user_id !== me).map((l) => names?.get(l.user_id) ?? t("household.fallbackName"));
  const like = (id: string, on = true) => {
    toggle.mutate({ key: id, on, me }, { onError: (e) => toast.show(errorMessage(e), "error") });
    if (on) {
      setBurst(`${id}:${Date.now()}`);
      const o = others(id);
      if (o.length) setTimeout(() => setMatch({ id, who: o[0]! }), 450);
    }
  };
  const next = () => ref.current?.scrollBy({ top: ref.current.clientHeight, behavior: "smooth" });
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const n = Math.round(el.scrollTop / el.clientHeight);
    if (n !== cur) {
      setCur(n);
      if (ids[n]) markSeen(ids[n]!);
    }
  };
  const dbl = (id: string) => {
    const now = Date.now();
    if (now - tap.current < 320) {
      like(id);
      tap.current = 0;
    } else tap.current = now;
  };
  const open = (id: string) => navigate(`/recipes/r/${encodeURIComponent(id)}`, { state: { ids: mine.has(id) ? [...mine] : [id] } });
  const liked = ids.filter((id) => mine.has(id)).map((id) => recipes.find(id)).filter((r): r is Recipe => !!r);
  const myName = names?.get(me) ?? "?";

  return (
    <div className="bhm bhm-full">
      <div className="taste">
        <div className="tst-top">
          <IB n="x" label={t("tst.close")} cls="glass2" onClick={() => navigate(-1)} />
          <div className="tst-prog" aria-label={t("tst.prog", { n: Math.min(cur + 1, ids.length), all: ids.length })}>
            {ids.map((_, k) => (
              <i key={k} className={k < cur ? "d" : k === cur ? "c" : ""} />
            ))}
          </div>
          <span className="tst-cnt">
            <I n="heart" />
            {liked.length}
          </span>
        </div>
        <div className="tst-feed" ref={ref} onScroll={onScroll}>
          {ids.map((id, k) => {
            const r = recipes.find(id);
            if (!r) return null;
            const a = art(r);
            const f = facts.get(id);
            const on = mine.has(id);
            const o = others(id);
            return (
              <section key={id} className="tst-card" aria-label={r.name}>
                <div className="tst-ph" onClick={() => dbl(id)}>
                  {Math.abs(k - cur) <= 2 ? (
                    a.pic ? (
                      <div className="gal">
                        <div className="gal-s">
                          <div className={`gal-i pic-${a.pic}`} role="img" aria-label={r.name} />
                        </div>
                      </div>
                    ) : (
                      <div className={`gal-i bg-${a.bg} tst-em`}>
                        <E k={a.e} s={180} />
                      </div>
                    )
                  ) : (
                    <div className="gal-i ph-wait" />
                  )}
                </div>
                <div className="tst-shade" />
                <div className="tst-info">
                  <h2>{r.name}</h2>
                  <div className="tst-meta">
                    <span>
                      <I n="timer" />
                      {hm(r.minutes)}
                    </span>
                    {f && f.cost > 0 && <span>{t("rk.perPortion", { price: eur(f.cost) })}</span>}
                  </div>
                  <div className="tst-have">
                    {f ? t("tst.have", { have: f.have, all: f.all }) : null}
                    {o.length > 0 && (
                      <span className="tst-who">
                        <Av id={likes.find((l) => l.recipe_key === id && l.user_id !== me)!.user_id} name={o[0]!} s={20} />
                        {t("tst.likes", { name: o.join(", ") })}
                      </span>
                    )}
                  </div>
                  <button type="button" className="tst-open" onClick={() => open(id)}>
                    {t("tst.full")}
                    <I n="caret-right" w="bold" />
                  </button>
                </div>
                <div className="tst-rail">
                  <button type="button" className={`tr-b${on ? " on" : ""}`} onClick={() => like(id, !on)} aria-pressed={on}>
                    <I n="heart" w={on ? "fill" : "bold"} />
                    <span>{t("tst.want")}</span>
                  </button>
                  <button type="button" className="tr-b" onClick={next}>
                    <I n="thumbs-down" w="bold" />
                    <span>{t("tst.no")}</span>
                  </button>
                  <button type="button" className="tr-b" onClick={() => setSheet({ kind: "add", r })}>
                    <I n="shopping-cart" w="bold" />
                    <span>{t("tst.shop")}</span>
                  </button>
                  <button type="button" className="tr-b" onClick={() => setSheet({ kind: "plan", r })}>
                    <I n="calendar-blank" w="bold" />
                    <span>{t("tst.plan")}</span>
                  </button>
                </div>
                {burst?.startsWith(`${id}:`) && (
                  <span key={burst} className="tst-burst">
                    <I n="heart" />
                  </span>
                )}
              </section>
            );
          })}
          <section className="tst-card tst-end">
            <div className="tst-endin">
              <E k="party" s={64} />
              <h2>{t("tst.endT")}</h2>
              <p>
                {t("tst.endSeen", { n: ids.length })} {liked.length ? t("tst.endLiked", { recipes: tn("rk.recipes", liked.length) }) : t("tst.endNone")}
              </p>
              {liked.length > 0 && (
                <div className="tst-liked">
                  {liked.map((r) => {
                    const a = art(r);
                    return (
                      <button type="button" key={r.id} onClick={() => open(r.id)}>
                        <span className={`th${a.pic ? ` pic-${a.pic}` : ` bg-${a.bg}`}`}>{!a.pic && <E k={a.e} />}</span>
                        <b>{r.name}</b>
                      </button>
                    );
                  })}
                </div>
              )}
              <Btn cls="pri full" onClick={() => navigate(-1)}>
                {t("sp.done")}
              </Btn>
            </div>
          </section>
        </div>
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
