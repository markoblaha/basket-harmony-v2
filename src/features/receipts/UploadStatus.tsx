import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { IconButton, cx } from "@/components/ui";
import { t, tn } from "@/i18n";
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
    c.OK > 0 && t("upload.ok", { n: c.OK }),
    c.NEEDS_REVIEW > 0 && t("upload.review", { n: c.NEEDS_REVIEW }),
    c.DUPLICATE > 0 && t("upload.duplicate", { n: c.DUPLICATE }),
    c.NOT_A_RECEIPT > 0 && t("upload.notReceipt", { n: c.NOT_A_RECEIPT }),
    problems > 0 && t("upload.failed", { n: problems }),
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
              ? t("upload.reading", { current: Math.min(progress.done + 1, progress.total), total: progress.total })
              : progress.stopped
                ? t("upload.stoppedAfter", { done: progress.done, total: progress.total })
                : tn("upload.doneCount", progress.total)}
          </p>
          {running && <p className="text-text-2">{t("upload.leaveHint")}</p>}
          {progress.stopped && (
            <p className="mt-0.5 text-text-2">
              {progress.stopReason ?? t("upload.stoppedDefault")} {t("upload.stoppedHelp")}
            </p>
          )}
          {parts.length > 0 && <p className="mt-0.5 text-text-2">{parts.join(" · ")}</p>}
        </div>
        {!running && (
          <IconButton label={t("common.close")} onClick={onClose} className="-mr-2 -mt-2">
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
