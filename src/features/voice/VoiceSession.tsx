import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Keyboard, Mic, MicOff, X } from "lucide-react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { t, tn } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { interpretAI, loadDraft, saveDraft, useKnownStores, useSaveVoiceList, type DraftItem, type SaveResult } from "./api";
import { matchStore, parseLocal } from "./parse";
import { applyOps, diff, reconcile, stepOf } from "./engine";
import { buzz, useSpeech } from "./useSpeech";
import { VoiceRow, type RowAnim } from "./VoiceRow";

/** Vlna hlasu – tri periodické krivky; posun o 390 px nadväzuje bez skoku. */
function wavePath(fn: (x: number) => number) {
  let d = "M0 32";
  for (let x = 5; x <= 780; x += 5) d += ` L${x} ${(32 + fn(x)).toFixed(1)}`;
  return d;
}
const W1 = wavePath((x) => Math.sin((x / 130) * Math.PI * 2) * 22 * (0.55 + 0.45 * Math.sin((x / 390) * Math.PI * 2)));
const W2 = wavePath((x) => Math.sin((x / 195) * Math.PI * 2 + 1) * 15);
const W3 = wavePath((x) => Math.sin((x / 78) * Math.PI * 2 + 2) * 12 * Math.abs(Math.sin((x / 390) * Math.PI * 2)));

/**
 * Hlasový nákup. Otvorí sa tlačidlom v strede navigácie s už zapnutým mikrofónom:
 *  1. Kam ideš? – predajňa ťuknutím, napísaním alebo hlasom („idem do Lidla“).
 *  2. Diktovanie – každá veta ide na rozbor (AI, záloha lokálne), položky padajú zhora.
 *  3. Hotovo – zoznam sa uloží do Nákupu ako bežný zoznam s názvom predajne.
 * Rozdiktovaný zoznam sa priebežne ukladá v prehliadači, takže sa nestratí.
 */
export function VoiceSession({ onClose, onSaved }: { onClose: () => void; onSaved: (store: string, r: SaveResult) => void }) {
  const { household } = useHousehold();
  const stores = useKnownStores(household.id).data ?? [];
  const save = useSaveVoiceList(household.id);
  const toast = useToast();

  const [phase, setPhase] = useState<"pick" | "dict">("pick");
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [store, setStore] = useState("");
  const [custom, setCustom] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [anims, setAnims] = useState<Record<string, Partial<RowAnim>>>({});
  const [lastId, setLastId] = useState<string | null>(null);
  const [pushKey, setPushKey] = useState<"a" | "b">("a");
  const [shake, setShake] = useState<"a" | "b" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [goneId, setGoneId] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [paused, setPaused] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<{ text: string; k: number; ms: number } | null>(null);
  const [unclearWarned, setUnclearWarned] = useState(false);
  const [draft, setDraft] = useState(() => loadDraft(household.id));

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showHint = useCallback((text: string, ms = 4000) => {
    setHint((h) => ({ text, k: (h?.k ?? 0) + 1, ms }));
    later(() => setHint((h) => (h?.text === text ? null : h)), ms);
  }, [later]);

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
    if (n < 3) later(() => showHint(t("voice.iosTip"), 7000), 1200);
  }, [later, showHint]);

  // Rozdiktovaný zoznam priebežne ukladáme, aby ho nič nezmazalo.
  useEffect(() => {
    if (phase === "dict") saveDraft(household.id, { store, items, savedAt: Date.now() });
  }, [phase, store, items, household.id]);

  // ---------------------------------------------------------------- animácie

  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [ghosts, setGhosts] = useState<{ item: DraftItem; index: number }[]>([]);
  const [refining, setRefining] = useState(0);
  const [discardArmed, setDiscardArmed] = useState(false);

  const flash = useCallback((ids: string[]) => {
    setAnims((a) => {
      const n = { ...a };
      for (const id of ids) {
        const p = n[id] ?? {};
        n[id] = { ...p, bump: p.bump === "a" ? "b" : "a", glow: p.glow === "a" ? "b" : "a" };
      }
      return n;
    });
  }, []);

  /**
   * Prechod na nový stav zoznamu: nové položky padajú po jednej (najnovšia dopadne hore),
   * odstránené odídu doľava, zmenené bliknú. Dáta sa menia hneď – animácia len dobieha.
   */
  const present = useCallback((next: DraftItem[]) => {
    const d = diff(itemsRef.current, next);
    itemsRef.current = next;
    setItems(next);
    if (d.removed.length) {
      setGhosts((g) => [...g, ...d.removed]);
      later(() => setGhosts((g) => g.filter((x) => !d.removed.some((r) => r.item.id === x.item.id))), 300);
    }
    if (d.changed.length) {
      flash(d.changed);
      buzz(10);
    }
    if (!d.added.length) return;
    setLastId(null);
    const order = [...d.added].reverse();
    setHidden((h) => new Set([...h, ...order]));
    order.forEach((id, k) =>
      later(() => {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
        setLastId(id);
        setPushKey((p) => (p === "a" ? "b" : "a"));
        const el = listRef.current;
        // Keď si posunutý nižšie (kontroluješ zoznam), nepreskakujeme – len jemne upozorníme.
        if (el && el.scrollTop < 140) el.scrollTo({ top: 0, behavior: "smooth" });
        else if (k === 0) showHint(t("voice.newOnTop"));
        later(() => {
          setShake((s) => (s === "a" ? "b" : "a"));
          const it = itemsRef.current.find((i) => i.id === id);
          buzz(it && it.status !== "ok" ? [16, 50, 16] : 14);
        }, 420);
      }, k * 320),
    );
    if (itemsRef.current.length === d.added.length) later(() => showHint(t("voice.swipeHint")), 900 + order.length * 320);
  }, [later, showHint, flash]);

  const patch = useCallback((id: string, p: Partial<DraftItem>) => {
    present(itemsRef.current.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, [present]);

  const remove = useCallback((id: string) => {
    setConfirmId(null);
    setGoneId(id);
    buzz([10, 30, 26]);
    later(() => {
      const next = itemsRef.current.filter((i) => i.id !== id);
      itemsRef.current = next;
      setItems(next);
      setGoneId(null);
      setLastId(null);
      setEditId((e) => (e === id ? null : e));
    }, 300);
  }, [later]);

  const askDelete = useCallback((id: string) => {
    buzz(22);
    setConfirmId(id);
    later(() => setConfirmId((c) => (c === id ? null : c)), 3000);
  }, [later]);

  const step = useCallback((id: string, dir: 1 | -1) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it) return;
    const st = stepOf(it.unit);
    if (it.quantity == null) {
      if (dir > 0) patch(id, it.status === "needs_qty" ? { quantity: 250, unit: "g", status: "ok" } : { quantity: 1, unit: it.unit ?? "ks" });
      else askDelete(id);
      return;
    }
    const next = Math.round((it.quantity + dir * st) * 1000) / 1000;
    if (next < st) askDelete(id);
    else patch(id, { quantity: next });
  }, [patch, askDelete]);

  const finishRef = useRef<() => void>(() => {});

  // ---------------------------------------------------------------- vety

  const pickStore = useCallback((name: string) => {
    const s = name.trim();
    if (!s || leaving) return;
    buzz(12);
    setStore(s);
    setLeaving(true);
    later(() => {
      setPhase("dict");
      setLeaving(false);
    }, 380);
  }, [leaving, later]);

  /**
   * Jedna veta: okamžite lokálny rozbor (položky padnú bez čakania), súčasne AI.
   * Keď AI odpovie (zvyčajne do 1,5 s), lokálny výsledok vety nahradí presnejším –
   * napr. rozdelí „banány 3 rožky maslo“ správne alebo opraví tvar slova.
   */
  const handleSentence = useCallback((text: string, typedByHand = false) => {
    if (phase === "pick") {
      // Napísaný text je rovno názov predajne; povedaný hľadáme vo vete („idem do Lidla“).
      const s = matchStore(text, stores) ?? (typedByHand ? text : null);
      if (s) pickStore(s);
      else showHint(t("voice.storeHint", { text }));
      return;
    }
    const target = editId ? (itemsRef.current.find((i) => i.id === editId)?.name ?? null) : null;
    if (target) setEditId(null);
    const before = itemsRef.current;
    const local = applyOps(before, parseLocal(text, target));
    if (local.done && !local.added.length && !local.merged.length) {
      finishRef.current();
      return;
    }
    if (local.understood) present(local.items);
    const mergedName = !target && local.merged.length ? itemsRef.current.find((i) => i.id === local.merged[0])?.name : null;
    if (mergedName) showHint(t("voice.dupe", { name: mergedName }));

    const mine = ++seq.current;
    setSaid(text);
    setRefining((r) => r + 1);
    void interpretAI(household.id, text, before, target).then((ops) => {
      setRefining((r) => r - 1);
      if (seq.current === mine) setSaid("");
      if (!ops) {
        if (!local.understood) showHint("Nerozumel som — skús to povedať inak");
        return;
      }
      const r = reconcile(itemsRef.current, local, ops);
      present(r.items);
      if (r.done) finishRef.current();
      else if (!r.understood && !local.understood) showHint("Nerozumel som — skús to povedať inak");
    });
  }, [phase, stores, pickStore, showHint, editId, present]);

  function discard() {
    if (!discardArmed) {
      buzz(16);
      setDiscardArmed(true);
      later(() => setDiscardArmed(false), 3000);
      return;
    }
    buzz([10, 30, 26]);
    saveDraft(household.id, null);
    itemsRef.current = [];
    setItems([]);
    close();
  }

  const speech = useSpeech(handleSentence);

  // Mikrofón je zapnutý hneď po otvorení (pokiaľ ho prehliadač má a nie je pauza).
  useEffect(() => {
    if (!speech.supported) {
      setTyping(true);
      return;
    }
    if (!paused && !closing) speech.start();
    else speech.stop();
  }, [paused, closing, speech.supported]);

  useEffect(() => {
    if (speech.error === "denied") {
      setTyping(true);
      showHint(t("voice.micDenied"));
    }
  }, [speech.error, showHint]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  });

  function close() {
    if (closing) return;
    speech.stop();
    setClosing(true);
    setTimeout(onClose, 420);
  }

  async function finish() {
    const all = itemsRef.current;
    if (!all.length) {
      close();
      return;
    }
    const unclear = all.filter((i) => i.status === "unclear");
    if (unclear.length && !unclearWarned) {
      setUnclearWarned(true);
      buzz([16, 50, 16]);
      showHint(tn("voice.unclear", unclear.length));
      return;
    }
    speech.stop();
    try {
      const r = await save.mutateAsync({ store, items: all.filter((i) => i.status !== "unclear") });
      saveDraft(household.id, null);
      buzz([10, 40, 10, 40, 22]);
      setClosing(true);
      setTimeout(() => onSaved(store, r), 420);
    } catch (err) {
      toast.show(errorMessage(err), "error");
      if (!paused) speech.start();
    }
  }
  finishRef.current = () => void finish();

  function sendTyped(e: FormEvent) {
    e.preventDefault();
    const line = typed.trim();
    if (!line) return;
    setTyped("");
    handleSentence(line, true);
  }

  function resumeDraft() {
    if (!draft) return;
    setItems(draft.items);
    setStore(draft.store);
    setDraft(null);
    setLeaving(true);
    later(() => {
      setPhase("dict");
      setLeaving(false);
    }, 380);
  }

  // ---------------------------------------------------------------- zobrazenie

  const n = items.length;
  const pending = items.filter((i) => i.status !== "ok").length;
  const editName = editId ? items.find((i) => i.id === editId)?.name : null;
  const live = speech.interim || said;
  const thinking = refining > 0 && !speech.interim;
  const talk = speech.hearing || !!speech.interim;
  const waveState = paused || (!speech.listening && !typing) ? "off" : thinking ? "think" : talk ? "talk" : "idle";
  const status = paused
    ? t("voice.st.paused")
    : thinking
      ? t("voice.st.refining")
      : talk
        ? t("voice.st.listening")
        : editName
          ? t("voice.st.editing", { name: editName })
          : !speech.supported || speech.error
            ? t("voice.st.typing")
            : phase === "pick"
              ? t("voice.st.pick")
              : t("voice.st.listening");
  const ghost = paused
    ? t("voice.ghost.paused")
    : editName
      ? t("voice.ghost.edit")
      : phase === "pick"
        ? t("voice.ghost.pick")
        : n === 0
          ? t("voice.ghost.first")
          : t("voice.ghost.next");
  // Zobrazené riadky: bez tých, čo ešte len padnú, a s odchádzajúcimi na pôvodnom mieste.
  const rows: { it: DraftItem; leaving: boolean }[] = items.filter((i) => !hidden.has(i.id)).map((it) => ({ it, leaving: goneId === it.id }));
  for (const g of ghosts) rows.splice(Math.min(g.index, rows.length), 0, { it: g.item, leaving: true });
  const meta = useMemo(
    () =>
      n === 0
        ? t("voice.meta.empty")
        : t(pending ? "voice.meta.pending" : "voice.meta.clear", { count: tn("shop.itemCount", n), n: pending }),
    [n, pending],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("voice.open")}
      className={cx("fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg pt-safe", closing ? "vo-out" : "animate-sheet")}
    >
      <div className={cx("mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col", shake && `vo-shake-${shake}`)}>
        {phase === "pick" ? (
          <section className={cx("flex min-h-0 flex-1 flex-col px-5 pt-2", leaving && "vo-leave")}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={close} aria-label={t("common.close")} className="-ml-2.5 grid size-11 place-items-center rounded-full text-text active:bg-pressed">
                <X className="size-[22px]" />
              </button>
              <HouseholdChip name={household.name} />
              <span className="size-11" />
            </div>
            <p className="mt-9 text-[0.8125rem] text-text-2">{t("voice.newTrip")}</p>
            <h1 className="mt-1 text-[2.75rem] font-bold leading-none tracking-[-0.04em]">{t("voice.where")}</h1>
            <div className="mt-6 flex flex-wrap gap-2">
              {stores.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickStore(s)}
                  className={cx(
                    "h-[3.125rem] rounded-full px-5 text-[1.0625rem] font-semibold transition-[background-color,color,transform] duration-300 active:scale-[0.97]",
                    store === s ? "scale-[1.04] bg-primary text-on-primary" : "bg-elevated text-text",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                pickStore(custom);
              }}
            >
              <label className="flex min-w-0 flex-1">
                <span className="sr-only">{t("voice.otherStore")}</span>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={t("voice.otherStorePlaceholder")}
                  maxLength={60}
                  className="h-[3.25rem] min-w-0 flex-1 rounded-2xl border border-transparent bg-elevated px-4 text-base outline-none placeholder:text-text-3 focus:border-primary"
                />
              </label>
              {custom.trim() && (
                <button type="submit" className="h-[3.25rem] animate-drop rounded-2xl bg-primary px-5 font-semibold text-on-primary">
                  {t("voice.next")}
                </button>
              )}
            </form>
            {draft && (
              <div className="mt-6 animate-rise rounded-[1.375rem] bg-elevated p-4">
                <p className="text-[0.8125rem] text-text-2">{t("voice.draftLabel")}</p>
                <p className="mt-0.5 text-lg font-bold tracking-[-0.02em]">
                  {t("voice.draftTitle", { store: draft.store, count: tn("shop.itemCount", draft.items.length) })}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={resumeDraft} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
                    {t("voice.resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveDraft(household.id, null);
                      setDraft(null);
                    }}
                    className="h-11 rounded-full px-4 text-sm font-semibold text-text-2 active:bg-pressed"
                  >
                    {t("voice.discard")}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pt-2">
              <button type="button" onClick={close} aria-label={t("voice.closeKeep")} className="-ml-1 grid size-11 place-items-center rounded-full text-text active:bg-pressed">
                <X className="size-[22px]" />
              </button>
              <HouseholdChip name={household.name} />
              {n > 0 ? (
                <button
                  type="button"
                  onClick={discard}
                  className={cx(
                    "-mr-1 h-9 rounded-full px-3 text-[0.8rem] font-semibold transition-colors",
                    discardArmed ? "animate-drop bg-danger text-on-primary" : "text-text-2 active:bg-pressed",
                  )}
                >
                  {discardArmed ? t("voice.discardConfirm") : t("voice.discard")}
                </button>
              ) : (
                <span className="size-11" />
              )}
            </div>
            {/* Celý obsah (názov + zoznam) sa dá posúvať aj počas počúvania. */}
            <div ref={listRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="px-6 pt-4">
                <h1 className="animate-rise truncate text-[3.5rem] font-bold leading-[0.95] tracking-[-0.045em]">{store}</h1>
                <p className="mt-2.5 text-[0.8125rem] text-text-2">{meta}</p>
              </div>
              <ul className="relative z-[2] px-3.5 pb-8 pt-4" aria-live="polite">
                {n === 0 && <li className="list-none animate-fade px-2.5 pt-2 text-[1.0625rem] text-text-3">{t("voice.emptyHint")}</li>}
                {rows.map(({ it, leaving: out }, i) => (
                  <VoiceRow
                    key={it.id}
                    item={it}
                    anim={{
                      fall: i === 0 && it.id === lastId,
                      push: lastId && i > 0 ? pushKey : null,
                      bump: anims[it.id]?.bump ?? null,
                      glow: anims[it.id]?.glow ?? null,
                    }}
                    editing={editId === it.id}
                    confirming={confirmId === it.id}
                    leaving={out}
                    onStep={(d) => step(it.id, d)}
                    onAskDelete={() => askDelete(it.id)}
                    onDelete={() => remove(it.id)}
                    onTap={() => {
                      buzz(10);
                      setEditId((e) => (e === it.id ? null : it.id));
                    }}
                    onResolve={(p) => {
                      if (p === "remove") remove(it.id);
                      else if (p === "voice") setEditId(it.id);
                      else patch(it.id, p);
                    }}
                  />
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="relative z-[3] rounded-t-[1.875rem] bg-elevated px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
          <div className="flex min-h-[1.375rem] items-center justify-center">
            {hint && (
              <p key={hint.k} className="vo-hint text-center text-[0.8rem] leading-snug text-text-3" style={{ animationDuration: `${hint.ms}ms` }}>
                {hint.text}
              </p>
            )}
          </div>

          {typing ? (
            <form onSubmit={sendTyped} className="mt-1 flex gap-2">
              <label className="flex min-w-0 flex-1">
                <span className="sr-only">{t("voice.typeAria")}</span>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={phase === "pick" ? t("voice.storePlaceholder") : t("voice.itemsPlaceholder")}
                  maxLength={300}
                  enterKeyHint="send"
                  className="h-12 min-w-0 flex-1 rounded-2xl bg-bg px-4 text-base outline-none placeholder:text-text-3"
                />
              </label>
              <button type="submit" disabled={!typed.trim()} className="h-12 rounded-2xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-40">
                {t("voice.add")}
              </button>
            </form>
          ) : (
            <p
              className={cx(
                "flex min-h-[3.4rem] items-center justify-center px-2 text-center text-xl font-semibold leading-tight tracking-[-0.01em] transition-[opacity,transform] duration-300",
                !live && "text-text-3/70",
                thinking && "vo-think -translate-y-1.5 scale-[0.97]",
              )}
            >
              {live || ghost}
            </p>
          )}

          <svg className={cx("vo-wave mt-1 block h-16 w-full", waveState)} viewBox="0 0 390 64" preserveAspectRatio="none" aria-hidden>
            <g className="g2"><path className="w2" d={W2} /></g>
            <g className="g3"><path className="w3" d={W3} /></g>
            <g className="g1"><path className="w1" d={W1} /></g>
          </svg>

          <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
            <span className="flex justify-start">
              {speech.supported && !speech.error && (
                <button
                  type="button"
                  onClick={() => setTyping((on) => !on)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-text-2 active:bg-pressed"
                >
                  {typing ? <Mic className="size-4" aria-hidden /> : <Keyboard className="size-4" aria-hidden />}
                  {typing ? t("voice.speak") : t("voice.type")}
                </button>
              )}
            </span>
            <span className="flex flex-col items-center gap-1.5 px-2">
              <button
                type="button"
                disabled={!speech.supported || speech.error === "denied"}
                onClick={() => {
                  buzz(8);
                  setPaused((p) => !p);
                }}
                aria-label={paused ? t("voice.resumeAria") : t("voice.pauseAria")}
                className={cx(
                  "grid size-16 place-items-center rounded-full transition-[background-color,color,box-shadow,transform] duration-300 active:scale-[0.94] disabled:opacity-40",
                  paused ? "bg-elevated text-text shadow-[inset_0_0_0_1.5px_var(--text)]" : talk || thinking ? "bg-accent text-on-accent" : "bg-primary text-on-primary",
                )}
              >
                {paused ? <MicOff className="size-6" aria-hidden /> : <Mic className="size-6" aria-hidden />}
              </button>
              <span className="whitespace-nowrap text-xs text-text-2">{status}</span>
            </span>
            <span className="flex justify-end">
              {phase === "dict" ? (
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={save.isPending}
                  className="h-11 animate-drop rounded-full bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-60"
                >
                  {save.isPending ? t("voice.saving") : t("voice.done")}
                </button>
              ) : (
                <button type="button" onClick={close} className="h-11 rounded-full px-3 text-sm font-semibold text-text-2 active:bg-pressed">
                  {t("common.cancel")}
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HouseholdChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-8 max-w-[60%] items-center gap-2 rounded-full bg-elevated px-3 text-[0.8rem] font-semibold">
      <span aria-hidden className="size-1.5 rounded-full bg-person" />
      <span className="truncate">{name}</span>
    </span>
  );
}

