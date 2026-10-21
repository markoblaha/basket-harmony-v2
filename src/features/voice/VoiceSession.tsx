import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, History, Keyboard, ListPlus, Mic, MicOff, Pause, SendHorizontal, X } from "lucide-react";
import { StoreBadge, haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useLists, useListStats } from "@/features/lists/api";
import { addDays, dayLabel, isoDay } from "@/features/lists/dates";
import { guessCategory, normalizeName } from "@/lib/categories";
import { t, tn } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { getSetting } from "@/lib/settings";
import { interpretAI, loadDraft, saveDraft, useKnownStores, useSaveVoiceList, type DraftItem, type SaveResult } from "./api";
import { parseLocal, splitStore, type VoiceOp } from "./parse";
import { applyOps, diff, findItem, reconcile } from "./engine";
import { useSpeech } from "./useSpeech";
import { VoiceCard } from "./VoiceRow";

const cap = (s: string) => (s ? s[0]!.toLocaleUpperCase("sk-SK") + s.slice(1) : s);

/** Krok pri +1/−1 ako v prototype: gramy a ml po 100, kilá a litre po pol, inak kusy. */
function stepOf(unit: string | null): number {
  if (unit === "g" || unit === "ml") return 100;
  if (unit === "kg" || unit === "l") return 0.5;
  return 1;
}

type Modal = "store" | "pickStore" | "unsure" | null;

/**
 * Hlasový nákup (H1 + H2 z prototypu). Otvorí sa stredným tlačidlom lišty:
 *  H1 Kam ideš? – obchod ťuknutím alebo hlasom, pokračovanie v rozdiktovanom, pridanie do existujúceho zoznamu.
 *  H2 Diktovanie – každá veta sa hneď rozoberie lokálne a o chvíľu spresní cez AI; položky pribúdajú hore,
 *     upravujú sa hlasom („nie, tri“, „zmaž maslo“) aj ťukom/potiahnutím.
 *  Vytvoriť zoznam – uloží položky do Nákupu (nový zoznam alebo vybraný existujúci).
 * Rozdiktovaný zoznam sa priebežne ukladá v zariadení, takže sa nestratí.
 */
export function VoiceSession({ onClose, onSaved }: { onClose: () => void; onSaved: (store: string, r: SaveResult) => void }) {
  const { household } = useHousehold();
  const stores = useKnownStores(household.id).data ?? [];
  const lists = useLists(household.id).data ?? [];
  const stats = useListStats(household.id).data;
  const save = useSaveVoiceList(household.id);
  const toast = useToast();
  const today = isoDay(new Date());

  const [phase, setPhase] = useState<"h1" | "h2">("h1");
  const [draft] = useState(() => loadDraft(household.id));
  const [store, setStore] = useState("");
  const [date, setDate] = useState(today);
  const [targetListId, setTargetListId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [discardArm, setDiscardArm] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [typing, setTyping] = useState(false);
  const [doneHint, setDoneHint] = useState(false);
  // Mikrofón sa po otvorení zapne sám, ak to nastavenie (Viac → Nastavenia) nevypne.
  const [listening, setListening] = useState(() => getSetting("micAutostart"));
  const [said, setSaid] = useState("");
  const [refining, setRefining] = useState(0);
  const [busy, setBusy] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selRef = useRef(selected);
  selRef.current = selected;
  const seq = useRef(0);
  const pendingText = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const openLists = useMemo(() => lists.filter((l) => !l.completed_at), [lists]);
  const target = targetListId ? (lists.find((l) => l.id === targetListId) ?? null) : null;
  const storeName = target ? target.name : store || t("voice.noStore");

  // Rozdiktovaný zoznam priebežne ukladáme, aby ho nič nezmazalo (ani obnovenie stránky).
  useEffect(() => {
    if (phase === "h2") saveDraft(household.id, { store, date, targetListId, items, savedAt: Date.now() });
  }, [phase, store, date, targetListId, items, household.id]);

  // ---------------------------------------------------------------- zmeny zoznamu

  /** Nový stav zoznamu: zmenené karty znova „dopadnú“ (ako v prototype), nové pribudnú hore. */
  const present = useCallback((next: DraftItem[]) => {
    const d = diff(itemsRef.current, next);
    itemsRef.current = next;
    setItems(next);
    if (d.changed.length) {
      setFlash((f) => {
        const n = { ...f };
        for (const id of d.changed) n[id] = (n[id] ?? 0) + 1;
        return n;
      });
    }
  }, []);

  const patch = useCallback(
    (id: string, p: Partial<DraftItem>) => present(itemsRef.current.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [present],
  );

  const removeCard = useCallback(
    (id: string) => {
      const base = itemsRef.current;
      const idx = base.findIndex((c) => c.id === id);
      const c = base[idx];
      if (!c) return;
      present(base.filter((x) => x.id !== id));
      if (selRef.current === id) setSelected(null);
      toast.show(t("voice.removed", { name: c.name }), "info", {
        undo: () => {
          const n = [...itemsRef.current];
          n.splice(Math.min(idx, n.length), 0, c);
          present(n);
        },
      });
    },
    [present, toast],
  );

  const delta = useCallback(
    (id: string, d: 1 | -1) => {
      const c = itemsRef.current.find((x) => x.id === id);
      if (!c) return;
      const step = stepOf(c.unit);
      const q = c.quantity ?? 1;
      if (d < 0 && q <= step) return removeCard(id);
      haptic(d > 0 ? 12 : 8);
      patch(id, { quantity: Math.round((q + d * step) * 1000) / 1000, unit: c.unit ?? "ks" });
    },
    [patch, removeCard],
  );

  // ---------------------------------------------------------------- vety

  /** H2: jedna veta – hneď lokálny rozbor, súčasne AI, ktorá výsledok vety spresní. */
  const apply = useCallback(
    (text: string) => {
      const sp = splitStore(text, stores);
      if (sp.store && !targetListId) setStore(sp.store);
      let rest = sp.rest;
      if (!rest) {
        if (sp.store) haptic(10);
        return;
      }
      // „nie, tri“ / „nie 250 g“ = oprava vybranej alebo poslednej (najvyššej) karty.
      const correction = /^nie\b[\s,]*/i.exec(rest);
      if (correction) rest = rest.slice(correction[0].length);
      const before = itemsRef.current;
      const sel = selRef.current ? before.find((c) => c.id === selRef.current) : undefined;
      // „ešte jedno mlieko“ pridáva (navýši rovnakú položku), aj keď je nejaká karta vybraná.
      const more = /^(este|ešte)\s+(jeden|jedno|jednu|jedna|jedny)\s+\S/i.test(rest);
      let target = more ? null : (sel?.name ?? (correction ? (before[0]?.name ?? null) : null));
      let ops: VoiceOp[] = parseLocal(rest, target);
      // samotné množstvo („250 g“, „tri“) → oprava poslednej karty
      if (!target && !ops.length && before[0]) {
        target = before[0].name;
        ops = parseLocal(rest, target);
      }
      const missing = ops.filter((o): o is Extract<VoiceOp, { op: "remove" }> => o.op === "remove" && !findItem(before, o.target));
      for (const m of missing) toast.show(t("voice.notInList", { name: m.target }));
      const local = applyOps(before, ops);
      if (local.done) setDoneHint(true);
      if (local.understood) {
        present(local.items);
        haptic(10);
      }
      for (const r of local.removed) {
        toast.show(t("voice.removed", { name: r.item.name }), "info", {
          undo: () => {
            const n = [...itemsRef.current];
            n.splice(Math.min(r.index, n.length), 0, r.item);
            present(n);
          },
        });
      }
      if (sel && target && local.understood) setSelected(null);
      if (local.done && !local.added.length && !local.merged.length && !local.removed.length) return;

      const mine = ++seq.current;
      setRefining((r) => r + 1);
      void interpretAI(rest, before, target).then((aiOps) => {
        setRefining((r) => r - 1);
        if (!aiOps) {
          if (!local.understood && seq.current === mine) toast.show(t("voice.notUnderstood"));
          return;
        }
        const r = reconcile(itemsRef.current, local, aiOps);
        present(r.items);
        if (r.done) setDoneHint(true);
      });
    },
    [stores, targetListId, present, toast],
  );

  function openH2(o: { store?: string; targetListId?: string | null; text?: string; fromDraft?: boolean }) {
    if (o.fromDraft && draft) {
      setStore(draft.store);
      setDate(draft.date || today);
      setTargetListId(draft.targetListId);
      itemsRef.current = draft.items;
      setItems(draft.items);
    } else {
      setStore(o.store ?? "");
      setTargetListId(o.targetListId ?? null);
    }
    pendingText.current = o.text ?? null;
    setPhase("h2");
  }

  // Veta povedaná už na H1 („mlieko a rožky“) sa spracuje hneď po prechode na diktovanie.
  useEffect(() => {
    if (phase !== "h2" || !pendingText.current) return;
    const text = pendingText.current;
    pendingText.current = null;
    apply(text);
  }, [phase, apply]);

  /** H1: obchod, alebo rovno položky (s obchodom aj bez neho). */
  const handleH1 = useCallback(
    (text: string) => {
      const sp = splitStore(text, stores);
      const ops = sp.rest ? parseLocal(sp.rest) : [];
      if (ops.some((o) => o.op !== "done")) openH2({ store: sp.store ?? "", text: sp.rest });
      else if (sp.store) openH2({ store: sp.store });
      else toast.show(t("voice.storeNotUnderstood"));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stores, toast],
  );

  const onFinal = useCallback(
    (text: string) => {
      setSaid(text);
      if (phase === "h1") handleH1(text);
      else apply(text);
    },
    [phase, handleH1, apply],
  );

  const speech = useSpeech(onFinal);
  const blocked = speech.error === "denied";

  // Mikrofón počúva, kým nie je pozastavený (a kým sa neukladá).
  useEffect(() => {
    if (!speech.supported) {
      setTyping(true);
      return;
    }
    if (listening && !blocked && !busy) speech.start();
    else speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, blocked, busy, speech.supported]);

  useEffect(() => {
    if (blocked) setTyping(true);
  }, [blocked]);

  // iPhone: Safari sa na mikrofón pýta pri každom otvorení stránky, kým ho pre ňu natrvalo nepovolíš.
  useEffect(() => {
    if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    let n = 0;
    try {
      n = Number(localStorage.getItem("bh.voiceIosTip") ?? 0);
      localStorage.setItem("bh.voiceIosTip", String(n + 1));
    } catch {
      /* nevadí */
    }
    if (n < 3) timers.current.push(setTimeout(() => toast.show(t("voice.iosTip")), 1200));
  }, [toast]);

  // ---------------------------------------------------------------- zatvorenie, zahodenie, uloženie

  function close() {
    speech.stop();
    if (phase === "h2" && itemsRef.current.length) toast.show(t("voice.draftSaved"));
    onClose();
  }

  function discard() {
    if (!discardArm) {
      haptic(16);
      setDiscardArm(true);
      timers.current.push(setTimeout(() => setDiscardArm(false), 3000));
      return;
    }
    saveDraft(household.id, null);
    speech.stop();
    onClose();
    toast.show(t("voice.discarded"));
  }

  function create(force = false) {
    if (!items.length || busy) return;
    if (items.some((c) => c.status === "unclear") && !force) return setModal("unsure");
    if (!target && !store) return setModal("pickStore");
    void finish();
  }

  async function finish(storeOverride?: string) {
    const all = itemsRef.current;
    if (!all.length) return;
    const name = target ? target.name : (storeOverride ?? store) || t("voice.defaultListName");
    setBusy(true);
    try {
      const r = await save.mutateAsync({ store: name, listId: target?.id ?? null, date, items: all });
      saveDraft(household.id, null);
      haptic(22);
      onSaved(name, r);
    } catch (err) {
      setBusy(false);
      toast.show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modal) setModal(null);
      else close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  });

  // ---------------------------------------------------------------- zobrazenie

  const n = items.length;
  const unsureCount = items.filter((c) => c.status === "unclear").length;
  const days = [0, 1, 2, 4].map((d) => isoDay(addDays(new Date(), d)));
  const tileStores = store && !stores.some((s) => normalizeName(s) === normalizeName(store)) ? [...stores, store] : stores;

  const panelProps = {
    speech,
    blocked,
    listening,
    typing,
    said,
    thinking: refining > 0 && !speech.interim,
    onMic: () => {
      if (blocked || !speech.supported) return;
      haptic(8);
      setListening((l) => !l);
      setTyping(false);
    },
    onTypingToggle: () => setTyping((x) => !x),
    onTyped: (text: string) => {
      setSaid(text);
      if (phase === "h1") handleH1(text);
      else apply(text);
    },
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t("voice.open")} className="v-root fixed inset-0 z-50 bg-bg pt-safe">
      <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col">
        {phase === "h1" ? (
          <div key="h1" className="stack v-screen min-h-0 flex-1">
            <div className="v-top">
              <button type="button" className="ibtn" onClick={close} aria-label={t("common.close")}>
                <X size={22} />
              </button>
              <span className="grow t-sm t-2 fw-6" style={{ textAlign: "center", paddingRight: 44 }}>
                {t("voice.open")}
              </span>
            </div>
            <div className="scroll">
              <div className="stack g-20" style={{ padding: "4px 16px 20px" }}>
                <div className="stack g-4">
                  <span className="t-big">{t("voice.where")}</span>
                  <span className="t-sm t-2">{t("voice.whereSub")}</span>
                </div>
                <div className="v-store-tiles">
                  {stores.map((s) => (
                    <button key={s} type="button" className="v-store-tile" onClick={() => openH2({ store: s })}>
                      <StoreBadge name={s} size="lg" />
                      {s}
                    </button>
                  ))}
                </div>
                {(draft || openLists.length > 0) && (
                  <div className="stack g-8">
                    <span className="section-title">{t("voice.orContinue")}</span>
                    <div className="cells">
                      {draft && (
                        <button type="button" className="cell" onClick={() => openH2({ fromDraft: true })}>
                          <span className="cat-ic">
                            <History size={18} />
                          </span>
                          <span className="grow stack g-2">
                            <span className="t-body fw-5">{t("voice.continueDraft")}</span>
                            <span className="t-sm t-2">
                              {(draft.targetListId ? lists.find((l) => l.id === draft.targetListId)?.name : draft.store) || t("voice.noStore")} ·{" "}
                              {tn("shop.itemCount", draft.items.length)}
                            </span>
                          </span>
                          <ChevronRight size={18} className="chev" />
                        </button>
                      )}
                      {openLists.slice(0, 3).map((l) => (
                        <button key={l.id} type="button" className="cell" onClick={() => openH2({ targetListId: l.id })}>
                          <span className="cat-ic">
                            <ListPlus size={18} />
                          </span>
                          <span className="grow stack g-2">
                            <span className="t-body fw-5">{t("voice.addTo", { name: l.name })}</span>
                            <span className="t-sm t-2">
                              {l.planned_for ? dayLabel(l.planned_for) : t("trip.noDay")} · {tn("shop.itemCount", stats?.get(l.id)?.open ?? 0)}
                            </span>
                          </span>
                          <ChevronRight size={18} className="chev" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key="h2" className="stack v-screen min-h-0 flex-1">
            <div className="v-top">
              <button type="button" className="ibtn" onClick={close} aria-label={t("voice.closeKeep")}>
                <X size={22} />
              </button>
              <button
                type="button"
                className="grow stack center"
                onClick={() => !target && setModal("store")}
                style={{ minHeight: 44 }}
                aria-label={target ? undefined : t("voice.changeStoreAria")}
              >
                <span className="row g-6 t-h">
                  {(store || target) && <StoreBadge name={storeName} size="sm" />}
                  {storeName}
                  {!target && <ChevronDown size={16} className="t-3" />}
                </span>
                <span className="t-xs t-2">{target ? t("voice.addingToExisting") : dayLabel(date)}</span>
              </button>
              <button type="button" className={cx("btn btn-sm", discardArm ? "btn-danger" : "btn-ghost")} onClick={discard} style={{ minWidth: 76 }}>
                {discardArm ? t("voice.discardConfirm") : t("voice.discard")}
              </button>
            </div>
            <div className="row between px" style={{ paddingBottom: 6 }}>
              <span className="t-sm t-2 fw-6 num">{n ? tn("shop.itemCount", n) : t("voice.emptyShort")}</span>
              {n > 0 && <span className="t-xs t-3">{t("voice.gestureHint")}</span>}
            </div>
            <div
              className="scroll"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelected(null);
              }}
            >
              {n === 0 ? (
                <div className="stack center g-8" style={{ padding: "48px 32px", textAlign: "center" }}>
                  <span className="t-title">{t("voice.emptyHint")}</span>
                  <span className="t-sm t-2">{t("voice.emptyExample")}</span>
                </div>
              ) : (
                <div className="v-cards" aria-live="polite">
                  {items.map((c) => (
                    <VoiceCard
                      key={`${c.id}-${flash[c.id] ?? 0}`}
                      item={c}
                      selected={selected === c.id}
                      onSelect={() => setSelected((s) => (s === c.id ? null : c.id))}
                      onDelta={(d) => delta(c.id, d)}
                      onRemove={() => removeCard(c.id)}
                      onSetQty={(q, u) => patch(c.id, { quantity: q, unit: u, status: "ok" })}
                      onRename={(name) => {
                        const v = name.trim();
                        if (!v || v === c.name) return;
                        patch(c.id, { name: cap(v), categoryId: guessCategory(v), status: c.status === "unclear" ? "ok" : c.status, suggestions: [] });
                      }}
                      onResolve={(name) => {
                        patch(c.id, { name, categoryId: guessCategory(name), status: "ok", suggestions: [] });
                        haptic(10);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <AssistantPanel
          {...panelProps}
          placeholder={phase === "h1" ? t("voice.ph.h1") : selected ? t("voice.ph.edit") : t("voice.ph.dictate")}
          action={
            phase === "h2" ? (
              <button type="button" className={cx("btn btn-ink v-create", doneHint && "pulse-strong")} disabled={!n || busy} onClick={() => create()}>
                <Check size={18} />
                {busy ? t("voice.saving") : `${target ? t("voice.addAction") : t("voice.createList")} (${n})`}
              </button>
            ) : null
          }
        />

        {modal && (
          <div className="v-modal-wrap" onClick={() => setModal(null)}>
            <div className="v-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              {modal === "unsure" && (
                <>
                  <span className="t-title">{tn("voice.unsureTitle", unsureCount)}</span>
                  <span className="t-sm t-2">{t("voice.unsureText")}</span>
                  <div className="row g-8">
                    <button
                      type="button"
                      className="btn btn-soft grow"
                      onClick={() => {
                        setModal(null);
                        setSelected(items.find((c) => c.status === "unclear")?.id ?? null);
                      }}
                    >
                      {t("voice.refine")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ink grow"
                      onClick={() => {
                        setModal(null);
                        if (!target && !store) setModal("pickStore");
                        else void finish();
                      }}
                    >
                      {t("voice.createAnyway")}
                    </button>
                  </div>
                </>
              )}
              {(modal === "store" || modal === "pickStore") && (
                <>
                  <span className="t-title">{modal === "pickStore" ? t("voice.whichStore") : t("voice.storeAndDay")}</span>
                  <div className="v-store-tiles">
                    {tileStores.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={cx("v-store-tile sm", store === s && "on")}
                        onClick={() => {
                          setStore(s);
                          if (modal === "pickStore") {
                            setModal(null);
                            void finish(s);
                          }
                        }}
                      >
                        <StoreBadge name={s} />
                        {s}
                      </button>
                    ))}
                  </div>
                  {modal === "store" ? (
                    <>
                      <span className="field-label">{t("voice.when")}</span>
                      <div className="row g-8 wrap">
                        {days.map((d) => (
                          <button key={d} type="button" className={cx("chip lg", date === d && "on")} onClick={() => setDate(d)}>
                            {dayLabel(d)}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="btn btn-ink btn-block" onClick={() => setModal(null)}>
                        {t("voice.done")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-soft btn-block"
                      onClick={() => {
                        setModal(null);
                        void finish("");
                      }}
                    >
                      {t("voice.noStore")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Zvlnená animácia hlasu (stĺpiky ako v prototype). */
function Wave({ active, height = 22, bars = 7 }: { active: boolean; height?: number; bars?: number }) {
  return (
    <span className="row g-4" style={{ height }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={cx("v-bar", active && "on")} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

/** Živý prepis – posledné slová výraznejšie, počas reči trojbodka. */
function Transcript({ text, speaking, placeholder }: { text: string; speaking: boolean; placeholder: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return <p className="v-transcript t-3">{placeholder}</p>;
  return (
    <p className="v-transcript" aria-live="polite">
      „
      {words.map((w, i) => (
        <span key={i} style={{ opacity: i >= words.length - 3 ? 1 : 0.55 }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
      {speaking ? "…" : "“"}
    </p>
  );
}

/** Spodný panel asistenta: prepis, (písanie), mikrofón s vlnou, klávesnica a hlavná akcia. */
function AssistantPanel({
  speech,
  blocked,
  listening,
  typing,
  said,
  thinking,
  placeholder,
  action,
  onMic,
  onTypingToggle,
  onTyped,
}: {
  speech: ReturnType<typeof useSpeech>;
  blocked: boolean;
  listening: boolean;
  typing: boolean;
  said: string;
  thinking: boolean;
  placeholder: string;
  action: ReactNode;
  onMic: () => void;
  onTypingToggle: () => void;
  onTyped: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const noMic = blocked || !speech.supported;
  const speaking = !!speech.interim;
  const active = listening && !noMic;
  const status = noMic
    ? blocked
      ? t("voice.st.blocked")
      : t("voice.st.unsupported")
    : speaking
      ? t("voice.st.listening")
      : thinking
        ? t("voice.st.understanding")
        : listening
          ? t("voice.st.listening")
          : t("voice.st.paused");

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  function send(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    onTyped(v);
  }

  return (
    <div className="v-panel">
      {noMic ? (
        <div className="v-blocked stack g-6">
          <span className="t-h">{blocked ? t("voice.blockedTitle") : t("voice.unsupportedTitle")}</span>
          <span className="t-sm t-2">{blocked ? t("voice.blockedText") : t("voice.unsupportedText")}</span>
          {!typing && (
            <button type="button" className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={onTypingToggle}>
              <Keyboard size={16} /> {t("voice.type")}
            </button>
          )}
        </div>
      ) : (
        <Transcript text={speech.interim || said} speaking={speaking} placeholder={placeholder} />
      )}
      {typing && (
        <form className="row g-6 anim-pop" onSubmit={send}>
          <input
            ref={inputRef}
            className="input"
            style={{ minHeight: 44, fontSize: 15 }}
            placeholder={t("voice.typingPlaceholder")}
            value={text}
            maxLength={300}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            aria-label={t("voice.typeAria")}
          />
          <button type="submit" className="ibtn soft" aria-label={t("voice.sendAria")}>
            <SendHorizontal size={18} />
          </button>
        </form>
      )}
      <div className="v-controls">
        <button type="button" className={cx("ibtn soft", typing && "v-on")} onClick={onTypingToggle} aria-label={typing ? t("voice.speak") : t("voice.type")}>
          {typing ? <Mic size={19} /> : <Keyboard size={19} />}
        </button>
        <div className="stack center g-4" style={{ flex: "none" }}>
          <button
            type="button"
            className={cx("v-mic", active && "on")}
            onClick={onMic}
            disabled={noMic}
            aria-label={listening ? t("voice.pauseAria") : t("voice.resumeAria")}
          >
            {active && <span className="v-ring" />}
            {noMic ? <MicOff size={28} /> : listening ? <Wave active={speaking || thinking || active} height={26} bars={5} /> : <Pause size={26} />}
          </button>
          <span className="t-xs t-2 fw-6">{typing ? t("voice.st.typing") : status}</span>
        </div>
        <div className="grow row" style={{ justifyContent: "flex-end" }}>
          {action}
        </div>
      </div>
    </div>
  );
}
