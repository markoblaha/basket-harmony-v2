import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Camera, Check, ChevronRight, Lock, Plus, Receipt } from "lucide-react";
import { Avatar, ErrorState, SectionTitle, Spinner, cx } from "@/components/ui";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { errorMessage } from "@/lib/errors";
import { useHubSessions, useListStats, useLists, type ListStats, type Session, type ShoppingList } from "./api";
import { dayLabel, isOverdue } from "./dates";
import { ListSheet } from "./ListSheet";
import { t, tn } from "@/i18n";

const HISTORY_LIMIT = 20;

/**
 * Karta „Nákupy“: prehľad všetkých nákupov domácnosti.
 *  - Rozpracované: zoznamy, do ktorých sa ešte pridáva alebo sa práve nakupuje.
 *  - História: nákupy, kde sa kúpilo všetko. Ak k nim chýba doklad, ukáže sa to.
 * Nový nákup (Lidl, DM, Kaufland…) sa zakladá tlačidlom hore.
 */
export function ShoppingHub() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const sessions = useHubSessions(household.id);
  const names = useProfiles().data;
  const [creating, setCreating] = useState(false);

  const { open, history, recentNames } = useMemo(() => {
    const all = lists.data ?? [];
    const open = all
      .filter((l) => !l.completed_at)
      .sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999") || b.created_at.localeCompare(a.created_at));
    const history = all
      .filter((l) => l.completed_at)
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
      .slice(0, HISTORY_LIMIT);
    const recentNames = [...history, ...open].map((l) => l.name);
    return { open, history, recentNames };
  }, [lists.data]);

  const sessionByList = new Map((sessions.data ?? []).map((s) => [s.list_id, s]));
  const memberNames = names ? [names.get(me) ?? t("hub.me"), ...[...names.entries()].filter(([id]) => id !== me).map(([, n]) => n)] : [];
  const missingReceipts = history.filter((l) => l.receipt_state === "LATER").length;

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  return (
    <div className="pb-6">
      <header className="flex items-end justify-between gap-3 px-4 pb-4 pt-5">
        <div>
          <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">{t("nav.shopping")}</h1>
          <p className="mt-1.5 text-[0.8125rem] font-medium text-text-2">
            {open.length ? tn("hub.openCount", open.length) : t("hub.noneOpen")}
            {missingReceipts > 0 && <span className="text-accent"> · {t("hub.missingReceipts", { n: missingReceipts })}</span>}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl border border-line bg-elevated py-1.5 pl-1.5 pr-2.5 text-sm font-semibold">
          <span className="flex">
            {memberNames.slice(0, 3).map((n, i) => (
              <span key={n + i} className={cx(i > 0 && "-ml-2 rounded-lg ring-2 ring-elevated")}>
                <Avatar name={n} me={i === 0} />
              </span>
            ))}
          </span>
          <span className="max-w-28 truncate">{household.name}</span>
        </span>
      </header>

      <div className="px-4">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-14 w-full items-center gap-3 rounded-2xl bg-accent pl-2 pr-4 text-left text-on-accent transition-transform active:scale-[0.98]"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-black/15">
            <Plus className="size-5" strokeWidth={2.6} aria-hidden />
          </span>
          <span className="flex-1 text-base font-bold">{t("hub.new")}</span>
          <span className="text-sm font-medium opacity-80">{t("hub.newHint")}</span>
        </button>
      </div>

      <section className="mt-6 px-4" aria-label={t("hub.openAria")}>
        <SectionTitle>{t("hub.open")}</SectionTitle>
        {open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-5 py-7 text-center text-sm leading-relaxed text-text-2">
            {t("hub.emptyOpen1")}
            <br />
            {t("hub.emptyOpen2")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {open.map((l) => (
              <ListCard
                key={l.id}
                list={l}
                stats={stats.data?.get(l.id)}
                session={sessionByList.get(l.id)}
                shopperName={sessionByList.get(l.id) ? (names?.get(sessionByList.get(l.id)!.shopper_id) ?? t("done.memberFallback")) : undefined}
                me={me}
                creatorName={l.created_by ? names?.get(l.created_by) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-7 px-4" aria-label={t("hub.historyAria")}>
          <SectionTitle>{t("hub.history")}</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
            {history.map((l, i) => {
              const st = stats.data?.get(l.id);
              return (
                <div key={l.id} className={cx("flex items-center gap-3 py-2.5 pl-3.5 pr-2", i > 0 && "border-t border-dashed border-line")}>
                  <Link to={`/lists/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-surface text-success" aria-hidden>
                      <Check className="size-[1.125rem]" strokeWidth={2.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{l.name}</span>
                        {l.is_private && <Lock className="size-3.5 shrink-0 text-text-3" aria-label={t("hub.private")} />}
                      </span>
                      <span className="block text-[0.8125rem] text-text-2">
                        {dayLabel(l.completed_at!)}
                        {st && st.bought > 0 && ` · ${tn("shop.itemCount", st.bought)}`}
                      </span>
                    </span>
                  </Link>
                  <ReceiptChip list={l} onAdd={() => navigate(`/receipts?pridat=1&nakup=${l.id}`)} />
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-0.5 text-xs leading-snug text-text-2">
            {t("hub.receiptHint")}
          </p>
        </section>
      )}

      <ListSheet
        open={creating}
        onClose={() => setCreating(false)}
        householdId={household.id}
        householdName={household.name}
        memberNames={memberNames}
        me={me}
        recentNames={recentNames}
        onCreated={(id) => navigate(`/lists/${id}`)}
      />
    </div>
  );
}

function ListCard({
  list,
  stats,
  session,
  shopperName,
  me,
  creatorName,
}: {
  list: ShoppingList;
  stats?: ListStats;
  session?: Session;
  shopperName?: string;
  me: string;
  creatorName?: string;
}) {
  const open = stats?.open ?? 0;
  const bought = stats?.bought ?? 0;
  const live = !!session;
  const mine = session?.shopper_id === me;
  return (
    <Link
      to={`/lists/${list.id}`}
      className={cx(
        "block rounded-[1.125rem] border p-3.5 transition-transform active:scale-[0.99] animate-rise",
        live ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-extrabold tracking-[-0.02em]">{list.name}</h2>
            {list.is_private ? (
              <span className={cx("flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold", live ? "bg-on-primary/15" : "bg-surface text-text-2")}>
                <Lock className="size-3" aria-hidden /> {t("trip.onlyMe")}
              </span>
            ) : (
              creatorName &&
              list.created_by !== me && <span className={cx("shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold", live ? "bg-on-primary/15" : "bg-person-soft text-person")}>{t("hub.createdBy", { name: creatorName })}</span>
            )}
          </div>
          <p className={cx("mt-0.5 text-[0.8125rem]", live ? "opacity-75" : "text-text-2")}>
            {live ? (
              <span className="font-semibold">{mine ? t("hub.shoppingNow") : t("hub.shopping", { name: shopperName ?? "" })}</span>
            ) : list.planned_for ? (
              <span className={cx(isOverdue(list.planned_for) && "font-semibold text-accent")}>
                {isOverdue(list.planned_for) ? t("hub.planned", { day: dayLabel(list.planned_for) }) : dayLabel(list.planned_for)}
              </span>
            ) : (
              t("trip.noDay")
            )}
            {list.note && <span> · {list.note}</span>}
          </p>
        </div>
        <span className={cx("flex shrink-0 items-center gap-1 text-sm font-bold", live ? "" : "text-text-2")}>
          {tn("shop.itemCount", open)}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
      {stats && stats.preview.length > 0 && (
        <p className={cx("mt-2 truncate text-[0.8125rem]", live ? "opacity-70" : "text-text-2")}>
          {stats.preview.join(" · ")}
          {open > stats.preview.length && ` +${open - stats.preview.length}`}
        </p>
      )}
      {live && open + bought > 0 && (
        <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-on-primary/15" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${(bought / (open + bought)) * 100}%` }} />
        </div>
      )}
    </Link>
  );
}

function ReceiptChip({ list, onAdd }: { list: ShoppingList; onAdd: () => void }) {
  if (list.receipt_state === "ATTACHED" && list.receipt_id) {
    return (
      <Link
        to={`/receipts/${list.receipt_id}`}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-[0.625rem] bg-success-soft px-2.5 text-[0.8125rem] font-bold text-success"
      >
        <Receipt className="size-4" aria-hidden /> {t("trip.receipt")}
      </Link>
    );
  }
  if (list.receipt_state === "LATER") {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-[0.625rem] bg-accent-soft px-2.5 text-[0.8125rem] font-bold text-accent"
      >
        <Camera className="size-4" aria-hidden /> {t("trip.completeReceipt")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={t("hub.addReceiptAria", { name: list.name })}
      className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] text-text-3 active:bg-pressed"
    >
      <Camera className="size-[1.125rem]" aria-hidden />
    </button>
  );
}
