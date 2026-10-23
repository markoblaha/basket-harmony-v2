import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ChefHat, ChevronRight, History, Lock, Plus, ReceiptText, ShoppingBasket, ShoppingCart } from "lucide-react";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { Avatars, Cell, Empty, Marquee, ProgressBar, ScreenHeader, StoreBadge, useLongPress, type Person } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { shortName } from "@/lib/shortName";
import { formatDateTime, formatEuro, t, tn } from "@/i18n";
import { useListPriceHints } from "@/features/analytics/api";
import { useRecipePlans } from "@/features/recipes/api";
import { useHubSessions, useItems, useListStats, useLists, useStartShopping, type ListStats, type Session, type ShoppingList } from "./api";
import { listDay } from "./dates";
import { ListActionsSheet } from "./ListActionsSheet";
import { ListSheet } from "./ListSheet";
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
  const [actionsFor, setActionsFor] = useState<ShoppingList | null>(null);

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

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  return (
    <div className="stack">
      <ScreenHeader
        title={t("nav.shopping")}
        right={
          <button type="button" className="row g-6 hdr-btn" onClick={() => navigate("/more/household")} aria-label={t("shop.householdLabel", { name: household.name })}>
            <Avatars people={people} />
          </button>
        }
      />
      <div className="stack g-16 px" style={{ paddingTop: 4 }}>
        {(liveList || missing > 0) && (
          <section className="stack g-8">
            {live && liveList && <LiveCard session={live} list={liveList} mine={live.shopper_id === me} shopper={shortName(nameOf(live.shopper_id))} />}
            {missing > 0 && (
              <button type="button" className="card ls-sub row g-12" style={{ padding: "10px 14px", minHeight: 52, textAlign: "left" }} onClick={() => navigate("/history?filter=missing")}>
                <span className="cat-ic sm" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>
                  <ReceiptText size={15} />
                </span>
                <span className="grow t-sm fw-5">{tn("ls.missingReceipts", missing)}</span>
                <span className="t-sm fw-6 t-accent">{t("ls.complete")}</span>
              </button>
            )}
          </section>
        )}

        {open.length === 0 ? (
          <Empty icon={ShoppingBasket} title={t("ls.emptyTitle")} text={t("ls.emptyText")} />
        ) : (
          <section className="stack g-10">
            {open.map((l) => (
              <ListCard
                key={fresh?.id === l.id ? `${l.id}-${fresh.at}` : l.id}
                list={l}
                stats={stats.data?.get(l.id)}
                session={sessionByList.get(l.id)}
                shopper={sessionByList.get(l.id) ? shortName(nameOf(sessionByList.get(l.id)!.shopper_id)) : ""}
                people={participants(l, stats.data?.get(l.id)?.adders ?? [], people)}
                recipes={recipesOf(l.id)}
                fresh={fresh?.id === l.id && Date.now() - fresh.at < 4000}
                onActions={() => setActionsFor(l)}
              />
            ))}
            <span className="t-xs t-3" style={{ textAlign: "center" }}>
              {t("ls.holdHint")}
            </span>
          </section>
        )}

        <div className="cells ls-sub ls-quiet">
          <Cell
            icon={
              <span className="cat-ic sm">
                <History size={15} />
              </span>
            }
            title={t("ls.history")}
            sub={tn("ls.historyCount", history.length)}
            onClick={() => navigate("/history")}
          />
        </div>
      </div>
      <div className="tab-space" style={{ height: 160 }} />

      <button type="button" className="fab fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4" onClick={() => setCreating(true)}>
        <Plus size={20} strokeWidth={2.4} />
        {t("ls.newList")}
      </button>

      <ListSheet
        key={creating ? "new-open" : "new"}
        open={creating}
        onClose={() => setCreating(false)}
        householdId={household.id}
        householdName={household.name}
        me={me}
        lists={lists.data ?? []}
        onCreated={(id) => navigate(`/lists/${id}`)}
      />
      <ListActionsSheet list={actionsFor} onClose={() => setActionsFor(null)} />
    </div>
  );
}

function LiveCard({ session, list, mine, shopper }: { session: Session; list: ShoppingList; mine: boolean; shopper: string }) {
  const navigate = useNavigate();
  const items = useItems(list.id).data ?? [];
  const since = new Date(session.started_at).getTime();
  const handled = items.filter((i) => i.status !== "OPEN" && new Date(i.purchased_at ?? 0).getTime() >= since).length;
  const total = handled + items.filter((i) => i.status === "OPEN").length;
  const at = formatDateTime(session.started_at, { hour: "2-digit", minute: "2-digit" });
  return (
    <button type="button" className="ls-now anim-rise" onClick={() => navigate(`/lists/${list.id}`)}>
      <span className="live" />
      <span className="grow stack g-6">
        <span className="t-h">
          {mine ? t("ls.youShop") : t("ls.someoneShops", { name: shopper })} · {list.name}
        </span>
        <ProgressBar value={total ? handled / total : 0} color="var(--violet)" />
        <span className="t-xs num">{t("ls.liveProgress", { done: handled, total, time: at })}</span>
      </span>
      <span className="row g-4 t-sm fw-6">
        {mine ? t("ls.continue") : t("ls.watch")}
        <ChevronRight size={16} />
      </span>
    </button>
  );
}

function ListCard({
  list,
  stats,
  session,
  shopper,
  people,
  recipes,
  fresh,
  onActions,
}: {
  list: ShoppingList;
  stats?: ListStats;
  session?: Session;
  shopper: string;
  people: Person[];
  recipes: string[];
  fresh: boolean;
  onActions: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const start = useStartShopping(list.id);
  const open = stats?.open ?? 0;
  const lp = useLongPress({ onTap: () => navigate(`/lists/${list.id}`), onLong: onActions });
  // Orientačný odhad podľa posledných cien z bločkov (ak nejaké sú).
  const hints = useListPriceHints(open > 0 ? list.id : undefined);
  const [showEstimate] = useSetting("estimate");
  const priced = [...(hints.data?.values() ?? [])].filter((h) => h.last_price > 0);
  const estimate = priced.reduce((sum, h) => sum + Number(h.last_price), 0);

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
      className={cx("ls-listcard anim-rise", fresh && "ls-fresh", session && "ls-active")}
      data-new={t("ls.newTag")}
      role="button"
      tabIndex={0}
      {...lp}
      aria-label={`${list.name}, ${listDay(list)}, ${tn("shop.itemCount", open)}`}
    >
      {session && <span className="ls-active-glow" aria-hidden />}
      <span className="row g-12">
        <StoreBadge name={list.name} />
        <span className="grow stack g-2">
          <span className="row g-8" style={{ minWidth: 0 }}>
            <span className="t-h ellipsis">{list.name}</span>
            {list.is_private ? (
              <Lock size={13} className="t-3 shrink-0" aria-label={t("trip.onlyMe")} />
            ) : (
              <span className="ls-ppl">
                <Avatars people={people} max={3} size="xs" />
              </span>
            )}
          </span>
          <span className="t-sm t-2 num ellipsis">
            {listDay(list)} · {tn("shop.itemCount", open)}
            {showEstimate && priced.length > 0 ? ` · ~${formatEuro(estimate)}` : ""}
          </span>
        </span>
        {(session || open > 0) && (
          <button
            type="button"
            className={cx("ls-go", session && "on")}
            disabled={start.isPending}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void go();
            }}
            aria-label={session ? t("ls.openShopAria", { name: list.name }) : t("ls.startShopAria", { name: list.name })}
          >
            {session ? <span className="live" style={{ width: 7, height: 7 }} /> : <ShoppingCart size={16} />}
            <span>{session ? t("ls.open") : t("ls.start")}</span>
          </button>
        )}
      </span>
      {(session || recipes.length > 0 || list.note) && (
        <span className="row g-6 wrap">
          {session && (
            <span className="badge b-violet">
              <span className="live" style={{ width: 6, height: 6 }} />
              {t("hub.shopping", { name: shopper })}
            </span>
          )}
          {recipes.length > 0 && (
            <span className="badge b-gray fit">
              <ChefHat size={12} className="shrink-0" />
              <Marquee text={t("ls.fromRecipe", { names: recipes.join(" + ") })} />
            </span>
          )}
          {list.note && recipes.length === 0 && <span className="t-xs t-3 ellipsis">{list.note}</span>}
        </span>
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
