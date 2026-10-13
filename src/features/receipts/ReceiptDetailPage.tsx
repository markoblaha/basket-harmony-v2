import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, FileText, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Banner, Button, ErrorState, Group, IconButton, Section, Sheet, Spinner, TextField } from "@/components/ui";
import { useToast } from "@/components/toast";
import { category } from "@/lib/categories";
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
} from "./api";
import { failureText, formatDate, formatMoney, readErrorMessage, reviewText } from "./format";

export function ReceiptDetailPage() {
  const { id } = useParams();
  const query = useReceipt(id);
  const navigate = useNavigate();
  const toast = useToast();
  const reread = useRereadReceipt();
  const confirm = useConfirmReceipt();
  const remove = useDeleteReceipt();
  const [editing, setEditing] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pagesQuery = useReceiptPages(id);
  const addPages = useAddReceiptPages();
  const fileInput = useRef<HTMLInputElement>(null);
  const viewer = useReceiptImage(openPath ?? undefined);

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data) return <ErrorState error="Tento bloček už neexistuje alebo k nemu nemáš prístup." />;
  const { receipt: r, items } = query.data;
  // Strany v poradí; kým sa nenačítajú (alebo pri staršom doklade) je to aspoň prvá fotka.
  const pageList = pagesQuery.data && pagesQuery.data.length > 0 ? pagesQuery.data.map((p) => p.image_path) : [r.image_path];

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

  async function onDelete() {
    if (!window.confirm("Naozaj zmazať tento bloček aj s fotkou?")) return;
    await act(async () => {
      await remove.mutateAsync(r);
      navigate("/receipts", { replace: true });
    });
  }

  return (
    <div className="pb-10">
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link to="/receipts" aria-label="Späť na bločky" className="flex size-11 items-center justify-center rounded-full active:bg-pressed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{r.store_name ?? "Bloček"}</h1>
        <IconButton label="Zmazať bloček" onClick={onDelete}>
          <Trash2 className="size-5" />
        </IconButton>
      </header>

      <div className="mt-2 flex flex-col gap-4">
        <Section>
          <div className="flex items-end justify-between gap-3 rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
            <div>
              <p className="text-sm text-text-2">
                {formatDate(r.purchased_on)}
                {r.purchased_time ? ` · ${r.purchased_time.slice(0, 5)}` : ""}
              </p>
              <p className="text-3xl font-bold tabular-nums">{formatMoney(r.total)}</p>
            </div>
            {r.status !== "PROCESSING" && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Upraviť
              </Button>
            )}
          </div>
        </Section>

        {r.status === "PROCESSING" && (
          <Section>
            <Banner tone="info" title="Bloček sa číta…">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Trvá to zvyčajne niekoľko sekúnd.
              </span>
              {Date.now() - new Date(r.updated_at).getTime() > 3 * 60_000 && (
                <p className="mt-1">Trvá to nezvyčajne dlho – skús čítanie spustiť znova.</p>
              )}
            </Banner>
          </Section>
        )}

        {r.status === "FAILED" && (
          <Section>
            <Banner tone="danger" title="Bloček sa nepodarilo prečítať">
              {failureText(r.error_text)}
            </Banner>
          </Section>
        )}

        {r.status === "NEEDS_REVIEW" && (
          <Section>
            <Banner
              tone="warning"
              title="Skontroluj bloček"
              action={
                <Button
                  variant="secondary"
                  loading={confirm.isPending}
                  onClick={() => act(() => confirm.mutateAsync(r.id), "Bloček potvrdený")}
                >
                  Je to v poriadku
                </Button>
              }
            >
              {reviewText(r)}
            </Banner>
          </Section>
        )}

        <Section title={pageList.length > 1 ? `Strany dokladu (${pageList.length})` : undefined}>
          <div className="flex flex-col gap-2">
            {pageList.map((path, i) => (
              <PageView key={path} path={path} label={pageList.length > 1 ? `Strana ${i + 1} z ${pageList.length}` : null} onOpen={() => setOpenPath(path)} />
            ))}
          </div>
          {r.status !== "PROCESSING" && pageList.length < MAX_PAGES && (
            <div className="mt-2">
              <Button variant="secondary" block loading={addPages.isPending} onClick={() => fileInput.current?.click()}>
                <Plus className="size-4" aria-hidden /> Pridať ďalšiu stranu
              </Button>
              <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={onAddPages} />
              <p className="mt-1 px-1 text-xs text-text-3">
                Ak je doklad na viacerých fotkách alebo stranách, pridaj ďalšie. Doklad sa prečíta znova zo všetkých strán.
              </p>
            </div>
          )}
        </Section>

        {items.length > 0 && (
          <Section title={`Položky (${items.length})`}>
            <Group>
              {items.map((it) => {
                const cat = category(it.category_id);
                return (
                  <div key={it.id} className="flex items-start gap-3 px-4 py-3">
                    <span aria-hidden className="mt-0.5 text-lg">{cat.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words">{it.raw_name}</p>
                      <p className="text-sm text-text-2">
                        {it.quantity !== 1 || it.unit ? `${it.quantity} ${it.unit ?? ""}`.trim() : null}
                        {it.unit_price != null && (it.quantity !== 1 || it.unit) ? ` × ${formatMoney(it.unit_price)}` : null}
                        {it.discount > 0 ? ` · zľava ${formatMoney(it.discount)}` : null}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(it.line_total)}</span>
                  </div>
                );
              })}
            </Group>
            {r.items_sum != null && (
              <p className="mt-2 px-1 text-sm text-text-2">Súčet položiek: {formatMoney(r.items_sum)}</p>
            )}
          </Section>
        )}

        <Section>
          <Button
            variant="secondary"
            block
            loading={reread.isPending}
            disabled={r.status === "PROCESSING" && Date.now() - new Date(r.updated_at).getTime() <= 3 * 60_000}
            onClick={() => act(() => reread.mutateAsync(r.id), "Bloček prečítaný znova")}
          >
            <RefreshCw className="size-4" aria-hidden /> Prečítať znova
          </Button>
          <p className="mt-1 px-1 text-xs text-text-3">Použi, ak sú údaje zlé. Položky sa nahradia novým prečítaním.</p>
        </Section>
      </div>

      <EditSheet open={editing} onClose={() => setEditing(false)} receipt={r} />
      <Sheet open={openPath !== null} onClose={() => setOpenPath(null)} title="Fotka dokladu">
        {viewer.data && <img src={viewer.data} alt="Fotka dokladu" className="w-full rounded-lg" />}
      </Sheet>
    </div>
  );
}

/** Jedna strana dokladu: náhľad fotky (klepnutím sa zväčší) alebo odkaz na PDF. */
function PageView({ path, label, onOpen }: { path: string; label: string | null; onOpen: () => void }) {
  const image = useReceiptImage(path);
  const pdf = path.toLowerCase().endsWith(".pdf");
  return (
    <div>
      {label && <p className="mb-1 px-1 text-xs font-medium text-text-3">{label}</p>}
      {image.isError ? (
        <p className="rounded-[var(--radius-surface)] bg-surface p-3 text-sm text-text-2">Súbor tejto strany sa nenašiel.</p>
      ) : !image.data ? null : pdf ? (
        <a
          href={image.data}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-surface)] bg-surface px-4 py-3 font-semibold active:bg-pressed"
        >
          <FileText className="size-5" aria-hidden /> Otvoriť PDF doklad
        </a>
      ) : (
        <>
          <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-[var(--radius-surface)] bg-surface">
            <img src={image.data} alt={label ?? "Fotka dokladu"} className="max-h-64 w-full object-cover object-top" />
          </button>
          <p className="mt-1 px-1 text-xs text-text-3">Klepnutím zväčšíš fotku.</p>
        </>
      )}
    </div>
  );
}

function EditSheet({ open, onClose, receipt }: { open: boolean; onClose: () => void; receipt: Receipt }) {
  const update = useUpdateReceipt();
  const toast = useToast();
  const [store, setStore] = useState(receipt.store_name ?? "");
  const [date, setDate] = useState(receipt.purchased_on ?? "");
  const [total, setTotal] = useState(receipt.total != null ? String(receipt.total) : "");

  async function save(e: FormEvent) {
    e.preventDefault();
    const totalNumber = total.trim() === "" ? null : Number(total.replace(",", "."));
    if (totalNumber !== null && (!Number.isFinite(totalNumber) || totalNumber < 0)) {
      toast.show("Suma musí byť číslo.", "error");
      return;
    }
    try {
      await update.mutateAsync({
        id: receipt.id,
        patch: { store_name: store.trim() || null, purchased_on: date || null, total: totalNumber },
      });
      toast.show("Uložené", "success");
      onClose();
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Upraviť bloček">
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Obchod" value={store} onChange={(e) => setStore(e.target.value)} maxLength={120} />
        <TextField label="Dátum nákupu" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Celková suma (€)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        <Button type="submit" size="lg" block loading={update.isPending}>
          Uložiť
        </Button>
      </form>
    </Sheet>
  );
}
