import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronRight, FileText, Link2, Merge, Plus, ReceiptText as ReceiptIcon, Search, Trash2, X } from "lucide-react";
import { ErrorState, Spinner, cx } from "@/components/ui";
import { ConfirmDialog, Empty } from "@/components/kit";
import { AnalyticsTop } from "@/features/analytics/akit";
import { usePeriod } from "@/features/analytics/period";
import { AddReceiptSheet } from "@/features/lists/HistoryPage";
import { useToast } from "@/components/toast";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists, type ShoppingList } from "@/features/lists/api";
import { dayLabel } from "@/features/lists/dates";
import { MAX_PAGES, isStale, needsAttention, useDeleteReceipt, useMatchSuggestions, useMergeReceipts, useReceiptItemIndex, useReceipts, type Receipt } from "./api";
import { AddMenu, ManualExpenseSheet, PendingSheet, type Pending, type PendingMode } from "./AddFlow";
import { AttentionRow, ReceiptRow } from "./ReceiptRow";
import { Dock, UploadStatus } from "./UploadStatus";
import { useBatch } from "./useBatch";
import { formatDate, formatMoney, monthLabel, readErrorMessage } from "./format";

type Filter = "all" | "review" | "ok";
const INBOX_PREVIEW = 4;

export function ReceiptsPage() {
  const { household } = useHousehold();
  const receipts = useReceipts(household.id);
  const itemIndex = useReceiptItemIndex(household.id);
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
  const [addingFor, setAddingFor] = useState<ShoppingList | null>(null);
  const { period } = usePeriod();
  const suggest = useMatchSuggestions(household.id);
  // Výber dokladov (podržanie riadku alebo tlačidlo "Vybrať"): poradie klepnutí = poradie strán pri spájaní.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // Potvrdenie v strede obrazovky (prototyp) pred spojením alebo zmazaním vybraných dokladov.
  const [ask, setAsk] = useState<"merge" | "delete" | null>(null);

  const all = receipts.data ?? [];
  const attention = all.filter(needsAttention);
  const failedCount = attention.filter((r) => r.status === "FAILED" || isStale(r)).length;
  const searching = query.trim() !== "";
  const flat = filter !== "all" || searching;

  const needle = normalizeName(query);
  const index = itemIndex.data;
  const visible = useMemo(() => {
    return all.filter((r) => {
      if (filter === "review" && !needsAttention(r)) return false;
      if (filter === "ok" && r.status !== "OK") return false;
      if (!needle) return true;
      const hay = normalizeName(`${r.store_name ?? ""} ${formatDate(r.purchased_on)} ${r.total ?? ""}`);
      // Hľadá sa aj v položkách dokladu (prototyp: „Hľadať obchod alebo položku“).
      return hay.includes(needle) || !!index?.get(r.id)?.names.some((n) => normalizeName(n).includes(needle));
    });
  }, [all, filter, needle, index]);
  // Pri hľadaní podľa položky ukážeme v riadku, ktorá položka sa našla.
  const hintFor = (r: Receipt) => {
    if (!needle || normalizeName(r.store_name ?? "").includes(needle)) return undefined;
    return index?.get(r.id)?.names.find((n) => normalizeName(n).includes(needle));
  };

  const inPeriod = (r: Receipt) => {
    const d = r.purchased_on ?? r.created_at.slice(0, 10);
    return d >= period.from && d <= period.to;
  };
  // Doklad na kontrolu je v „Na vybavenie“ aj vo svojom mesiaci (prototyp).
  const listed = visible.filter((r) => (flat ? true : inPeriod(r)));
  const groups = groupByMonth(listed);
  const missing = (lists.data ?? []).filter((l) => l.completed_at && l.receipt_state === "LATER");
  const suggestions = (suggest.data ?? []).filter((m) => all.some((r) => r.id === m.receipt_id));
  const todo = missing.length + suggestions.length + attention.length;

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

  function doMerge() {
    if (picked.length > MAX_PAGES) return toast.show(t("rpage.mergeMax", { max: MAX_PAGES }), "error");
    setAsk("merge");
  }

  async function runMerge() {
    try {
      await merge.mutateAsync(picked);
      toast.show(t("rpage.merged"), "success");
      cancelSelect();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  async function runDelete() {
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

  const busy = batch.running || merge.isPending || remove.isPending;

  const row = (r: Receipt) => (
    <ReceiptRow
      key={r.id}
      receipt={r}
      selecting={selecting}
      order={picked.indexOf(r.id)}
      onToggle={() => toggle(r.id)}
      onLongPress={() => startSelecting(r.id)}
      itemCount={index?.get(r.id)?.count}
      hint={hintFor(r)}
    />
  );

  return (
    <div className="stack">
      <AnalyticsTop
        part="receipts"
        right={
          selecting ? (
            <button type="button" className="hdr-btn" onClick={cancelSelect}>
              {t("common.cancel")}
            </button>
          ) : all.length >= 2 ? (
            <button type="button" className="hdr-btn" onClick={() => startSelecting()} disabled={busy}>
              {t("rpage.select")}
            </button>
          ) : undefined
        }
      />
      <div className="stack g-16" style={{ padding: "8px 16px 0" }}>
        {attachList && (
          <div role="status" className="row g-10 anim-rise" style={{ padding: "10px 12px", borderRadius: 14, background: "var(--blue-soft)" }}>
            <span className="cat-ic sm" style={{ color: "var(--blue)" }}>
              <Link2 size={16} />
            </span>
            <span className="grow stack g-2">
              <span className="t-sm fw-6">{t("trip.attachTitle", { name: attachList.name })}</span>
              <span className="t-xs t-2">
                {attachList.completed_at ? t("trip.attachDone", { day: dayLabel(attachList.completed_at) }) : t("trip.attachOpen")} · {t("trip.attachNext")}
              </span>
            </span>
            <button type="button" className="ibtn sm" aria-label={t("trip.detach")} onClick={() => setAttachListId(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {receipts.isPending ? (
          <Spinner />
        ) : receipts.isError ? (
          <ErrorState error={errorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
        ) : (
          <>
            {todo > 0 && !selecting && (
              <section className="stack g-8">
                <span className="section-title">{t("an.todoCount", { n: todo })}</span>
                <div className="cells">
                  {missing.map((l) => (
                    <button key={l.id} type="button" className="cell" onClick={() => setAddingFor(l)}>
                      <span className="cat-ic sm" style={{ color: "var(--orange)" }}>
                        <ReceiptIcon size={16} />
                      </span>
                      <span className="grow stack g-2">
                        <span className="t-body fw-5">{t("rpage.missingTrip", { name: l.name, day: dayLabel(l.completed_at!) })}</span>
                        <span className="t-xs t-2">{t("rpage.missingHint")}</span>
                      </span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  ))}
                  {suggestions.map((m) => {
                    const r = all.find((x) => x.id === m.receipt_id)!;
                    const l = lists.data?.find((x) => x.id === m.list_id);
                    return (
                      <button key={m.receipt_id} type="button" className="cell" onClick={() => navigate(`/receipts/${m.receipt_id}/match`)}>
                        <span className="cat-ic sm" style={{ color: "var(--blue)" }}>
                          <Link2 size={16} />
                        </span>
                        <span className="grow stack g-2">
                          <span className="t-body fw-5">{t("rpage.belongs", { store: r.store_name ?? t("row.receipt"), day: dayLabel(r.purchased_on ?? r.created_at) })}</span>
                          <span className="t-xs t-2 num">
                            {t("rpage.matchLine", { pct: Math.round(m.score * 100), name: l?.name ?? "", day: l?.completed_at ? dayLabel(l.completed_at) : "" })}
                          </span>
                        </span>
                        <ChevronRight size={18} className="chev" />
                      </button>
                    );
                  })}
                  {(inboxOpen ? attention : attention.slice(0, INBOX_PREVIEW)).map((r) => (
                    <AttentionRow key={r.id} receipt={r} />
                  ))}
                </div>
                <div className="row wrap g-8">
                  {attention.length > INBOX_PREVIEW && (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => setInboxOpen((v) => !v)}>
                      {inboxOpen ? t("rpage.collapse") : t("rpage.showAll", { n: attention.length })}
                    </button>
                  )}
                  {failedCount > 0 && (
                    <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => void batch.retry(all)}>
                      {t("rpage.retryFailed", { n: failedCount })}
                    </button>
                  )}
                </div>
              </section>
            )}

            <div className="row g-8 input" style={{ paddingRight: 6 }}>
              <Search size={18} color="var(--text-3)" />
              <input
                className="grow"
                style={{ minHeight: 44, fontSize: 16 }}
                placeholder={t("rpage.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t("rpage.searchAria")}
              />
              {query && (
                <button type="button" className="ibtn sm" onClick={() => setQuery("")} aria-label={t("an.clear")}>
                  <X size={16} />
                </button>
              )}
            </div>

            {(attention.length > 0 || filter !== "all") && (
              <div className="row wrap g-8" role="group" aria-label={t("rpage.filterAria")}>
                <button type="button" className={cx("chip", filter === "all" && "on")} onClick={() => setFilter("all")}>
                  {t("rpage.filterAll")}
                </button>
                <button type="button" className={cx("chip", filter === "review" && "on")} onClick={() => setFilter("review")}>
                  {t("rpage.filterReview", { n: attention.length })}
                </button>
                <button type="button" className={cx("chip", filter === "ok" && "on")} onClick={() => setFilter("ok")}>
                  {t("rpage.filterOk")}
                </button>
              </div>
            )}

            {groups.map(([label, list]) => (
              <section key={label} className="stack g-8">
                <div className="section-head">
                  <span className="section-title first-letter:uppercase">{label}</span>
                  <span className="t-xs t-2 num">
                    {list.length} · {formatMoney(list.reduce((a, r) => a + (r.total ?? 0), 0))}
                  </span>
                </div>
                <div className="cells">{list.map((r) => row(r))}</div>
              </section>
            ))}
            {!groups.length && (
              <Empty
                icon={FileText}
                title={searching ? t("rpage.nothingFound") : all.length ? t("rpage.nothingHere") : t("rpage.emptyTitle")}
                text={searching ? t("an.tryOther") : all.length ? t("an.noReceiptsInPeriod") : t("rpage.emptyText")}
              />
            )}
          </>
        )}
      </div>
      <div className="tab-space" />
      <div style={{ height: 60 }} />

      <Dock>
        {batch.progress && <UploadStatus progress={batch.progress} running={batch.running} onClose={batch.close} />}
        {selecting ? (
          <div className="card stack g-8" style={{ padding: 12, width: "100%", boxShadow: "var(--sh-2)" }}>
            <span className="t-sm t-2" style={{ padding: "0 4px" }}>
              {picked.length === 0 ? t("rpage.selectHint") : t("rpage.selected", { n: picked.length })}
            </span>
            <div className="row g-8">
              <button type="button" className="btn btn-ink grow" disabled={picked.length < 2 || busy} onClick={doMerge}>
                <Merge size={18} /> {t("rpage.merge")}
              </button>
              <button type="button" className="btn btn-danger" disabled={picked.length < 1 || busy} onClick={() => setAsk("delete")}>
                <Trash2 size={18} /> {t("common.delete")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="fab" style={{ position: "static" }} onClick={() => setMenuOpen(true)} disabled={batch.running}>
            <Plus size={20} />
            {t("rpage.add")}
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
      <ConfirmDialog
        open={ask !== null}
        title={ask === "merge" ? t("rpage.mergeTitle") : t("rpage.deleteTitle")}
        body={ask === "merge" ? t("rpage.mergeConfirm", { n: picked.length }) : tn("rpage.deleteConfirm", picked.length)}
        confirmLabel={ask === "merge" ? t("rpage.merge") : t("common.delete")}
        danger={ask === "delete"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          const what = ask;
          setAsk(null);
          void (what === "merge" ? runMerge() : runDelete());
        }}
      />
      <AddReceiptSheet
        list={addingFor}
        onClose={() => setAddingFor(null)}
      />
    </div>
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
