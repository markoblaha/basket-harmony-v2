import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { haptic } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useFlip } from "@/components/motion";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useFrequentItems, useLists, useListStats, type ShoppingList } from "@/features/lists/api";
import { useEstimator } from "@/features/lists/estimate";
import { fmtQty } from "@/features/lists/ListParts";
import { useTheme } from "@/theme/ThemeProvider";
import { E, I, IB } from "@/mockup/ui";
import { HelpBtn } from "@/features/help/Help";
import { useKeyboardHeight } from "@/mockup/Sheet";
import { Btn, StoreTile, eur, storeKeyOf } from "@/mockup/kit";
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
import { keepSaidWords, matchStore, parseLocal, splitStore, type VoiceOp } from "./parse";

/** Názvy od AI zúžené na to, čo zaznelo (pravidlo „appka nič nedomýšľa“). */
const asSaid = (ops: VoiceOp[], text: string): VoiceOp[] => (text ? ops.map((o) => (o.op === "add" ? { ...o, name: keepSaidWords(o.name, text) } : o)) : ops);
import { applyOps, diff, findItem, reconcile, type Effect } from "./engine";
import { recipeCommand, splitCook } from "./recipeVoice";
import { useSpeech } from "./useSpeech";
import { recorderSupported, useRecorder } from "./useRecorder";
import { PlanRow, RecipeCardView, cardItems, cardPlan, cardRows, toggled, useRecipeCards, type Card } from "./VoiceRecipe";



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
export function VoiceSession({ onClose, onSaved, listId }: { onClose: () => void; onSaved: (store: string, r: SaveResult) => void; /** Otvorené zo zoznamu – položky pôjdu doň. */ listId?: string }) {
  const { household } = useHousehold();
  const stores = useKnownStores(household.id).data ?? [];
  // Čo domácnosť často kupuje – AI podľa toho rozhodne nejasne vyslovené slovo.
  const frequent = useFrequentItems(household.id).data;
  const vocabRef = useRef<string[]>([]);
  vocabRef.current = (frequent ?? []).map((f) => f.name);
  const lists = useLists(household.id).data ?? [];
  const save = useSaveVoiceList(household.id);
  const saveRecipe = useSaveRecipe(household.id);
  const planRecipes = usePlanRecipes(household.id);
  const cards = useRecipeCards(household.id);
  const toast = useToast();
  const today = isoDay(new Date());
  const estimator = useEstimator(household.id);
  const estRef = useRef(estimator);
  estRef.current = estimator;
  const g = useTheme().style === "glass";

  const [draft] = useState(() => loadDraft(household.id));
  const [restored, setRestored] = useState(!!draft);
  const [store, setStore] = useState(draft?.store ?? "");
  const [date, setDate] = useState(draft?.date || today);
  const [targetListId, setTargetListId] = useState<string | null>(listId ?? draft?.targetListId ?? null);
  const [items, setItems] = useState<DraftItem[]>(draft?.items ?? []);
  const [plans, setPlans] = useState<VoicePlan[]>(draft?.recipes ?? []);
  const [flash, setFlash] = useState<Record<string, number>>({});
  /** Viditeľná oprava na 3 s („~~plzeň~~ → Pilsner Urquell“, „~~1 ks~~ → 6 ks“). */
  const [fixes, setFixes] = useState<Record<string, { from: string; to: string; at: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [typing, setTyping] = useState(false);
  const [, setDoneHint] = useState(false);
  // Mikrofón sa po otvorení zapne sám, ak to nastavenie (Viac → Nastavenia) nevypne.
  const [listening, setListening] = useState(() => getSetting("micAutostart"));
  const [said, setSaid] = useState("");
  const [refining, setRefining] = useState(0);
  /** Nahrávky na serveri, ktoré ešte nemajú výsledok – v zozname ich ukazuje karta „Spracúvam…“. */
  const [pendingAudio, setPendingAudio] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Nový zoznam „Iba ja“ (vybrané v „Kam pridávať?“). */
  const [priv, setPriv] = useState(false);
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

  const openLists = useMemo(
    () => lists.filter((l) => !l.completed_at).sort((a, b) => (a.planned_for ?? "9999").localeCompare(b.planned_for ?? "9999")),
    [lists],
  );
  // Predvolený cieľ ako v mockupe: najbližší otvorený zoznam (ak nič iné nie je zvolené ani rozdiktované).
  const defaulted = useRef(!!(listId || draft?.targetListId || draft?.store));
  useEffect(() => {
    if (defaulted.current || !openLists.length) return;
    defaulted.current = true;
    if (!store) setTargetListId(openLists[0]!.id);
  }, [openLists, store]);
  const target = targetListId ? (lists.find((l) => l.id === targetListId) ?? null) : null;
  const storeName = target ? target.name : store;

  // Rozdiktovaný zoznam priebežne ukladáme, aby ho nič nezmazalo (ani obnovenie stránky).
  useEffect(() => {
    saveDraft(household.id, { store, date, targetListId, items, recipes: plans, savedAt: Date.now() });
  }, [store, date, targetListId, items, plans, household.id]);

  // ---------------------------------------------------------------- zmeny zoznamu

  /** Nový stav zoznamu: zmenené karty znova „dopadnú“ (ako v prototype), nové pribudnú hore. */
  const present = useCallback((next: DraftItem[]) => {
    const before = itemsRef.current;
    const d = diff(before, next);
    const now = Date.now();
    const fx: Record<string, { from: string; to: string; at: number }> = {};
    const label = (c: DraftItem) => estRef.current.resolve(c.name)?.label ?? c.name;
    for (const id of d.changed) {
      const o = before.find((x) => x.id === id)!;
      const n = next.find((x) => x.id === id)!;
      if (label(o) !== label(n)) fx[id] = { from: label(o), to: label(n), at: now };
      else if (o.quantity !== n.quantity || o.unit !== n.unit) fx[id] = { from: fmtQty(o.quantity, o.unit), to: fmtQty(n.quantity, n.unit), at: now };
    }
    for (const id of d.added) {
      const n = next.find((x) => x.id === id)!;
      if (normalizeName(label(n)) !== normalizeName(n.name)) fx[id] = { from: n.name.toLowerCase(), to: label(n), at: now };
    }
    if (Object.keys(fx).length) {
      setFixes((f) => ({ ...f, ...fx }));
      timers.current.push(setTimeout(() => setFixes((f) => ({ ...f })), 3100));
    }
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

  async function finish(o: { store?: string; listId?: string | null; date?: string; isPrivate?: boolean } = {}) {
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
      // Názvy podľa pravidla „appka nič nedomýšľa“ (plzeň → Pilsner Urquell), kategória z katalógu.
      const named = all.map((c) => {
        const r = estRef.current.resolve(c.name);
        return r ? { ...c, name: r.label, categoryId: r.category } : c;
      });
      const r = await save.mutateAsync({ store: name, listId, date: o.date ?? date, items: named, isPrivate: o.isPrivate ?? priv });
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
        const r = reconcile(itemsRef.current, local, asSaid(ai.ops, sp.rest));
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
      const eff = applyOps(itemsRef.current, asSaid(res.ops, res.transcript));
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

  // Úseky nahrávky idú na server hneď (súbežne), výsledky sa však použijú v poradí, ako zazneli.
  // Po jednom by každá ďalšia veta čakala aj na všetky predchádzajúce.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const audioRef = useRef(applyAudio);
  audioRef.current = applyAudio;
  const onSegment = useCallback(
    (wav: string) => {
      setRefining((r) => r + 1);
      setPendingAudio((p) => p + 1);
      const before = itemsRef.current;
      const sel = selRef.current ? (before.find((c) => c.id === selRef.current)?.name ?? null) : null;
      const answer = interpretAudio({ mime: "audio/wav", data: wav }, before, sel, vocabRef.current);
      chain.current = chain.current.then(async () => {
        const res = await answer;
        setRefining((r) => r - 1);
        setPendingAudio((p) => p - 1);
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
    setPriv(false);
    setRestored(false);
    setDoneHint(false);
    setSaid("");
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

  // ---------------------------------------------------------------- zobrazenie (mockup voicetalk.jsx)

  const n = items.length;
  const unsureCount = items.filter((c) => c.status === "unclear").length;
  const active = activeCard();
  const openCards = cards.cards.filter((c) => c.status !== "added");
  const orphanPlans = plans.filter((p) => !cards.cards.some((c) => c.id === p.card && c.status !== "added"));
  const empty = n === 0 && !openCards.length && !plans.length && !pendingAudio;
  const pendingRecipes = cards.cards.filter((c) => c.status !== "added" && c.sel != null);

  const hearing = engine === "rec" ? rec.hearing : !!speech.interim;
  const live = engine === "speech" ? speech.interim : "";
  // iPhone mikrofón zapol, ale zvuk appky pustí až po ťuknutí – ťuk kamkoľvek ho rozbehne.
  const stalled = engine === "rec" && listening && rec.stalled;
  const kb = useKeyboardHeight(true);
  const shown = (c: DraftItem) => estimator.resolve(c.name)?.label ?? c.name;
  const tStore = storeKeyOf(target ? target.name : store);
  const tLabel = target ? target.name : store ? `${store} · ${dayLabel(date)}` : null;
  const selItem = selected ? items.find((c) => c.id === selected) : undefined;
  const now = Date.now();
  const [txt, setTxt] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typing) inp.current?.focus();
  }, [typing]);
  const send = (e: FormEvent) => {
    e.preventDefault();
    const v = txt.trim();
    if (!v) return;
    setTxt("");
    setSaid(v);
    setRestored(false);
    apply(v);
  };
  const micOn = listening && !blocked;

  return (
    <div className="bhm bhm-full bhm-voice" style={{ "--kb": `${kb}px` } as CSSProperties}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("voice.open")}
        className={`vx${g ? " g2" : ""}`}
        onClickCapture={() => {
          if (stalled) rec.wake();
        }}
      >
        {g && (
          <div className="bgl">
            <div className="bgb pic-kari_p" />
            <div className="veil" />
            <div className="veil" />
          </div>
        )}
        <div className="vx-top">
          <IB n="x" cls="vx-ib" label={t("voice.closeKeep")} onClick={close} />
          <button type="button" className="vx-target" onClick={() => setModal("store")} aria-label={t("vx.whereAria")}>
            {t("vx.to")} {tLabel ? <b>{tLabel}</b> : <em>{t("vx.newList")}</em>}
            <I n="caret-down" w="bold" />
          </button>
          <HelpBtn screen="m-voice" cls="vx-ib" />
        </div>
        {restored && n > 0 && (
          <div className="vx-rest">
            <I n="arrow-counter-clockwise" w="bold" />
            <span className="grow">{t("vx.restored", { n })}</span>
            <button type="button" onClick={reset}>
              {t("voice.startOver")}
            </button>
          </div>
        )}
        <div
          className="vx-list"
          ref={cardsBox}
          aria-live="polite"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {empty ? (
            <div className="vx-empty">
              <b>{t("vx.emptyT")}</b>
              <span>{t("vx.emptyS")}</span>
              <div className="vx-ex">
                {[t("vx.ex1"), t("vx.ex2"), t("vx.ex3")].map((x) => (
                  <button
                    type="button"
                    key={x}
                    onClick={() => {
                      setSaid(x);
                      apply(x);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {n > 0 && <div className="vx-cnt">{t("vx.cnt", { items: tn("li.items", n) })}</div>}
              {pendingAudio > 0 && (
                <div className="vxi" role="status">
                  <span className="th">
                    <span className="think-l">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                  <div className="grow">
                    <b>{tn("voice.pending", pendingAudio)}</b>
                    <small>{t("voice.pendingSub")}</small>
                  </div>
                </div>
              )}
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
              {items.map((c) => {
                const name = shown(c);
                const e = estimator.est({ name, quantity: c.quantity, unit: c.unit }, tStore);
                const unsure = c.status === "unclear" && c.suggestions.length > 0;
                const fx = fixes[c.id] && now - fixes[c.id]!.at < 3000 ? fixes[c.id] : null;
                const bump = flash[c.id] ?? 0;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className={`vxi${selected === c.id ? " sel" : ""}${unsure ? " unsure" : ""}`}
                    style={bump ? { animation: `${bump % 2 ? "mk-vxbumpA" : "mk-vxbumpB"} .55s cubic-bezier(.3,1.5,.5,1)` } : undefined}
                    onClick={() => setSelected((x) => (x === c.id ? null : c.id))}
                    onKeyDown={(ev) => ev.key === "Enter" && setSelected((x) => (x === c.id ? null : c.id))}
                  >
                    <span className="th">
                      <E k={estimator.emoji(name, c.categoryId)} />
                    </span>
                    <div className="grow">
                      <b>{unsure ? t("vx.unsure", { name }) : name}</b>
                      {unsure ? (
                        <div className="vx-opts">
                          {c.suggestions.map((sg) => (
                            <button
                              type="button"
                              key={sg}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                patch(c.id, { name: sg, categoryId: guessCategory(sg), status: "ok", suggestions: [] });
                                haptic(10);
                              }}
                            >
                              {sg}
                            </button>
                          ))}
                        </div>
                      ) : fx ? (
                        <small key={fx.at} className="vx-fix">
                          <s>{fx.from}</s> → {fx.to}
                        </small>
                      ) : e ? (
                        <small>~{eur(e.v)}</small>
                      ) : null}
                    </div>
                    <span className="q">{fmtQty(c.quantity, c.unit)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="vx-bot">
          {selItem && (
            <div className="vx-qq">
              {(selItem.unit === "kg" ? [0.25, 0.5, 1, 2] : selItem.unit === "l" ? [0.5, 1, 2, 3] : [1, 2, 3, 6]).map((q) => (
                <button
                  type="button"
                  key={q}
                  className={Math.abs((selItem.quantity ?? 1) - q) < 0.001 ? "on" : ""}
                  onClick={() => {
                    patch(selItem.id, { quantity: q, unit: selItem.unit ?? "ks", status: "ok" });
                    setSelected(null);
                  }}
                >
                  {fmtQty(q, selItem.unit ?? "ks")}
                </button>
              ))}
            </div>
          )}
          <div className={`vx-heard${selItem ? " edit" : ""}`} aria-live="polite">
            <small>
              {selItem
                ? t("vx.editing", { name: shown(selItem) })
                : live || hearing
                  ? t("vx.hearing")
                  : refining > 0
                    ? t("vx.thinking")
                    : micOn
                      ? t("vx.listening")
                      : t("vx.paused")}
            </small>
            {blocked ? (
              <p className="vx-note">
                <I n="warning-circle" />
                {engine === "none" ? t("voice.unsupportedText") : isIOS() ? t("voice.blockedTextIos") : t("voice.blockedText")}
              </p>
            ) : stalled ? (
              <span className="dim">{t("voice.tapToStart")}</span>
            ) : live ? (
              <span>
                {live}
                <i>…</i>
              </span>
            ) : selItem ? (
              <span className="dim">{t("vx.editHint")}</span>
            ) : hearing || (micOn && !said) ? (
              <span className="wave">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : said ? (
              <span>{said}</span>
            ) : (
              <span className="dim">{t("vx.pausedHint")}</span>
            )}
          </div>
          {engine === "rec" && import.meta.env.MODE === "staging" && <MicDiag diag={rec.diag} />}
          {typing && (
            <form className="vx-kbd" onSubmit={send}>
              <input
                ref={inp}
                value={txt}
                onChange={(e) => setTxt(e.target.value)}
                placeholder={selItem ? t("vx.kbdPhEdit") : t("vx.kbdPh")}
                autoComplete="off"
                enterKeyHint="send"
                maxLength={300}
                aria-label={t("vx.kbdAria")}
              />
              <button type="submit" disabled={!txt.trim()} aria-label={t("vx.add")}>
                <I n="arrow-up" w="bold" />
              </button>
            </form>
          )}
          <div className="vx-ctrl">
            {selItem ? (
              <button type="button" className="vx-side" onClick={() => setSelected(null)}>
                {t("vx.cancelEdit")}
              </button>
            ) : (
              <button type="button" className={`vx-side${typing ? " on" : ""}`} onClick={() => setTyping((x) => !x)}>
                <I n="keyboard" />
                {t("vx.type")}
              </button>
            )}
            <button
              type="button"
              className={`vx-orb${micOn ? " on" : ""}${selItem ? " edit" : ""}`}
              disabled={blocked}
              onClick={() => {
                if (blocked || stalled) return;
                haptic(8);
                setListening((l) => !l);
              }}
              aria-label={listening ? t("vx.pause") : t("vx.listen")}
            />
            {selItem ? (
              <button type="button" className="vx-side dng" onClick={() => removeCard(selItem.id)}>
                <I n="trash" />
                {t("vx.del")}
              </button>
            ) : (
              <button type="button" className="vx-done" onClick={() => create()} disabled={!n || busy}>
                {busy ? t("voice.saving") : t("vx.done")}
              </button>
            )}
          </div>
        </div>

        {(modal === "where" || modal === "store") && (
          <WherePanel
            done={modal === "where"}
            n={n}
            lists={openLists}
            stores={stores}
            targetListId={targetListId}
            store={store}
            date={date}
            priv={priv}
            householdName={household.name}
            busy={busy}
            onClose={() => setModal(null)}
            onPick={(c) => {
              setModal(null);
              if (c.listId !== null) {
                setTargetListId(c.listId);
              } else {
                setTargetListId(null);
                setStore(c.store);
                setDate(c.date);
                setPriv(c.isPrivate);
              }
            }}
            onCommit={(c) => {
              if (c.listId !== null) void finish({ listId: c.listId });
              else {
                setTargetListId(null);
                setStore(c.store);
                setDate(c.date);
                void finish({ store: c.store, listId: null, date: c.date, isPrivate: c.isPrivate });
              }
            }}
          />
        )}
        {(modal === "recipes" || modal === "unsure") && (
          <div className="vx-panel" role="dialog" aria-modal="true">
            <div className="vx-scrim" onClick={() => setModal(null)} />
            <div className="vx-sheet">
              <span className="grab" onClick={() => setModal(null)} />
              {modal === "recipes" ? (
                <>
                  <h2>{t("voice.rc.pendingTitle")}</h2>
                  <p className="meta">{t("voice.rc.pendingText", { names: pendingRecipes.map((c) => c.options[c.sel!]?.name ?? c.query).join(", ") })}</p>
                  <Btn cls="pri full big" onClick={() => {
                    for (const c of pendingRecipes) addRecipe(c);
                    setModal(null);
                    timers.current.push(setTimeout(() => createRef.current("recipes")));
                  }}>
                    {t("voice.rc.addThem")}
                  </Btn>
                  <Btn cls="soft full" onClick={() => create("recipes")}>
                    {t("voice.rc.withoutThem")}
                  </Btn>
                </>
              ) : (
                <>
                  <h2>{tn("voice.unsureTitle", unsureCount)}</h2>
                  <p className="meta">{t("voice.unsureText")}</p>
                  <Btn cls="pri full big" onClick={() => create("unsure")}>
                    {t("voice.createAnyway")}
                  </Btn>
                  <Btn
                    cls="soft full"
                    onClick={() => {
                      setModal(null);
                      setSelected(items.find((c) => c.status === "unclear")?.id ?? null);
                    }}
                  >
                    {t("voice.refine")}
                  </Btn>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Choice = { listId: string } | { listId: null; store: string; date: string; isPrivate: boolean };

/** „Kam pridať?“ – existujúce zoznamy navrchu, pod nimi nový zoznam (obchod, deň, kto ho uvidí). */
function WherePanel({
  done,
  n,
  lists,
  stores,
  targetListId,
  store,
  date,
  priv,
  householdName,
  busy,
  onClose,
  onPick,
  onCommit,
}: {
  done: boolean;
  n: number;
  lists: ShoppingList[];
  stores: string[];
  targetListId: string | null;
  store: string;
  date: string;
  priv: boolean;
  householdName: string;
  busy: boolean;
  onClose: () => void;
  onPick: (c: Choice) => void;
  onCommit: (c: Choice) => void;
}) {
  const stats = useListStats(lists[0]?.household_id ?? "").data;
  const days = [0, 1, 2].map((d) => isoDay(addDays(new Date(), d)));
  const [c, setC] = useState<Choice>(() =>
    targetListId ? { listId: targetListId } : store ? { listId: null, store, date, isPrivate: priv } : lists[0] ? { listId: lists[0].id } : { listId: null, store: "", date: days[1]!, isPrivate: false },
  );
  const isNew = c.listId === null;
  const nc = (p: Partial<{ store: string; date: string; isPrivate: boolean }>) =>
    setC((x) => ({ listId: null, store: x.listId === null ? x.store : "", date: x.listId === null ? x.date : days[1]!, isPrivate: x.listId === null ? x.isPrivate : false, ...p }));
  const L = !isNew ? lists.find((l) => l.id === c.listId) : undefined;
  const tiles = (store && !stores.includes(store) ? [store, ...stores] : stores).slice(0, 6);
  const name = c.listId === null ? c.store || t("voice.defaultListName") : (L?.name ?? "");
  const label = !done ? t("vx.sheetDone") : isNew ? t("vx.createAdd", { name }) : t("vx.addTo", { name });
  const dayNames = [t("date.today"), t("date.tomorrow"), t("nl.dayAfter")].map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  return (
    <div className="vx-panel" role="dialog" aria-label={t("vx.wherePick")}>
      <div className="vx-scrim" onClick={onClose} />
      <div className="vx-sheet where">
        <span className="grab" onClick={onClose} />
        <h2>{done ? tn("vx.whereN", n) : t("vx.wherePick")}</h2>
        {lists.length > 0 && (
          <>
            <span className="k">{t("vx.existing")}</span>
            <div
              className="vx-lists"
              ref={(el) => {
                // vybraný zoznam je hneď vidieť (aj keď je nižšie v zozname)
                if (el && !el.dataset.shown) {
                  el.dataset.shown = "1";
                  el.querySelector(".vx-opt.on")?.scrollIntoView({ block: "nearest" });
                }
              }}
            >
              {lists.map((l) => (
                <button type="button" key={l.id} className={`vx-opt${!isNew && c.listId === l.id ? " on" : ""}`} onClick={() => setC({ listId: l.id })}>
                  <span className="grow">
                    <b>{l.name}</b>
                    <small>
                      {l.planned_for ? dayLabel(l.planned_for) : t("trip.noDay")} · {tn("li.items", stats?.get(l.id)?.open ?? 0)}
                    </small>
                  </span>
                  {!isNew && c.listId === l.id && <I n="check-circle" />}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="k">{t("vx.orNew")}</span>
        <div className={`vx-new${isNew ? " on" : ""}`}>
          <div className="vx-stores">
            {tiles.map((s) => (
              <button type="button" key={s} className={c.listId === null && c.store === s ? "on" : ""} onClick={() => nc({ store: c.listId === null && c.store === s ? "" : s })}>
                <StoreTile k={storeKeyOf(s)} n={s} s={22} />
                {s}
              </button>
            ))}
          </div>
          <div className="vx-days">
            {days.map((d, i) => (
              <button type="button" key={d} className={c.listId === null && c.date === d ? "on" : ""} onClick={() => nc({ date: d })}>
                {dayNames[i]}
              </button>
            ))}
          </div>
          <div className="vx-days">
            <span className="vx-who">{t("vx.who")}</span>
            <button type="button" className={c.listId === null && !c.isPrivate ? "on" : ""} onClick={() => nc({ isPrivate: false })}>
              {householdName}
            </button>
            <button type="button" className={c.listId === null && c.isPrivate ? "on" : ""} onClick={() => nc({ isPrivate: true })}>
              {t("nl.onlyMe")}
            </button>
          </div>
        </div>
        <Btn cls="pri full big" disabled={busy || (!isNew && !L)} onClick={() => (done ? onCommit(c) : onPick(c))}>
          {label}
        </Btn>
      </div>
    </div>
  );
}

/** Len v testovacej appke: čo mikrofón naozaj dáva (hlasitosť vs. prah reči) – na odhalenie tichého mikrofónu. */
function MicDiag({ diag }: { diag: { current: string } }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const id = setInterval(() => setText(diag.current), 400);
    return () => clearInterval(id);
  }, [diag]);
  return text ? <div className="v-diag t-xs t-3 num">{text}</div> : null;
}
