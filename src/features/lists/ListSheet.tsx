import { useMemo, useState, type FormEvent } from "react";
import { Archive, CalendarDays, Lock, Users } from "lucide-react";
import { Avatar, Button, Sheet, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { useCreateList, useUpdateList, type ShoppingList } from "./api";
import { addDays, dayLabel, isoDay, nextSaturday } from "./dates";

const STORES = ["Lidl", "Kaufland", "Tesco", "Billa", "DM", "Teta", "Lekáreň", "Pepco", "IKEA"];

/**
 * Nový nákup (alebo úprava existujúceho). Hore prepínač, kto ho uvidí:
 * celá skupina naživo, alebo „Len ja“ – súkromný zoznam, ktorý sa nikomu nezdieľa.
 */
export function ListSheet({
  open,
  onClose,
  householdId,
  householdName,
  memberNames,
  me,
  recentNames,
  list,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  householdName: string;
  memberNames: string[];
  me: string;
  /** Obchody z histórie – ponúkneme ich ako prvé. */
  recentNames: string[];
  /** Úprava existujúceho nákupu. */
  list?: ShoppingList | null;
  onCreated?: (id: string) => void;
}) {
  const create = useCreateList(householdId);
  const update = useUpdateList(householdId);
  const toast = useToast();
  const editing = !!list;
  const canChangePrivacy = !list || list.created_by === me;

  const [isPrivate, setPrivate] = useState(list?.is_private ?? false);
  const [name, setName] = useState(list?.name ?? "");
  const [planned, setPlanned] = useState<string | null>(list?.planned_for ?? isoDay(new Date()));
  const [note, setNote] = useState(list?.note ?? "");

  const stores = useMemo(() => {
    const seen = new Set<string>();
    return [...recentNames, ...STORES].filter((n) => {
      const k = normalizeName(n);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 9);
  }, [recentNames]);

  const today = isoDay(new Date());
  const tomorrow = isoDay(addDays(new Date(), 1));
  const saturday = isoDay(nextSaturday());
  const dayChips: [string, string | null][] = [
    ["Dnes", today],
    ["Zajtra", tomorrow],
    ...(saturday !== today && saturday !== tomorrow ? ([[`Sobota ${dayLabel(saturday).slice(3)}`, saturday]] as [string, string][]) : []),
    ["Bez dňa", null],
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      if (list) {
        await update.mutateAsync({
          id: list.id,
          patch: { name: n, planned_for: planned, note: note.trim() || null, ...(canChangePrivacy ? { is_private: isPrivate } : {}) },
        });
        toast.show("Nákup upravený", "success");
        onClose();
      } else {
        const id = await create.mutateAsync({ name: n, isPrivate, plannedFor: planned, note: note.trim() || null });
        onClose();
        onCreated?.(id);
      }
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function archive() {
    if (!list) return;
    try {
      await update.mutateAsync({ id: list.id, patch: { is_archived: true } });
      toast.show(`„${list.name}“ odstránené z prehľadu`);
      onClose();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Upraviť nákup" : "Nový nákup"}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Kto ho uvidí */}
        <div>
          <div role="radiogroup" aria-label="Kto uvidí tento nákup" className={cx("grid grid-cols-2 gap-1 rounded-[0.875rem] bg-surface p-1", !canChangePrivacy && "opacity-50")}>
            {(
              [
                [false, householdName, "spoločný", <Users key="u" className="size-4" aria-hidden />],
                [true, "Len ja", "súkromný", <Lock key="l" className="size-4" aria-hidden />],
              ] as const
            ).map(([priv, title, sub, icon]) => (
              <button
                key={String(priv)}
                type="button"
                role="radio"
                aria-checked={isPrivate === priv}
                disabled={!canChangePrivacy}
                onClick={() => setPrivate(priv)}
                className={cx(
                  "flex items-center gap-2.5 rounded-[0.6875rem] px-3 py-2.5 text-left transition-colors",
                  isPrivate === priv ? "bg-elevated shadow-[0_1px_3px_rgb(0_0_0/0.14)]" : "text-text-2",
                )}
              >
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-[0.5625rem]", isPrivate === priv ? (priv ? "bg-primary text-on-primary" : "bg-person text-on-primary") : "bg-bg")}>
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{title}</span>
                  <span className="block text-xs text-text-2">{sub}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-2 px-0.5 text-[0.8125rem] leading-snug text-text-2" aria-live="polite">
            {isPrivate ? (
              <>
                <Lock className="size-3.5 shrink-0" aria-hidden />
                Uvidíš ho len ty. Nezdieľa sa s nikým zo skupiny.
              </>
            ) : (
              <>
                <span className="flex shrink-0">
                  {memberNames.slice(0, 3).map((n, i) => (
                    <span key={n + i} className={cx(i > 0 && "-ml-1.5 rounded-md ring-2 ring-elevated")}>
                      <Avatar name={n} size="sm" me={i === 0} />
                    </span>
                  ))}
                </span>
                Uvidia ho všetci v skupine a zmeny sa ukážu naživo.
              </>
            )}
          </p>
          {!canChangePrivacy && <p className="mt-1 px-0.5 text-xs text-text-3">Súkromie môže zmeniť len ten, kto nákup založil.</p>}
        </div>

        {/* Kde */}
        <div>
          <label htmlFor="list-name" className="mb-1.5 block text-sm font-semibold text-text-2">
            Kde nakupuješ
          </label>
          <input
            id="list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Napríklad Lidl"
            maxLength={60}
            autoFocus={!editing}
            autoComplete="off"
            className="h-[3.25rem] w-full rounded-[var(--radius-control)] border border-line bg-bg px-3.5 text-base font-semibold outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-text-3 focus:border-primary focus:ring-3 focus:ring-primary/10"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stores.map((s) => {
              const on = normalizeName(s) === normalizeName(name);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setName(s)}
                  className={cx(
                    "h-9 rounded-[0.625rem] border px-3 text-sm font-semibold transition-colors",
                    on ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated text-text active:bg-pressed",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kedy */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-text-2">Kedy</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {dayChips.map(([label, value]) => (
              <button
                key={label}
                type="button"
                aria-pressed={planned === value}
                onClick={() => setPlanned(value)}
                className={cx(
                  "h-9 rounded-[0.625rem] border px-3 text-sm font-semibold transition-colors",
                  planned === value ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated text-text active:bg-pressed",
                )}
              >
                {label}
              </button>
            ))}
            <label
              className={cx(
                "relative flex h-9 items-center gap-1.5 rounded-[0.625rem] border px-3 text-sm font-semibold",
                planned && ![today, tomorrow, saturday].includes(planned) ? "border-primary bg-primary text-on-primary" : "border-line bg-elevated",
              )}
            >
              <CalendarDays className="size-4" aria-hidden />
              {planned && ![today, tomorrow, saturday].includes(planned) ? dayLabel(planned) : "Iný deň"}
              <input
                type="date"
                aria-label="Vybrať iný deň"
                value={planned ?? ""}
                onChange={(e) => setPlanned(e.target.value || null)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="list-note" className="mb-1.5 block text-sm font-semibold text-text-2">
            Poznámka <span className="font-normal text-text-3">(nepovinné)</span>
          </label>
          <input
            id="list-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="napr. po práci, cestou z tréningu"
            maxLength={200}
            autoComplete="off"
            className="h-12 w-full rounded-[var(--radius-control)] border border-dashed border-line bg-transparent px-3.5 text-[0.9375rem] outline-none placeholder:text-text-3 focus:border-solid focus:border-primary"
          />
        </div>

        <Button type="submit" variant={editing ? "primary" : "accent"} size="lg" block loading={create.isPending || update.isPending} disabled={!name.trim()}>
          {editing ? "Uložiť zmeny" : isPrivate ? "Vytvoriť súkromný nákup" : "Vytvoriť nákup"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" block onClick={archive}>
            <Archive className="size-4" aria-hidden /> Odstrániť z prehľadu
          </Button>
        )}
      </form>
    </Sheet>
  );
}
