import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronRight, Merge, Pencil, Plus, Search } from "lucide-react";
import { Button, ErrorState, Group, Section, Sheet, Spinner, TextField, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { CATEGORIES, normalizeName } from "@/lib/categories";
import { formatMoney, formatShortDate, parseAmount, plural, readErrorMessage } from "@/features/receipts/format";
import { useMergeProducts, useProduct, useProducts, useUpdateProduct, type ProductDetail } from "./api";
import { BackHeader } from "./AnalyticsLayout";
import { PriceChart } from "./charts";
import { Card, EmojiBadge, SectionTitle, Stat, categoryInfo, sizeLabel, storeColor, unitLabel } from "./bits";
import { usePeriod } from "./period";
import { useAddToList } from "./useAddToList";

/** Detail produktu: cena v čase, porovnanie obchodov, ako často ho kupujete a všetky nákupy. */
export function ProductPage() {
  const { id } = useParams();
  const { search } = usePeriod();
  const query = useProduct(id);
  const { addToList, pending: adding, listName } = useAddToList();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={readErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const d = query.data;
  const p = d.product;
  const info = categoryInfo(p.category_id);
  const size = sizeLabel(p.size_value, p.size_unit);
  const last = d.purchases[0];
  const basis = last?.basis ?? "ks";
  const showUnit = basis !== "ks" || (p.size_value ?? 1) > 1;
  const cheapest = d.stores[0];
  // Obchody v tomto produkte dostanú dobre odlíšiteľné farby (v grafe aj v zoznamoch).
  const storeNames = [...new Set([...d.stores.map((s) => s.name), ...d.purchases.map((x) => x.store)])].sort();
  const colorOf = (name: string) => storeColor(storeNames.indexOf(name));
  const points = d.purchases
    .filter((x) => x.shelf_unit !== null && x.basis === basis)
    .map((x) => ({
      key: x.item_id,
      date: x.date,
      shelf: showUnit ? x.shelf_unit! : x.line_total + x.discount,
      paid: showUnit ? (x.paid_unit ?? x.shelf_unit!) : x.line_total,
      store: x.store,
      color: colorOf(x.store),
    }))
    .reverse();
  const storesInChart = [...new Set(points.map((x) => x.store))];

  return (
    <div className="pb-10">
      <BackHeader fallback={`/analytics/products${search}`} title="Produkty" />

      <Section className="mt-1">
        <div className="flex items-start gap-3">
          <EmojiBadge emoji={info.emoji} color={info.color} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{p.name}</h1>
            <p className="mt-0.5 text-sm text-text-2">{[p.brand, size, info.name].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> Upraviť
          </Button>
          <Button variant="secondary" onClick={() => setMerging(true)}>
            <Merge className="size-4" aria-hidden /> Spojiť
          </Button>
          <Button variant="secondary" disabled={adding} onClick={() => void addToList(p.name, p.category_id)}>
            <Plus className="size-4" aria-hidden /> {listName ? `Do zoznamu ${listName}` : "Do zoznamu"}
          </Button>
        </div>
      </Section>

      <div className="mt-4 flex flex-col gap-5">
        {last && (
          <Section>
            <Card>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Naposledy" value={formatMoney(last.line_total)} hint={`${formatShortDate(last.date)} · ${last.store}`} />
                {showUnit && last.shelf_unit !== null ? (
                  <Stat label="Cena za jednotku" value={`${formatMoney(last.shelf_unit)} ${unitLabel(basis)}`} hint="na regáli, pred zľavou" />
                ) : (
                  <Stat label="Kúpené" value={`${d.purchases.length}×`} hint="spolu" />
                )}
                {cheapest && d.stores.length > 1 && (
                  <Stat
                    label="Najlacnejšie"
                    value={`${formatMoney(cheapest.avg_unit)} ${showUnit ? unitLabel(basis) : ""}`}
                    hint={`${cheapest.name} (priemer)`}
                  />
                )}
                {d.interval_days !== null && (
                  <Stat label="Kupuješ" value={`každých ~${Math.round(d.interval_days)} dní`} hint={`naposledy ${daysAgo(last.date)}`} />
                )}
                <Stat
                  label="Tento rok"
                  value={formatMoney(d.spent_year)}
                  hint={`${d.count_year} ${plural(d.count_year, ["nákup", "nákupy", "nákupov"])}`}
                />
              </div>
            </Card>
          </Section>
        )}

        <Section>
          <SectionTitle title={`Cena v čase${showUnit ? ` (€ ${unitLabel(basis)})` : ""}`} />
          <Card>
            {points.length >= 2 ? (
              <>
                <PriceChart points={points} unitLabel={showUnit ? unitLabel(basis) : ""} />
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-3">
                  {storesInChart.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: colorOf(s) }} aria-hidden /> {s}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full border-2 border-text-3" aria-hidden /> akcia (bodka pod = zaplatené)
                  </span>
                </div>
                <p className="mt-2 text-center text-xs text-text-3">Klepni na bodku a uvidíš detail nákupu.</p>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-text-2">
                Na vývoj ceny treba aspoň 2 nákupy tohto produktu (zatiaľ {d.purchases.length}). Pribudne s ďalšími bločkami.
              </p>
            )}
          </Card>
        </Section>

        {d.stores.length > 1 && <StoreCompare d={d} showUnit={showUnit} colorOf={colorOf} />}

        <Section>
          <SectionTitle title={`Nákupy (${d.purchases.length})`} />
          <Group>
            {d.purchases.map((x) => (
              <Link key={x.item_id} to={`/receipts/${x.receipt_id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-pressed">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(x.store) }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {formatShortDate(x.date)} · {x.store}
                  </p>
                  <p className="text-xs text-text-3">
                    {x.quantity !== 1 ? `${x.quantity.toLocaleString("sk-SK")} × · ` : ""}
                    {showUnit && x.shelf_unit !== null ? `${formatMoney(x.shelf_unit)} ${unitLabel(x.basis)}` : ""}
                    {x.discount > 0 ? ` · zľava ${formatMoney(x.discount)}` : ""}
                  </p>
                </div>
                {x.discount > 0 && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">akcia</span>}
                <span className="font-semibold tabular-nums">{formatMoney(x.line_total)}</span>
                <ChevronRight className="size-4 text-text-3" aria-hidden />
              </Link>
            ))}
          </Group>
        </Section>

        {d.aliases.length > 0 && (
          <Section>
            <SectionTitle title="Zápisy na bločkoch" />
            <p className="px-1 text-sm text-text-2">{d.aliases.join(" · ")}</p>
          </Section>
        )}
      </div>

      {editing && <EditProductSheet d={d} onClose={() => setEditing(false)} />}
      {merging && <MergeProductSheet d={d} onClose={() => setMerging(false)} />}
    </div>
  );
}

function daysAgo(date: string): string {
  const days = Math.round((Date.now() - Date.parse(date + "T00:00:00")) / 86_400_000);
  if (days <= 0) return "dnes";
  if (days === 1) return "pred 1 dňom";
  return `pred ${days} dňami`;
}

function StoreCompare({ d, showUnit, colorOf }: { d: ProductDetail; showUnit: boolean; colorOf: (name: string) => string }) {
  const cheapest = d.stores[0]!.avg_unit;
  return (
    <Section>
      <SectionTitle title="Porovnanie obchodov" />
      <Group>
        {d.stores.map((s, i) => {
          const diff = cheapest > 0 ? s.avg_unit / cheapest - 1 : 0;
          return (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3">
              <span className="size-3 shrink-0 rounded-full" style={{ background: colorOf(s.name) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-xs text-text-3">
                  {s.count}× · naposledy {formatShortDate(s.last_date)} za {formatMoney(s.last_unit)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatMoney(s.avg_unit)}
                  {showUnit ? <span className="text-xs font-normal text-text-3"> {unitLabel(d.purchases[0]?.basis ?? "ks")}</span> : null}
                </p>
                <p className={cx("text-xs font-semibold", i === 0 ? "text-success" : "text-warning")}>
                  {i === 0 ? "najlacnejšie" : `+${Math.round(diff * 100)} %`}
                </p>
              </div>
            </div>
          );
        })}
      </Group>
      <p className="mt-2 px-1 text-xs text-text-3">Priemerná cena na regáli (pred zľavou), aby akcie neskresľovali porovnanie.</p>
    </Section>
  );
}

function EditProductSheet({ d, onClose }: { d: ProductDetail; onClose: () => void }) {
  const p = d.product;
  const update = useUpdateProduct(p.id);
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [brand, setBrand] = useState(p.brand ?? "");
  // Veľkosť zobrazujeme v bežných jednotkách: 1000 ml = 1 l.
  const initialUnit = p.size_unit === "g" && (p.size_value ?? 0) >= 1000 ? "kg" : p.size_unit === "ml" && (p.size_value ?? 0) >= 1000 ? "l" : (p.size_unit ?? "");
  const initialValue =
    p.size_value == null ? "" : initialUnit === "kg" || initialUnit === "l" ? String(p.size_value / 1000) : String(p.size_value);
  const [size, setSize] = useState(initialValue.replace(".", ","));
  const [unit, setUnit] = useState<string>(initialUnit);
  const [categoryId, setCategoryId] = useState(p.category_id);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Napíš názov produktu.");
    let sizeValue: number | null = null;
    let sizeUnit: "g" | "ml" | "ks" | null = null;
    if (size.trim() !== "" || unit) {
      const n = parseAmount(size);
      if (n === null || n <= 0 || !unit) return setError("Balenie: zadaj číslo aj jednotku, alebo nechaj obe prázdne.");
      sizeValue = unit === "kg" || unit === "l" ? n * 1000 : n;
      sizeUnit = unit === "kg" ? "g" : unit === "l" ? "ml" : (unit as "g" | "ml" | "ks");
    }
    setError(null);
    try {
      await update.mutateAsync({ name: name.trim(), brand: brand.trim() || null, sizeValue, sizeUnit, categoryId });
      toast.show("Produkt uložený", "success");
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "";
      toast.show(code === "PRODUCT_EXISTS" ? "Taký produkt už existuje. Použi radšej „Spojiť“." : readErrorMessage(err), "error");
    }
  }

  const selectClass =
    "min-h-12 rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";
  return (
    <Sheet open onClose={onClose} title="Upraviť produkt">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Názov" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        <TextField label="Značka (nepovinné)" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <TextField label="Balenie" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder="napr. 1" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-unit" className="text-sm font-medium text-text-2">
              Jednotka
            </label>
            <select id="product-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={selectClass}>
              <option value="">—</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="ks">ks</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-category" className="text-sm font-medium text-text-2">
            Kategória
          </label>
          <select id="product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-text-3">Zmena platí pre všetky nákupy tohto produktu, aj budúce.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={update.isPending}>
          Uložiť
        </Button>
      </form>
    </Sheet>
  );
}

function MergeProductSheet({ d, onClose }: { d: ProductDetail; onClose: () => void }) {
  const { household } = useHousehold();
  const products = useProducts(household.id);
  const merge = useMergeProducts();
  const toast = useToast();
  const navigate = useNavigate();
  const { search } = usePeriod();
  const [query, setQuery] = useState("");
  const words = normalizeName(d.product.name).split(" ").filter((w) => w.length > 2);
  const candidates = useMemo(() => {
    const needle = normalizeName(query);
    const list = (products.data ?? []).filter((x) => x.id !== d.product.id);
    if (needle) return list.filter((x) => normalizeName(`${x.name} ${x.brand ?? ""}`).includes(needle)).slice(0, 30);
    // Bez hľadania: najprv podobné názvy.
    const score = (name: string) => words.filter((w) => normalizeName(name).includes(w)).length;
    return list
      .map((x) => ({ x, s: score(x.name) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 15)
      .map((r) => r.x);
  }, [products.data, query, d.product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(id: string, name: string) {
    if (!window.confirm(`Je „${name}“ ten istý produkt ako „${d.product.name}“? Všetky jeho nákupy sa presunú sem.`)) return;
    try {
      await merge.mutateAsync({ target: d.product.id, sources: [id] });
      toast.show("Produkty spojené", "success");
      onClose();
      navigate(`/analytics/product/${d.product.id}${search}`, { replace: true });
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  return (
    <Sheet open onClose={onClose} title="Spojiť s rovnakým produktom">
      <p className="mb-3 text-sm text-text-2">
        Vyber produkt, ktorý je to isté ako „{d.product.name}“ (napr. ten istý tovar z iného obchodu). Jeho nákupy sa presunú sem.
      </p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hľadať produkt"
          aria-label="Hľadať produkt"
          className="min-h-11 w-full rounded-full border border-line-strong/40 bg-elevated pl-10 pr-4 text-base outline-none focus:border-primary"
        />
      </div>
      {products.isPending ? (
        <Spinner />
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-2">{query ? "Nič sa nenašlo." : "Napíš časť názvu produktu."}</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-surface)] bg-surface">
          {candidates.map((x) => (
            <button
              key={x.id}
              type="button"
              disabled={merge.isPending}
              onClick={() => void pick(x.id, x.name)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-pressed"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.name}</p>
                <p className="truncate text-xs text-text-3">
                  {[x.brand, sizeLabel(x.size_value, x.size_unit)].filter(Boolean).join(" · ")}
                  {x.brand || x.size_value ? " · " : ""}
                  {x.purchases}× · {x.last_store}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(x.last_price)}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
