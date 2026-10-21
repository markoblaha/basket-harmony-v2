/**
 * Podstránky Viac: V3 Upozornenia, V4 Moje obchody, V5 Obľúbené dlaždice.
 * Upozornenia a obchody sú voľby tohto telefónu (src/lib/settings.ts), dlaždice sú v databáze.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowDown, ArrowUp, BellRing, Star, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { setSetting, useSettings, type NotifKind } from "@/lib/settings";
import { normalizeName } from "@/lib/categories";
import { Empty, ScreenHeader, StoreBadge, Switch } from "@/components/kit";
import { ErrorState, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useFavoriteTiles, useRemoveFavorite, useSaveFavorite } from "@/features/lists/api";
import { useReceipts } from "@/features/receipts/api";
import { t, tn, type Key } from "@/i18n";

/* ------------------------------------------------------------------ V3 – upozornenia */
const NOTIF: [NotifKind, Key, Key][] = [
  ["start", "more.notif.start", "more.notif.startSub"],
  ["request", "more.notif.request", "more.notif.requestSub"],
  ["reply", "more.notif.reply", "more.notif.replySub"],
  ["unavailable", "more.notif.unavailable", "more.notif.unavailableSub"],
  ["end", "more.notif.end", "more.notif.endSub"],
  ["receiptRead", "more.notif.receiptRead", "more.notif.receiptReadSub"],
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notif } = useSettings();
  return (
    <div className="stack">
      <ScreenHeader title={t("more.notif.title")} onBack={() => navigate("/more")} />
      <div className="stack g-16 pad" style={{ paddingTop: 4 }}>
        <div className="card row g-12" style={{ padding: 14, alignItems: "flex-start", background: "var(--blue-soft)", boxShadow: "none" }}>
          <BellRing size={20} color="var(--blue)" style={{ flex: "none", marginTop: 2 }} />
          <span className="stack g-4">
            <span className="t-h" style={{ color: "var(--blue)" }}>
              {t("more.notif.inApp")}
            </span>
            <span className="t-sm t-2">{t("more.notif.inAppBody")}</span>
          </span>
        </div>
        <div className="cells">
          {NOTIF.map(([k, title, sub]) => (
            <div key={k} className="cell">
              <span className="grow stack g-2">
                <span className="t-body fw-5">{t(title)}</span>
                <span className="t-sm t-2">{t(sub)}</span>
              </span>
              <Switch on={notif[k] !== false} label={t(title)} onChange={(v) => setSetting("notif", { ...notif, [k]: v })} />
            </div>
          ))}
        </div>
        <span className="t-sm t-2" style={{ padding: "0 4px" }}>
          {t("more.notif.footer")}
        </span>
      </div>
      <div className="tab-space" />
    </div>
  );
}

/* ------------------------------------------------------------------ V4 – moje obchody */
const DEFAULT_STORES = ["Lidl", "Kaufland", "Tesco", "Billa", "DM", "Teta"];

export function StoresPage() {
  const navigate = useNavigate();
  const { household } = useHousehold();
  const receipts = useReceipts(household.id);
  const { storeOrder, favStores } = useSettings();

  // Obchody: známe + tie, z ktorých máme doklady; počet dokladov podľa normalizovaného mena.
  const { order, counts } = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const n of DEFAULT_STORES) names.set(normalizeName(n), n);
    for (const r of receipts.data ?? []) {
      if (!r.store_name) continue;
      const k = normalizeName(r.store_name.split(/\s+/)[0] ?? r.store_name);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (!names.has(k)) names.set(k, r.store_name);
    }
    const all = [...names.values()].sort((a, b) => (counts.get(normalizeName(b)) ?? 0) - (counts.get(normalizeName(a)) ?? 0));
    const rank = (n: string) => {
      const i = storeOrder.findIndex((s) => normalizeName(s) === normalizeName(n));
      return i < 0 ? storeOrder.length : i;
    };
    return { order: all.map((n, i) => ({ n, i })).sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i).map((x) => x.n), counts };
  }, [receipts.data, storeOrder]);

  const isFav = (n: string) => favStores.some((s) => normalizeName(s) === normalizeName(n));
  const toggleFav = (n: string) =>
    setSetting("favStores", isFav(n) ? favStores.filter((s) => normalizeName(s) !== normalizeName(n)) : [...favStores, n]);
  const move = (i: number, d: number) => {
    const o = [...order];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    setSetting("storeOrder", o);
  };

  return (
    <div className="stack">
      <ScreenHeader title={t("more.stores")} onBack={() => navigate("/more")} />
      <div className="stack g-12 pad" style={{ paddingTop: 4 }}>
        <span className="t-sm t-2" style={{ padding: "0 4px" }}>
          {t("more.stores.help")}
        </span>
        <div className="cells">
          {order.map((n, i) => {
            const on = isFav(n);
            return (
              <div key={n} className="cell">
                <StoreBadge name={n} />
                <span className="grow stack g-2">
                  <span className="t-body fw-5">{n}</span>
                  <span className="t-sm t-2 num">{tn("more.stores.count", counts.get(normalizeName(n)) ?? 0)}</span>
                </span>
                <button type="button" className="ibtn sm" onClick={() => toggleFav(n)} aria-label={on ? t("more.stores.unfav") : t("more.stores.fav")} aria-pressed={on}>
                  <Star size={18} fill={on ? "currentColor" : "none"} style={{ color: on ? "var(--yellow)" : "var(--text-3)" }} />
                </button>
                <button type="button" className="ibtn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("more.stores.up")} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  className="ibtn sm"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={t("more.stores.down")}
                  style={{ opacity: i === order.length - 1 ? 0.3 : 1 }}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="tab-space" />
    </div>
  );
}

/* ------------------------------------------------------------------ V5 – obľúbené dlaždice */
export function TilesPage() {
  const navigate = useNavigate();
  const me = useUserId();
  const { household } = useHousehold();
  const toast = useToast();
  const tiles = useFavoriteTiles(household.id);
  const remove = useRemoveFavorite(household.id);
  const restore = useSaveFavorite(household.id);
  const mine = (tiles.data ?? []).filter((x) => x.user_id === me);

  return (
    <div className="stack">
      <ScreenHeader title={t("more.tiles")} sub={t("more.tilesSub", { n: mine.length })} onBack={() => navigate("/more")} />
      <div className="stack g-12 pad" style={{ paddingTop: 4 }}>
        {tiles.isPending ? (
          <Spinner />
        ) : tiles.isError ? (
          <ErrorState error={errorMessage(tiles.error)} onRetry={() => tiles.refetch()} />
        ) : mine.length === 0 ? (
          <Empty icon={Star} title={t("more.tiles.empty")} text={t("more.tiles.emptyText")} />
        ) : (
          <>
            <span className="t-sm t-2" style={{ padding: "0 4px" }}>
              {t("more.tiles.help")}
            </span>
            <div className="cells">
              {mine.map((tile) => (
                <div key={tile.id} className="cell">
                  <span className="cat-ic">
                    <Star size={18} strokeWidth={1.9} />
                  </span>
                  <span className="grow stack g-2">
                    <span className="t-body fw-5">{tile.label}</span>
                    {tile.item_name !== tile.label && <span className="t-sm t-2">{tile.item_name}</span>}
                  </span>
                  <button
                    type="button"
                    className="ibtn"
                    aria-label={t("more.tiles.remove", { name: tile.label })}
                    onClick={() =>
                      remove.mutate(tile.id, {
                        onSuccess: () =>
                          toast.show(t("more.tiles.removed", { name: tile.label }), "info", {
                            undo: () =>
                              restore.mutate(
                                { label: tile.label, itemName: tile.item_name, position: tile.position },
                                { onError: (err) => toast.show(errorMessage(err), "error") },
                              ),
                          }),
                        onError: (err) => toast.show(errorMessage(err), "error"),
                      })
                    }
                  >
                    <Trash2 size={18} color="var(--red)" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="tab-space" />
    </div>
  );
}
