import { useRef, type ChangeEvent } from "react";
import { Ban, Camera, FileText, Image } from "lucide-react";
import { BottomSheet, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { MAX_PAGES } from "@/features/receipts/api";
import { readErrorMessage } from "@/features/receipts/format";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useListStats, useSetReceiptLater, useUploadTripReceipt, type ShoppingList } from "./api";
import { dayLabel } from "./dates";

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
          // Doklad sa číta na pozadí na serveri – appka nečaká (výsledok uvidíš v Dokladoch).
          if (outcome === "QUEUED") toast.show(t("ls.receiptQueued", { name }), "success");
          else toast.show(t("ls.receiptDuplicate"), "info");
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
