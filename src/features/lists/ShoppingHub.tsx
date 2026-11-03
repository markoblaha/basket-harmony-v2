import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ErrorState, Spinner } from "@/components/ui";
import { useLongPress, type Person } from "@/components/kit";
import { E, I, IB, MkHeader } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { Avatars, eur0, recipeArt } from "@/mockup/kit";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { t, tn, type Key } from "@/i18n";
import { useListEstimate } from "./estimate";
import { useRecipePlans } from "@/features/recipes/api";
import { useHubSessions, useItems, useListStats, useLists, useStartShopping, type ListStats, type Session, type ShoppingList } from "./api";
import { isoDay, listDay } from "./dates";
import { ListMenuSheet } from "./ListMenuSheet";
import { NewListSheet } from "./NewListSheet";
import { useSetting } from "@/lib/settings";

/**
 * N1 – prehľad nákupných zoznamov (podľa prototypu): prebiehajúci nákup hore,
 * karty zoznamov s tlačidlom Začať, podržaním karty sa otvoria akcie.
 * História nákupov je tichý odkaz pod zoznamami, nový zoznam plávajúce tlačidlo.
 */
export function ShoppingHub() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const sessions = useHubSessions(household.id);
  const names = useProfiles().data;
  const [params, setParams] = useSearchParams();
  // „Nový zoznam“ z iných obrazoviek (prepínač zoznamov) otvorí panel rovno tu.
  const [creating, setCreating] = useState(() => params.get("novy") === "1");
  // Nový zoznam (z receptov: navigate("/", { state: { highlight: id } }) alebo /?zvyraznit=<id>)
  // sa krátko rozsvieti so štítkom „Nový“ – ako v prototype N1.
  const location = useLocation();
  const highlight = (location.state as { highlight?: string } | null)?.highlight ?? params.get("zvyraznit");
  const [fresh, setFresh] = useState<{ id: string; at: number } | null>(null);
  useEffect(() => {
    if (!highlight) return;
    setFresh({ id: highlight, at: Date.now() });
    // Aby sa pri návrate späť zoznam nerozsvietil znova.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [highlight, location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (params.has("novy") || params.has("zvyraznit")) setParams({}, { replace: true });
  }, [params, setParams]);
  const plans = useRecipePlans(household.id);
  const g = useTheme().style === "glass";
  const [actionsFor, setActionsFor] = useState<ShoppingList | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const people: Person[] = useMemo(() => {
    const all = names ? [...names.entries()].map(([id, name]) => ({ id, name })) : [];
    return all.sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0));
  }, [names, me]);

  const { open, history } = useMemo(() => {
    const all = lists.data ?? [];
    const open = all
      .filter((l) => !l.completed_at)
      .sort(
        (a, b) =>
          (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") ||
          (a.planned_time ?? "99").localeCompare(b.planned_time ?? "99") ||
          b.created_at.localeCompare(a.created_at),
      );
    const history = all.filter((l) => l.completed_at);
    return { open, history };
  }, [lists.data]);

  const sessionByList = new Map((sessions.data ?? []).map((s) => [s.list_id, s]));
  const live = (sessions.data ?? []).find((s) => open.some((l) => l.id === s.list_id));
  const liveList = live ? open.find((l) => l.id === live.list_id) : undefined;
  const missing = history.filter((l) => l.receipt_state === "LATER").length;
  const nameOf = (id: string) => names?.get(id) ?? t("done.memberFallback");
  // Recepty, na ktoré sa nakupuje (čakajú na uvarenie) – štítok „Z receptu“ na karte.
  const recipesOf = (listId: string) => [...new Set((plans.data ?? []).filter((p) => p.list_id === listId && p.status === "PENDING").map((p) => p.recipe_name))];

  // Skupiny podľa dňa nákupu: Dnes (aj zmeškané) · Tento týždeň · Neskôr; prázdne zoznamy zbalené na konci.
  const today = isoDay(new Date());
  const week = isoDay(new Date(Date.now() + 6 * 86_400_000));
  const isEmpty = (l: ShoppingList) => !sessionByList.get(l.id) && stats.data?.get(l.id)?.open === 0;
  const bucket = (l: ShoppingList) => (isEmpty(l) ? "empty" : !l.planned_for ? "later" : l.planned_for <= today ? "today" : l.planned_for <= week ? "week" : "later");
  const groups: [string, ShoppingList[]][] = (["today", "week", "later", "empty"] as const).map((k) => [k, open.filter((l) => bucket(l) === k)]);
  const multi = groups.filter(([k, v]) => k !== "empty" && v.length).length > 1;
  const card = (l: ShoppingList) => (
    <ListCard
      key={fresh?.id === l.id ? `${l.id}-${fresh.at}` : l.id}
      list={l}
      g={g}
      stats={stats.data?.get(l.id)}
      session={sessionByList.get(l.id)}
      people={participants(l, stats.data?.get(l.id)?.adders ?? [], people)}
      recipes={recipesOf(l.id)}
      fresh={fresh?.id === l.id && Date.now() - fresh.at < 7000}
      onActions={() => setActionsFor(l)}
    />
  );

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  return (
    <div className="stack">
      <MkHeader title={t("nav.shopping")} right={
          <>
            <IB n="plus" cls="addb" label={t("ls.newList")} onClick={() => setCreating(true)} />
            <HelpBtn screen="lists" />
          </>
        }
      >
        {live && liveList && <LiveMini session={live} list={liveList} g={g} mine={live.shopper_id === me} shopper={shortName(nameOf(live.shopper_id))} />}
        {groups.map(([key, items]) =>
          items.length ? (
            <Fragment key={key}>
              {key === "empty" ? (
                <button type="button" className="hub-g tap" onClick={() => setShowEmpty((v) => !v)} aria-expanded={showEmpty}>
                  {tn("hub.gEmpty", items.length)}
                  <I n={showEmpty ? "caret-up" : "caret-down"} w="bold" cls="chev" />
                </button>
              ) : (
                multi && <div className="hub-g">{t(`hub.g.${key}` as Key)}</div>
              )}
              {(key !== "empty" || showEmpty) && items.map(card)}
            </Fragment>
          ) : null,
        )}
        <button type="button" className={`card addcard tapc${g ? " glass2" : ""}`} onClick={() => setCreating(true)}>
          <span className="pl">
            <I n="plus" w="bold" />
          </span>
          {t("ls.newList")}
        </button>
        {history.length > 0 && (
          <button type="button" className={`card row-card tapc histrow${g ? " glass2" : ""}`} onClick={() => navigate("/history")}>
            <span className="th ic">
              <I n="clock-counter-clockwise" />
            </span>
            <div className="grow">
              <div className="t1">{t("ls.history")}</div>
              <div className="meta">
                {tn("ls.historyCount", history.length)}
                {missing ? ` · ${tn("ls.historyMissing", missing)}` : ""}
              </div>
            </div>
            <I n="caret-right" w="bold" cls="chev" />
          </button>
        )}
      </MkHeader>
      <div className="tab-space" />

      <NewListSheet
        open={creating}
        onClose={() => setCreating(false)}
        householdId={household.id}
        householdName={household.name}
        lists={lists.data ?? []}
        onCreated={(id) => navigate(`/lists/${id}`)}
      />
      <ListMenuSheet list={actionsFor} onClose={() => setActionsFor(null)} />
    </div>
  );
}

/** Prebiehajúci nákup hore (mockup: „Nakupuje: Lucia ●“ · obchod · 5 z 9 v košíku). */
function LiveMini({ session, list, g, mine, shopper }: { session: Session; list: ShoppingList; g: boolean; mine: boolean; shopper: string }) {
  const navigate = useNavigate();
  const items = useItems(list.id).data ?? [];
  const since = new Date(session.started_at).getTime();
  const done = items.filter((i) => i.status !== "OPEN" && new Date(i.purchased_at ?? 0).getTime() >= since).length;
  const n = done + items.filter((i) => i.status === "OPEN").length;
  return (
    <button type="button" className={`card row-card tapc livemini${g ? " glass2" : ""}`} onClick={() => navigate(`/lists/${list.id}`)}>
      <div className="grow">
        <div className="t1">
          {mine ? t("home.youShop") : t("home.shopperLive", { name: shopper })} <span className="dot" />
        </div>
        <div className="meta">
          {list.name} · {t("home.inCart", { done, n })}
        </div>
      </div>
      <I n="caret-right" w="bold" cls="chev" />
    </button>
  );
}

/** Karta zoznamu (mockup .lcard): názov, ľudia alebo zámok, deň, odhad ceny, počet a košík na štart nákupu. */
function ListCard({
  list,
  g,
  stats,
  session,
  people,
  recipes,
  fresh,
  onActions,
}: {
  list: ShoppingList;
  g: boolean;
  stats?: ListStats;
  session?: Session;
  people: Person[];
  recipes: string[];
  fresh: boolean;
  onActions: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const me = useUserId();
  const start = useStartShopping(list.id);
  const open = stats?.open ?? 0;
  const lp = useLongPress({ onTap: () => navigate(`/lists/${list.id}`), onLong: onActions });
  // Orientačný odhad podľa posledných cien z bločkov (ak nejaké sú).
  const { household } = useHousehold();
  const est = useListEstimate(household.id, list, open > 0);
  const [showEstimate] = useSetting("estimate");
  const going = !!session && session.shopper_id === me;

  async function go() {
    if (session) {
      navigate(`/lists/${list.id}`);
      return;
    }
    try {
      await start.mutateAsync();
      navigate(`/lists/${list.id}`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div
      className={`card lcard tapc${g ? " glass2" : ""}${fresh ? " lhl" : ""}`}
      role="button"
      tabIndex={0}
      {...lp}
      aria-label={t("ls.openListAria", { name: list.name })}
      ref={fresh ? (n) => void (n && setTimeout(() => n.scrollIntoView({ block: "center", behavior: "smooth" }), 450)) : undefined}
    >
      <div className="rowc">
        <div className="grow">
          <div className="ttl tw">
            <span>{list.name}</span>
            {list.is_private ? (
              <span className="prv" role="img" aria-label={t("trip.onlyMe")}>
                <I n="lock-simple" />
              </span>
            ) : (
              <Avatars people={people.slice(0, 3)} sm />
            )}
          </div>
          <div className="meta">{listDay(list)}</div>
        </div>
        <div className="ra">
          <div className="price">{showEstimate && est?.priced ? `~${eur0(est.v)}` : "–"}</div>
          <div className="meta">{tn("shop.itemCount", open)}</div>
        </div>
        {(open > 0 || session) && (
          <button
            type="button"
            className={`lgo${going || session ? " going" : ""}`}
            disabled={start.isPending}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void go();
            }}
            aria-label={session ? t("ls.openShopAria", { name: list.name }) : t("ls.startShopAria", { name: list.name })}
          >
            <I n={session ? "play" : "basket"} w="fill" />
          </button>
        )}
      </div>
      {recipes.length > 0 && (
        <div className="lrec">
          {recipes.map((name) => {
            const art = recipeArt("", name);
            return (
              <span key={name} className="rch">
                <E k={art.e} s={20} />
                <span>{name}</span>
              </span>
            );
          })}
        </div>
      )}
      {!open && (
        <div className="rowc lfoot">
          <span className="meta">{stats && stats.bought ? t("ls.allBought") : t("ls.stillEmpty")}</span>
        </div>
      )}
    </div>
  );
}

/** Ľudia na karte (ako v prototype): kto zoznam založil a kto doň pridal položky. */
function participants(list: ShoppingList, adders: string[], people: Person[]): Person[] {
  const ids = [...new Set([list.created_by, ...adders].filter((x): x is string => !!x))];
  const found = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return found.length ? found : people;
}
