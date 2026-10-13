import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, ChevronDown, ChevronRight, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { Banner, Button, Group, Section, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { CATEGORIES } from "@/lib/categories";
import { readStatement, useImportBankPayments, type StatementMatch, type StatementRow } from "./api";
import { formatMoney, formatShortDate, plural, readErrorMessage } from "./format";

type Loaded = { rows: StatementRow[]; matches: Map<number, StatementMatch>; fileHash: string };

/**
 * Import platieb z bankového výpisu. Výpis prečíta AI na serveri (nikde sa neukladá),
 * aplikácia ukáže pohyby rozdelené na skupiny a človek potvrdí, čo pridať.
 * Platby, ku ktorým už bloček máme, sa nepridajú – nákup by sa inak zarátal dvakrát.
 */
export function StatementImportPage() {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const importer = useImportBankPayments(household.id);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [showOther, setShowOther] = useState(false);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    setError(null);
    setData(null);
    try {
      const loaded = await readStatement(household.id, file);
      setData(loaded);
      // Predvolene vyberieme nákupy, ku ktorým bloček nemáme.
      setPicked(new Set(loaded.rows.filter((r) => r.direction === "out" && r.kind === "purchase" && !loaded.matches.has(r.idx)).map((r) => r.idx)));
      setCategories(Object.fromEntries(loaded.rows.map((r) => [r.idx, r.category_id])));
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setReading(false);
    }
  }

  const groups = useMemo(() => {
    const rows = data?.rows ?? [];
    const matched = (r: StatementRow) => data?.matches.has(r.idx) ?? false;
    return {
      purchases: rows.filter((r) => r.direction === "out" && r.kind === "purchase" && !matched(r)),
      bills: rows.filter((r) => r.direction === "out" && r.kind === "bill" && !matched(r)),
      matched: rows.filter((r) => r.direction === "out" && matched(r)),
      other: rows.filter((r) => r.direction === "out" && !["purchase", "bill"].includes(r.kind) && !matched(r)),
      incoming: rows.filter((r) => r.direction === "in"),
    };
  }, [data]);

  const selected = (data?.rows ?? []).filter((r) => picked.has(r.idx));
  const selectedSum = selected.reduce((s, r) => s + r.amount, 0);

  function toggle(idx: number) {
    const next = new Set(picked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setPicked(next);
  }

  async function doImport() {
    if (!data || selected.length === 0) return;
    try {
      const n = await importer.mutateAsync(
        selected.map((r) => ({
          date: r.date,
          amount: r.amount,
          merchant: r.merchant,
          category_id: categories[r.idx] ?? r.category_id,
          ref: `${data.fileHash}:${r.idx}`,
        })),
      );
      const skipped = selected.length - (n ?? 0);
      toast.show(
        `Pridané: ${n} ${plural(n ?? 0, ["platba", "platby", "platieb"])}${skipped > 0 ? ` (${skipped} už boli pridané skôr)` : ""}`,
        "success",
      );
      navigate("/receipts", { replace: true });
    } catch (err) {
      toast.show(readErrorMessage(err), "error");
    }
  }

  const row = (r: StatementRow, selectable = true) => {
    const on = picked.has(r.idx);
    return (
      <div key={r.idx} className={cx("flex items-start gap-3 px-4 py-3", on && "bg-primary-soft/50")}>
        {selectable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={`Pridať ${r.merchant} ${formatMoney(r.amount)}`}
            onClick={() => toggle(r.idx)}
            className={cx(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border-2",
              on ? "border-primary bg-primary text-on-primary" : "border-line-strong/60",
            )}
          >
            {on && <Check className="size-4" strokeWidth={3} />}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-medium">{r.merchant}</p>
            <p className="shrink-0 font-semibold tabular-nums">{formatMoney(r.amount)}</p>
          </div>
          <p className="truncate text-xs text-text-3">
            {formatShortDate(r.date)}
            {r.description ? ` · ${r.description}` : ""}
          </p>
          {selectable && on && (
            <select
              aria-label="Kategória"
              value={categories[r.idx] ?? r.category_id}
              onChange={(e) => setCategories({ ...categories, [r.idx]: e.target.value })}
              className="mt-2 min-h-9 w-full rounded-[var(--radius-control)] border border-line-strong/50 bg-elevated px-2 text-sm"
            >
              {CATEGORIES.filter((c) => c.id !== "deposit").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-40">
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link to="/receipts" aria-label="Späť na bločky" className="flex size-11 items-center justify-center rounded-full active:bg-pressed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Bankový výpis</h1>
      </header>

      <div className="mt-2 flex flex-col gap-5">
        {!data && !reading && (
          <Section>
            <div className="rounded-[var(--radius-surface)] bg-elevated p-5 shadow-sm">
              <p className="font-semibold">Pridaj platby, ku ktorým nemáš bloček</p>
              <p className="mt-1 text-sm text-text-2">
                Nahraj výpis z internet bankingu (PDF, CSV alebo snímku obrazovky). Aplikácia z neho vyberie platby kartou –
                tankovanie, reštaurácie, e-shopy – a ukáže ti ich na potvrdenie. Platby, ku ktorým už bloček máš, sa
                nezarátajú dvakrát.
              </p>
              <Button size="lg" block className="mt-4" onClick={() => input.current?.click()}>
                <FileUp className="size-5" aria-hidden /> Vybrať výpis
              </Button>
              <p className="mt-3 flex items-start gap-2 text-xs text-text-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Výpis sa nikde neukladá. Uložia sa len platby, ktoré potvrdíš (obchod, dátum, suma, kategória) – bez čísla účtu a
                zostatku. Najspoľahlivejší je CSV export.
              </p>
            </div>
          </Section>
        )}

        {reading && (
          <Section>
            <div className="flex items-center gap-3 rounded-[var(--radius-surface)] bg-elevated p-5 shadow-sm">
              <Loader2 className="size-6 shrink-0 animate-spin text-primary" aria-hidden />
              <div>
                <p className="font-semibold">Čítam výpis…</p>
                <p className="text-sm text-text-2">Dlhší výpis môže trvať do minúty. Nezatváraj aplikáciu.</p>
              </div>
            </div>
          </Section>
        )}

        {error && (
          <Section>
            <Banner
              tone="danger"
              title="Výpis sa nepodarilo spracovať"
              action={
                <Button variant="secondary" onClick={() => input.current?.click()}>
                  Skúsiť iný súbor
                </Button>
              }
            >
              {error}
            </Banner>
          </Section>
        )}

        {data && (
          <>
            <Section>
              <p className="px-1 text-sm text-text-2">
                Našiel som {data.rows.length} {plural(data.rows.length, ["pohyb", "pohyby", "pohybov"])}. Skontroluj, čo pridať, a
                prípadne zmeň kategóriu.
              </p>
            </Section>

            <ImportGroup
              title={`Nákupy bez bločku (${groups.purchases.length})`}
              hint="Predvolene vybrané. Odškrtni, čo nechceš."
              empty="Žiadne – ku všetkým nákupom už bločky máš."
            >
              {groups.purchases.map((r) => row(r))}
            </ImportGroup>

            {groups.bills.length > 0 && (
              <ImportGroup
                title={`Účty a pravidelné platby (${groups.bills.length})`}
                hint="Nájom, energie, mobil, poistenie… Zaškrtni, ak ich chceš vidieť v rodinnom rozpočte."
              >
                {groups.bills.map((r) => row(r))}
              </ImportGroup>
            )}

            {groups.matched.length > 0 && (
              <ImportGroup title={`Už máš bloček (${groups.matched.length})`} hint="Tieto sa nepridajú, aby sa nákup nezarátal dvakrát.">
                {groups.matched.map((r) => {
                  const m = data.matches.get(r.idx)!;
                  return (
                    <Link key={r.idx} to={`/receipts/${m.receipt_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-pressed">
                      <Check className="size-5 shrink-0 text-success" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.merchant}</p>
                        <p className="truncate text-xs text-text-3">
                          {formatShortDate(r.date)} · doklad: {m.store_name ?? "bez obchodu"}
                          {m.purchased_on ? `, ${formatShortDate(m.purchased_on)}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                      <ChevronRight className="size-4 text-text-3" aria-hidden />
                    </Link>
                  );
                })}
              </ImportGroup>
            )}

            {groups.other.length > 0 && (
              <Section>
                <button
                  type="button"
                  onClick={() => setShowOther((v) => !v)}
                  aria-expanded={showOther}
                  className="flex w-full items-center justify-between px-1 text-sm font-semibold text-text-2"
                >
                  Prevody, výbery a poplatky ({groups.other.length})
                  <ChevronDown className={cx("size-4 transition-transform", showOther && "rotate-180")} aria-hidden />
                </button>
                {showOther && (
                  <>
                    <p className="mb-2 mt-1 px-1 text-xs text-text-3">Bežne sa nezapočítavajú (presun peňazí, nie výdavok). Zaškrtni, ak niektorý je výdavok.</p>
                    <Group>{groups.other.map((r) => row(r))}</Group>
                  </>
                )}
              </Section>
            )}

            {groups.incoming.length > 0 && (
              <Section>
                <p className="px-1 text-xs text-text-3">
                  {groups.incoming.length} {plural(groups.incoming.length, ["príjem sa", "príjmy sa", "príjmov sa"])} nezapočítava (výplata,
                  vrátenia, prevody na účet).
                </p>
              </Section>
            )}
          </>
        )}
      </div>

      <input ref={input} type="file" accept="application/pdf,image/*,.csv,text/csv,.txt" hidden onChange={onPick} />

      {data && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
          <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-3">
            <Button block size="lg" className="shadow-lg" disabled={selected.length === 0} loading={importer.isPending} onClick={doImport}>
              {selected.length === 0
                ? "Nič nie je vybrané"
                : `Pridať ${selected.length} ${plural(selected.length, ["platbu", "platby", "platieb"])} · ${formatMoney(selectedSum)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportGroup({ title, hint, empty, children }: { title: string; hint?: string; empty?: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <Section>
      <h2 className="px-1 text-sm font-semibold text-text-2">{title}</h2>
      {hint && <p className="mb-2 px-1 text-xs text-text-3">{hint}</p>}
      {hasChildren ? <Group>{children}</Group> : empty ? <p className="px-1 text-sm text-text-2">{empty}</p> : null}
    </Section>
  );
}
