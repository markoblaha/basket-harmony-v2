import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Ban, Camera, FileText, History, Image, ReceiptText } from "lucide-react";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { BottomSheet, Empty, ScreenHeader, SheetHeader, StoreBadge } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useReceipts } from "@/features/receipts/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatEuro, t, tn } from "@/i18n";
import { useListStats, useLists, useSetReceiptLater, type ShoppingList } from "./api";
import { dayLabel } from "./dates";

/**
 * HIST – história nákupov (podľa prototypu): ukončené nákupy po mesiacoch,
 * filter „Bez dokladu“, pri každom stav dokladu. Ťuknutie otvorí doklad
 * alebo ponuku, ako ho doplniť.
 */
export function HistoryPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const receipts = useReceipts(household.id);
  const [adding, setAdding] = useState<ShoppingList | null>(null);
  const filter = params.get("filter") === "missing" ? "missing" : "all";

  const trips = useMemo(
    () => (lists.data ?? []).filter((l) => l.completed_at).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [lists.data],
  );
  const missing = trips.filter((l) => l.receipt_state === "LATER");
  const shown = filter === "missing" ? missing : trips;

  const groups: [string, ShoppingList[]][] = [];
  for (const l of shown) {
    const label = formatDateTime(l.completed_at!, { month: "long", year: "numeric" });
    const cap = label.charAt(0).toUpperCase() + label.slice(1);
    if (!groups.length || groups[groups.length - 1]![0] !== cap) groups.push([cap, []]);
    groups[groups.length - 1]![1].push(l);
  }

  if (lists.isPending) return <Spinner />;
  if (lists.isError) return <ErrorState error={errorMessage(lists.error)} onRetry={() => lists.refetch()} />;

  return (
    <div className="stack">
      <ScreenHeader onBack={() => navigate("/")} title={t("ls.history")} />
      <div className="stack g-16 px" style={{ paddingTop: 4 }}>
        <div className="row g-8">
          <button type="button" className={cx("chip", filter === "all" && "on")} onClick={() => setParams({}, { replace: true })}>
            {t("ls.filterAll")}
          </button>
          <button type="button" className={cx("chip", filter === "missing" && "on")} onClick={() => setParams({ filter: "missing" }, { replace: true })}>
            {t("ls.filterMissing")}
            {missing.length ? ` · ${missing.length}` : ""}
          </button>
        </div>

        {shown.length === 0 && (
          <Empty
            icon={filter === "missing" ? ReceiptText : History}
            title={filter === "missing" ? t("ls.allHaveReceipt") : t("ls.noTrips")}
            text={filter === "missing" ? undefined : t("ls.noTripsText")}
          />
        )}

        {groups.map(([label, group]) => (
          <section key={label} className="stack g-8">
            <div className="section-head">
              <span className="section-title">{label}</span>
              <span className="t-xs t-3 num">{tn("ls.tripCount", group.length)}</span>
            </div>
            <div className="cells">
              {group.map((l) => {
                const receipt = l.receipt_id ? receipts.data?.find((r) => r.id === l.receipt_id) : undefined;
                const bought = stats.data?.get(l.id)?.bought ?? 0;
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="ls-trip"
                    onClick={() => (l.receipt_state === "ATTACHED" && l.receipt_id ? navigate(`/receipts/${l.receipt_id}`) : setAdding(l))}
                  >
                    <StoreBadge name={l.name} />
                    <span className="grow stack g-2" style={{ minWidth: 0 }}>
                      <span className="row g-6" style={{ minWidth: 0 }}>
                        <span className="t-body fw-6 ellipsis">{l.name}</span>
                        <span className="t-sm t-2 num" style={{ flex: "none" }}>
                          {dayLabel(l.completed_at!)}
                        </span>
                      </span>
                      <span className="t-sm t-2 num ellipsis">{tn("shop.itemCount", bought)}</span>
                    </span>
                    <span className="stack g-4" style={{ alignItems: "flex-end", flex: "none" }}>
                      {l.receipt_state === "ATTACHED" ? (
                        <span className="badge b-blue num">{receipt?.total != null ? formatEuro(Number(receipt.total)) : t("trip.receipt")}</span>
                      ) : l.receipt_state === "LATER" ? (
                        <span className="badge b-orange">{t("trip.completeReceipt")}</span>
                      ) : (
                        <span className="badge b-gray">{t("ls.noReceipt")}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="tab-space" />
      <AddReceiptSheet list={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

/** ADD_RECEIPT – doklad k nákupu: odfotiť, z galérie, PDF alebo „Nemám doklad“. */
export function AddReceiptSheet({ list, onClose }: { list: ShoppingList | null; onClose: () => void }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const setLater = useSetReceiptLater(household.id);
  const go = () => {
    if (!list) return;
    onClose();
    navigate(`/receipts?pridat=1&nakup=${list.id}`);
  };
  const none = () => {
    if (!list) return;
    const id = list.id;
    const wasLater = list.receipt_state === "LATER";
    onClose();
    setLater.mutate(
      { listId: id, later: false },
      {
        onSuccess: () =>
          toast.show(t("ls.noReceiptSaved"), "info", wasLater ? { undo: () => setLater.mutate({ listId: id, later: true }) } : undefined),
        onError: (err) => toast.show(errorMessage(err), "error"),
      },
    );
  };
  return (
    <BottomSheet open={!!list} onClose={onClose} label={t("ls.receiptForTrip")}>
      {list && (
        <>
          <SheetHeader title={t("ls.receiptForTrip")} sub={`${list.name} · ${dayLabel(list.completed_at ?? list.created_at)}`} onClose={onClose} />
          <div className="sheet-body stack g-12">
            <span className="t-sm t-2">{t("ls.receiptWhy")}</span>
            <button type="button" className="btn btn-ink btn-lg btn-block" onClick={go}>
              <Camera size={18} />
              {t("ls.takePhoto")}
            </button>
            <div className="row g-8">
              <button type="button" className="btn btn-line grow" onClick={go}>
                <Image size={17} />
                {t("ls.fromGallery")}
              </button>
              <button type="button" className="btn btn-line grow" onClick={go}>
                <FileText size={17} />
                {t("ls.pdf")}
              </button>
            </div>
            {list.receipt_state === "LATER" && (
              <button type="button" className="btn btn-ghost btn-block" onClick={none}>
                <Ban size={17} />
                {t("ls.haveNoReceipt")}
              </button>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
