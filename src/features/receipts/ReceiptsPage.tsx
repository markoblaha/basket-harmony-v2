import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronRight, Link2, Merge, Plus, Receipt as ReceiptIcon, Search, Trash2, X } from "lucide-react";
import { Button, EmptyState, ErrorState, Group, PageHeader, Section, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { dayLabel } from "@/features/lists/dates";
import { MAX_PAGES, isStale, needsAttention, useDeleteReceipt, useMergeReceipts, useReceipts, type Receipt } from "./api";
import { AddMenu, ManualExpenseSheet, PendingSheet, type Pending, type PendingMode } from "./AddFlow";
import { ReceiptRow } from "./ReceiptRow";
import { Dock, UploadStatus } from "./UploadStatus";
import { useBatch } from "./useBatch";
import { formatDate, formatMoney, monthLabel, readErrorMessage } from "./format";

type Filter = "all" | "review" | "ok";
const INBOX_PREVIEW = 4;

export function ReceiptsPage() {
  const { household } = useHousehold();
  const receipts = useReceipts(household.id);
  const toast = useToast();
  // Doklad k nákupu (?nakup=<id> z obrazovky „Nákup dokončený“ alebo z Histórie nákupov).
  const [params, setParams] = useSearchParams();
  const [attachListId, setAttachListId] = useState<string | null>(() => params.get("nakup"));
  const lists = useLists(household.id);
  const attachList = lists.data?.find((l) => l.id === attachListId);
  const batch = useBatch(household.id, attachListId, () => {
    toast.show(t("trip.attached", { name: attachList?.name ?? "" }).trim(), "success");
    setAttachListId(null);
  });
  const merge = useMergeReceipts();
  const remove = useDeleteReceipt();

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Príchod z obrazovky „Nákup dokončený“ (?pridat=1) rovno otvorí ponuku na pridanie bločku.
  const [menuOpen, setMenuOpen] = useState(() => params.get("pridat") === "1");
  useEffect(() => {
    if (params.get("pridat") || params.get("nakup")) setParams({}, { replace: true });
  }, [params, setParams]);
  const [manualOpen, setManualOpen] = useState(false);
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<PendingMode>("separate");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [inboxOpen, setInboxOpen] = useState(false);
  // Výber dokladov (podržanie riadku alebo tlačidlo "Vybrať"): poradie klepnutí = poradie strán pri spájaní.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const all = receipts.data ?? [];
  const attention = all.filter(needsAttention);
  const failedCount = attention.filter((r) => r.status === "FAILED" || isStale(r)).length;
  const searching = query.trim() !== "";
  const flat = filter !== "all" || searching;

  const visible = useMemo(() => {
    const needle = normalizeName(query);
    return all.filter((r) => {
      if (filter === "review" && !needsAttention(r)) return false;
      if (filter === "ok" && r.status !== "OK") return false;
      if (!needle) return true;
      const hay = normalizeName(`${r.store_name ?? ""} ${formatDate(r.purchased_on)} ${r.total ?? ""}`);
      return hay.includes(needle);
    });
  }, [all, filter, query]);

  const listed = flat ? visible : all.filter((r) => !needsAttention(r));
  const groups = groupByMonth(listed);
  const month = useMemo(() => monthSummary(all), [all]);

  // ------------------------------------------------------------ pridávanie
  function onPickCamera(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPending((p) => ({ kind: "camera", files: p?.kind === "camera" ? [...p.files, ...files] : files }));
  }

  function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (pending?.kind === "files") {
      setPending({ kind: "files", files: [...pending.files, ...files] });
    } else if (files.length === 1) {
      void batch.processGroups([files]);
    } else {
      setMode("separate");
      setPending({ kind: "files", files });
    }
  }

  function startPending() {
    if (!pending) return;
    const one = pending.kind === "camera" || mode === "one";
    const groups = one ? [pending.files] : pending.files.map((f) => [f]);
    setPending(null);
    void batch.processGroups(groups);
  }

  // ------------------------------------------------------------ výber
  function startSelecting(id?: string) {
    setSelecting(true);
    setPicked(id ? [id] : []);
  }

  function cancelSelect() {
    setSelecting(false);
    setPicked([]);
  }

  function toggle(id: string) {
    if (picked.includes(id)) return setPicked(picked.filter((x) => x !== id));
    setPicked([...picked, id]);
  }

  async function doMerge() {
    if (picked.length > MAX_PAGES) return toast.show(t("rpage.mergeMax", { max: MAX_PAGES }), "error");
    const text = t("rpage.mergeConfirm", { n: picked.length });
    if (!window.confirm(text)) return;
    try {
      await merge.mutateAsync(picked);
      toast.show(t("rpage.merged"), "success");
      cancelSelect();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  async function doDelete() {
    const text = tn("rpage.deleteConfirm", picked.length);
    if (!window.confirm(text)) return;
    let failed = 0;
    for (const id of picked) {
      const receipt = all.find((r) => r.id === id);
      if (!receipt) continue;
      try {
        await remove.mutateAsync(receipt);
      } catch {
        failed++;
      }
    }
    if (failed > 0) toast.show(t("rpage.deleteFailed", { n: failed }), "error");
    else toast.show(t("rpage.deleted"), "success");
    cancelSelect();
  }

  const inbox = !flat && attention.length > 0 ? (inboxOpen ? attention : attention.slice(0, INBOX_PREVIEW)) : [];
  const busy = batch.running || merge.isPending || remove.isPending;

  const row = (r: Receipt, isAttention = false) => (
    <ReceiptRow
      key={r.id}
      receipt={r}
      selecting={selecting}
      order={picked.indexOf(r.id)}
      attention={isAttention}
      onToggle={() => toggle(r.id)}
      onLongPress={() => startSelecting(r.id)}
    />
  );

  return (
    <>
      <PageHeader
        title={t("nav.receipts")}
        subtitle={all.length > 0 ? tn("rpage.subtitle", all.length) : undefined}
        trailing={
          selecting ? (
            <Button variant="ghost" onClick={cancelSelect}>
              {t("common.cancel")}
            </Button>
          ) : all.length >= 2 ? (
            <Button variant="ghost" onClick={() => startSelecting()} disabled={busy}>
              {t("rpage.select")}
            </Button>
          ) : undefined
        }
      />
      {attachList && (
        <div role="status" className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-primary-soft p-3 animate-rise">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-hidden>
            <Link2 className="size-[1.125rem]" />
          </span>
          <p className="min-w-0 flex-1 text-footnote text-text-2">
            <b className="block text-callout font-strong text-text">{t("trip.attachTitle", { name: attachList.name })}</b>
            {attachList.completed_at ? t("trip.attachDone", { day: dayLabel(attachList.completed_at) }) : t("trip.attachOpen")} · {t("trip.attachNext")}
          </p>
          <button type="button" aria-label={t("trip.detach")} onClick={() => setAttachListId(null)} className="grid size-11 shrink-0 place-items-center rounded-lg text-text-2 active:bg-pressed">
            <X className="size-[1.125rem]" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 pb-40">
        {receipts.isPending ? (
          <Spinner />
        ) : receipts.isError ? (
          <ErrorState error={errorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState icon={<ReceiptIcon />} title={t("rpage.emptyTitle")}>
            {t("rpage.emptyText")}
          </EmptyState>
        ) : (
          <>
            {month && !selecting && (
              <Section>
                <Link
                  to="/analytics"
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-surface)] bg-surface p-4 shadow-card active:bg-pressed"
                >
                  <div>
                    <p className="text-overline font-semibold uppercase text-text-2">{month.label}</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(month.total)}</p>
                    <p className="text-sm text-text-2">
                      {tn("rpage.purchases", month.count)}
                    </p>
                  </div>
                  <span className="flex min-h-11 items-center gap-0.5 text-sm font-strong text-primary">
                    {t("nav.analytics")} <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </Section>
            )}

            {all.length >= 5 && (
              <Section>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("rpage.searchPlaceholder")}
                    aria-label={t("rpage.searchAria")}
                    className="min-h-12 w-full rounded-[var(--radius-control)] border border-transparent bg-sunken pl-10 pr-4 text-base outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-3 focus:border-primary focus:bg-elevated focus:ring-3 focus:ring-primary/20"
                  />
                </div>
              </Section>
            )}

            {(attention.length > 0 || filter !== "all") && (
              <Section>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("rpage.filterAria")}>
                  <Chip active={filter === "all"} onClick={() => setFilter("all")}>
                    {t("rpage.filterAll")}
                  </Chip>
                  <Chip active={filter === "review"} onClick={() => setFilter("review")}>
                    {t("rpage.filterReview", { n: attention.length })}
                  </Chip>
                  <Chip active={filter === "ok"} onClick={() => setFilter("ok")}>
                    {t("rpage.filterOk")}
                  </Chip>
                </div>
              </Section>
            )}

            {inbox.length > 0 && (
              <Section title={t("rpage.inbox", { n: attention.length })}>
                <Group>{inbox.map((r) => row(r, true))}</Group>
                <div className="mt-2 flex flex-wrap gap-2">
                  {attention.length > INBOX_PREVIEW && (
                    <Button variant="secondary" onClick={() => setInboxOpen((v) => !v)}>
                      {inboxOpen ? t("rpage.collapse") : t("rpage.showAll", { n: attention.length })}
                    </Button>
                  )}
                  {failedCount > 0 && (
                    <Button variant="secondary" loading={batch.running} disabled={busy} onClick={() => void batch.retry(all)}>
                      {t("rpage.retryFailed", { n: failedCount })}
                    </Button>
                  )}
                </div>
              </Section>
            )}

            {flat && filter === "review" && failedCount > 0 && (
              <Section>
                <Button variant="secondary" loading={batch.running} disabled={busy} onClick={() => void batch.retry(all)}>
                  {t("rpage.retryFailed", { n: failedCount })}
                </Button>
              </Section>
            )}

            {listed.length === 0 && flat ? (
              <p className="px-6 py-10 text-center text-text-2">
                {searching ? t("rpage.nothingFound") : filter === "review" ? t("rpage.nothingToReview") : t("rpage.nothingHere")}
              </p>
            ) : (
              groups.map(([label, list]) => (
                <Section key={label} title={label}>
                  <Group>{list.map((r) => row(r))}</Group>
                </Section>
              ))
            )}
          </>
        )}
      </div>

      <Dock>
        {batch.progress && <UploadStatus progress={batch.progress} running={batch.running} onClose={batch.close} />}
        {selecting ? (
          <div className="w-full rounded-[var(--radius-surface)] bg-elevated p-3 shadow-raised">
            <p className="px-1 text-sm text-text-2">
              {picked.length === 0
                ? t("rpage.selectHint")
                : t("rpage.selected", { n: picked.length })}
            </p>
            <div className="mt-2 flex gap-2">
              <Button block disabled={picked.length < 2 || busy} loading={merge.isPending} onClick={doMerge}>
                <Merge className="size-5" aria-hidden /> {t("rpage.merge")}
              </Button>
              <Button variant="danger" disabled={picked.length < 1 || busy} loading={remove.isPending} onClick={doDelete}>
                <Trash2 className="size-5" aria-hidden /> {t("common.delete")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            disabled={batch.running}
            className="flex h-14 items-center gap-2 rounded-full bg-primary px-6 text-base font-strong text-on-primary shadow-raised transition-[transform,background-color] active:scale-[0.98] active:bg-primary-pressed disabled:opacity-55"
          >
            <Plus className="size-6" aria-hidden /> {t("rpage.add")}
          </button>
        )}
      </Dock>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPickCamera} />
      <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
      <input ref={fileInput} type="file" accept="application/pdf,image/*" multiple hidden onChange={onPickFiles} />

      <AddMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCamera={() => cameraInput.current?.click()}
        onGallery={() => galleryInput.current?.click()}
        onFile={() => fileInput.current?.click()}
        onStatement={() => navigate("/receipts/statement")}
        onManual={() => setManualOpen(true)}
      />
      <ManualExpenseSheet open={manualOpen} onClose={() => setManualOpen(false)} householdId={household.id} />
      <PendingSheet
        pending={pending}
        mode={mode}
        onMode={setMode}
        onAddMore={() => (pending?.kind === "camera" ? cameraInput : galleryInput).current?.click()}
        onRemove={(i) => {
          if (!pending) return;
          const rest = pending.files.filter((_, idx) => idx !== i);
          setPending(rest.length > 0 ? { ...pending, files: rest } : null);
        }}
        onStart={startPending}
        onClose={() => setPending(null)}
      />
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "min-h-11 rounded-full px-4 text-sm font-strong transition-colors duration-[120ms]",
        active ? "bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text-2 active:bg-pressed",
      )}
    >
      {children}
    </button>
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

/** Súčet najnovšieho mesiaca, v ktorom je nejaký prečítaný doklad (zlyhané sa nerátajú). */
function monthSummary(list: Receipt[]): { label: string; total: number; count: number } | null {
  const dated = list.filter((r) => r.purchased_on && r.total != null && (r.status === "OK" || r.status === "NEEDS_REVIEW"));
  if (dated.length === 0) return null;
  const key = dated.map((r) => r.purchased_on!.slice(0, 7)).sort().at(-1)!;
  const inMonth = dated.filter((r) => r.purchased_on!.startsWith(key));
  const nowKey = new Date().toISOString().slice(0, 7);
  return {
    label: key === nowKey ? t("rpage.thisMonth") : monthLabel(`${key}-01`),
    total: inMonth.reduce((sum, r) => sum + (r.total ?? 0), 0),
    count: inMonth.length,
  };
}
