import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, History, Keyboard, ListPlus, Mic, MicOff, Pause, SendHorizontal, X } from "lucide-react";
import { StoreBadge, haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useFlip } from "@/components/motion";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useFrequentItems, useLists, useListStats } from "@/features/lists/api";
import { addDays, dayLabel, isoDay } from "@/features/lists/dates";
import { usePlanRecipes, useSaveRecipe } from "@/features/recipes/api";
import { guessCategory, normalizeName } from "@/lib/categories";
import { t, tn } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { getSetting } from "@/lib/settings";
import {
  interpretAI,
  interpretAudio,
  loadDraft,
  saveDraft,
  useKnownStores,
  useSaveVoiceList,
  type DraftItem,
  type Interpretation,
  type SaveResult,
  type VoicePlan,
} from "./api";
import { matchStore, parseLocal, splitStore, type VoiceOp } from "./parse";
import { applyOps, diff, findItem, reconcile, type Effect } from "./engine";
import { recipeCommand, splitCook } from "./recipeVoice";
import { useSpeech } from "./useSpeech";
import { recorderSupported, useRecorder } from "./useRecorder";
import { VoiceCard } from "./VoiceRow";
import { PlanRow, RecipeCardView, cardItems, cardPlan, cardRows, toggled, useRecipeCards, type Card } from "./VoiceRecipe";

const cap = (s: string) => (s ? s[0]!.toLocaleUpperCase("sk-SK") + s.slice(1) : s);

/** Krok pri +1/−1 ako v prototype: gramy a ml po 100, kilá a litre po pol, inak kusy. */
function stepOf(unit: string | null): number {
  if (unit === "g" || unit === "ml") return 100;
  if (unit === "kg" || unit === "l") return 0.5;
  return 1;
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const hasSpeech = () => {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
};

/**
 * Ako počúvame: rozpoznávanie reči v prehliadači (Chrome, Android – živý prepis),
 * alebo nahrávanie po vetách s prepisom cez AI (iPhone, appka z plochy, kde prehliadač
 * reč nerozpozná alebo sa pýta pri každej vete).
 */
type Engine = "speech" | "rec" | "none";
// Prednostne nahrávanie – rozpoznávanie reči v prehliadači pri každom spustení a zastavení pípne.
const firstEngine = (): Engine => (recorderSupported() ? "rec" : hasSpeech() ? "speech" : "none");

type Modal = "where" | "store" | "unsure" | "recipes" | null;

/**
 * Hlasový nákup. Otvorí sa stredným tlačidlom lišty a hneď počúva:
 *  - položky padajú do zoznamu (každá veta sa hneď rozoberie lokálne a o chvíľu spresní cez AI),
 *    upravujú sa hlasom („nie, tri“, „zmaž maslo“) aj ťukom/potiahnutím,
 *  - „chcem uvariť hovädzí guláš“ ukáže až 4 recepty; vybraný recept ponúkne suroviny,
 *    ktoré sa jedným ťuknutím (alebo „pridaj“) pridajú medzi položky,
 *  - Hotovo → „Kam to dať?“ (obchod, deň alebo existujúci zoznam). Ak obchod zaznel, nepýta sa.
 * Rozdiktovaný zoznam sa priebežne ukladá v zariadení a po otvorení pokračuje.
 */
export function VoiceSession({ onClose, onSaved }: { onClose: () => void; onSaved: (store: string, r: SaveResult) => void }) {
  const { household } = useHousehold();
  const stores = useKnownStores(household.id).data ?? [];
  // Čo domácnosť často kupuje – AI podľa toho rozhodne nejasne vyslovené slovo.
  const frequent = useFrequentItems(household.id).data;
  const vocabRef = useRef<string[]>([]);
  vocabRef.current = (frequent ?? []).map((f) => f.name);
  const lists = useLists(household.id).data ?? [];
  const stats = useListStats(household.id).data;
  const save = useSaveVoiceList(household.id);
  const saveRecipe = useSaveRecipe(household.id);
  const planRecipes = usePlanRecipes(household.id);
  const cards = useRecipeCards(household.id);
  const toast = useToast();
  const today = isoDay(new Date());

  const [draft] = useState(() => loadDraft(household.id));
  const [restored, setRestored] = useState(!!draft);
  const [store, setStore] = useState(draft?.store ?? "");
  const [date, setDate] = useState(draft?.date || today);
  const [targetListId, setTargetListId] = useState<string | null>(draft?.targetListId ?? null);
  const [items, setItems] = useState<DraftItem[]>(draft?.items ?? []);
  const [plans, setPlans] = useState<VoicePlan[]>(draft?.recipes ?? []);
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
  const [engine, setEngine] = useState<Engine>(firstEngine);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const selRef = useRef(selected);
  selRef.current = selected;
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Nové karty „dopadnú“ samé (anim-drop); ostatné sa k novému miestu plynulo dokĺžu.
  const cardsBox = useRef<HTMLDivElement>(null);
  useFlip(cardsBox, { enter: false });
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const openLists = useMemo(() => lists.filter((l) => !l.completed_at), [lists]);
  const target = targetListId ? (lists.find((l) => l.id === targetListId) ?? null) : null;
  const storeName = target ? target.name : store;

  // Rozdiktovaný zoznam priebežne ukladáme, aby ho nič nezmazalo (ani obnovenie stránky).
  useEffect(() => {
    saveDraft(household.id, { store, date, targetListId, items, recipes: plans, savedAt: Date.now() });
  }, [store, date, targetListId, items, plans, household.id]);

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

  const showRemoved = useCallback(
    (eff: Effect) => {
      for (const r of eff.removed) {
        toast.show(t("voice.removed", { name: r.item.name }), "info", {
          undo: () => {
            const n = [...itemsRef.current];
            n.splice(Math.min(r.index, n.length), 0, r.item);
            present(n);
          },
        });
      }
    },
    [present, toast],
  );

  // ---------------------------------------------------------------- recepty

  /** Suroviny vybraného receptu → položky (hore), recept čaká na uloženie. */
  const addRecipe = useCallback(
    (card: Card) => {
      const add = cardItems(card);
      const plan = cardPlan(card);
      if (!add.length || !plan) return;
      present([...add, ...itemsRef.current.filter((i) => i.recipeCard !== card.id)]);
      setPlans((p) => [...p.filter((x) => x.card !== card.id), plan]);
      cards.update(card.id, (c) => ({ ...c, status: "added" }));
      haptic(16);
      toast.show(tn("voice.rc.added", add.length, { name: plan.name }), "success", {
        undo: () => {
          present(itemsRef.current.filter((i) => i.recipeCard !== card.id));
          setPlans((p) => p.filter((x) => x.card !== card.id));
          cards.update(card.id, (c) => ({ ...c, status: "ready" }));
        },
      });
    },
    [present, cards, toast],
  );

  /** Zmeniť výber: suroviny z receptu sa vrátia späť a karta sa znova otvorí. */
  const editRecipe = useCallback(
    (cardId: string) => {
      present(itemsRef.current.filter((i) => i.recipeCard !== cardId));
      setPlans((p) => p.filter((x) => x.card !== cardId));
      cards.update(cardId, (c) => ({ ...c, status: "ready" }));
    },
    [present, cards],
  );

  const dropRecipe = useCallback(
    (cardId: string) => {
      present(itemsRef.current.filter((i) => i.recipeCard !== cardId));
      setPlans((p) => p.filter((x) => x.card !== cardId));
      cards.remove(cardId);
    },
    [present, cards],
  );

  const activeCard = () => cards.ref.current.find((c) => c.status !== "added" && c.status !== "error");

  /** Povely ku karte receptu („ten druhý“, „na šesť porcií“, „bez cibule“, „pridaj“). */
  const runCommand = useCallback(
    (text: string): boolean => {
      const card = activeCard();
      if (!card) return false;
      const rows = cardRows(card);
      const cmd = recipeCommand(
        text,
        card.options.map((o) => o.name),
        rows.map((r) => r.buy.name),
      );
      if (!cmd) return false;
      haptic(10);
      if (cmd.kind === "pick") cards.pick(card.id, cmd.index);
      else if (cmd.kind === "portions") cards.update(card.id, (c) => ({ ...c, portions: cmd.n }));
      else if (cmd.kind === "without" || cmd.kind === "with") {
        const key = rows[cmd.index]!.key;
        cards.update(card.id, (c) => ({ ...c, off: toggled(c, key, cmd.kind === "without") }));
      } else if (cmd.kind === "add") {
        if (card.sel == null) toast.show(t("voice.rc.pickFirst"));
        else addRecipe(card);
      } else if (cmd.kind === "cancel") dropRecipe(card.id);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, addRecipe, dropRecipe, toast],
  );

  // ---------------------------------------------------------------- uloženie

  async function finish(o: { store?: string; listId?: string | null } = {}) {
    const all = itemsRef.current;
    if (!all.length || busy) return;
    const listId = o.listId !== undefined ? o.listId : (target?.id ?? null);
    const name = listId ? (lists.find((l) => l.id === listId)?.name ?? storeName) : (o.store ?? store) || t("voice.defaultListName");
    setModal(null);
    setBusy(true);
    try {
      // Recepty od AI sa uložia medzi Moje recepty – v Receptoch potom čakajú na uvarenie.
      let ps = plansRef.current;
      for (const p of ps) {
        if (p.key || !p.draft) continue;
        const id = await saveRecipe.mutateAsync(p.draft);
        ps = ps.map((x) => (x.card === p.card ? { ...x, key: id, draft: null } : x));
        plansRef.current = ps;
        setPlans(ps);
      }
      const r = await save.mutateAsync({ store: name, listId, date, items: all });
      const recipes = ps.filter((p) => p.key).map((p) => ({ key: p.key!, name: p.name, portions: p.portions }));
      if (recipes.length) {
        // Položky už sú v zozname; ak by sa nepodarilo zapísať plán receptu, povieme to, ale zoznam ostane.
        await planRecipes.mutateAsync({ listId: r.listId, newList: null, items: [], recipes }).catch((e) => toast.show(errorMessage(e), "error"));
      }
      saveDraft(household.id, null);
      haptic(22);
      onSaved(name, r);
    } catch (err) {
      setBusy(false);
      toast.show(errorMessage(err), "error");
    }
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;

  function create(force: "" | "recipes" | "unsure" = "") {
    if (!items.length || busy) return;
    const pendingRecipe = cards.cards.some((c) => c.status !== "added" && c.sel != null);
    if (pendingRecipe && !force) return setModal("recipes");
    if (items.some((c) => c.status === "unclear") && force !== "unsure") return setModal("unsure");
    if (!target && !store) return setModal("where");
    void finish();
  }
  const createRef = useRef(create);
  createRef.current = create;

  // ---------------------------------------------------------------- vety

  /** Text (prehliadač alebo napísaný): hneď lokálny rozbor, súčasne AI, ktorá výsledok spresní. */
  const apply = useCallback(
    (text: string) => {
      const sp = splitStore(text, stores);
      if (modalRef.current === "where") {
        const s = sp.store ?? matchStore(text, stores);
        if (s) void finishRef.current({ store: s });
        else toast.show(t("voice.storeNotUnderstood"));
        return;
      }
      if (sp.store && !targetListId) setStore(sp.store);
      if (!sp.rest) {
        if (sp.store) haptic(10);
        return;
      }
      if (runCommand(sp.rest)) return;
      const mine = ++seq.current;
      const cook = splitCook(sp.rest);
      for (const dish of cook.cook) cards.addQuery(dish, mine);
      let rest = cook.rest;

      // „nie, tri“ / „nie 250 g“ = oprava vybranej alebo poslednej (najvyššej) karty.
      const correction = /^nie\b[\s,]*/i.exec(rest);
      if (correction) rest = rest.slice(correction[0].length);
      const before = itemsRef.current;
      const sel = selRef.current ? before.find((c) => c.id === selRef.current) : undefined;
      // „ešte jedno mlieko“ pridáva (navýši rovnakú položku), aj keď je nejaká karta vybraná.
      const more = /^(este|ešte)\s+(jeden|jedno|jednu|jedna|jedny)\s+\S/i.test(rest);
      let target = more ? null : (sel?.name ?? (correction ? (before[0]?.name ?? null) : null));
      let ops: VoiceOp[] = rest ? parseLocal(rest, target) : [];
      // samotné množstvo („250 g“, „tri“) → oprava poslednej karty
      if (rest && !target && !ops.length && before[0] && !cook.cook.length) {
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
      showRemoved(local);
      if (sel && target && local.understood) setSelected(null);
      if (local.done && !local.added.length && !local.merged.length && !local.removed.length) return;
      // Len jedlo bez položiek – AI netreba, recepty sa už načítavajú.
      if (!rest && cook.cook.length) return;

      setRefining((r) => r + 1);
      void interpretAI(sp.rest, before, target, vocabRef.current).then((ai) => {
        setRefining((r) => r - 1);
        if (!ai) {
          if (!local.understood && !cook.cook.length && seq.current === mine) toast.show(t("voice.notUnderstood"));
          return;
        }
        if (ai.store && !targetListId) setStore((s) => s || ai.store!);
        cards.confirmCook(mine, ai.cook);
        if (!ai.ops.length && local.understood) return;
        const r = reconcile(itemsRef.current, local, ai.ops);
        present(r.items);
        if (r.done) setDoneHint(true);
      });
    },
    [stores, targetListId, present, toast, runCommand, cards, showRemoved],
  );

  /** Nahrávka (iPhone): prepis aj rozbor prišiel naraz z AI. */
  const applyAudio = useCallback(
    (res: Interpretation, target: string | null) => {
      if (res.transcript) setSaid(res.transcript);
      if (modalRef.current === "where") {
        const s = res.store ?? matchStore(res.transcript, stores);
        if (s) void finishRef.current({ store: s });
        else toast.show(t("voice.storeNotUnderstood"));
        return;
      }
      if (res.store && !targetListId) setStore(res.store);
      if (res.transcript && runCommand(splitStore(res.transcript, stores).rest || res.transcript)) return;
      const mine = ++seq.current;
      for (const dish of res.cook) cards.addQuery(dish, mine);
      if (!res.ops.length) {
        if (!res.cook.length && !res.store && res.transcript) toast.show(t("voice.notUnderstood"));
        return;
      }
      const eff = applyOps(itemsRef.current, res.ops);
      if (eff.done) setDoneHint(true);
      if (eff.understood) {
        present(eff.items);
        haptic(10);
      }
      showRemoved(eff);
      if (target && eff.understood) setSelected(null);
    },
    [stores, targetListId, runCommand, cards, present, showRemoved, toast],
  );

  // Úseky nahrávky idú na server po jednom, v poradí, ako zazneli.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const audioRef = useRef(applyAudio);
  audioRef.current = applyAudio;
  const onSegment = useCallback(
    (wav: string) => {
      setRefining((r) => r + 1);
      chain.current = chain.current.then(async () => {
        const before = itemsRef.current;
        const sel = selRef.current ? (before.find((c) => c.id === selRef.current)?.name ?? null) : null;
        const res = await interpretAudio({ mime: "audio/wav", data: wav }, before, sel, vocabRef.current);
        setRefining((r) => r - 1);
        if (!res) return toast.show(t("voice.audioFailed"));
        if (!res.transcript && !res.ops.length && !res.cook.length) return;
        audioRef.current(res, sel);
      });
    },
    [toast],
  );

  const onFinal = useCallback(
    (text: string) => {
      setSaid(text);
      apply(text);
    },
    [apply],
  );

  const speech = useSpeech(onFinal);
  const rec = useRecorder(onSegment);

  // Prehliadač reč zakázal (napr. appka z plochy) → prepneme na nahrávanie, ak sa dá.
  useEffect(() => {
    if (engine === "speech" && speech.error === "denied") setEngine(recorderSupported() ? "rec" : "none");
    if (engine === "speech" && speech.error === "unavailable" && recorderSupported()) setEngine("rec");
  }, [engine, speech.error]);

  const blocked = engine === "none" || (engine === "rec" && !!rec.error) || (engine === "speech" && speech.error === "denied");
  const unsupported = engine === "none";

  // Mikrofón počúva, kým nie je pozastavený (a kým sa neukladá).
  useEffect(() => {
    const on = listening && !busy && !blocked;
    if (engine === "speech") {
      rec.stop();
      if (on) speech.start();
      else speech.stop();
    } else if (engine === "rec") {
      speech.stop();
      if (on) rec.start();
      else rec.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, listening, busy, blocked]);

  useEffect(() => {
    if (blocked) setTyping(true);
  }, [blocked]);

  // ---------------------------------------------------------------- zatvorenie, zahodenie

  function close() {
    speech.stop();
    rec.stop();
    if (itemsRef.current.length) toast.show(t("voice.draftSaved"));
    onClose();
  }

  function reset() {
    present([]);
    setPlans([]);
    for (const c of cards.ref.current) cards.remove(c.id);
    setStore("");
    setTargetListId(null);
    setDate(today);
    setRestored(false);
    setDoneHint(false);
    setSaid("");
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
    rec.stop();
    onClose();
    toast.show(t("voice.discarded"));
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
  const active = activeCard();
  const openCards = cards.cards.filter((c) => c.status !== "added");
  const orphanPlans = plans.filter((p) => !cards.cards.some((c) => c.id === p.card && c.status !== "added"));
  const empty = n === 0 && !openCards.length && !plans.length;
  const pendingRecipes = cards.cards.filter((c) => c.status !== "added" && c.sel != null);

  const hearing = engine === "rec" ? rec.hearing : !!speech.interim;
  const live = engine === "speech" ? speech.interim : "";

  return (
    <div role="dialog" aria-modal="true" aria-label={t("voice.open")} className="v-root fixed inset-0 z-50 bg-bg pt-safe">
      <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col">
        <div className="stack v-screen min-h-0 flex-1">
          <div className="v-top">
            <button type="button" className="ibtn" onClick={close} aria-label={t("voice.closeKeep")}>
              <X size={22} />
            </button>
            {storeName ? (
              <button
                type="button"
                className="grow stack center"
                onClick={() => !target && setModal("store")}
                style={{ minHeight: 44 }}
                aria-label={target ? undefined : t("voice.changeStoreAria")}
              >
                <span className="row g-6 t-h">
                  <StoreBadge name={storeName} size="sm" />
                  {storeName}
                  {!target && <ChevronDown size={16} className="t-3" />}
                </span>
                <span className="t-xs t-2">{target ? t("voice.addingToExisting") : dayLabel(date)}</span>
              </button>
            ) : (
              <span className="grow stack center" style={{ minHeight: 44 }}>
                <span className="t-h">{t("voice.open")}</span>
                <span className="t-xs t-2">{t("voice.storeLater")}</span>
              </span>
            )}
            <button
              type="button"
              className={cx("btn btn-sm", discardArm ? "btn-danger" : "btn-ghost")}
              onClick={discard}
              style={{ minWidth: 76, visibility: empty ? "hidden" : undefined }}
            >
              {discardArm ? t("voice.discardConfirm") : t("voice.discard")}
            </button>
          </div>
          {restored && n > 0 && (
            <div className="v-restored row g-8 anim-pop">
              <History size={16} />
              <span className="grow t-sm">{tn("voice.restored", n)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                {t("voice.startOver")}
              </button>
            </div>
          )}
          {n > 0 && (
            <div className="row between px" style={{ paddingBottom: 6 }}>
              <span className="t-sm t-2 fw-6 num">{tn("shop.itemCount", n)}</span>
              <span className="t-xs t-3">{t("voice.gestureHint")}</span>
            </div>
          )}
          <div
            className="scroll"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            {empty ? (
              <div className="stack center g-8" style={{ padding: "48px 32px", textAlign: "center" }}>
                <span className="t-title">{t("voice.emptyHint")}</span>
                <span className="t-sm t-2">{t("voice.emptyExample2")}</span>
              </div>
            ) : (
              <div ref={cardsBox} className="v-cards" aria-live="polite">
                {openCards.map((c) => (
                  <RecipeCardView
                    key={c.id}
                    card={c}
                    active={c.id === active?.id}
                    onPick={(i) => cards.pick(c.id, i)}
                    onPortions={(p) => cards.update(c.id, (x) => ({ ...x, portions: p }))}
                    onToggle={(key) => cards.update(c.id, (x) => ({ ...x, off: toggled(x, key) }))}
                    onAdd={() => addRecipe(c)}
                    onClose={() => dropRecipe(c.id)}
                    onRetry={() => cards.retry(c.id)}
                    onRetryDetail={(o) => cards.retryDetail(c.id, o)}
                  />
                ))}
                {orphanPlans.map((p) => (
                  <PlanRow
                    key={p.card}
                    plan={p}
                    count={items.filter((i) => i.recipeCard === p.card).length}
                    onEdit={cards.cards.some((c) => c.id === p.card) ? () => editRecipe(p.card) : undefined}
                    onRemove={() => dropRecipe(p.card)}
                  />
                ))}
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

        <AssistantPanel
          blocked={blocked}
          unsupported={unsupported}
          ios={isIOS()}
          listening={listening}
          hearing={hearing}
          live={live}
          typing={typing}
          said={said}
          thinking={refining > 0 && !live}
          placeholder={selected ? t("voice.ph.edit") : active ? t("voice.ph.recipe") : t("voice.ph.dictate")}
          onMic={() => {
            if (blocked) return;
            haptic(8);
            setListening((l) => !l);
            setTyping(false);
          }}
          onTypingToggle={() => setTyping((x) => !x)}
          onTyped={(text) => {
            setSaid(text);
            apply(text);
          }}
          action={
            <button type="button" className={cx("btn btn-ink v-create", doneHint && "pulse-strong")} disabled={!n || busy} onClick={() => create()}>
              <Check size={18} />
              {busy ? t("voice.saving") : `${t("voice.done")} (${n})`}
            </button>
          }
        />

        {modal && (
          <div className="v-modal-wrap" onClick={() => setModal(null)}>
            <div className="v-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              {modal === "recipes" && (
                <>
                  <span className="t-title">{t("voice.rc.pendingTitle")}</span>
                  <span className="t-sm t-2">{t("voice.rc.pendingText", { names: pendingRecipes.map((c) => c.options[c.sel!]?.name ?? c.query).join(", ") })}</span>
                  <div className="row g-8">
                    <button type="button" className="btn btn-soft grow" onClick={() => create("recipes")}>
                      {t("voice.rc.withoutThem")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ink grow"
                      onClick={() => {
                        for (const c of pendingRecipes) addRecipe(c);
                        setModal(null);
                        timers.current.push(setTimeout(() => createRef.current("recipes")));
                      }}
                    >
                      {t("voice.rc.addThem")}
                    </button>
                  </div>
                </>
              )}
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
                    <button type="button" className="btn btn-ink grow" onClick={() => create("unsure")}>
                      {t("voice.createAnyway")}
                    </button>
                  </div>
                </>
              )}
              {modal === "where" && (
                <>
                  <div className="stack g-4">
                    <span className="t-title">{t("voice.whereTitle")}</span>
                    <span className="t-sm t-2">{t("voice.whereText")}</span>
                  </div>
                  <div className="row g-8 wrap">
                    {days.map((d) => (
                      <button key={d} type="button" className={cx("chip", date === d && "on")} onClick={() => setDate(d)}>
                        {dayLabel(d)}
                      </button>
                    ))}
                  </div>
                  <div className="v-store-tiles">
                    {tileStores.map((s) => (
                      <button key={s} type="button" className="v-store-tile sm" disabled={busy} onClick={() => void finish({ store: s })}>
                        <StoreBadge name={s} />
                        {s}
                      </button>
                    ))}
                  </div>
                  {openLists.length > 0 && (
                    <div className="stack g-8">
                      <span className="section-title">{t("voice.orExisting")}</span>
                      <div className="cells">
                        {openLists.slice(0, 4).map((l) => (
                          <button key={l.id} type="button" className="cell" disabled={busy} onClick={() => void finish({ listId: l.id })}>
                            <span className="cat-ic">
                              <ListPlus size={18} />
                            </span>
                            <span className="grow stack g-2">
                              <span className="t-body fw-5">{t("voice.addTo", { name: l.name })}</span>
                              <span className="t-sm t-2">
                                {l.planned_for ? dayLabel(l.planned_for) : t("trip.noDay")} · {tn("shop.itemCount", stats?.get(l.id)?.open ?? 0)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="button" className="btn btn-soft btn-block" disabled={busy} onClick={() => void finish({ store: "" })}>
                    {t("voice.noStore")}
                  </button>
                </>
              )}
              {modal === "store" && (
                <>
                  <span className="t-title">{t("voice.storeAndDay")}</span>
                  <div className="v-store-tiles">
                    {tileStores.map((s) => (
                      <button key={s} type="button" className={cx("v-store-tile sm", store === s && "on")} onClick={() => setStore(s)}>
                        <StoreBadge name={s} />
                        {s}
                      </button>
                    ))}
                  </div>
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
  if (!words.length) return <p className="v-transcript t-3">{speaking ? t("voice.hearing") : placeholder}</p>;
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
  blocked,
  unsupported,
  ios,
  listening,
  hearing,
  live,
  typing,
  said,
  thinking,
  placeholder,
  action,
  onMic,
  onTypingToggle,
  onTyped,
}: {
  blocked: boolean;
  unsupported: boolean;
  ios: boolean;
  listening: boolean;
  hearing: boolean;
  live: string;
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
  const active = listening && !blocked;
  const status = blocked
    ? unsupported
      ? t("voice.st.unsupported")
      : t("voice.st.blocked")
    : hearing
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
      {blocked ? (
        <div className="v-blocked stack g-6">
          <span className="t-h">{unsupported ? t("voice.unsupportedTitle") : t("voice.blockedTitle")}</span>
          <span className="t-sm t-2">{unsupported ? t("voice.unsupportedText") : ios ? t("voice.blockedTextIos") : t("voice.blockedText")}</span>
          {!typing && (
            <button type="button" className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={onTypingToggle}>
              <Keyboard size={16} /> {t("voice.type")}
            </button>
          )}
        </div>
      ) : (
        <Transcript text={live || (hearing ? "" : said)} speaking={hearing} placeholder={placeholder} />
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
            disabled={blocked}
            aria-label={listening ? t("voice.pauseAria") : t("voice.resumeAria")}
          >
            {active && <span className="v-ring" />}
            {blocked ? <MicOff size={28} /> : listening ? <Wave active={hearing || thinking} height={26} bars={5} /> : <Pause size={26} />}
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
