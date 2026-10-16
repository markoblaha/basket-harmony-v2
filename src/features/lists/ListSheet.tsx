import { useMemo, useState, type FormEvent } from "react";
import { Archive, CalendarDays, Lock, Users } from "lucide-react";
import { Avatar, Button, Sheet, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { useCreateList, useUpdateList, type ShoppingList } from "./api";
import { formatDateTime, t } from "@/i18n";
import { addDays, dayLabel, isoDay, nextSaturday } from "./dates";

const storeSuggestions = () => ["Lidl", "Kaufland", "Tesco", "Billa", "DM", "Teta", t("lsheet.pharmacy"), "Pepco", "IKEA"];

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
    return [...recentNames, ...storeSuggestions()].filter((n) => {
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
    [t("lsheet.today"), today],
    [t("lsheet.tomorrow"), tomorrow],
    ...(saturday !== today && saturday !== tomorrow ? ([[t("lsheet.saturday", { date: formatDateTime(nextSaturday(), { day: "numeric", month: "numeric" }) }), saturday]] as [string, string][]) : []),
    [t("lsheet.noDay"), null],
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
        toast.show(t("lsheet.edited"), "success");
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
      toast.show(t("lsheet.archived", { name: list.name }));
      onClose();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("trip.edit") : t("hub.new")}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        {/* Kto ho uvidí */}
        <div>
          <div role="radiogroup" aria-label={t("lsheet.whoAria")} className={cx("grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1", !canChangePrivacy && "opacity-50")}>
            {(
              [
                [false, householdName, t("lsheet.shared"), <Users key="u" className="size-4" aria-hidden />],
                [true, t("trip.onlyMe"), t("hub.private"), <Lock key="l" className="size-4" aria-hidden />],
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
                  "flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-200",
                  isPrivate === priv ? "bg-elevated shadow-card" : "text-text-2",
                )}
              >
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", isPrivate === priv ? "bg-primary-soft text-primary" : "bg-surface/60")}>
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-strong">{title}</span>
                  <span className="block text-xs text-text-2">{sub}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-2 px-1 text-footnote text-text-2" aria-live="polite">
            {isPrivate ? (
              <>
                <Lock className="size-3.5 shrink-0" aria-hidden />
                {t("lsheet.privateNote")}
              </>
            ) : (
              <>
                <span className="flex shrink-0">
                  {memberNames.slice(0, 3).map((n, i) => (
                    <span key={n + i} className={cx(i > 0 && "-ml-2 rounded-full ring-2 ring-surface")}>
                      <Avatar name={n} size="sm" me={i === 0} />
                    </span>
                  ))}
                </span>
                {t("lsheet.sharedNote")}
              </>
            )}
          </p>
          {!canChangePrivacy && <p className="mt-1 px-0.5 text-xs text-text-3">{t("lsheet.privacyLocked")}</p>}
        </div>

        {/* Kde */}
        <div>
          <label htmlFor="list-name" className="mb-2 block text-footnote font-medium text-text-2">
            {t("lsheet.where")}
          </label>
          <input
            id="list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("lsheet.wherePlaceholder")}
            maxLength={60}
            autoComplete="off"
            className="h-12 w-full rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-4 text-base font-strong outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-text-3 focus:border-primary focus:ring-3 focus:ring-primary/20"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {stores.map((s) => {
              const on = normalizeName(s) === normalizeName(name);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setName(s)}
                  className={cx(
                    "h-11 rounded-full px-4 text-sm font-strong transition-colors duration-[120ms]",
                    on ? "bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text active:bg-pressed",
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
          <span className="mb-2 block text-footnote font-medium text-text-2">{t("lsheet.when")}</span>
          <div className="flex flex-wrap items-center gap-2">
            {dayChips.map(([label, value]) => (
              <button
                key={label}
                type="button"
                aria-pressed={planned === value}
                onClick={() => setPlanned(value)}
                className={cx(
                  "h-11 rounded-full px-4 text-sm font-strong transition-colors duration-[120ms]",
                  planned === value ? "bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text active:bg-pressed",
                )}
              >
                {label}
              </button>
            ))}
            <label
              className={cx(
                "relative flex h-11 items-center gap-2 rounded-full px-4 text-sm font-strong",
                planned && ![today, tomorrow, saturday].includes(planned) ? "bg-primary-soft text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-sunken text-text active:bg-pressed",
              )}
            >
              <CalendarDays className="size-4" aria-hidden />
              {planned && ![today, tomorrow, saturday].includes(planned) ? dayLabel(planned) : t("lsheet.otherDay")}
              <input
                type="date"
                aria-label={t("lsheet.pickDay")}
                value={planned ?? ""}
                onChange={(e) => setPlanned(e.target.value || null)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="list-note" className="mb-2 block text-footnote font-medium text-text-2">
            {t("lsheet.note")} <span className="font-normal text-text-3">{t("lsheet.optional")}</span>
          </label>
          <input
            id="list-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("lsheet.notePlaceholder")}
            maxLength={200}
            autoComplete="off"
            className="h-12 w-full rounded-[var(--radius-control)] border border-line-strong/60 bg-elevated px-4 text-callout outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-primary focus:ring-3 focus:ring-primary/20"
          />
        </div>

        <Button type="submit" size="lg" block loading={create.isPending || update.isPending} disabled={!name.trim()}>
          {editing ? t("lsheet.save") : isPrivate ? t("lsheet.createPrivate") : t("lsheet.create")}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" block onClick={archive}>
            <Archive className="size-4" aria-hidden /> {t("lsheet.archive")}
          </Button>
        )}
      </form>
    </Sheet>
  );
}
