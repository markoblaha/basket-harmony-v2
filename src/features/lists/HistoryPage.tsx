import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Ban, Camera, FileText, History, Image, ReceiptText } from "lucide-react";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { BottomSheet, Empty, PersonAvatar, ScreenHeader, SheetHeader, StoreBadge } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useProfiles } from "@/features/household/api";
import { MAX_PAGES, useReceipts, type Receipt } from "@/features/receipts/api";
import { readErrorMessage } from "@/features/receipts/format";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatEuro, t, tn } from "@/i18n";
import { useListStats, useLists, useSetReceiptLater, useUploadTripReceipt, type ListStats, type ShoppingList } from "./api";
import { dayLabel } from "./dates";

/**
 * HIST – história nákupov (podľa prototypu): ukončené nákupy po mesiacoch,
 * filter „Bez dokladu“, pri každom stav dokladu a kto nakupoval. Ťuknutie otvorí
 * doklad alebo panel „Doklad k nákupu“ (počas čítania sa nedá ťuknúť).
 */
export function HistoryPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lists = useLists(household.id);
  const stats = useListStats(household.id);
  const receipts = useReceipts(household.id);
  const names = useProfiles().data;
  const [adding, setAdding] = useState<ShoppingList | null>(null);
  const filter = params.get("filter") === "missing" ? "missing" : "all";

  const trips = useMemo(
    () => (lists.data ?? []).filter((l) => l.completed_at).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [lists.data],
  );
  const missing = trips.filter((l) => l.receipt_state === "LATER");
  const shown = filter === "missing" ? missing : trips;

  // Mesiac ako v prototype („Október“); rok len pri staršom roku.
  const thisYear = new Date().getFullYear();
  const groups: [string, ShoppingList[]][] = [];
  for (const l of shown) {
    const d = new Date(l.completed_at!);
    const label = formatDateTime(d, d.getFullYear() === thisYear ? { month: "long" } : { month: "long", year: "numeric" });
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
                const st = stats.data?.get(l.id);
                const shopper = st?.shopper ? { id: st.shopper, name: names?.get(st.shopper) ?? "?" } : null;
                const reading = l.receipt_state === "ATTACHED" && receipt?.status === "PROCESSING";
                const open = () => (l.receipt_state === "ATTACHED" && l.receipt_id ? navigate(`/receipts/${l.receipt_id}`) : setAdding(l));
                const body = (
                  <>
                    <StoreBadge name={l.name} />
                    <span className="grow stack g-2" style={{ minWidth: 0 }}>
                      <span className="row g-6" style={{ minWidth: 0 }}>
                        <span className="t-body fw-6 ellipsis">{l.name}</span>
                        <span className="t-sm t-2 num" style={{ flex: "none" }}>
                          {dayLabel(l.completed_at!)}
                        </span>
                      </span>
                      <span className="t-sm t-2 num ellipsis">{tripLine(st)}</span>
                    </span>
                    <span className="stack g-4" style={{ alignItems: "flex-end", flex: "none" }}>
                      <TripStatus list={l} receipt={receipt} reading={reading} />
                      {shopper && <PersonAvatar person={shopper} size="sm" />}
                    </span>
                  </>
                );
                return reading ? (
                  <div key={l.id} className="ls-trip">
                    {body}
                  </div>
                ) : (
                  <button key={l.id} type="button" className="ls-trip" onClick={open}>
                    {body}
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

/** „7 položiek · nemali 1 · Mlieko, Rožky, Jogurt…“ */
function tripLine(st: ListStats | undefined): string {
  if (!st) return tn("shop.itemCount", 0);
  const names = st.boughtNames.slice(0, 3).join(", ");
  return [
    tn("shop.itemCount", st.bought),
    st.unavailable ? t("ls.naCount", { n: st.unavailable }) : "",
    names ? `${names}${st.bought > 3 ? "…" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function TripStatus({ list, receipt, reading }: { list: ShoppingList; receipt?: Receipt; reading: boolean }) {
  if (reading)
    return (
      <span className="badge b-blue">
        <span className="spin ls-spin" style={{ width: 10, height: 10 }} />
        {t("ls.reading")}
      </span>
    );
  if (list.receipt_state === "ATTACHED")
    return <span className="badge b-blue num">{receipt?.total != null ? formatEuro(Number(receipt.total)) : t("trip.receipt")}</span>;
  if (list.receipt_state === "LATER") return <span className="badge b-orange">{t("trip.completeReceipt")}</span>;
  return <span className="badge b-gray">{t("ls.noReceipt")}</span>;
}

/**
 * ADD_RECEIPT – doklad k nákupu: odfotiť, z galérie, PDF alebo „Nemám doklad“.
 * Doklad sa nahrá rovno odtiaľto, priradí k nákupu a prečíta na serveri; panel sa hneď zavrie.
 */
export function AddReceiptSheet({ list, onClose }: { list: ShoppingList | null; onClose: () => void }) {
  const { household } = useHousehold();
  const toast = useToast();
  const setLater = useSetReceiptLater(household.id);
  const upload = useUploadTripReceipt(household.id);
  const stats = useListStats(household.id);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PAGES);
    e.target.value = "";
    if (!list || files.length === 0) return;
    const name = list.name;
    onClose();
    toast.show(t("ls.receiptReading"));
    // Viac fotiek z galérie = strany jedného dlhého dokladu.
    upload.mutate(
      { listId: list.id, files },
      {
        onSuccess: (outcome) => {
          if (outcome === "OK") toast.show(t("ls.receiptRead", { name }), "success");
          else if (outcome === "NEEDS_REVIEW") toast.show(t("ls.receiptReview", { name }), "info");
          else if (outcome === "DUPLICATE") toast.show(t("ls.receiptDuplicate"), "info");
          else if (outcome === "FAILED" || outcome === "NOT_A_RECEIPT") toast.show(t("ls.receiptFailed"), "error");
        },
        onError: (err) => toast.show(readErrorMessage(err), "error"),
      },
    );
  }

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
  const bought = list ? stats.data?.get(list.id)?.bought : undefined;
  return (
    <>
      <BottomSheet open={!!list} onClose={onClose} label={t("ls.receiptForTrip")}>
        {list && (
          <>
            <SheetHeader
              title={t("ls.receiptForTrip")}
              sub={[list.name, dayLabel(list.completed_at ?? list.created_at), bought != null ? tn("shop.itemCount", bought) : ""].filter(Boolean).join(" · ")}
              onClose={onClose}
            />
            <div className="sheet-body stack g-12">
              <span className="t-sm t-2">{t("ls.receiptWhy")}</span>
              <button type="button" className="btn btn-ink btn-lg btn-block" onClick={() => camera.current?.click()}>
                <Camera size={18} />
                {t("ls.takePhoto")}
              </button>
              <div className="row g-8">
                <button type="button" className="btn btn-line grow" onClick={() => gallery.current?.click()}>
                  <Image size={17} />
                  {t("ls.fromGallery")}
                </button>
                <button type="button" className="btn btn-line grow" onClick={() => pdf.current?.click()}>
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
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={onPick} />
      <input ref={pdf} type="file" accept="application/pdf" hidden onChange={onPick} />
    </>
  );
}
