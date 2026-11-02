import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { FileText, Landmark, PenLine, Trash2 } from "lucide-react";
import { CatIcon, ConfirmDialog, Empty, ScreenHeader } from "@/components/kit";
import { Button, ErrorState, Sheet, Spinner, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { dayLabel } from "@/features/lists/dates";
import { CATEGORIES, category } from "@/lib/categories";
import { formatNumber, t, tn } from "@/i18n";

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
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB, Back, useScrolled } from "@/mockup/ui";
import { Sheet as MkSheet } from "@/mockup/Sheet";
import { Btn, StoreTile, emojiFor, storeKeyOf } from "@/mockup/kit";
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
  const g = useTheme().style === "glass";
  const scrolled = useScrolled();


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


  const items2 = rows.filter((x) => x.category_id !== "deposit");
  const deposits = rows.filter((x) => x.category_id === "deposit");
  const sk = storeKeyOf(store);
  const qtyDec = (n: number) => formatNumber(n, { maximumFractionDigits: 3 });
  const line = (it: ReceiptItem) => {
    const name = it.product_id ? (products[it.product_id] ?? it.raw_name) : it.raw_name;
    const kg = (it.unit ?? "").toLowerCase() === "kg";
    const up = it.unit_price != null ? Number(it.unit_price) : null;
    // Pri kontrole bločku ťuk opraví položku; inak otvorí výrobok (cena v čase a v obchodoch).
    const tap = () => (r.status === "NEEDS_REVIEW" || !it.product_id ? editable && openItem(it) : navigate(`/analytics/product/${it.product_id}`));
    return (
      <button type="button" className="row tap" key={it.id} onClick={tap}>
        <span className="th">
          <E k={emojiFor(name, it.category_id)} />
        </span>
        <div className="tx">
          <b>{name}</b>
          <span className="sub">
            {kg && up != null
              ? t("sc.perKg", { q: qtyDec(Number(it.quantity)), price: formatMoney(up) })
              : Number(it.quantity) > 1 && up != null
                ? t("sc.times", { q: qtyDec(Number(it.quantity)), price: formatMoney(up) })
                : category(it.category_id).name}
            {it.discount > 0 ? ` · ${t("rd.discount")}` : ""}
          </span>
        </div>
        <b className="amt">{formatMoney(it.line_total)}</b>
      </button>
    );
  };

  return (
    <>
      <div className="bhm bhm-top">
        <div className={`sc${scrolled ? " scrolled" : ""}`}>
          <header className="nb">
            <Back label={t("mn.receipts")} onClick={goBack} />
            <span className="nbt">{store}</span>
            <div className="nbr">
              <IB n="dots-three" label={t("detail.more")} onClick={() => setMenuOpen(true)} />
            </div>
          </header>
        </div>
      </div>
      <div className="bhm bhm-list">
        <div className="body">
          <div className="lhead">
            <StoreTile k={sk} n={store} s={60} />
            <div className="grow">
              <h1 className="lt">{store}</h1>
              <div className="meta">
                {r.purchased_on ? formatShortDate(r.purchased_on) : formatDate(null)} {r.purchased_time?.slice(0, 5) ?? ""} · {tn("rpage.items", items2.length)}
              </div>
            </div>
          </div>
          {r.status === "PROCESSING" && (
            <p className="vnote">
              <I n="clock" />
              {t("detail.reading2")}
              {stuck ? ` ${t("detail.stuck")}` : ""}
            </p>
          )}
          {r.status === "FAILED" && (
            <div className="callout">
              <I n="warning-circle" />
              <span className="grow">
                <b>{t("detail.failedTitle")}</b> {failureText(r.error_text)}
              </span>
            </div>
          )}
          {r.status === "FAILED" && (
            <Btn cls="soft" disabled={reread.isPending} onClick={onReread}>
              <I n="arrow-counter-clockwise" w="bold" />
              {t("common.retry")}
            </Btn>
          )}
          {r.status === "NEEDS_REVIEW" && (
            <div className={`card${g ? " glass2" : ""} rcheck`}>
              <div className="t1">{mismatch ? t("detail.mismatchTitle", { diff: formatMoney(Math.abs(diff)) }) : t("detail.checkTitle")}</div>
              <p className="meta">
                {mismatch
                  ? t(diff > 0 ? "detail.mismatchText" : "detail.mismatchOver", { total: formatMoney(r.total), sum: formatMoney(sum) })
                  : r.review_reason === "NO_ITEMS"
                    ? t("detail.fixHint")
                    : reviewText(r)}
              </p>
              <div className="chips wrap">
                {mismatch && diff > 0 && (
                  <Btn cls="pri sm" disabled={saveItem.isPending} onClick={() => void addMissing()}>
                    <I n="plus" w="bold" />
                    {t("detail.addMissing", { diff: formatMoney(diff) })}
                  </Btn>
                )}
                {r.review_reason === "NO_ITEMS" && (
                  <Btn cls="pri sm" onClick={() => openItem(null, r.total)}>
                    <I n="plus" w="bold" />
                    {t("ritem.addTitle")}
                  </Btn>
                )}
                <Btn cls="soft sm" disabled={confirm.isPending} onClick={() => void act(() => confirm.mutateAsync(r.id), t("detail.confirmed"))}>
                  {t("detail.confirm")}
                </Btn>
                {mismatch && (
                  <Btn cls="soft sm" onClick={() => setEditing(true)}>
                    {t("sum.fixTotal")}
                  </Btn>
                )}
              </div>
            </div>
          )}
          <div className={`card match${g ? " mg" : ""}`}>
            <div>
              <div className="k">{t("sc.paid")}</div>
              <div className="price">{formatMoney(r.total)}</div>
            </div>
            {r.status === "OK" && Math.abs(diff) > 0.009 && (
              <div className="ra">
                <div className="k">{t("rd.diff")}</div>
                <div className="price mut">{formatMoney(diff)}</div>
                <div className="meta sm">{t("rd.diffWhy")}</div>
              </div>
            )}
          </div>
          {tripList ? (
            <button type="button" className={`card krow${g ? " glass2" : ""}`} onClick={() => navigate(`/history/${tripList.id}`)}>
              <span className="kc">
                <span className="k">{t("an.trip")}</span>
                <b>
                  {tripList.name}
                  {tripList.completed_at ? ` · ${dayLabel(tripList.completed_at)}` : ""}
                </b>
              </span>
              <span className="meta">{r.match_score != null ? t("trip.autoMatched", { percent: Math.round(Number(r.match_score) * 100) }) : ""}</span>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
          ) : (
            <AssignTrip receipt={r} />
          )}
          {tripList && (
            <button type="button" className="lnk c" onClick={() => navigate(`/receipts/${r.id}/match`)}>
              {t("an.changeTrip")}
            </button>
          )}
          {items2.length > 0 && <div className={`lst${g ? " glass2" : ""}`}>{items2.map(line)}</div>}
          {deposits.length > 0 && (
            <>
              <div className="group plain">
                <span className="gl">{t("rd.deposits")}</span>
                <span className="cnt">{formatMoney(deposits.reduce((a, x) => a + Number(x.line_total), 0))}</span>
              </div>
              <div className={`lst${g ? " glass2" : ""}`}>{deposits.map(line)}</div>
            </>
          )}
          {rows.length > 0 && <p className="hint">{t("rd.hint")}</p>}
          <div className="h2 sm">{pageList.length > 1 ? t("detail.pages", { n: pageList.length }) : t("viewer.title")}</div>
          <ul className="rd-pages">
            {pageList.map((path, i) => (
              <li key={path}>
                <PageCard path={path} label={pageList.length > 1 ? `${i + 1} / ${pageList.length}` : null} onOpen={() => setOpenPath(path)} />
              </li>
            ))}
          </ul>
          {editable && (
            <div className="rbtns">
              <Btn cls="soft grow" onClick={() => setEditing(true)}>
                <I n="pencil-simple" />
                {t("detail.edit")}
              </Btn>
              <Btn cls="soft grow" onClick={() => openItem(null)}>
                <I n="plus" w="bold" />
                {t("ritem.addTitle")}
              </Btn>
            </div>
          )}
          <button type="button" className="lnk c dng" onClick={onDelete}>
            {t("detail.deleteReceipt")}
          </button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={onAddPages} />
      <EditSheet key={`${editing}-${r.updated_at}`} open={editing} onClose={() => setEditing(false)} receipt={r} />
      <ImageViewer path={openPath} onClose={() => setOpenPath(null)} />
      {itemTarget && (
        <ItemSheet key={itemTarget.key} receiptId={r.id} item={itemTarget.item} suggestedPrice={itemTarget.price} onClose={() => setItemTarget(null)} />
      )}
      <AskDialog ask={ask} onClose={() => setAsk(null)} busy={remove.isPending || reread.isPending} />

      <MkSheet open={menuOpen} onClose={() => setMenuOpen(false)} label={t("detail.actions")}>
        <div className="sh-head">
          <h2>{t("detail.actions")}</h2>
        </div>
        <div className="sh-body">
          <div className="menu">
            <button type="button" disabled={r.status === "PROCESSING" && !stuck} onClick={onReread}>
              <I n="arrow-counter-clockwise" />
              {t("detail.reread")}
            </button>
            {r.status !== "PROCESSING" && pageList.length < MAX_PAGES && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  fileInput.current?.click();
                }}
              >
                <I n="plus" />
                {t("detail.addPage")}
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                <I n="pencil-simple" />
                {t("detail.editReceipt")}
              </button>
            )}
            <button type="button" className="dng" onClick={onDelete}>
              <I n="trash" />
              {t("detail.deleteReceipt")}
            </button>
          </div>
        </div>
      </MkSheet>
    </>
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

  // Bloček bez nákupu (mockup: riadky .lst) – ťuk ponúkne dokončené nákupy, ku ktorým sa hodí.
  return (
    <div className="lst">
      <button type="button" className="row tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="th ic">
          <I n="link" />
        </span>
        <div className="tx">
          <b>{t("an.assignTrip")}</b>
          <span className="sub">{t("an.noTripHint")}</span>
        </div>
        <I n={open ? "caret-up" : "caret-down"} w="bold" cls="chev" />
      </button>
      {open &&
        (candidates.isPending ? (
          <div className="row">
            <span className="sub">{t("common.loading")}</span>
          </div>
        ) : candidates.isError ? (
          <div className="row">
            <span className="sub">{readErrorMessage(candidates.error)}</span>
          </div>
        ) : free.length ? (
          free.map((c) => (
            <button key={c.list_id} type="button" className="row tap" disabled={attach.isPending} onClick={() => void pick(c.list_id, c.name, dayLabel(c.completed_at))}>
              <StoreTile k={storeKeyOf(c.name)} n={c.name} s={34} />
              <div className="tx">
                <b>
                  {c.name} · {dayLabel(c.completed_at)}
                </b>
                <span className="sub">{t("detail.tripScore", { pct: Math.round(c.score * 100), items: tn("rpage.items", c.hit.length + c.missing.length) })}</span>
              </div>
              <I n="plus" w="bold" cls="chev" />
            </button>
          ))
        ) : (
          <div className="row">
            <span className="sub">{t("detail.noFreeTrip")}</span>
          </div>
        ))}
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
