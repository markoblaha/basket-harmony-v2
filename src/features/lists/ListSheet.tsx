import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronUp, Lock, Plus, TriangleAlert, Users } from "lucide-react";
import { BottomSheet, Seg, SheetHeader, StoreBadge } from "@/components/kit";
import { useToast } from "@/components/toast";
import { cx } from "@/components/ui";
import { normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t } from "@/i18n";
import { useCreateList, useUpdateList, type ShoppingList } from "./api";
import { addDays, dayLabel, isoDay, nextSaturday } from "./dates";

const STORES = ["Lidl", "Kaufland", "Tesco", "Billa", "DM", "Teta"];

type Day = "today" | "tomorrow" | "sat" | "pick";

/**
 * N2 – nový zoznam alebo úprava existujúceho (podľa prototypu): Kde (obchody ako čipy,
 * „Zatiaľ neviem“, „Iný…“), Kedy (dnes, zajtra, sobota, vybrať dátum), Pre koho
 * (domácnosť / Len ja) a pod „Ďalšie možnosti“ poznámka.
 */
export function ListSheet({
  open,
  onClose,
  householdId,
  householdName,
  me,
  lists,
  list,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  householdName: string;
  me: string;
  /** Všetky zoznamy domácnosti – pre poradie obchodov a upozornenie na duplicitu. */
  lists: ShoppingList[];
  /** Úprava existujúceho zoznamu. */
  list?: ShoppingList | null;
  onCreated?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateList(householdId);
  const update = useUpdateList(householdId);
  const edit = list ?? null;
  const canChangePrivacy = !edit || edit.created_by === me;

  // Obchody zoradené podľa počtu nákupov v histórii, potom bežné obchody.
  const stores = useMemo(() => {
    const count = new Map<string, { name: string; n: number }>();
    for (const l of lists) {
      const k = normalizeName(l.name);
      const c = count.get(k) ?? { name: l.name, n: 0 };
      c.n++;
      count.set(k, c);
    }
    const known = STORES.map((name) => ({ name, n: count.get(normalizeName(name))?.n ?? 0 }));
    return known.sort((a, b) => b.n - a.n).map((s) => s.name);
  }, [lists]);

  const isKnown = (n: string) => stores.some((s) => normalizeName(s) === normalizeName(n));
  const today = isoDay(new Date());
  const tomorrow = isoDay(addDays(new Date(), 1));
  const sat = isoDay(nextSaturday(addDays(new Date(), 1)));

  const [store, setStore] = useState<string | null>(edit && isKnown(edit.name) ? edit.name : null);
  const [custom, setCustom] = useState(edit && !isKnown(edit.name) ? edit.name : "");
  const [showCustom, setShowCustom] = useState(!!edit && !isKnown(edit.name));
  const [unsure, setUnsure] = useState(false);
  const initialDay: Day = !edit ? "today" : edit.planned_for === today ? "today" : edit.planned_for === tomorrow ? "tomorrow" : edit.planned_for === sat ? "sat" : "pick";
  const [day, setDay] = useState<Day>(initialDay);
  const [picked, setPicked] = useState(edit?.planned_for ?? isoDay(addDays(new Date(), 2)));
  const [time, setTime] = useState(edit?.planned_time?.slice(0, 5) ?? "");
  const [shared, setShared] = useState(edit ? !edit.is_private : true);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState(edit?.note ?? "");

  const date = day === "today" ? today : day === "tomorrow" ? tomorrow : day === "sat" ? sat : picked;
  const name = showCustom || unsure ? custom.trim() || (unsure ? t("ls.defaultName") : "") : (store ?? "");
  const canCreate = !!name;
  const dup = name
    ? lists.find((l) => !l.completed_at && l.id !== edit?.id && l.planned_for === date && normalizeName(l.name) === normalizeName(name))
    : undefined;
  const busy = create.isPending || update.isPending;

  async function submit() {
    if (!canCreate || busy) return;
    try {
      if (edit) {
        await update.mutateAsync({
          id: edit.id,
          patch: { name, planned_for: date, planned_time: time || null, note: note.trim() || null, ...(canChangePrivacy ? { is_private: !shared } : {}) },
        });
        onClose();
        toast.show(t("ls.edited"));
        return;
      }
      const id = await create.mutateAsync({ name, isPrivate: !shared, plannedFor: date, plannedTime: time || null, note: note.trim() || null });
      onClose();
      onCreated?.(id);
      toast.show(t("ls.created", { name, day: time ? `${dayLabel(date)} ${time}` : dayLabel(date) }));
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const dayChips: [Day, string][] = [
    ["today", t("lsheet.today")],
    ["tomorrow", t("lsheet.tomorrow")],
    ["sat", dayLabel(sat)],
    ["pick", day === "pick" ? formatDateTime(new Date(`${picked}T12:00:00`), { day: "numeric", month: "numeric" }) : t("ls.pickDate")],
  ];

  return (
    <BottomSheet open={open} onClose={onClose} label={edit ? t("ls.editTitle") : t("ls.newList")}>
      <SheetHeader title={edit ? t("ls.editTitle") : t("ls.newList")} onClose={onClose} />
      <div className="sheet-body stack g-20">
        <section className="stack g-10">
          <span className="field-label">{t("ls.where")}</span>
          <div className="row wrap g-8">
            {stores.map((s) => (
              <button
                key={s}
                type="button"
                className={cx("chip lg", !showCustom && !unsure && store === s && "on")}
                style={{ paddingLeft: 6 }}
                onClick={() => {
                  setStore(s);
                  setShowCustom(false);
                  setUnsure(false);
                }}
              >
                <StoreBadge name={s} size="sm" />
                {s}
              </button>
            ))}
            <button
              type="button"
              className={cx("chip lg", unsure && "on")}
              onClick={() => {
                setUnsure(true);
                setShowCustom(false);
                setStore(null);
              }}
            >
              {t("ls.unsure")}
            </button>
            <button
              type="button"
              className={cx("chip lg", showCustom && "on")}
              onClick={() => {
                setShowCustom(true);
                setUnsure(false);
              }}
            >
              <Plus size={15} />
              {t("ls.other")}
            </button>
          </div>
          {(showCustom || unsure) && (
            <input
              className="input anim-pop"
              autoFocus
              maxLength={60}
              placeholder={unsure ? t("ls.nameOptional") : t("ls.namePlaceholder")}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
          {dup && (
            <div className="row g-10 anim-pop" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--yellow-soft)", color: "var(--yellow)" }}>
              <TriangleAlert size={16} />
              <span className="grow t-sm fw-5">{t("ls.duplicateWarn", { name: dup.name, day: dayLabel(date) })}</span>
              <button
                type="button"
                className="btn btn-sm btn-line"
                onClick={() => {
                  onClose();
                  navigate(`/lists/${dup.id}`);
                }}
              >
                {t("ls.open")}
              </button>
            </div>
          )}
        </section>

        <section className="stack g-10">
          <span className="field-label">{t("lsheet.when")}</span>
          <div className="row wrap g-8">
            {dayChips.map(([v, label]) => (
              <button key={v} type="button" className={cx("chip lg", day === v && "on")} onClick={() => setDay(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="row g-8">
            {day === "pick" && (
              <input className="input grow" type="date" aria-label={t("lsheet.pickDay")} value={picked} min={today} onChange={(e) => setPicked(e.target.value || picked)} />
            )}
            <input
              className="input"
              type="time"
              aria-label={t("ls.timeOptional")}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ maxWidth: day === "pick" ? 130 : "100%" }}
            />
          </div>
        </section>

        <section className="stack g-10">
          <span className="field-label">{t("ls.forWhom")}</span>
          <Seg
            value={shared ? "shared" : "me"}
            onChange={(v) => canChangePrivacy && setShared(v === "shared")}
            className={cx(!canChangePrivacy && "opacity-50")}
            options={[
              { value: "shared", label: householdName, icon: <Users size={15} /> },
              { value: "me", label: t("trip.onlyMe"), icon: <Lock size={15} /> },
            ]}
          />
          <span className="t-xs t-3" style={{ padding: "0 4px" }}>
            {!canChangePrivacy ? t("lsheet.privacyLocked") : shared ? t("lsheet.sharedNote") : t("ls.privateNote")}
          </span>
        </section>

        <section className="stack g-8">
          <button type="button" className="row g-6 t-sm fw-6 t-2" style={{ minHeight: 40, padding: "0 4px" }} onClick={() => setMore(!more)} aria-expanded={more}>
            {t("ls.moreOptions")}
            {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {more && (
            <div className="cells anim-pop">
              <div className="cell">
                <input className="input" maxLength={200} placeholder={t("ls.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}
        </section>

        <button type="button" className="btn btn-ink btn-lg btn-block" disabled={!canCreate || busy} onClick={() => void submit()}>
          {edit ? t("lsheet.save") : canCreate ? t("ls.createNamed", { name }) : t("ls.pickStore")}
        </button>
      </div>
    </BottomSheet>
  );
}
