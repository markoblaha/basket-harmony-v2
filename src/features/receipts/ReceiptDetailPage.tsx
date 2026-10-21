import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, Check, ChevronDown, FileText, Landmark, Link2, Loader2, MoreHorizontal, PenLine, Plus, RefreshCw, Trash2, Unlink } from "lucide-react";
import { BottomSheet, CatIcon, Cell, ConfirmDialog, Empty, ScreenHeader, SheetHeader, StoreBadge } from "@/components/kit";
import { Button, ErrorState, Sheet, Spinner, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { dayLabel } from "@/features/lists/dates";
import { CATEGORIES, category, categoryOrder } from "@/lib/categories";
import { formatNumber, t, tn } from "@/i18n";
import { unitLabel } from "@/lib/parseItem";
import {
  MAX_PAGES,
  useAddReceiptPages,
  useAttachReceipt,
  useConfirmReceipt,
  useDeleteReceipt,
  useMatchCandidates,
  useReceipt,
  useReceiptImage,
  useReceiptPages,
  useRereadReceipt,
  useSaveReceiptItem,
  useUpdateReceipt,
  type Receipt,
  type ReceiptItem,
} from "./api";
import { ImageViewer } from "./ImageViewer";
import { ItemSheet } from "./ItemSheet";
import { failureText, formatDate, formatLongDate, formatMoney, formatShortDate, parseAmount, readErrorMessage, reviewText } from "./format";

type ItemTarget = { item: ReceiptItem | null; price?: number | null; key: number };
type Ask = { title: string; body: string; label: string; danger?: boolean; run: () => void };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ReceiptDetailPage() {
  const { id } = useParams();
  const query = useReceipt(id);
  const { household } = useHousehold();
  const lists = useLists(household.id);
  const navigate = useNavigate();
  const toast = useToast();
  const reread = useRereadReceipt();
  const confirm = useConfirmReceipt();
  const remove = useDeleteReceipt();
  const saveItem = useSaveReceiptItem(id ?? "");
  const pagesQuery = useReceiptPages(id);
  const addPages = useAddReceiptPages();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  const items = query.data?.items;
  const groups = useMemo(() => {
    const byCategory = new Map<string, ReceiptItem[]>();
    for (const it of items ?? []) byCategory.set(it.category_id, [...(byCategory.get(it.category_id) ?? []), it]);
    return [...byCategory.entries()].sort((a, b) => categoryOrder(a[0]) - categoryOrder(b[0]));
  }, [items]);

  const goBack = () => navigate(-1);
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data)
    return (
      <div className="stack">
        <ScreenHeader title={t("match.receipt")} onBack={goBack} />
        <Empty icon={FileText} title={t("detail.gone")} />
      </div>
    );
  const { receipt: r, items: rows, products } = query.data;

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.show(ok, "success");
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  };

  // Ručný výdavok alebo platba z výpisu: nemá bloček ani položky, má len kategóriu (prototyp ManualDetail).
  if (r.origin !== "RECEIPT") {
    const askDelete = () =>
      setAsk({
        title: t("detail.deleteExpenseTitle"),
        body: t("detail.deleteExpenseBody", { name: r.store_name ?? "", amount: formatMoney(r.total) }),
        label: t("common.delete"),
        danger: true,
        run: () =>
          void act(async () => {
            await remove.mutateAsync(r);
            navigate("/receipts", { replace: true });
          }, t("detail.expenseDeleted")),
      });
    return (
      <div className="stack">
        <ScreenHeader title={r.store_name ?? formatMoney(r.total)} sub={r.origin === "BANK" ? t("detail.bankSub") : t("detail.manualSub")} onBack={goBack} />
        <div className="stack g-16" style={{ padding: "0 16px" }}>
          <section className="card stack g-10 anim-rise" style={{ padding: 18 }}>
            <div className="row g-12">
              <CatIcon id={r.category_id ?? "other"} />
              <span className="grow stack" style={{ minWidth: 0 }}>
                <span className="t-h ellipsis">{r.store_name}</span>
                <span className="t-sm t-2">
                  {formatLongDate(r.purchased_on)}
                  {r.category_id ? ` · ${category(r.category_id).name}` : ""}
                </span>
              </span>
              {r.origin === "BANK" && (
                <span className="badge b-gray">
                  <Landmark size={12} /> {t("rpage.bank")}
                </span>
              )}
            </div>
            <span className="an-big">{formatMoney(r.total)}</span>
            <span className="t-sm t-2">{t("detail.manualNote")}</span>
          </section>
          <button type="button" className="btn btn-soft" onClick={() => setEditing(true)}>
            <PenLine size={16} /> {t("detail.edit")}
          </button>
          <button type="button" className="btn btn-ghost t-red" onClick={askDelete}>
            <Trash2 size={16} /> {t("detail.deleteExpense")}
          </button>
        </div>
        <div className="tab-space" />
        <EditSheet key={`${editing}-${r.updated_at}`} open={editing} onClose={() => setEditing(false)} receipt={r} />
        <AskDialog ask={ask} onClose={() => setAsk(null)} busy={remove.isPending} />
      </div>
    );
  }

  const pageList = pagesQuery.data && pagesQuery.data.length > 0 ? pagesQuery.data.map((p) => p.image_path) : [r.image_path];
  const editable = r.status === "OK" || r.status === "NEEDS_REVIEW";
  const startedAt = new Date(r.updated_at).getTime();
  const stuck = r.status === "PROCESSING" && Date.now() - startedAt > 3 * 60_000;
  const store = r.store_name ?? t("row.unknownStore");
  const sum = r.items_sum ?? 0;
  const diff = r.total != null ? round2(r.total - sum) : 0;
  const mismatch = r.status === "NEEDS_REVIEW" && r.review_reason === "TOTAL_MISMATCH" && r.total != null && Math.abs(diff) > 0.05;

  async function onAddPages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    await act(
      () => addPages.mutateAsync({ receipt: r, files }),
      files.length === 1 ? t("detail.pageAdded") : t("detail.pagesAdded"),
    );
  }

  function onReread() {
    setMenuOpen(false);
    const run = () => void act(() => reread.mutateAsync(r.id), t("detail.rereadDone"));
    if (!editable) return run();
    setAsk({ title: t("detail.rereadTitle"), body: t("detail.rereadConfirm"), label: t("detail.reread"), run });
  }

  function onDelete() {
    setMenuOpen(false);
    setAsk({
      title: t("detail.deleteTitle"),
      body: t("detail.deleteBody", { store, day: formatShortDate(r.purchased_on), amount: formatMoney(r.total) }),
      label: t("common.delete"),
      danger: true,
      run: () =>
        void act(async () => {
          await remove.mutateAsync(r);
          navigate("/receipts", { replace: true });
        }, t("detail.deleted")),
    });
  }

  // „Pridať chýbajúcu položku“ (prototyp): doplní nerozpoznanú položku s rozdielom, databáza potom prepočíta súčet a stav.
  const addMissing = () =>
    act(
      () => saveItem.mutateAsync({ name: t("detail.unrecognized"), lineTotal: diff, quantity: 1, discount: 0, categoryId: "other" }),
      t("detail.missingAdded", { diff: formatMoney(diff) }),
    );

  const openItem = (item: ReceiptItem | null, price?: number | null) => setItemTarget({ item, price, key: Date.now() });

  const tripList = r.list_id ? lists.data?.find((l) => l.id === r.list_id) : undefined;
  const dec2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const menuIcon = (node: ReactNode, danger?: boolean) => (
    <span className="cat-ic sm" style={danger ? { background: "var(--red-soft)", color: "var(--red)" } : undefined}>
      {node}
    </span>
  );

  return (
    <div className="stack">
      <ScreenHeader
        title={`${store} · ${formatMoney(r.total)}`}
        sub={`${t("match.receipt")} · ${formatLongDate(r.purchased_on)}`}
        onBack={goBack}
        right={
          <button type="button" className="ibtn" aria-label={t("detail.more")} onClick={() => setMenuOpen(true)}>
            <MoreHorizontal size={20} />
          </button>
        }
      />
      <div className="stack g-16" style={{ padding: "0 16px" }}>
        {rows.length > 0 && (
          <div style={{ padding: "6px 0 0" }}>
            <div className="an-receipt" aria-label={t("detail.paperAria")}>
              <div style={{ textAlign: "center", fontWeight: 700 }}>{store.toUpperCase()}</div>
              <div style={{ textAlign: "center" }}>
                {formatDate(r.purchased_on)} {r.purchased_time?.slice(0, 5) ?? ""}
              </div>
              <div className="hr" />
              {rows.map((it) => (
                <div key={it.id}>
                  <div className="row between g-8">
                    <span className="ellipsis">{it.raw_name}</span>
                    <span>{dec2(it.line_total)}</span>
                  </div>
                  {(it.quantity !== 1 || it.discount > 0) && (
                    <div style={{ opacity: 0.7, paddingLeft: 8 }}>
                      {formatNumber(it.quantity, { maximumFractionDigits: 3 })} x {it.unit_price != null ? dec2(it.unit_price) : ""}
                      {it.discount > 0 ? `  ${t("detail.paperDiscount")}` : ""}
                    </div>
                  )}
                </div>
              ))}
              <div className="hr" />
              <div className="row between" style={{ fontWeight: 700 }}>
                <span>{t("detail.paperTotal")}</span>
                <span>{r.total != null ? dec2(r.total) : "—"}</span>
              </div>
            </div>
          </div>
        )}

        <section className="card stack g-6" style={{ padding: 16 }}>
          <div className="row g-12">
            <StoreBadge name={store} />
            <span className="grow stack" style={{ minWidth: 0 }}>
              <span className="t-h ellipsis">{store}</span>
              <span className="t-sm t-2 num">
                {r.purchased_on ? dayLabel(r.purchased_on) : formatDate(null)}
                {r.purchased_time ? ` · ${r.purchased_time.slice(0, 5)}` : ""}
                {` · ${tn("rpage.items", rows.length)}`}
              </span>
            </span>
            <span className="t-title num">{formatMoney(r.total)}</span>
          </div>
          {r.status === "PROCESSING" && (
            <span className="row g-6 t-sm t-blue">
              <Loader2 size={15} className="spin" /> {t("detail.reading2")}
              {stuck ? ` ${t("detail.stuck")}` : ""}
            </span>
          )}
          {r.status === "OK" && <SumCheck receipt={r} count={rows.length} onAdd={(price) => openItem(null, price)} onEdit={() => setEditing(true)} />}
        </section>

        {r.status === "FAILED" && (
          <section className="card stack g-10 anim-rise" style={{ padding: 16, background: "var(--red-soft)" }}>
            <span className="row g-8 t-h" style={{ color: "var(--red)" }}>
              <AlertTriangle size={18} /> {t("detail.failedTitle")}
            </span>
            <span className="t-sm">{failureText(r.error_text)}</span>
            <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} disabled={reread.isPending} onClick={onReread}>
              <RefreshCw size={15} /> {t("common.retry")}
            </button>
          </section>
        )}

        {r.status === "NEEDS_REVIEW" && (
          <section className="card stack g-10 anim-rise" style={{ padding: 16, background: "var(--yellow-soft)" }}>
            <span className="row g-8 t-h" style={{ color: "var(--yellow)" }}>
              <AlertTriangle size={18} /> {mismatch ? t("detail.mismatchTitle", { diff: formatMoney(Math.abs(diff)) }) : t("detail.checkTitle")}
            </span>
            <span className="t-sm num">
              {mismatch
                ? t(diff > 0 ? "detail.mismatchText" : "detail.mismatchOver", { total: formatMoney(r.total), sum: formatMoney(sum) })
                : r.review_reason === "NO_ITEMS"
                  ? t("detail.fixHint")
                  : reviewText(r)}
            </span>
            <div className="row g-8 wrap">
              {mismatch && diff > 0 && (
                <button type="button" className="btn btn-ink btn-sm" disabled={saveItem.isPending} onClick={() => void addMissing()}>
                  <Plus size={16} /> {t("detail.addMissing", { diff: formatMoney(diff) })}
                </button>
              )}
              {r.review_reason === "NO_ITEMS" && (
                <button type="button" className="btn btn-ink btn-sm" onClick={() => openItem(null, r.total)}>
                  <Plus size={16} /> {t("ritem.addTitle")}
                </button>
              )}
              <button
                type="button"
                className="btn btn-line btn-sm"
                disabled={confirm.isPending}
                onClick={() => act(() => confirm.mutateAsync(r.id), t("detail.confirmed"))}
              >
                {t("detail.confirm")}
              </button>
              {mismatch && (
                <button type="button" className="btn btn-line btn-sm" onClick={() => setEditing(true)}>
                  {t("sum.fixTotal")}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="stack g-8">
          <span className="section-title">{t("an.trip")}</span>
          <div className="cells">
            {tripList ? (
              <>
                <Cell
                  icon={
                    <span className="cat-ic sm" style={{ color: "var(--blue)" }}>
                      <Link2 size={16} />
                    </span>
                  }
                  title={`${tripList.name}${tripList.completed_at ? ` · ${dayLabel(tripList.completed_at)}` : ""}`}
                  sub={r.match_score != null ? t("trip.autoMatched", { percent: Math.round(Number(r.match_score) * 100) }) : undefined}
                  onClick={() => navigate(`/lists/${tripList.id}`)}
                />
                <button type="button" className="cell t-sm" style={{ color: "var(--text-2)" }} onClick={() => navigate(`/receipts/${r.id}/match`)}>
                  <Unlink size={16} /> <span className="grow">{t("an.changeTrip")}</span>
                </button>
              </>
            ) : (
              <AssignTrip receipt={r} />
            )}
          </div>
        </section>

        {groups.map(([categoryId, list]) => {
          const cat = category(categoryId);
          return (
            <section key={categoryId} className="stack g-8">
              <span className="section-title row g-6">
                <CatIcon id={cat.id} size="sm" /> {cat.name}
              </span>
              <div className="cells">
                {list.map((it) => (
                  <ItemRow key={it.id} item={it} product={it.product_id ? products[it.product_id] : undefined} editable={editable} onClick={() => openItem(it)} />
                ))}
              </div>
            </section>
          );
        })}

        <section className="stack g-8">
          <span className="section-title">{pageList.length > 1 ? t("detail.pages", { n: pageList.length }) : t("viewer.title")}</span>
          <ul className="row g-12" style={{ overflowX: "auto", margin: "0 -16px", padding: "0 16px 4px" }}>
            {pageList.map((path, i) => (
              <li key={path} className="shrink-0">
                <PageCard path={path} label={pageList.length > 1 ? `${i + 1} / ${pageList.length}` : null} onOpen={() => setOpenPath(path)} />
              </li>
            ))}
          </ul>
        </section>

        {editable && (
          <div className="row g-8">
            <button type="button" className="btn btn-soft grow" onClick={() => setEditing(true)}>
              <PenLine size={16} /> {t("detail.edit")}
            </button>
            <button type="button" className="btn btn-soft grow" onClick={() => openItem(null)}>
              <Plus size={16} /> {t("ritem.addTitle")}
            </button>
          </div>
        )}
        <button type="button" className="btn btn-ghost t-red" onClick={onDelete}>
          <Trash2 size={16} /> {t("detail.deleteReceipt")}
        </button>
      </div>
      <div className="tab-space" />

      <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={onAddPages} />
      <EditSheet key={`${editing}-${r.updated_at}`} open={editing} onClose={() => setEditing(false)} receipt={r} />
      <ImageViewer path={openPath} onClose={() => setOpenPath(null)} />
      {itemTarget && (
        <ItemSheet key={itemTarget.key} receiptId={r.id} item={itemTarget.item} suggestedPrice={itemTarget.price} onClose={() => setItemTarget(null)} />
      )}
      <AskDialog ask={ask} onClose={() => setAsk(null)} busy={remove.isPending || reread.isPending} />

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} label={t("detail.actions")}>
        <SheetHeader title={t("detail.actions")} onClose={() => setMenuOpen(false)} />
        <div className="sheet-body stack g-12">
          <div className="cells">
            <Cell icon={menuIcon(<RefreshCw size={16} />)} title={t("detail.reread")} sub={t("detail.rereadHint")} onClick={r.status === "PROCESSING" && !stuck ? undefined : onReread} />
            {r.status !== "PROCESSING" && pageList.length < MAX_PAGES && (
              <Cell
                icon={menuIcon(<Plus size={16} />)}
                title={t("detail.addPage")}
                sub={tn("detail.addPageHint", pageList.length, { max: MAX_PAGES })}
                onClick={() => {
                  setMenuOpen(false);
                  fileInput.current?.click();
                }}
              />
            )}
            {editable && (
              <Cell
                icon={menuIcon(<PenLine size={16} />)}
                title={t("detail.editReceipt")}
                sub={t("detail.editAria")}
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              />
            )}
            <Cell
              icon={menuIcon(<Trash2 size={16} />, true)}
              title={t("detail.deleteReceipt")}
              sub={t("detail.deleteReceiptHint")}
              danger
              chevron={false}
              onClick={onDelete}
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/** Potvrdenie v strede obrazovky (ako v prototype) – nadpis, vysvetlenie, Zrušiť a potvrdenie. */
function AskDialog({ ask, onClose, busy }: { ask: Ask | null; onClose: () => void; busy?: boolean }) {
  return (
    <ConfirmDialog
      open={ask !== null}
      title={ask?.title ?? ""}
      body={ask?.body}
      confirmLabel={ask?.label ?? ""}
      danger={ask?.danger}
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        ask?.run();
        onClose();
      }}
    />
  );
}

/** Doklad bez nákupu: „Priradiť k nákupu“ rozbalí nákupy bez dokladu so zhodou (prototyp A6). */
function AssignTrip({ receipt: r }: { receipt: Receipt }) {
  const [open, setOpen] = useState(false);
  const candidates = useMatchCandidates(open ? r.id : undefined);
  const attach = useAttachReceipt();
  const toast = useToast();
  const free = (candidates.data ?? []).filter((c) => !c.attached).slice(0, 5);

  async function pick(listId: string, name: string, day: string) {
    try {
      await attach.mutateAsync({ receiptId: r.id, listId });
      toast.show(t("detail.attachedTo", { name, day }), "success");
      setOpen(false);
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <>
      <Cell
        icon={
          <span className="cat-ic sm">
            <Unlink size={16} />
          </span>
        }
        title={t("rpage.noTrip")}
        sub={t("an.noTripHint")}
      />
      <button type="button" className="cell" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Link2 size={18} color="var(--accent-text)" />
        <span className="grow t-body fw-5 t-accent">{t("an.assignTrip")}</span>
        <ChevronDown size={18} className="chev rc-chev" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open &&
        (candidates.isPending ? (
          <div className="cell t-sm t-2">
            <Loader2 size={16} className="spin" /> {t("common.loading")}
          </div>
        ) : candidates.isError ? (
          <div className="cell t-sm t-red">{readErrorMessage(candidates.error)}</div>
        ) : free.length ? (
          free.map((c) => (
            <button
              key={c.list_id}
              type="button"
              className="cell anim-rise"
              disabled={attach.isPending}
              onClick={() => void pick(c.list_id, c.name, dayLabel(c.completed_at))}
            >
              <StoreBadge name={c.name} size="sm" />
              <span className="grow stack g-2">
                <span className="t-body fw-5">
                  {c.name} · {dayLabel(c.completed_at)}
                </span>
                <span className="t-xs t-2 num">
                  {t("detail.tripScore", { pct: Math.round(c.score * 100), items: tn("rpage.items", c.hit.length + c.missing.length) })}
                </span>
              </span>
              <Plus size={18} />
            </button>
          ))
        ) : (
          <div className="cell t-sm t-2 anim-rise">{t("detail.noFreeTrip")}</div>
        ))}
    </>
  );
}

function SumCheck({
  receipt: r,
  count,
  onAdd,
  onEdit,
}: {
  receipt: Receipt;
  count: number;
  onAdd: (price: number | null) => void;
  onEdit: () => void;
}) {
  if (count === 0)
    return (
      <div className="stack g-8 t-sm t-2">
        <span>{t("sum.noItems")}</span>
        <button type="button" className="btn btn-sm btn-line" style={{ alignSelf: "flex-start" }} onClick={() => onAdd(r.total)}>
          <Plus size={15} /> {t("ritem.addTitle")}
        </button>
      </div>
    );
  if (r.total == null)
    return (
      <div className="stack g-8 t-sm" style={{ color: "var(--yellow)" }}>
        <span className="row g-6">
          <AlertTriangle size={15} /> {t("sum.noTotal", { sum: formatMoney(r.items_sum) })}
        </span>
        <button type="button" className="btn btn-sm btn-line" style={{ alignSelf: "flex-start" }} onClick={onEdit}>
          {t("sum.addTotal")}
        </button>
      </div>
    );
  const sum = r.items_sum ?? 0;
  const diff = round2(r.total - sum);
  if (Math.abs(diff) <= 0.05)
    return (
      <span className="row g-6 t-sm t-2">
        <Check size={15} color="var(--accent-text)" /> {t("sum.matches")}
      </span>
    );
  return (
    <div className="stack g-8 t-sm" style={{ padding: 12, borderRadius: 12, background: "var(--yellow-soft)" }}>
      <span className="row g-6" style={{ color: "var(--yellow)", alignItems: "flex-start" }}>
        <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
        <span>
          {t("sum.mismatch", { sum: formatMoney(sum), total: formatMoney(r.total) })}{" "}
          {diff > 0 ? t("sum.missing", { diff: formatMoney(diff) }) : t("sum.over", { diff: formatMoney(-diff) })}
        </span>
      </span>
      <div className="row wrap g-8">
        {diff > 0 && (
          <button type="button" className="btn btn-ink btn-sm" onClick={() => onAdd(diff)}>
            <Plus size={15} /> {t("sum.addMissing")}
          </button>
        )}
        <button type="button" className="btn btn-line btn-sm" onClick={onEdit}>
          {t("sum.fixTotal")}
        </button>
      </div>
    </div>
  );
}

/** Položka (prototyp): pekný názov produktu, pod ním text z bločku strojovým písmom a „množstvo × cena“. */
function ItemRow({ item: it, product, editable, onClick }: { item: ReceiptItem; product?: string; editable: boolean; onClick: () => void }) {
  const unit = it.unit ? unitLabel(it.unit) : t("rpage.pieces");
  const meta = `${formatNumber(it.quantity, { maximumFractionDigits: 3 })} ${unit}${it.unit_price != null ? ` × ${formatMoney(it.unit_price)}` : ""}`;
  const content = (
    <>
      <span className="grow stack g-2" style={{ minWidth: 0 }}>
        <span className="t-body fw-5 ellipsis">{product ?? it.raw_name}</span>
        {product && <span className="t-xs t-3 ellipsis rc-raw">{it.raw_name}</span>}
        <span className="t-xs t-2 num">
          {meta}
          {it.discount > 0 && (
            <span className="badge b-green" style={{ marginLeft: 6 }}>
              {t("detail.discount", { amount: formatMoney(it.discount) })}
            </span>
          )}
        </span>
      </span>
      <span className="t-body fw-6 num">{formatMoney(it.line_total)}</span>
    </>
  );
  return editable ? (
    <button type="button" onClick={onClick} className="cell" style={{ alignItems: "flex-start" }}>
      {content}
    </button>
  ) : (
    <div className="cell" style={{ alignItems: "flex-start" }}>
      {content}
    </div>
  );
}

/** Jedna strana dokladu: karta s náhľadom (klepnutím sa otvorí celá) alebo odkaz na PDF. */
function PageCard({ path, label, onOpen }: { path: string; label: string | null; onOpen: () => void }) {
  const image = useReceiptImage(path);
  const pdf = path.toLowerCase().endsWith(".pdf");
  const box = "relative flex h-48 w-36 items-center justify-center overflow-hidden rounded-[var(--radius-surface)] bg-sunken text-text-2";
  if (image.isError) return <div className={cx(box, "p-3 text-center text-sm")}>{t("detail.fileMissing")}</div>;
  if (!image.data) return <div className={cx(box, "animate-pulse")} aria-label={t("common.loading")} />;
  return pdf ? (
    <a href={image.data} target="_blank" rel="noreferrer" className={cx(box, "flex-col gap-2 font-semibold active:bg-pressed")}>
      <FileText className="size-8" aria-hidden /> {t("detail.openPdf")}
    </a>
  ) : (
    <button type="button" onClick={onOpen} className={box} aria-label={label ? t("detail.openPage", { label }) : t("detail.openPhoto")}>
      <img src={image.data} alt="" className="size-full object-cover object-top" />
      {label && <span className="absolute left-2 top-2 rounded-full bg-inverse/85 px-2 py-0.5 text-xs font-strong text-on-inverse">{label}</span>}
    </button>
  );
}

function EditSheet({ open, onClose, receipt }: { open: boolean; onClose: () => void; receipt: Receipt }) {
  const update = useUpdateReceipt();
  const toast = useToast();
  const [store, setStore] = useState(receipt.store_name ?? "");
  const [date, setDate] = useState(receipt.purchased_on ?? "");
  const [total, setTotal] = useState(receipt.total != null ? String(receipt.total) : "");
  const [categoryId, setCategoryId] = useState(receipt.category_id ?? "other");
  const withCategory = receipt.origin !== "RECEIPT";

  async function save(e: FormEvent) {
    e.preventDefault();
    const totalNumber = parseAmount(total);
    if (total.trim() !== "" && (totalNumber === null || totalNumber < 0)) {
      toast.show(t("detail.badAmount"), "error");
      return;
    }
    try {
      await update.mutateAsync({
        id: receipt.id,
        patch: {
          store_name: store.trim() || null,
          purchased_on: date || null,
          total: totalNumber,
          ...(withCategory ? { category_id: categoryId } : {}),
        },
      });
      toast.show(t("detail.saved"), "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={withCategory ? t("detail.editExpense") : t("detail.editReceipt")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("detail.store")} value={store} onChange={(e) => setStore(e.target.value)} maxLength={120} />
        <TextField label={t("detail.purchaseDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label={t("detail.total")} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        {withCategory && (
          <div className="flex flex-col gap-2">
            <label htmlFor="receipt-category" className="text-sm font-medium text-text-2">
              {t("edit.category")}
            </label>
            <select
              id="receipt-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
            >
              {CATEGORIES.filter((c) => c.id !== "deposit").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" size="lg" block loading={update.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </Sheet>
  );
}
