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
  isNotAReceipt,
  isNotAReceiptError,
  uploadReceiptFile,
  useReceipts,
  type Receipt,
  type UploadOutcome,
} from "./api";
import { formatDate, formatMoney, monthLabel } from "./format";

type Progress = { total: number; done: number; counts: Record<UploadOutcome | "ERROR", number>; stopped?: boolean };
/**
 * Po tomto počte technických chýb za sebou spracovanie zastavíme – ide takmer iste o rovnakú príčinu
 * (kľúč, kredit, limit). Fotka, na ktorej nie je bloček, je iný prípad: ostatné sa spracujú ďalej.
 */
const STOP_AFTER_FAILURES = 3;
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
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total) state.stopped = true;
      setProgress({ ...state, counts: { ...state.counts } });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      if (state.stopped) break;
    }
    if (lastError) toast.show(errorMessage(lastError), "error");
  }

  /** Znova prečíta všetky bločky, ktoré skončili chybou (fotky už sú nahraté). */
  async function retryFailed() {
    // Najprv tie, ktoré zlyhali technicky (kredit, preťaženie); fotky bez bločku až nakoniec.
    const failed = (receipts.data ?? [])
      .filter((r) => r.status === "FAILED")
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
        }
      }
      state.done++;
      if (streak >= STOP_AFTER_FAILURES && state.done < state.total) state.stopped = true;
      setProgress({ ...state, counts: { ...state.counts } });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      if (state.stopped) break;
    }
  }

  const all = receipts.data ?? [];
  const failedCount = all.filter((r) => r.status === "FAILED").length;
  const reviewCount = all.filter((r) => r.status === "NEEDS_REVIEW" || r.status === "FAILED").length;
  const visible = onlyReview ? all.filter((r) => r.status === "NEEDS_REVIEW" || r.status === "FAILED") : all;
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
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={onPick} />
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
              Súčet položiek nesedí s celkovou sumou alebo sa údaje nepodarilo prečítať.
            </Banner>
          </Section>
        )}

        {receipts.isPending ? (
          <Spinner />
        ) : receipts.isError ? (
          <ErrorState error={errorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState icon="🧾" title="Zatiaľ žiadne bločky">
            Klepni na „Pridať“ a vyber fotky bločkov (aj viac naraz). Umelá inteligencia z nich prečíta obchod, dátum a
            všetky položky s cenami.
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

function groupByMonth(list: Receipt[]): [string, Receipt[]][] {
  const map = new Map<string, Receipt[]>();
  for (const r of list) {
    const label = monthLabel(r.purchased_on);
    map.set(label, [...(map.get(label) ?? []), r]);
  }
  return [...map.entries()];
}

function ReceiptRow({ receipt: r }: { receipt: Receipt }) {
  const stale = r.status === "PROCESSING" && Date.now() - new Date(r.updated_at).getTime() > 3 * 60_000;
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
              : `Hotovo: ${progress.total} fotiek`
        }
        action={!running && <Button variant="secondary" onClick={onClose}>Zavrieť</Button>}
      >
        {progress.stopped && (
          <p className="font-medium">
            Zastavil som spracovanie, lebo {STOP_AFTER_FAILURES} bločky za sebou zlyhali. Zvyšok sa nenahral. Dôvod je v detaile
            bločku (otvor ho v zozname).
          </p>
        )}
        {running ? "Nechaj túto stránku otvorenú, kým sa všetko nespracuje. Jeden bloček trvá niekoľko sekúnd." : null}
        {parts.length > 0 && <p>{parts.join(" · ")}</p>}
        {!running && c.FAILED + c.ERROR > 0 && (
          <p className="mt-1">Nepodarené otvor v zozname (označené červene) a skús čítanie spustiť znova.</p>
        )}
      </Banner>
    </Section>
  );
}
