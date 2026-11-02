/**
 * Domov – prenesený z mockupu 1:1 (prototyp/src/home.jsx, variant A): skupiny s nadpismi
 * Treba vybaviť (nákupy bez bločku) · Nákupy (kto práve nakupuje, najbližší zoznam) ·
 * Naplánované recepty · Rýchlo. Každý riadok má jednu hlavnú akciu vpravo.
 * Dáta: zoznamy, nákupy a bločky z features/lists/api, recepty z features/recipes/api.
 */
import { Fragment, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { useListPriceHints } from "@/features/analytics/api";
import { useRecipePlans, useRecipes } from "@/features/recipes/api";
import { useHubSessions, useItems, useListStats, useLists, useStartShopping, type Session, type ShoppingList } from "@/features/lists/api";
import { AddReceiptSheet } from "@/features/lists/HistoryPage";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { t, tn } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, MkHeader } from "@/mockup/ui";
import { Btn, StoreTile, eur0, recipeArt, relDay, storeKeyOf } from "@/mockup/kit";

const MONTH_MS = 30 * 86_400_000;

function HSec({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: ReactNode }) {
  return (
    <section className="hsec" aria-label={title}>
      <div className="hsec-h">
        <h2>{title}</h2>
        {link && (
          <button type="button" onClick={onLink}>
            {link}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function HRow({ lead, title, sub, action, onClick, warn, g, label }: { lead: ReactNode; title: string; sub?: string; action?: ReactNode; onClick?: () => void; warn?: boolean; g: boolean; label?: string }) {
  return (
    <div
      className={`card hrow${g ? " glass2" : ""}${warn ? " warn" : ""}${onClick ? " tapc" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onClick ? (e: KeyboardEvent) => e.key === "Enter" && onClick() : undefined}
    >
      {lead}
      <div className="grow">
        <b>{title}</b>
        {sub && (
          <small>
            {sub.split(" · ").map((x, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                <span className="nw">{x}</span>
              </Fragment>
            ))}
          </small>
        )}
      </div>
      {action}
    </div>
  );
}

const stopThen = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation();
  fn();
};

/** Najbližší otvorený zoznam: najskôr podľa plánovaného dňa a času, potom najnovší. */
function byPlan(a: ShoppingList, b: ShoppingList) {
  return (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") || (a.planned_time ?? "99").localeCompare(b.planned_time ?? "99") || b.created_at.localeCompare(a.created_at);
}

export function HomePage() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const { style } = useTheme();
  const g = style === "glass";
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const sessions = useHubSessions(household.id);
  const plans = useRecipePlans(household.id);
  const recipes = useRecipes(household.id);
  const names = useProfiles().data;
  const [scanFor, setScanFor] = useState<ShoppingList | null>(null);

  const { open, missing } = useMemo(() => {
    const all = lists.data ?? [];
    const now = Date.now();
    return {
      open: all.filter((l) => !l.completed_at).sort(byPlan),
      missing: all
        .filter((l) => l.completed_at && l.receipt_state === "LATER" && now - new Date(l.completed_at).getTime() <= MONTH_MS)
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    };
  }, [lists.data]);

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  const live = (sessions.data ?? []).find((s) => open.some((l) => l.id === s.list_id));
  const liveList = live ? open.find((l) => l.id === live.list_id) : undefined;
  const next = open.find((l) => l.id !== liveList?.id && (stats.data?.get(l.id)?.open ?? 0) > 0) ?? open.find((l) => l.id !== liveList?.id);
  const mySession = (sessions.data ?? []).find((s) => s.shopper_id === me && s.list_id === next?.id);
  const planned = (plans.data ?? []).filter((p) => p.status === "PENDING").slice(0, 2);
  const listById = new Map((lists.data ?? []).map((l) => [l.id, l]));

  const quick: [string, string, () => void][] = [
    ["plus", t("home.qaAdd"), () => (next ? navigate(`/lists/${next.id}`) : navigate("/lists?novy=1"))],
    ["camera", t("home.qaScan"), () => navigate("/receipts?pridat=1")],
    ["cooking-pot", t("home.qaCook"), () => navigate("/recipes")],
  ];

  return (
    <div className="stack">
      <MkHeader title={t("nav.home")} bodyClass="home-a">
          {missing.length > 0 && (
            <HSec title={t("home.todo")} link={missing.length > 2 ? t("home.allCount", { n: missing.length }) : undefined} onLink={() => navigate("/history?filter=missing")}>
              {missing.slice(0, 2).map((l) => (
                <HRow
                  key={l.id}
                  g={g}
                  warn
                  lead={storeKeyOf(l.name) ? <StoreTile k={storeKeyOf(l.name)} s={40} /> : <span className="th ic"><I n="receipt" /></span>}
                  title={t("home.missingTitle")}
                  sub={`${l.name} · ${relDay(l.completed_at!)}`}
                  action={
                    <Btn cls={`pri sm${g ? " a" : ""}`} onClick={stopThen(() => setScanFor(l))}>
                      <I n="camera" />
                      {t("home.photo")}
                    </Btn>
                  }
                />
              ))}
            </HSec>
          )}

          <HSec title={t("home.shopping")} link={t("home.all")} onLink={() => navigate("/lists")}>
            {live && liveList && (
              <LiveRow
                session={live}
                list={liveList}
                g={g}
                mine={live.shopper_id === me}
                shopper={shortName(names?.get(live.shopper_id) ?? t("done.memberFallback"))}
              />
            )}
            {next ? (
              <NextRow list={next} g={g} open={stats.data?.get(next.id)?.open ?? 0} going={!!mySession} />
            ) : (
              !liveList && (
                <HRow
                  g={g}
                  lead={<span className="th ic"><I n="basket" /></span>}
                  title={t("home.noList")}
                  sub={t("home.noListSub")}
                  onClick={() => navigate("/lists?novy=1")}
                  action={
                    <Btn cls="soft sm">
                      <I n="plus" w="bold" />
                      {t("home.new")}
                    </Btn>
                  }
                />
              )
            )}
          </HSec>

          <HSec title={t("home.planned")} link={t("home.weekPlan")} onLink={() => navigate("/recipes")}>
            {planned.length ? (
              planned.map((p) => {
                const r = recipes.find(p.recipe_key);
                const art = recipeArt(p.recipe_key, p.recipe_name);
                const day = p.list_id && listById.get(p.list_id)?.planned_for;
                const sub = [relDay(day || p.created_at), r ? t("home.minutes", { n: r.minutes }) : ""].filter(Boolean).join(" · ");
                return (
                  <HRow
                    key={p.id}
                    g={g}
                    lead={art.pic ? <span className={`th tph pic-${art.pic}`} /> : <span className={`th bg-${art.bg}`}><E k={art.e} /></span>}
                    onClick={() => navigate(`/recipes/r/${encodeURIComponent(p.recipe_key)}`)}
                    label={t("home.recipeAria", { name: p.recipe_name })}
                    title={p.recipe_name}
                    sub={sub}
                    action={
                      <button type="button" className="hplay" aria-label={t("home.cook", { name: p.recipe_name })} onClick={stopThen(() => navigate(`/recipes/r/${encodeURIComponent(p.recipe_key)}/cook`))}>
                        <I n="play" />
                      </button>
                    }
                  />
                );
              })
            ) : (
              <HRow
                g={g}
                lead={<span className="th ic"><I n="cooking-pot" /></span>}
                title={t("home.nothingPlanned")}
                sub={t("home.nothingPlannedSub")}
                onClick={() => navigate("/recipes")}
                action={<I n="caret-right" w="bold" cls="chev" />}
              />
            )}
          </HSec>

          <HSec title={t("home.quick")}>
            <div className="hqa">
              {quick.map(([ic, label, fn]) => (
                <button type="button" key={label} className={`hqab${g ? " glass2" : ""}`} onClick={fn}>
                  <span className="qi">
                    <I n={ic} w={ic === "plus" ? "bold" : "fill"} />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </HSec>
      </MkHeader>
      <div className="tab-space" />
      <AddReceiptSheet list={scanFor} onClose={() => setScanFor(null)} />
    </div>
  );
}

/** Kto práve nakupuje: postup v košíku, Sledovať (alebo Pokračovať, ak nakupujem ja). */
function LiveRow({ session, list, g, mine, shopper }: { session: Session; list: ShoppingList; g: boolean; mine: boolean; shopper: string }) {
  const navigate = useNavigate();
  const items = useItems(list.id).data ?? [];
  const since = new Date(session.started_at).getTime();
  const done = items.filter((i) => i.status !== "OPEN" && new Date(i.purchased_at ?? 0).getTime() >= since).length;
  const n = done + items.filter((i) => i.status === "OPEN").length;
  const k = storeKeyOf(list.name);
  return (
    <HRow
      g={g}
      lead={<StoreTile k={k} n={list.name} s={40} />}
      onClick={() => navigate(`/lists/${list.id}`)}
      label={t("home.liveAria", { name: list.name })}
      title={mine ? t("home.youShop") : t("home.shopperLive", { name: shopper })}
      sub={`${list.name} · ${t("home.inCart", { done, n })}`}
      action={<Btn cls="soft sm">{mine ? t("home.continue") : t("home.watch")}</Btn>}
    />
  );
}

/** Najbližší zoznam: deň, počet položiek, odhad ceny a tlačidlo Nakupovať / Pokračovať. */
function NextRow({ list, g, open, going }: { list: ShoppingList; g: boolean; open: number; going: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const start = useStartShopping(list.id);
  const hints = useListPriceHints(open > 0 ? list.id : undefined);
  const priced = [...(hints.data?.values() ?? [])].filter((h) => h.last_price > 0);
  const total = priced.reduce((sum, h) => sum + Number(h.last_price), 0);
  const k = storeKeyOf(list.name);
  const day = list.planned_for ? relDay(list.planned_for) : t("trip.noDay");
  const sub = [day, tn("shop.itemCount", open), priced.length ? `~${eur0(total)}` : ""].filter(Boolean).join(" · ");
  async function go() {
    if (going) return navigate(`/lists/${list.id}`);
    try {
      await start.mutateAsync();
      navigate(`/lists/${list.id}`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }
  return (
    <HRow
      g={g}
      lead={<StoreTile k={k} n={list.name} s={40} />}
      onClick={() => navigate(`/lists/${list.id}`)}
      label={t("home.listAria", { name: list.name })}
      title={list.name}
      sub={sub}
      action={
        open > 0 ? (
          <Btn cls={`${going ? "ok" : "pri"} sm${g && !going ? " a" : ""}`} onClick={stopThen(go)} disabled={start.isPending}>
            <I n={going ? "play" : "basket"} />
            {going ? t("home.continue") : t("home.goShop")}
          </Btn>
        ) : undefined
      }
    />
  );
}
