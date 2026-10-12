import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronDown, ShoppingCart } from "lucide-react";
import { Banner, Button, EmptyState, ErrorState, Group, Sheet, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { CATEGORIES, categoryOrder } from "@/lib/categories";
import { errorCode, errorMessage } from "@/lib/errors";
import { formatQuantity } from "@/lib/parseItem";
import {
  useActiveSession,
  useEndShopping,
  useItems,
  useLists,
  useRequests,
  useStartShopping,
  useUpdateItem,
  type Item,
} from "./api";
import { AddItemBar } from "./AddItemBar";
import { EditItemSheet } from "./EditItemSheet";
import { ItemRow } from "./ItemRow";
import { ListsSheet } from "./ListsSheet";
import { RequestSheet } from "./RequestSheet";

const time = (iso: string) => new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

export function ShoppingPage() {
  const { household } = useHousehold();
  const me = useUserId();
  const navigate = useNavigate();
  const params = useParams();
  const toast = useToast();
  const lists = useLists(household.id);
  const listId = lists.data?.find((l) => l.id === params.listId)?.id ?? lists.data?.[0]?.id;
  const list = lists.data?.find((l) => l.id === listId);

  const items = useItems(listId);
  const session = useActiveSession(listId);
  const requests = useRequests(listId, session.data?.id);
  const names = useProfiles().data;
  const update = useUpdateItem(listId ?? "none");
  const start = useStartShopping(listId ?? "none");
  const end = useEndShopping(listId ?? "none");

  const [editing, setEditing] = useState<Item | null>(null);
  const [listsOpen, setListsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<{ bought: number; left: number } | null>(null);
  const [showPurchased, setShowPurchased] = useState(false);

  const active = session.data ?? null;
  const iAmShopping = !!active && active.shopper_id === me;
  const someoneElse = !!active && !iAmShopping;
  const shopperName = active ? (names?.get(active.shopper_id) ?? "Člen domácnosti") : null;

  const { groups, purchased, openCount } = useMemo(() => {
    const all = items.data ?? [];
    const open = all.filter((i) => i.status === "OPEN");
    const byCategory = new Map<string, Item[]>();
    for (const item of open) {
      const arr = byCategory.get(item.category_id) ?? [];
      arr.push(item);
      byCategory.set(item.category_id, arr);
    }
    const groups = [...byCategory.entries()]
      .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
      .map(([id, list]) => ({ category: CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!, items: list }));
    const since = active ? new Date(active.started_at).getTime() : 0;
    const purchased = all
      .filter((i) => i.status === "PURCHASED" && (!active || new Date(i.purchased_at ?? 0).getTime() >= since))
      .sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
    return { groups, purchased, openCount: open.length };
  }, [items.data, active]);

  const pendingForMe = (requests.data ?? []).filter((r) => r.status === "PENDING" && r.requested_for === me);
  const myRequests = (requests.data ?? []).filter((r) => r.requested_by === me);

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;
  if (!list || !listId) {
    return (
      <EmptyState icon="📝" title="Žiadny zoznam">
        <Button className="mt-4" onClick={() => setListsOpen(true)}>
          Vytvoriť zoznam
        </Button>
        <ListsSheet open={listsOpen} onClose={() => setListsOpen(false)} householdId={household.id} lists={[]} currentId="" onSelect={(id) => navigate(`/lists/${id}`)} />
      </EmptyState>
    );
  }

  function toggle(item: Item) {
    update.mutate(
      { id: item.id, patch: { status: item.status === "OPEN" ? "PURCHASED" : "OPEN" } },
      { onError: (err) => toast.show(errorMessage(err), "error") },
    );
  }

  async function startShopping() {
    try {
      await start.mutateAsync();
    } catch (err) {
      toast.show(errorCode(err) === "SESSION_ALREADY_ACTIVE" ? "Práve nakupuje niekto iný." : errorMessage(err), "error");
    }
  }

  async function endShopping() {
    if (!active) return;
    const bought = purchased.length;
    try {
      await end.mutateAsync(active.id);
      setConfirmEnd(false);
      setSummary({ bought, left: openCount });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const total = openCount + purchased.length;

  return (
    <div className={cx("pb-4", (iAmShopping || (!active && openCount > 0)) && "pb-24")}>
      {/* Hlavička */}
      <header className="px-4 pb-3 pt-5">
        <button type="button" onClick={() => setListsOpen(true)} className="-ml-1 flex max-w-full items-center gap-1 rounded-lg px-1 text-left active:bg-pressed">
          <h1 className="truncate text-2xl font-bold tracking-tight">{list.name}</h1>
          <ChevronDown className="size-5 shrink-0 text-text-3" aria-label="Zmeniť zoznam" />
        </button>
        <p className="text-sm text-text-2">{household.name}</p>
      </header>

      {/* Stav nákupu */}
      {iAmShopping && active && (
        <div className="sticky top-0 z-20 mx-4 mb-3 rounded-[var(--radius-surface)] bg-primary p-4 text-on-primary shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Nakupuješ</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold tabular-nums">
              {purchased.length} / {total}
            </p>
            <p className="text-sm opacity-80">od {time(active.started_at)}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-on-primary/25" aria-hidden>
            <div className="h-full rounded-full bg-on-primary transition-[width]" style={{ width: `${total ? (purchased.length / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {someoneElse && active && (
        <div className="mx-4 mb-3">
          <Banner tone="warning" title={`Nakupuje: ${shopperName}`}>
            Od {time(active.started_at)}. Čo teraz pridáš, pošle sa ako žiadosť – v obchode ju schváli alebo odmietne.
          </Banner>
        </div>
      )}

      {/* Pridanie */}
      <div className="mb-4 px-4">
        <AddItemBar listId={listId} shopperName={someoneElse ? shopperName : null} />
      </div>

      {/* Moje žiadosti počas cudzieho nákupu */}
      {someoneElse && myRequests.length > 0 && (
        <section className="mb-4 px-4">
          <h2 className="mb-2 px-1 text-sm font-semibold text-text-2">Tvoje žiadosti</h2>
          <Group>
            {myRequests.map((r) => (
              <div key={r.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                <span className="truncate">
                  {r.name} {formatQuantity(r.quantity, r.unit) && <span className="text-text-3">· {formatQuantity(r.quantity, r.unit)}</span>}
                </span>
                <RequestStatus status={r.status} />
              </div>
            ))}
          </Group>
        </section>
      )}

      {/* Položky */}
      {items.isPending ? (
        <Spinner />
      ) : items.isError ? (
        <ErrorState error={errorMessage(items.error)} onRetry={() => items.refetch()} />
      ) : openCount === 0 && purchased.length === 0 ? (
        <EmptyState icon="🧺" title="Zoznam je prázdny">
          Napíš prvú položku do poľa vyššie. Kategóriu doplníme sami.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {openCount === 0 && iAmShopping && (
            <div className="px-4">
              <Banner tone="success" title="Všetko kúpené!">
                Ukonči nákup tlačidlom dole.
              </Banner>
            </div>
          )}
          {groups.map(({ category, items: groupItems }) => (
            <section key={category.id} className="px-4" aria-label={category.name}>
              <h2 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold text-text-2">
                <span aria-hidden>{category.emoji}</span> {category.name}
                <span className="font-normal text-text-3">{groupItems.length}</span>
              </h2>
              <Group>
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    large={iAmShopping}
                    addedBy={item.added_by && item.added_by !== me ? names?.get(item.added_by) : undefined}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditing(item)}
                  />
                ))}
              </Group>
            </section>
          ))}

          {purchased.length > 0 && (
            <section className="px-4">
              {iAmShopping ? (
                <h2 className="mb-1.5 px-1 text-sm font-semibold text-success">✓ V košíku ({purchased.length})</h2>
              ) : (
                <button type="button" onClick={() => setShowPurchased((v) => !v)} aria-expanded={showPurchased} className="mb-1.5 flex min-h-10 items-center gap-1 px-1 text-sm font-semibold text-text-2">
                  Nedávno kúpené ({purchased.length})
                  <ChevronDown className={cx("size-4 transition-transform", showPurchased && "rotate-180")} aria-hidden />
                </button>
              )}
              {(iAmShopping || showPurchased) && (
                <Group>
                  {purchased.map((item) => (
                    <ItemRow key={item.id} item={item} large={iAmShopping} onToggle={() => toggle(item)} onEdit={() => setEditing(item)} />
                  ))}
                </Group>
              )}
              {!iAmShopping && showPurchased && <p className="mt-2 px-1 text-xs text-text-3">Klepnutím na položku ju vrátiš do zoznamu.</p>}
            </section>
          )}
        </div>
      )}

      {/* Spodné tlačidlo */}
      {(iAmShopping || (!active && openCount > 0)) && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-3 pt-6">
          {iAmShopping ? (
            <Button size="lg" block variant={openCount === 0 ? "primary" : "secondary"} onClick={() => setConfirmEnd(true)} className={openCount ? "border border-line-strong/50" : undefined}>
              Ukončiť nákup
            </Button>
          ) : (
            <Button size="lg" block loading={start.isPending} onClick={startShopping}>
              <ShoppingCart className="size-5" aria-hidden /> Začať nákup
            </Button>
          )}
        </div>
      )}

      {/* Okná */}
      {iAmShopping && <RequestSheet listId={listId} pending={pendingForMe} names={names} />}
      <EditItemSheet key={editing?.id} item={editing} listId={listId} onClose={() => setEditing(null)} />
      <ListsSheet
        key={listId}
        open={listsOpen}
        onClose={() => setListsOpen(false)}
        householdId={household.id}
        lists={lists.data ?? []}
        currentId={listId}
        onSelect={(id) => navigate(`/lists/${id}`)}
      />
      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Ukončiť nákup?">
        <div className="flex flex-col gap-4">
          <p className="text-text-2">
            Kúpené: <strong className="text-text">{purchased.length}</strong>. Nekúpené ({openCount}) ostanú v zozname na budúce
            nakupovanie.
          </p>
          {pendingForMe.length > 0 && <Banner tone="warning">Nevybavené žiadosti ({pendingForMe.length}) prepadnú.</Banner>}
          <Button size="lg" block loading={end.isPending} onClick={endShopping}>
            Ukončiť nákup
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmEnd(false)}>
            Ešte nakupujem
          </Button>
        </div>
      </Sheet>
      <Sheet open={!!summary} onClose={() => setSummary(null)} title="Nákup ukončený">
        <div className="flex flex-col gap-4">
          <p className="text-text-2">
            Kúpené: <strong className="text-text">{summary?.bought}</strong> · Ostáva v zozname: <strong className="text-text">{summary?.left}</strong>
          </p>
          <Banner tone="info">Pridávanie bločkov k nákupu pribudne v ďalšej verzii aplikácie.</Banner>
          <Button size="lg" block onClick={() => setSummary(null)}>
            Hotovo
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function RequestStatus({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: ["čaká", "bg-warning-soft text-warning"],
    ACCEPTED: ["pridané ✓", "bg-success-soft text-success"],
    REJECTED: ["odmietnuté", "bg-danger-soft text-danger"],
    EXPIRED: ["prepadlo", "bg-surface text-text-3"],
  };
  const [label, cls] = map[status] ?? ["?", ""];
  return <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}
