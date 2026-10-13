import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { IconButton, cx } from "@/components/ui";
import { plural } from "./format";
import type { Progress } from "./useBatch";

/** Pás nad spodnou navigáciou: sem patria plávajúce prvky (priebeh nahrávania, tlačidlo +, lišta výberu). */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto flex max-w-2xl flex-col items-end gap-3 px-4 pb-3 [&>*]:pointer-events-auto">{children}</div>
    </div>
  );
}

/** Kompaktná karta s priebehom. Počas čítania sa dá pokojne odísť inam v aplikácii – nahrávanie beží ďalej. */
export function UploadStatus({ progress, running, onClose }: { progress: Progress; running: boolean; onClose: () => void }) {
  const c = progress.counts;
  const problems = c.FAILED + c.ERROR;
  const parts = [
    c.OK > 0 && `${c.OK} v poriadku`,
    c.NEEDS_REVIEW > 0 && `${c.NEEDS_REVIEW} na kontrolu`,
    c.DUPLICATE > 0 && `${c.DUPLICATE} už bolo (preskočené)`,
    c.NOT_A_RECEIPT > 0 && `${c.NOT_A_RECEIPT} nie je nákupný doklad`,
    problems > 0 && `${problems} sa nepodarilo`,
  ].filter(Boolean);
  const warn = progress.stopped || problems > 0;
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

  return (
    <div
      role="status"
      className={cx(
        "w-full rounded-[var(--radius-surface)] p-3.5 shadow-lg",
        running ? "bg-elevated" : warn ? "bg-warning-soft" : "bg-success-soft",
      )}
    >
      <div className="flex items-start gap-3">
        {running ? (
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
        ) : warn ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {running
              ? `Číta sa ${Math.min(progress.done + 1, progress.total)} z ${progress.total}…`
              : progress.stopped
                ? `Zastavené po ${progress.done} z ${progress.total}`
                : `Hotovo: ${progress.total} ${plural(progress.total, ["doklad", "doklady", "dokladov"])}`}
          </p>
          {running && <p className="text-text-2">Môžeš pokojne odísť inde v aplikácii, ale nezatváraj ju.</p>}
          {progress.stopped && (
            <p className="mt-0.5 text-text-2">
              {progress.stopReason ?? "Spracovanie sa zastavilo."} Už nahraté doklady sú uložené. Po oprave klepni na „Skúsiť znova“
              a nenahraté súbory pridaj znova (už nahraté sa preskočia).
            </p>
          )}
          {parts.length > 0 && <p className="mt-0.5 text-text-2">{parts.join(" · ")}</p>}
        </div>
        {!running && (
          <IconButton label="Zavrieť" onClick={onClose} className="-mr-2 -mt-2">
            <X className="size-5" />
          </IconButton>
        )}
      </div>
      {running && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
      )}
    </div>
  );
}
