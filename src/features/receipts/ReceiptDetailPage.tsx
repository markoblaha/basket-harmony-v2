import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Banner, Button, ErrorState, Group, IconButton, Section, Sheet, Spinner, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists } from "@/features/lists/api";
import { dayLabel } from "@/features/lists/dates";
import { CATEGORIES, category, categoryOrder } from "@/lib/categories";
import {
  MAX_PAGES,
  useAddReceiptPages,
  useConfirmReceipt,
  useDeleteReceipt,
  useReceipt,
  useReceiptImage,
  useReceiptPages,
  useRereadReceipt,
  useUpdateReceipt,
  type Receipt,
  type ReceiptItem,
} from "./api";
import { ImageViewer } from "./ImageViewer";
import { ItemSheet } from "./ItemSheet";
import { StoreAvatar } from "./ReceiptRow";
import { failureText, formatDate, formatMoney, parseAmount, plural, readErrorMessage, reviewText } from "./format";

type ItemTarget = { item: ReceiptItem | null; price?: number | null; key: number };

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
  const pagesQuery = useReceiptPages(id);
  const addPages = useAddReceiptPages();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null);

  const items = query.data?.items;
  const groups = useMemo(() => {
    const byCategory = new Map<string, ReceiptItem[]>();
    for (const it of items ?? []) byCategory.set(it.category_id, [...(byCategory.get(it.category_id) ?? []), it]);
    return [...byCategory.entries()].sort((a, b) => categoryOrder(a[0]) - categoryOrder(b[0]));
  }, [items]);

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data) return <ErrorState error="Tento doklad už neexistuje alebo k nemu nemáš prístup." />;
  const { receipt: r, items: rows } = query.data;
  const pageList = pagesQuery.data && pagesQuery.data.length > 0 ? pagesQuery.data.map((p) => p.image_path) : [r.image_path];
  // Platba z výpisu alebo ručný výdavok: nemá fotku ani položky, má len kategóriu.
  const isDocument = r.origin === "RECEIPT";
  const editable = isDocument && (r.status === "OK" || r.status === "NEEDS_REVIEW");
  const startedAt = new Date(r.updated_at).getTime();
  const stuck = r.status === "PROCESSING" && Date.now() - startedAt > 3 * 60_000;

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.show(ok, "success");
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  };

  async function onAddPages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    await act(
      () => addPages.mutateAsync({ receipt: r, files }),
      files.length === 1 ? "Strana pridaná, doklad prečítaný znova" : "Strany pridané, doklad prečítaný znova",
    );
  }

  async function onReread() {
    setMenuOpen(false);
    if (editable && !window.confirm("Doklad sa prečíta znova a položky sa nahradia novým čítaním. Ručné úpravy položiek sa stratia. Pokračovať?")) return;
    await act(() => reread.mutateAsync(r.id), "Doklad prečítaný znova");
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!window.confirm("Naozaj zmazať tento doklad aj s fotkami?")) return;
    await act(async () => {
      await remove.mutateAsync(r);
      navigate("/receipts", { replace: true });
    });
  }

  const openItem = (item: ReceiptItem | null, price?: number | null) => setItemTarget({ item, price, key: Date.now() });

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between px-2 pt-3">
        <Link to="/receipts" aria-label="Späť na doklady" className="flex size-11 items-center justify-center rounded-full active:bg-pressed">
          <ArrowLeft className="size-5" />
        </Link>
        <IconButton label="Ďalšie akcie" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal className="size-6" />
        </IconButton>
      </header>

      <div className="mt-1 flex flex-col gap-4">
        <Section>
          <div className="rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <StoreAvatar name={r.store_name} className="size-12" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold tracking-tight">{r.store_name ?? "Neznámy obchod"}</h1>
                <p className="text-sm text-text-2">
                  {formatDate(r.purchased_on)}
                  {r.purchased_time ? ` · ${r.purchased_time.slice(0, 5)}` : ""}
                </p>
              </div>
              {r.status !== "PROCESSING" && (
                <IconButton label="Upraviť obchod, dátum a sumu" onClick={() => setEditing(true)} className="-mr-2 -mt-1">
                  <Pencil className="size-5" />
                </IconButton>
              )}
            </div>
            <p className="mt-3 text-4xl font-bold tabular-nums">{formatMoney(r.total)}</p>
            {r.list_id && <TripLink list={lists.data?.find((l) => l.id === r.list_id)} score={r.match_score} />}
            {editable && <SumCheck receipt={r} count={rows.length} onAdd={(price) => openItem(null, price)} onEdit={() => setEditing(true)} />}
            {!isDocument && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-2">
                <span className="rounded-full bg-surface px-3 py-1">{r.origin === "BANK" ? "🏦 Z bankového výpisu" : "✍️ Zadané ručne"}</span>
                {r.category_id && (
                  <Link to={`/analytics/category/${r.category_id}`} className="rounded-full bg-surface px-3 py-1 active:bg-pressed">
                    {category(r.category_id).emoji} {category(r.category_id).name}
                  </Link>
                )}
              </div>
            )}
          </div>
        </Section>

        {r.status === "PROCESSING" && (
          <Section>
            <Banner tone="info" title="Doklad sa číta…">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Trvá to zvyčajne niekoľko sekúnd.
              </span>
              {stuck && <p className="mt-1">Trvá to nezvyčajne dlho – skús čítanie spustiť znova cez ⋯ hore.</p>}
            </Banner>
          </Section>
        )}

        {r.status === "FAILED" && (
          <Section>
            <Banner
              tone="danger"
              title="Doklad sa nepodarilo prečítať"
              action={
                <Button variant="secondary" loading={reread.isPending} onClick={onReread}>
                  <RefreshCw className="size-4" aria-hidden /> Skúsiť znova
                </Button>
              }
            >
              {failureText(r.error_text)}
            </Banner>
          </Section>
        )}

        {r.status === "NEEDS_REVIEW" && (
          <Section>
            <Banner
              tone="warning"
              title="Skontroluj doklad"
              action={
                <Button
                  variant="secondary"
                  loading={confirm.isPending}
                  onClick={() => act(() => confirm.mutateAsync(r.id), "Doklad potvrdený")}
                >
                  Je to v poriadku
                </Button>
              }
            >
              {r.review_reason === "TOTAL_MISMATCH" || r.review_reason === "NO_ITEMS"
                ? "Oprav položky alebo sumu podľa fotky. Ak sa rozdiel nedá odstrániť (zaokrúhlenie, nečitateľná položka), doklad potvrď."
                : reviewText(r)}
            </Banner>
          </Section>
        )}

        {isDocument && (
        <Section title={pageList.length > 1 ? `Strany dokladu (${pageList.length})` : "Fotka dokladu"}>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {pageList.map((path, i) => (
              <li key={path} className="shrink-0 snap-start">
                <PageCard path={path} label={pageList.length > 1 ? `${i + 1} / ${pageList.length}` : null} onOpen={() => setOpenPath(path)} />
              </li>
            ))}
            {r.status !== "PROCESSING" && pageList.length < MAX_PAGES && (
              <li className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={addPages.isPending}
                  className="flex h-48 w-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-surface)] border-2 border-dashed border-line-strong/50 px-2 text-center text-sm font-medium text-text-2 active:bg-pressed disabled:opacity-55"
                >
                  {addPages.isPending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Plus className="size-6" aria-hidden />}
                  Pridať ďalšiu stranu
                </button>
              </li>
            )}
          </ul>
        </Section>
        )}

        {rows.length > 0 && (
          <Section title={`Položky (${rows.length})`}>
            <div className="flex flex-col gap-3">
              {groups.map(([categoryId, list]) => {
                const cat = category(categoryId);
                const subtotal = list.reduce((sum, it) => sum + it.line_total, 0);
                return (
                  <div key={categoryId}>
                    <div className="mb-1 flex items-center justify-between px-1 text-sm text-text-2">
                      <span>
                        <span aria-hidden>{cat.emoji}</span> {cat.name}
                      </span>
                      <span className="tabular-nums">{formatMoney(subtotal)}</span>
                    </div>
                    <Group>
                      {list.map((it) => (
                        <ItemRow key={it.id} item={it} editable={editable} onClick={() => openItem(it)} />
                      ))}
                    </Group>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {editable && (
          <Section>
            <Button variant="secondary" block onClick={() => openItem(null)}>
              <Plus className="size-4" aria-hidden /> Pridať položku
            </Button>
          </Section>
        )}
      </div>

      <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={onAddPages} />
      <EditSheet key={`${editing}-${r.updated_at}`} open={editing} onClose={() => setEditing(false)} receipt={r} />
      <ImageViewer path={openPath} onClose={() => setOpenPath(null)} />
      {itemTarget && (
        <ItemSheet
          key={itemTarget.key}
          receiptId={r.id}
          item={itemTarget.item}
          suggestedPrice={itemTarget.price}
          onClose={() => setItemTarget(null)}
        />
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Akcie s dokladom">
        <div className="flex flex-col gap-2">
          {isDocument && (
            <MenuAction
              icon={<RefreshCw className="size-5" aria-hidden />}
              title="Prečítať znova"
              hint="Použi, ak sú údaje zlé. Položky sa nahradia novým čítaním."
              disabled={r.status === "PROCESSING" && !stuck}
              onClick={onReread}
            />
          )}
          {isDocument && r.status !== "PROCESSING" && pageList.length < MAX_PAGES && (
            <MenuAction
              icon={<Plus className="size-5" aria-hidden />}
              title="Pridať ďalšiu stranu"
              hint={`Ak je doklad na viacerých fotkách. Teraz ${pageList.length} ${plural(pageList.length, ["strana", "strany", "strán"])}, najviac ${MAX_PAGES}.`}
              onClick={() => {
                setMenuOpen(false);
                fileInput.current?.click();
              }}
            />
          )}
          <MenuAction
            icon={<Trash2 className="size-5" aria-hidden />}
            title="Zmazať doklad"
            hint={isDocument ? "Zmaže doklad aj s fotkami. Nedá sa vrátiť späť." : "Zmaže tento výdavok. Nedá sa vrátiť späť."}
            danger
            onClick={onDelete}
          />
        </div>
      </Sheet>
    </div>
  );
}

function MenuAction({
  icon,
  title,
  hint,
  onClick,
  danger,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex min-h-16 w-full items-center gap-4 rounded-[var(--radius-surface)] px-4 py-3 text-left disabled:opacity-55",
        danger ? "bg-danger-soft text-danger" : "bg-surface active:bg-pressed",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className={cx("block text-sm", danger ? "opacity-80" : "text-text-2")}>{hint}</span>
      </span>
    </button>
  );
}

/** Kontrola súčtu: sedí položky s celkovou sumou? Ak nie, ukáže rozdiel a ponúkne doplniť chýbajúcu položku. */
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
  const base = "mt-3 flex flex-col gap-2 rounded-[var(--radius-control)] p-3 text-sm";
  if (count === 0) {
    return (
      <div className={cx(base, "bg-surface text-text-2")}>
        <p>Na doklade sa nenašli položky s cenami.</p>
        <Button variant="secondary" onClick={() => onAdd(r.total)}>
          <Plus className="size-4" aria-hidden /> Pridať položku
        </Button>
      </div>
    );
  }
  if (r.total == null) {
    return (
      <div className={cx(base, "bg-warning-soft text-warning")}>
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> Chýba celková suma (súčet položiek je {formatMoney(r.items_sum)}).
        </p>
        <Button variant="secondary" onClick={onEdit}>
          Doplniť sumu
        </Button>
      </div>
    );
  }
  const sum = r.items_sum ?? 0;
  const diff = Math.round((r.total - sum) * 100) / 100;
  if (Math.abs(diff) <= 0.05) {
    return (
      <p className={cx(base, "flex-row items-center gap-2 bg-success-soft font-medium text-success")}>
        <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Súčet položiek sedí s celkovou sumou
      </p>
    );
  }
  return (
    <div className={cx(base, "bg-warning-soft text-warning")}>
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Položky dávajú {formatMoney(sum)}, na doklade je {formatMoney(r.total)}.{" "}
          {diff > 0 ? `Chýba ${formatMoney(diff)}.` : `Položky sú o ${formatMoney(-diff)} viac.`}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {diff > 0 && (
          <Button variant="secondary" onClick={() => onAdd(diff)}>
            <Plus className="size-4" aria-hidden /> Pridať chýbajúcu položku
          </Button>
        )}
        <Button variant="secondary" onClick={onEdit}>
          Opraviť celkovú sumu
        </Button>
      </div>
    </div>
  );
}

function ItemRow({ item: it, editable, onClick }: { item: ReceiptItem; editable: boolean; onClick: () => void }) {
  const amount = it.quantity !== 1 || it.unit ? `${it.quantity} ${it.unit ?? ""}`.trim() : null;
  const meta = [
    amount && it.unit_price != null ? `${amount} × ${formatMoney(it.unit_price)}` : amount,
    it.discount > 0 ? `zľava ${formatMoney(it.discount)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="break-words">{it.raw_name}</p>
        {meta && <p className="text-sm text-text-2">{meta}</p>}
      </div>
      <span className="font-semibold tabular-nums">{formatMoney(it.line_total)}</span>
      {editable && <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />}
    </>
  );
  return editable ? (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-pressed">
      {content}
    </button>
  ) : (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">{content}</div>
  );
}

/** Jedna strana dokladu: karta s náhľadom (klepnutím sa otvorí celá) alebo odkaz na PDF. */
function PageCard({ path, label, onOpen }: { path: string; label: string | null; onOpen: () => void }) {
  const image = useReceiptImage(path);
  const pdf = path.toLowerCase().endsWith(".pdf");
  const box = "relative flex h-48 w-36 items-center justify-center overflow-hidden rounded-[var(--radius-surface)] bg-surface text-text-2";
  if (image.isError) return <div className={cx(box, "p-3 text-center text-sm")}>Súbor tejto strany sa nenašiel.</div>;
  if (!image.data) return <div className={cx(box, "animate-pulse")} aria-label="Načítavam" />;
  return pdf ? (
    <a href={image.data} target="_blank" rel="noreferrer" className={cx(box, "flex-col gap-2 font-semibold active:bg-pressed")}>
      <FileText className="size-8" aria-hidden /> Otvoriť PDF
    </a>
  ) : (
    <button type="button" onClick={onOpen} className={box} aria-label={label ? `Otvoriť stranu ${label}` : "Otvoriť fotku dokladu"}>
      <img src={image.data} alt="" className="size-full object-cover object-top" />
      {label && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">{label}</span>}
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
      toast.show("Suma musí byť číslo.", "error");
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
      toast.show("Uložené", "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={withCategory ? "Upraviť výdavok" : "Upraviť doklad"}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Obchod" value={store} onChange={(e) => setStore(e.target.value)} maxLength={120} />
        <TextField label="Dátum nákupu" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Celková suma (€)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        {withCategory && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="receipt-category" className="text-sm font-medium text-text-2">
              Kategória
            </label>
            <select
              id="receipt-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              {CATEGORIES.filter((c) => c.id !== "deposit").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" size="lg" block loading={update.isPending}>
          Uložiť
        </Button>
      </form>
    </Sheet>
  );
}

/** K akému nákupu doklad patrí (priradený ručne alebo automaticky podľa položiek). */
function TripLink({ list, score }: { list?: { id: string; name: string; completed_at: string | null }; score: number | null }) {
  if (!list) return null;
  return (
    <Link to={`/lists/${list.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm active:bg-pressed">
      <span aria-hidden>🛒</span>
      <span className="min-w-0 flex-1 truncate">
        Nákup <b>{list.name}</b>
        {list.completed_at && ` · ${dayLabel(list.completed_at)}`}
        {score != null && <span className="text-text-2"> · priradené automaticky ({Math.round(Number(score) * 100)} % zhoda)</span>}
      </span>
    </Link>
  );
}
