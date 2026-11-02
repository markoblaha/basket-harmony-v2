/**
 * Nový zoznam – prenesený z mockupu 1:1 (prototyp/src/lists.jsx NewListSheet): názov, obchod (6 najčastejších,
 * obchod sa rozpozná aj z napísaného názvu), kedy (Dnes / Zajtra / Pozajtra / dátum), kto ho uvidí.
 * Tlačidlo Vytvoriť je vždy viditeľné pod obsahom – netreba rolovať.
 */
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useToast } from "@/components/toast";
import { useReceipts } from "@/features/receipts/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, t, tn } from "@/i18n";
import { I } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Btn, STORES, storeKeyOf } from "@/mockup/kit";
import { useCreateList, type ShoppingList } from "./api";
import { addDays, dayLabel, isoDay } from "./dates";

/** Obchody na výber, keď domácnosť ešte nemá históriu. */
const DEFAULT = ["lidl", "kaufland", "tesco", "billa", "dm", "drmax"];

export function NewListSheet({
  open,
  onClose,
  householdId,
  householdName,
  lists,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  householdName: string;
  lists: ShoppingList[];
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const create = useCreateList(householdId);
  const receipts = useReceipts(householdId);
  const [name, setName] = useState("");
  const [store, setStore] = useState<string | null>(null);
  const auto = useRef(false); // obchod vybraný podľa napísaného názvu, nie ťuknutím
  const [day, setDay] = useState(1);
  const [date, setDate] = useState(""); // vlastný dátum (RRRR-MM-DD), prednosť pred Dnes/Zajtra
  const [mine, setMine] = useState(false); // predvolene spoločný zoznam domácnosti

  // Najčastejšie obchody podľa bločkov a zoznamov domácnosti.
  const all = useMemo(() => {
    const cnt = new Map<string, number>();
    for (const r of receipts.data ?? []) {
      const k = storeKeyOf(r.store_name);
      if (k) cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    for (const l of lists) {
      const k = storeKeyOf(l.name);
      if (k && !cnt.has(k)) cnt.set(k, 0);
    }
    const keys = [...cnt.keys()].sort((a, b) => cnt.get(b)! - cnt.get(a)!);
    for (const k of DEFAULT) if (!keys.includes(k)) keys.push(k);
    return keys.map((k) => ({ k, cnt: cnt.get(k) ?? 0 }));
  }, [receipts.data, lists]);
  // 6 najčastejších obchodov; obchod rozpoznaný z názvu sa ukáže, aj keď medzi nimi nie je
  const freq = store && all.findIndex((x) => x.k === store) >= 6 ? [...all.slice(0, 5), all.find((x) => x.k === store)!] : all.slice(0, 6);

  const typed = (v: string) => {
    setName(v);
    if (store && !auto.current) return;
    const k = storeKeyOf(v.trim());
    auto.current = !!k;
    setStore(k);
  };
  const pick = (k: string) => {
    auto.current = false;
    if (store === k) {
      setStore(null);
      if (name.trim() === STORES[k]!.n) setName("");
      return;
    }
    setStore(k);
    if (!name.trim() || storeKeyOf(name.trim())) setName(STORES[k]!.n);
  };
  const title = name.trim() || (store ? STORES[store]!.n : "");

  async function submit() {
    if (!title) {
      document.getElementById("nl-name")?.focus();
      return;
    }
    const planned = date || isoDay(addDays(new Date(), day));
    try {
      const id = await create.mutateAsync({ name: title, isPrivate: mine, plannedFor: planned, note: null });
      onClose();
      onCreated(id);
      toast.show(t("ls.created", { name: title, day: dayLabel(planned) }));
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const days: [number, string][] = [
    [0, t("date.today")],
    [1, t("date.tomorrow")],
    [2, t("nl.dayAfter")],
  ];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <Sheet open={open} onClose={onClose} label={t("ls.newList")} cls="nl">
      <div className="sh-head">
        <h2>{t("ls.newList")}</h2>
      </div>
      <div className="sh-body">
        <label className="fl">
          <span>{t("nl.name")}</span>
          <input
            id="nl-name"
            value={name}
            onChange={(e) => typed(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder={t("nl.namePh")}
            enterKeyHint="done"
            autoComplete="off"
          />
        </label>
        <div>
          <span className="k">
            {t("nl.store")} <small>· {t("nl.storeHint")}</small>
          </span>
          <div className="stgrid">
            {freq.map(({ k, cnt }) => (
              <button type="button" key={k} aria-pressed={store === k} className={`stb${store === k ? " on" : ""}`} style={{ "--sc": STORES[k]!.c1 } as CSSProperties} onClick={() => pick(k)}>
                <b>{STORES[k]!.n}</b>
                {cnt > 0 && <small>{tn("nl.trips", cnt)}</small>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="k">{t("nl.when")}</span>
          <div className="days">
            {days.map(([d, l]) => (
              <button
                type="button"
                key={d}
                className={`chip plain${!date && day === d ? " on" : ""}`}
                onClick={() => {
                  setDay(d);
                  setDate("");
                }}
              >
                {cap(l)}
              </button>
            ))}
            <label className={`chip plain datec${date ? " on" : ""}`}>
              <I n="calendar-blank" />
              {date ? formatDateTime(new Date(`${date}T00:00`), { weekday: "short", day: "numeric", month: "numeric" }) : t("nl.date")}
              <input
                type="date"
                aria-label={t("nl.pickDate")}
                min={isoDay(new Date())}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    /* starší prehliadač – otvorí sa sám */
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div>
          <span className="k">{t("nl.who")}</span>
          <div className="who">
            <button type="button" aria-pressed={!mine} className={`whob${!mine ? " on" : ""}`} onClick={() => setMine(false)}>
              <I n="users-three" />
              <span>
                <b>{householdName}</b>
                <small>{t("nl.shared")}</small>
              </span>
            </button>
            <button type="button" aria-pressed={mine} className={`whob${mine ? " on" : ""}`} onClick={() => setMine(true)}>
              <I n="lock-simple" />
              <span>
                <b>{t("nl.onlyMe")}</b>
                <small>{t("nl.private")}</small>
              </span>
            </button>
          </div>
        </div>
      </div>
      <div className="sh-foot">
        <Btn cls="pri full" disabled={!title || create.isPending} onClick={() => void submit()}>
          {title ? t("nl.create", { name: title }) : t("nl.needName")}
        </Btn>
      </div>
    </Sheet>
  );
}
