import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Keyboard, Mic, MicOff, X } from "lucide-react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { countOf, isCountable, itemsWord, sameProduct } from "@/features/lists/qty";
import { guessCategory, normalizeName } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { interpret, loadDraft, saveDraft, useKnownStores, useSaveVoiceList, type DraftItem, type SaveResult } from "./api";
import { matchStore, type VoiceOp } from "./parse";
import { buzz, useSpeech } from "./useSpeech";
import { stepOf, VoiceRow, type RowAnim } from "./VoiceRow";

/** Vlna hlasu – tri periodické krivky; posun o 390 px nadväzuje bez skoku. */
function wavePath(fn: (x: number) => number) {
  let d = "M0 32";
  for (let x = 5; x <= 780; x += 5) d += ` L${x} ${(32 + fn(x)).toFixed(1)}`;
  return d;
}
const W1 = wavePath((x) => Math.sin((x / 130) * Math.PI * 2) * 22 * (0.55 + 0.45 * Math.sin((x / 390) * Math.PI * 2)));
const W2 = wavePath((x) => Math.sin((x / 195) * Math.PI * 2 + 1) * 15);
const W3 = wavePath((x) => Math.sin((x / 78) * Math.PI * 2 + 2) * 12 * Math.abs(Math.sin((x / 390) * Math.PI * 2)));

const VISIBLE = 7;

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
  const [thinking, setThinking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<{ text: string; k: number } | null>(null);
  const [unclearWarned, setUnclearWarned] = useState(false);
  const [draft, setDraft] = useState(() => loadDraft(household.id));

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showHint = useCallback((text: string) => {
    setHint((h) => ({ text, k: (h?.k ?? 0) + 1 }));
    later(() => setHint((h) => (h?.text === text ? null : h)), 4000);
  }, [later]);

  // Rozdiktovaný zoznam priebežne ukladáme, aby ho nič nezmazalo.
  useEffect(() => {
    if (phase === "dict") saveDraft(household.id, { store, items, savedAt: Date.now() });
  }, [phase, store, items, household.id]);

  // ---------------------------------------------------------------- operácie

  const find = (name: string) =>
    itemsRef.current.find((i) => sameProduct(i.name, name)) ??
    itemsRef.current.find((i) => normalizeName(i.name).includes(normalizeName(name)) || normalizeName(name).includes(normalizeName(i.name)));

  const patch = useCallback((id: string, p: Partial<DraftItem>, glow = false) => {
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));
    setAnims((a) => {
      const prev = a[id] ?? {};
      return { ...a, [id]: { ...prev, bump: prev.bump === "a" ? "b" : "a", ...(glow ? { glow: prev.glow === "a" ? "b" : "a" } : {}) } };
    });
    setLastId(null);
    buzz(10);
  }, []);

  const remove = useCallback((id: string) => {
    setConfirmId(null);
    setGoneId(id);
    buzz([10, 30, 26]);
    later(() => {
      setItems((all) => all.filter((i) => i.id !== id));
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

  const addNew = useCallback((op: Extract<VoiceOp, { op: "add" }>, delay: number) => {
    later(() => {
      const existing = op.status === "ok" ? find(op.name) : undefined;
      if (existing && isCountable(existing.unit) && isCountable(op.unit) && existing.status === "ok") {
        patch(existing.id, { quantity: countOf(existing.quantity) + countOf(op.quantity), unit: existing.unit ?? "ks" }, true);
        buzz([12, 40, 12]);
        showHint(`${existing.name} už v zozname — navýšené, nie duplicitné`);
        return;
      }
      const it: DraftItem = {
        id: crypto.randomUUID(),
        name: op.name,
        quantity: op.quantity,
        unit: op.unit,
        categoryId: op.categoryId ?? guessCategory(op.name),
        status: op.status,
        suggestions: op.suggestions,
      };
      setItems((all) => [it, ...all]);
      setLastId(it.id);
      setPushKey((k) => (k === "a" ? "b" : "a"));
      // Dopad položky = 64 % animácie pádu.
      later(() => {
        setShake((s) => (s === "a" ? "b" : "a"));
        buzz(it.status === "ok" ? 14 : [16, 50, 16]);
      }, 420);
      if (itemsRef.current.length === 0) later(() => showHint("Potiahni doprava +1 · doľava −1 · podrž pre zmazanie"), 900);
    }, delay);
  }, [later, patch, showHint]);

  const finishRef = useRef<() => void>(() => {});

  const apply = useCallback((ops: VoiceOp[]) => {
    let delay = 0;
    let understood = false;
    for (const op of ops) {
      if (op.op === "done") {
        understood = true;
        later(() => finishRef.current(), delay + 200);
      } else if (op.op === "add") {
        understood = true;
        addNew(op, delay);
        delay += 380;
      } else if (op.op === "remove") {
        const it = find(op.target);
        if (it) {
          understood = true;
          remove(it.id);
        }
      } else if (op.op === "change") {
        const it = find(op.target);
        if (!it) continue;
        understood = true;
        const p: Partial<DraftItem> = { status: "ok" };
        if (op.name && op.quantity == null && op.delta == null) Object.assign(p, { name: op.name, suggestions: [] });
        if (op.quantity != null) Object.assign(p, { quantity: op.quantity, unit: op.unit ?? it.unit ?? "ks" });
        else if (op.delta != null) Object.assign(p, { quantity: Math.max(stepOf(it.unit), countOf(it.quantity) + op.delta * (isCountable(it.unit) ? 1 : stepOf(it.unit))) });
        if (op.name && (op.quantity != null || op.delta != null)) p.name = op.name;
        if (it.status === "needs_qty" && p.quantity == null) delete p.status;
        patch(it.id, p, true);
      }
    }
    if (!understood) showHint("Nerozumel som — skús to povedať inak");
  }, [addNew, later, patch, remove, showHint]);

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

  const handleSentence = useCallback((text: string, typedByHand = false) => {
    if (phase === "pick") {
      // Napísaný text je rovno názov predajne; povedaný hľadáme vo vete („idem do Lidla“).
      const s = matchStore(text, stores) ?? (typedByHand ? text : null);
      if (s) pickStore(s);
      else showHint(`„${text}“ — povedz napr. „idem do Lidla“ alebo vyber predajňu`);
      return;
    }
    const target = editId ? itemsRef.current.find((i) => i.id === editId)?.name ?? null : null;
    queue.current = queue.current.then(async () => {
      setSaid(text);
      setThinking(true);
      const { ops } = await interpret(text, itemsRef.current, target);
      setThinking(false);
      setSaid("");
      if (target) setEditId(null);
      apply(ops);
    });
  }, [phase, stores, pickStore, showHint, editId, apply]);

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
      showHint("Mikrofón nie je povolený — povoľ ho v nastaveniach prehliadača, zatiaľ píš");
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
      showHint(`${unclear.length} nejasná položka sa neuloží — vyrieš ju alebo ťukni Hotovo znova`);
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
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    handleSentence(t, true);
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
  const talk = speech.hearing || !!speech.interim;
  const waveState = paused || (!speech.listening && !typing) ? "off" : thinking ? "think" : talk ? "talk" : "idle";
  const status = paused
    ? "pozastavené"
    : thinking
      ? "rozpoznávam"
      : talk
        ? "počúvam"
        : editName
          ? `upravuješ · ${editName}`
          : !speech.supported || speech.error
            ? "píšeš"
            : phase === "pick"
              ? "počúvam · povedz predajňu"
              : "počúvam";
  const ghost = paused
    ? "Ťukni na mikrofón a pokračuj"
    : editName
      ? "„pol kila“ · „o jeden viac“"
      : phase === "pick"
        ? "„Idem do Lidla“"
        : n === 0
          ? "„banány, tri rožky, maslo“"
          : "„mlieko, dva litre“";
  const visible = items.slice(0, VISIBLE);
  const meta = useMemo(
    () =>
      n === 0
        ? "dnes · zatiaľ prázdny"
        : `dnes · ${n} ${itemsWord(n)}${pending ? ` · ${pending} na doplnenie` : " · všetko jasné"}`,
    [n, pending],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hlasový nákup"
      className={cx("fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg pt-safe", closing ? "vo-out" : "animate-sheet")}
    >
      <div className={cx("mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col", shake && `vo-shake-${shake}`)}>
        {phase === "pick" ? (
          <section className={cx("flex min-h-0 flex-1 flex-col px-5 pt-2", leaving && "vo-leave")}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={close} aria-label="Zavrieť" className="-ml-2.5 grid size-11 place-items-center rounded-full text-text active:bg-pressed">
                <X className="size-[22px]" />
              </button>
              <HouseholdChip name={household.name} />
              <span className="size-11" />
            </div>
            <p className="mt-9 text-[0.8125rem] text-text-2">nový nákup</p>
            <h1 className="mt-1 text-[2.75rem] font-bold leading-none tracking-[-0.04em]">Kam ideš?</h1>
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
                <span className="sr-only">Iná predajňa</span>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Iná predajňa…"
                  maxLength={60}
                  className="h-[3.25rem] min-w-0 flex-1 rounded-2xl border border-transparent bg-elevated px-4 text-base outline-none placeholder:text-text-3 focus:border-primary"
                />
              </label>
              {custom.trim() && (
                <button type="submit" className="h-[3.25rem] animate-drop rounded-2xl bg-primary px-5 font-semibold text-on-primary">
                  Ďalej
                </button>
              )}
            </form>
            {draft && (
              <div className="mt-6 animate-rise rounded-[1.375rem] bg-elevated p-4">
                <p className="text-[0.8125rem] text-text-2">rozdiktovaný zoznam</p>
                <p className="mt-0.5 text-lg font-bold tracking-[-0.02em]">
                  {draft.store} · {draft.items.length} {itemsWord(draft.items.length)}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={resumeDraft} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
                    Pokračovať
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveDraft(household.id, null);
                      setDraft(null);
                    }}
                    className="h-11 rounded-full px-4 text-sm font-semibold text-text-2 active:bg-pressed"
                  >
                    Zahodiť
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pt-2">
              <button type="button" onClick={close} aria-label="Zavrieť (zoznam ostane rozdiktovaný)" className="-ml-1 grid size-11 place-items-center rounded-full text-text active:bg-pressed">
                <X className="size-[22px]" />
              </button>
              <HouseholdChip name={household.name} />
              <span className="size-11" />
            </div>
            <div className="px-6 pt-4">
              <h1 className="animate-rise truncate text-[3.5rem] font-bold leading-[0.95] tracking-[-0.045em]">{store}</h1>
              <p className="mt-2.5 text-[0.8125rem] text-text-2">{meta}</p>
            </div>
            <ul className="relative z-[2] min-h-0 flex-1 px-3.5 pt-4" aria-live="polite">
              {n === 0 && <li className="list-none animate-fade px-2.5 pt-2 text-[1.0625rem] text-text-3">Hovor. Položky padnú sem.</li>}
              {visible.map((it, i) => (
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
                  leaving={goneId === it.id}
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
                    else patch(it.id, p, true);
                  }}
                />
              ))}
              {n > VISIBLE && <li className="list-none px-2.5 py-2 text-[0.8rem] text-text-3">+{n - VISIBLE} staršie</li>}
            </ul>
          </section>
        )}

        <div className="relative z-[3] rounded-t-[1.875rem] bg-elevated px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
          <div className="flex h-[1.375rem] items-center justify-center">
            {hint && (
              <p key={hint.k} className="vo-hint text-center text-[0.8rem] text-text-3">
                {hint.text}
              </p>
            )}
          </div>

          {typing ? (
            <form onSubmit={sendTyped} className="mt-1 flex gap-2">
              <label className="flex min-w-0 flex-1">
                <span className="sr-only">Napíš položky</span>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={phase === "pick" ? "Lidl" : "banány, 3 rožky, maslo"}
                  maxLength={300}
                  enterKeyHint="send"
                  className="h-12 min-w-0 flex-1 rounded-2xl bg-bg px-4 text-base outline-none placeholder:text-text-3"
                />
              </label>
              <button type="submit" disabled={!typed.trim()} className="h-12 rounded-2xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-40">
                Pridať
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
                  onClick={() => setTyping((t) => !t)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-text-2 active:bg-pressed"
                >
                  {typing ? <Mic className="size-4" aria-hidden /> : <Keyboard className="size-4" aria-hidden />}
                  {typing ? "Hovoriť" : "Písať"}
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
                aria-label={paused ? "Pokračovať v počúvaní" : "Pozastaviť počúvanie"}
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
                  {save.isPending ? "Ukladám…" : "Hotovo"}
                </button>
              ) : (
                <button type="button" onClick={close} className="h-11 rounded-full px-3 text-sm font-semibold text-text-2 active:bg-pressed">
                  Zrušiť
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

