import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, ChevronRight, FileText, Loader2, Merge, X } from "lucide-react";
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Group,
  IconButton,
  PageHeader,
  Section,
  Sheet,
  Spinner,
  cx,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  extractReceipt,
  isGlobalFailure,
  isNotAReceipt,
  isNotAReceiptError,
  isReceiptPdf,
  MAX_PAGES,
  uploadReceipt,
  useMergeReceipts,
  useReceiptImage,
  useReceipts,
  type Receipt,
  type UploadOutcome,
} from "./api";
import { failureText, formatDate, formatMoney, monthLabel, readErrorMessage } from "./format";

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
  // Vybrané súbory čakajúce na rozhodnutie: samostatné doklady, alebo strany jedného dokladu.
  const [pending, setPending] = useState<File[] | null>(null);
  const [mode, setMode] = useState<"separate" | "one">("separate");
  // Režim spájania dokladov: poradie klepnutí = poradie strán.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const merge = useMergeReceipts();

  const running = progress !== null && !progress.stopped && progress.done < progress.total;

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (pending) {
      setPending([...pending, ...files]); // "Pridať ďalšie súbory" v okne
    } else if (files.length === 1) {
      void processGroups([files]);
    } else {
      setMode("separate");
      setPending(files);
    }
  }

  function startPending() {
    if (!pending) return;
    const groups = mode === "one" ? [pending] : pending.map((f) => [f]);
    setPending(null);
    void processGroups(groups);
  }

  /** Doklady nahrávame po jednom: server číta jeden naraz a nepreťažíme limity služby. */
  async function processGroups(groups: File[][]) {
    const state: Progress = { total: groups.length, done: 0, counts: { ...EMPTY_COUNTS } };
    setProgress({ ...state, counts: { ...state.counts } });
    let lastError: unknown = null;
    let streak = 0;
    for (const group of groups) {
      try {
        const outcome = await uploadReceipt(household.id, group);
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
    if (lastError && !state.stopReason) toast.show(readErrorMessage(lastError), "error");
  }

  function cancelSelect() {
    setSelecting(false);
    setPicked([]);
  }

  function toggle(id: string) {
    if (picked.includes(id)) return setPicked(picked.filter((x) => x !== id));
    if (picked.length >= MAX_PAGES) return toast.show(`Spojiť sa dá najviac ${MAX_PAGES} dokladov naraz.`, "error");
    setPicked([...picked, id]);
  }

  async function doMerge() {
    const text = `Spojiť ${picked.length} dokladov do jedného? Prvý vybraný zostane a ostatné sa doň pridajú ako ďalšie strany (ich fotky sa zachovajú). Spojený doklad sa potom prečíta znova.`;
    if (!window.confirm(text)) return;
    try {
      await merge.mutateAsync(picked);
      toast.show("Doklady sú spojené a znova prečítané", "success");
      cancelSelect();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
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
          <div className="flex shrink-0 gap-2">
            {selecting ? (
              <Button variant="secondary" onClick={cancelSelect}>
                Zrušiť
              </Button>
            ) : (
              <>
                {all.length >= 2 && (
                  <Button variant="secondary" onClick={() => setSelecting(true)} disabled={running}>
                    <Merge className="size-5" aria-hidden /> Spojiť
                  </Button>
                )}
                <Button onClick={() => input.current?.click()} disabled={running}>
                  <Camera className="size-5" aria-hidden /> Pridať
                </Button>
              </>
            )}
            <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={onPick} />
          </div>
        }
      />

      <div className="flex flex-col gap-4 pb-8">
        {progress && <UploadProgress progress={progress} running={running} onClose={() => setProgress(null)} />}

        {selecting && (
          <div className="sticky top-0 z-20 px-4">
            <div className="rounded-[var(--radius-surface)] bg-elevated p-3.5 shadow-md">
              <p className="text-sm font-semibold">Spojenie dokladov</p>
              <p className="mt-0.5 text-sm text-text-2">
                Klepni na doklady, ktoré tvoria jeden doklad (napr. dve polovice faktúry). Prvý vybraný zostane, ostatné sa doň
                pridajú ako ďalšie strany.
              </p>
              <Button
                className="mt-2"
                block
                disabled={picked.length < 2}
                loading={merge.isPending}
                onClick={doMerge}
              >
                {picked.length < 2 ? "Vyber aspoň 2 doklady" : `Spojiť vybrané (${picked.length})`}
              </Button>
            </div>
          </div>
        )}

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
                  <ReceiptRow
                    key={r.id}
                    receipt={r}
                    selecting={selecting}
                    order={picked.indexOf(r.id)}
                    onToggle={() => toggle(r.id)}
                  />
                ))}
              </Group>
            </Section>
          ))
        )}
      </div>

      <PendingSheet
        files={pending}
        mode={mode}
        onMode={setMode}
        onAddMore={() => input.current?.click()}
        onRemove={(i) => {
          const rest = (pending ?? []).filter((_, idx) => idx !== i);
          setPending(rest.length > 0 ? rest : null);
        }}
        onStart={startPending}
        onClose={() => setPending(null)}
      />
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

function ReceiptRow({
  receipt: r,
  selecting,
  order,
  onToggle,
}: {
  receipt: Receipt;
  selecting: boolean;
  /** Poradie vo výbere na spojenie (-1 = nevybraný). */
  order: number;
  onToggle: () => void;
}) {
  const stale = isStale(r);
  const body = (
    <>
      {selecting && <Thumb receipt={r} />}
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
    </>
  );
  if (selecting) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={order >= 0}
        className={cx(
          "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed",
          order >= 0 && "bg-primary/10",
        )}
      >
        {body}
        <span
          aria-hidden
          className={cx(
            "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
            order >= 0 ? "border-primary bg-primary text-on-primary" : "border-line-strong/60 text-transparent",
          )}
        >
          {order >= 0 ? order + 1 : "·"}
        </span>
      </button>
    );
  }
  return (
    <Link to={`/receipts/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pressed">
      {body}
      <ChevronRight className="size-5 text-text-3" aria-hidden />
    </Link>
  );
}

/** Malý náhľad prvej strany – v režime spájania, aby bolo vidno, ktoré doklady patria k sebe. */
function Thumb({ receipt }: { receipt: Receipt }) {
  const pdf = isReceiptPdf(receipt);
  const image = useReceiptImage(pdf ? undefined : receipt.image_path);
  return (
    <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-text-3">
      {pdf ? (
        <FileText className="size-6" aria-hidden />
      ) : image.data ? (
        <img src={image.data} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" />
      ) : null}
    </div>
  );
}

/** Okno po výbere viacerých súborov: sú to samostatné doklady, alebo strany jedného dokladu? */
function PendingSheet({
  files,
  mode,
  onMode,
  onAddMore,
  onRemove,
  onStart,
  onClose,
}: {
  files: File[] | null;
  mode: "separate" | "one";
  onMode: (m: "separate" | "one") => void;
  onAddMore: () => void;
  onRemove: (index: number) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const list = files ?? [];
  const urls = useMemo(
    () => list.map((f) => (f.type.startsWith("image/") && !/hei[cf]/i.test(f.type) ? URL.createObjectURL(f) : null)),
    [files], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);
  const tooMany = mode === "one" && list.length > MAX_PAGES;
  const option = (value: "separate" | "one", title: string, hint: string) => (
    <button
      type="button"
      onClick={() => onMode(value)}
      aria-pressed={mode === value}
      className={cx(
        "rounded-[var(--radius-control)] border-2 p-3 text-left",
        mode === value ? "border-primary bg-primary/10" : "border-line-strong/40 bg-surface",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-text-2">{hint}</p>
    </button>
  );
  return (
    <Sheet open={files !== null} onClose={onClose} title={`Pridať ${list.length} súborov`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {option("separate", "Každý súbor je samostatný doklad", `Vznikne ${list.length} dokladov.`)}
          {option(
            "one",
            "Všetky súbory sú jeden doklad",
            "Napr. dlhý bloček alebo faktúra na viacerých fotkách či stranách. Prečítajú sa spolu.",
          )}
        </div>
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Vybrané súbory">
          {list.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative shrink-0">
              <div className="flex h-24 w-16 items-center justify-center overflow-hidden rounded-md bg-surface text-text-3">
                {urls[i] ? (
                  <img src={urls[i]!} alt={f.name} className="size-full object-cover object-top" />
                ) : (
                  <FileText className="size-6" aria-hidden />
                )}
              </div>
              {mode === "one" && (
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-xs font-bold text-white">{i + 1}</span>
              )}
              <IconButton
                label={`Odstrániť ${f.name}`}
                onClick={() => onRemove(i)}
                className="absolute -right-2 -top-2 size-7 bg-elevated shadow"
              >
                <X className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
        {tooMany && <p className="text-sm text-danger">Jeden doklad môže mať najviac {MAX_PAGES} strán.</p>}
        <div className="flex flex-col gap-2">
          <Button size="lg" block disabled={list.length === 0 || tooMany} onClick={onStart}>
            {mode === "one" ? "Pridať ako 1 doklad" : `Pridať ${list.length} dokladov`}
          </Button>
          <Button variant="secondary" block onClick={onAddMore}>
            Pridať ďalšie súbory
          </Button>
        </div>
      </div>
    </Sheet>
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
              : `Hotovo: ${progress.total} ${progress.total === 1 ? "doklad" : progress.total < 5 ? "doklady" : "dokladov"}`
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
