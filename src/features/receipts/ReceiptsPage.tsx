import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, ChevronRight, Loader2 } from "lucide-react";
import { Banner, Button, EmptyState, ErrorState, Group, PageHeader, Section, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  extractReceipt,
  isGlobalFailure,
  isNotAReceipt,
  isNotAReceiptError,
  uploadReceiptFile,
  useReceipts,
  type Receipt,
  type UploadOutcome,
} from "./api";
import { failureText, formatDate, formatMoney, monthLabel } from "./format";

type Progress = {
  total: number;
  done: number;
  counts: Record<UploadOutcome | "ERROR", number>;
  stopped?: boolean;
  /** Prečo sa dávka zastavila (veta pre človeka). */
  stopReason?: string;
};
/**
 * Jeden problémový doklad dávku nezastaví. Zastavíme ju len keď:
 *  - došiel kredit alebo je zlý kľúč (zastaví sa hneď, ďalšie doklady by zlyhali tiež), alebo
 *  - zlyhalo viac technických pokusov za sebou (výpadok služby alebo siete).
 */
const STOP_AFTER_FAILURES = 5;
const EMPTY_COUNTS = { NEW: 0, DUPLICATE: 0, OK: 0, NEEDS_REVIEW: 0, FAILED: 0, NOT_A_RECEIPT: 0, ERROR: 0 };

export function ReceiptsPage() {
  const { household } = useHousehold();
  const receipts = useReceipts(household.id);
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);

  const running = progress !== null && !progress.stopped && progress.done < progress.total;

  /** Fotky nahrávame po jednej: server číta jednu naraz a nepreťažíme limity služby. */
  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const state: Progress = { total: files.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let lastError: unknown = null;
    let streak = 0;
    for (const file of files) {
      try {
        const outcome = await uploadReceiptFile(household.id, file);
        state.counts[outcome]++;
        if (outcome === "FAILED") streak++;
        else if (outcome !== "NOT_A_RECEIPT") streak = 0;
      } catch (err) {
        state.counts.ERROR++;
        lastError = err;
        streak++;
        if (err instanceof Error && isGlobalFailure(err.message)) {
          state.stopped = true;
          state.stopReason = failureText(err.message);
        }
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total && !state.stopped) {
        state.stopped = true;
        state.stopReason = `${STOP_AFTER_FAILURES} dokladov za sebou sa nepodarilo prečítať, takže ide pravdepodobne o výpadok služby. Skús to o chvíľu.`;
      }
      setProgress({ ...state, counts: { ...state.counts } });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      if (state.stopped) break;
    }
    if (lastError && !state.stopReason) toast.show(errorMessage(lastError), "error");
  }

  /** Znova prečíta všetky bločky, ktoré skončili chybou (fotky už sú nahraté). */
  async function retryFailed() {
    // Najprv tie, ktoré zlyhali technicky (kredit, preťaženie); súbory bez dokladu až nakoniec.
    // Zaseknuté (čítanie sa začalo, ale nikdy neskončilo) berieme tiež.
    const failed = (receipts.data ?? [])
      .filter((r) => r.status === "FAILED" || isStale(r))
      .sort((a, b) => Number(isNotAReceipt(a)) - Number(isNotAReceipt(b)));
    if (failed.length === 0) return;
    const state: Progress = { total: failed.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let streak = 0;
    for (const r of failed) {
      try {
        const status = await extractReceipt(r.id);
        state.counts[status]++;
        streak = 0;
      } catch (err) {
        if (isNotAReceiptError(err)) {
          state.counts.NOT_A_RECEIPT++;
        } else {
          state.counts.FAILED++;
          streak++;
          const message = err instanceof Error ? err.message : "";
          if (isGlobalFailure(message)) {
            state.stopped = true;
            state.stopReason = failureText(message);
          }
        }
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total && !state.stopped) {
        state.stopped = true;
        state.stopReason = `${STOP_AFTER_FAILURES} dokladov za sebou sa nepodarilo prečítať, takže ide pravdepodobne o výpadok služby. Skús to o chvíľu.`;
      }
      setProgress({ ...state, counts: { ...state.counts } });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      if (state.stopped) break;
    }
  }

  const all = receipts.data ?? [];
  const failedCount = all.filter((r) => r.status === "FAILED" || isStale(r)).length;
  const needsAttention = (r: Receipt) => r.status === "NEEDS_REVIEW" || r.status === "FAILED" || isStale(r);
  const reviewCount = all.filter(needsAttention).length;
  const visible = onlyReview ? all.filter(needsAttention) : all;
  const groups = groupByMonth(visible);

  return (
    <>
      <PageHeader
        title="Bločky"
        subtitle={all.length > 0 ? `${all.length} v domácnosti` : undefined}
        trailing={
          <>
            <Button onClick={() => input.current?.click()} disabled={running}>
              <Camera className="size-5" aria-hidden /> Pridať
            </Button>
            <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={onPick} />
          </>
        }
      />

      <div className="flex flex-col gap-4 pb-8">
        {progress && <UploadProgress progress={progress} running={running} onClose={() => setProgress(null)} />}

        {reviewCount > 0 && (
          <Section>
            <Banner
              tone={failedCount > 0 ? "danger" : "warning"}
              title={`${reviewCount} ${reviewCount === 1 ? "bloček čaká" : reviewCount < 5 ? "bločky čakajú" : "bločkov čaká"} na kontrolu`}
              action={
                <div className="flex flex-wrap gap-2">
                  {failedCount > 0 && (
                    <Button loading={running} disabled={running} onClick={retryFailed}>
                      Skúsiť znova nepodarené ({failedCount})
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setOnlyReview((v) => !v)}>
                    {onlyReview ? "Ukázať všetky" : "Ukázať len tieto"}
                  </Button>
                </div>
              }
            >
              Súčet položiek nesedí s celkovou sumou, údaje sa nepodarilo prečítať alebo je niečo podozrivé. Otvor doklad a porovnaj s fotkou.
            </Banner>
          </Section>
        )}

        {receipts.isPending ? (
          <Spinner />
        ) : receipts.isError ? (
          <ErrorState error={errorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState icon="🧾" title="Zatiaľ žiadne bločky">
            Klepni na „Pridať“ a vyber fotky bločkov, snímky obrazovky alebo PDF faktúry (aj viac naraz). Umelá inteligencia
            z nich prečíta obchod, dátum a všetky položky s cenami.
          </EmptyState>
        ) : (
          groups.map(([month, list]) => (
            <Section key={month} title={month}>
              <Group>
                {list.map((r) => (
                  <ReceiptRow key={r.id} receipt={r} />
                ))}
              </Group>
            </Section>
          ))
        )}
      </div>
    </>
  );
}

/** Čítanie sa začalo, ale server ho nikdy nedokončil (napr. zavretá aplikácia, výpadok). */
const isStale = (r: Receipt) => r.status === "PROCESSING" && Date.now() - new Date(r.updated_at).getTime() > 3 * 60_000;

function groupByMonth(list: Receipt[]): [string, Receipt[]][] {
  const map = new Map<string, Receipt[]>();
  for (const r of list) {
    const label = monthLabel(r.purchased_on);
    map.set(label, [...(map.get(label) ?? []), r]);
  }
  return [...map.entries()];
}

function ReceiptRow({ receipt: r }: { receipt: Receipt }) {
  const stale = isStale(r);
  return (
    <Link to={`/receipts/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pressed">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{r.store_name ?? (r.status === "PROCESSING" ? "Číta sa…" : "Neznámy obchod")}</p>
        <p className="text-sm text-text-2">
          {formatDate(r.purchased_on)}
          {r.status === "NEEDS_REVIEW" && <span className="ml-2 font-medium text-warning">· skontrolovať</span>}
          {r.status === "FAILED" && (
            <span className="ml-2 font-medium text-danger">· {isNotAReceipt(r) ? "nie je bloček" : "nepodarilo sa"}</span>
          )}
          {stale && <span className="ml-2 font-medium text-warning">· zaseklo sa, otvor a skús znova</span>}
        </p>
      </div>
      {r.status === "PROCESSING" ? (
        <Loader2 className="size-5 animate-spin text-text-3" aria-label="Číta sa" />
      ) : r.status === "OK" ? (
        <span className="font-semibold tabular-nums">{formatMoney(r.total)}</span>
      ) : (
        <>
          <AlertTriangle className={cx("size-5", r.status === "FAILED" ? "text-danger" : "text-warning")} aria-hidden />
          {r.status === "NEEDS_REVIEW" && <span className="font-semibold tabular-nums">{formatMoney(r.total)}</span>}
        </>
      )}
      <ChevronRight className="size-5 text-text-3" aria-hidden />
    </Link>
  );
}

function UploadProgress({ progress, running, onClose }: { progress: Progress; running: boolean; onClose: () => void }) {
  const c = progress.counts;
  const parts = [
    c.OK > 0 && `${c.OK} v poriadku`,
    c.NEEDS_REVIEW > 0 && `${c.NEEDS_REVIEW} na kontrolu`,
    c.DUPLICATE > 0 && `${c.DUPLICATE} už bolo (preskočené)`,
    c.NOT_A_RECEIPT > 0 && `${c.NOT_A_RECEIPT} nie je nákupný doklad`,
    c.FAILED + c.ERROR > 0 && `${c.FAILED + c.ERROR} sa nepodarilo`,
  ].filter(Boolean);
  return (
    <Section>
      <Banner
        tone={running ? "info" : progress.stopped || c.FAILED + c.ERROR > 0 ? "warning" : "success"}
        title={
          running
            ? `Spracúvam ${progress.done + 1} z ${progress.total}…`
            : progress.stopped
              ? `Zastavené po ${progress.done} z ${progress.total}`
              : `Hotovo: ${progress.total} súborov`
        }
        action={!running && <Button variant="secondary" onClick={onClose}>Zavrieť</Button>}
      >
        {progress.stopped && (
          <p className="font-medium">
            {progress.stopReason ?? "Spracovanie sa zastavilo."} Už nahraté doklady sú v poriadku uložené. Po oprave klikni
            na „Skúsiť znova nepodarené“ a nenahraté súbory vyber znova (už nahraté sa preskočia).
          </p>
        )}
        {running ? "Nechaj túto stránku otvorenú, kým sa všetko nespracuje. Jeden bloček trvá niekoľko sekúnd." : null}
        {parts.length > 0 && <p>{parts.join(" · ")}</p>}
        {!running && c.FAILED + c.ERROR > 0 && (
          <p className="mt-1">Nepodarené nájdeš v zozname (označené červene). Dôvod je v detaile dokladu.</p>
        )}
      </Banner>
    </Section>
  );
}
