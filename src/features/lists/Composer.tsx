import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Keyboard, Mic, Plus } from "lucide-react";
import { haptic } from "@/components/kit";
import { cx } from "@/components/ui";
import { normalizeName } from "@/lib/categories";
import { formatQuantity, parseItemInput } from "@/lib/parseItem";
import { t } from "@/i18n";
import { parseLocal } from "@/features/voice/parse";
import { useDictation } from "@/features/voice/useDictation";
import type { Item } from "./api";
import { Bubble, starters, useQuickPool, useSlots } from "./QuickDock";
import { candidates, keyOf } from "./quickSlots";
import { popOut, useTapCounter } from "./useTapCounter";
import type { AddOutcome } from "./useSmartAdd";

export const UNITS = ["ks", "g", "kg", "ml", "l"] as const;
const CHIPS = 6;

export type AddInput = { name: string; quantity: number | null; unit: string | null; note: string | null; quiet?: boolean };

/**
 * Kde začína klávesnica (horný okraj viditeľnej časti stránky). iPhone kreslí klávesnicu cez stránku
 * a výšku okna pritom hlási rôzne, preto sa meria priamo viditeľná oblasť – nie rozdiel výšok.
 * Na Androide sa stránka zmenší sama, vtedy je to spodok obrazovky. Mimo písania null.
 */
export function useKeyboardEdge(active: boolean) {
  const [edge, setEdge] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setEdge(null);
      return;
    }
    const update = () => setEdge(Math.round(vv.offsetTop + vv.height));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return edge;
}

/**
 * Pole na pridávanie v doku pri palci.
 *  - Mimo písania: „Čo treba kúpiť?“ s mikrofónom (diktovanie celých viet).
 *  - Pri písaní sa pole prilepí ku klávesnici: nad ním 6 rovnako veľkých bublín (najčastejšie produkty,
 *    pri písaní zhody) – ťuk = +1, po 2 s sa pridá a bublinu nahradí ďalší. Počet sa dá napísať rovno
 *    do textu („pivo6“, „pivo 6 ks“, „6x pivo“) – ukáže sa ako štítok v poli.
 *  - Klávesnica sa zavrie ťukom do zoznamu alebo na Hotovo.
 */
export function Composer({
  householdId,
  items,
  requestMode,
  typing,
  onTyping,
  onAdd,
  onRemove,
}: {
  householdId: string;
  items: Item[];
  requestMode?: boolean;
  typing: boolean;
  onTyping: (on: boolean) => void;
  onAdd: (input: AddInput) => Promise<AddOutcome>;
  /** Diktovanie „zmaž maslo“. */
  onRemove?: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const [dict, setDict] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const pool = useQuickPool(householdId, items);

  // Nadiktovaná veta: všetky položky naraz, potom jedna hláška „Pridané hlasom: …“.
  const speech = useDictation(async (said) => {
    const adds: Promise<AddOutcome>[] = [];
    const names: string[] = [];
    for (const op of parseLocal(said)) {
      if (op.op === "add") {
        names.push(op.name);
        adds.push(onAdd({ name: op.name, quantity: op.quantity, unit: op.unit && op.unit !== "ks" ? op.unit : null, note: null, quiet: true }));
      } else if (op.op === "remove") onRemove?.(op.target);
    }
    if (!adds.length) return;
    const done = await Promise.all(adds);
    const ok = names.filter((_, i) => done[i] !== "FAILED");
    if (ok.length) toast.show(t("ls.addedByVoice", { names: ok.join(", ") }), "success");
  }, pool.freq);

  // Ťuk mimo doku (do zoznamu) zavrie klávesnicu – iPhone to sám neurobí.
  useEffect(() => {
    if (!typing) return;
    const away = (e: PointerEvent) => {
      const dock = root.current?.closest(".ls-dock");
      if (dock && !dock.contains(e.target as Node)) inputRef.current?.blur();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [typing]);

  const parsed = text.trim() ? parseItemInput(text) : null;
  const typed = parsed ? normalizeName(parsed.name) : "";

  const textRef = useRef(text);
  textRef.current = text;
  const { counts, tap } = useTapCounter((key, n) => {
    const name = key.slice(2);
    const typedAtTap = typedRef.current.get(key);
    popOut(root.current?.querySelector(`[data-q="${CSS.escape(key)}"]`) ?? null, () => {
      pool.mark(name, true);
      // Bublina zo zhody s napísaným textom: text už netreba.
      if (typedAtTap && textRef.current === typedAtTap) setText("");
      void onAdd({ name, quantity: n, unit: null, note: null }).then((o) => o === "FAILED" && pool.mark(name, false));
    });
  });
  const typedRef = useRef(new Map<string, string>());

  const hold = useMemo(() => new Set(Object.keys(counts).map((k) => keyOf(k.slice(2)))), [counts]);
  const basePool = useMemo(() => candidates([pool.freq, starters()], pool.exclude), [pool.freq, pool.exclude]);
  const slots = useSlots(basePool, CHIPS, hold, pool.ready);
  const matches = useMemo(() => {
    if (!typed) return [];
    const all = candidates([pool.freq, starters()], pool.exclude);
    const starts = all.filter((n) => keyOf(n).startsWith(typed) && keyOf(n) !== typed);
    const inside = all.filter((n) => !keyOf(n).startsWith(typed) && keyOf(n).includes(typed));
    return [...starts, ...inside].slice(0, CHIPS);
  }, [typed, pool.freq, pool.exclude]);
  const chips = typed ? matches : slots;

  async function add() {
    if (!parsed?.name) return;
    const before = text;
    setText("");
    inputRef.current?.focus();
    const outcome = await onAdd({ name: parsed.name, quantity: parsed.quantity, unit: parsed.unit, note: null });
    if (outcome === "FAILED") setText(before); // nič sa nestratí
  }

  if (dict) {
    return (
      <div className="ls-composer2" ref={root}>
        <div className="ls-dict">
          <div className="row g-10">
            <span className="ls-mic-live" aria-hidden>
              <Mic size={20} />
            </span>
            <div className="transcript grow">
              {speech.interim ? (
                <span className="fw-5">{speech.interim}</span>
              ) : speech.error ? (
                <span className="t-2">{t("ls.micBlocked")}</span>
              ) : (
                <span className="t-2">{t("ls.listening")}</span>
              )}
            </div>
          </div>
          <span className="t-xs t-3">{t("ls.dictHint")}</span>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => {
              speech.stop();
              setDict(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <Keyboard size={16} />
            {t("ls.type")}
          </button>
        </div>
      </div>
    );
  }

  const keep = { onMouseDown: (e: React.MouseEvent) => e.preventDefault() };
  return (
    <div className={cx("ls-composer2", typing && "typing")} ref={root}>
      {typing && (
        <>
          <div className="qc-top">
            <span className="t-xs fw-6 t-2">{typed ? t("qd.matches") : t("qd.suggest")}</span>
            <button type="button" className="qc-done" {...keep} onClick={() => inputRef.current?.blur()}>
              {t("qd.done")}
            </button>
          </div>
          <div className="qd-grid qc-chips">
            {chips.map((name) => {
              const key = `c:${name}`;
              return (
                <Bubble
                  key={key}
                  id={key}
                  name={name}
                  n={counts[key] ?? 0}
                  onTap={() => {
                    if (typed) typedRef.current.set(key, text);
                    else typedRef.current.delete(key);
                    tap(key);
                    inputRef.current?.focus();
                  }}
                />
              );
            })}
            {Array.from({ length: Math.max(0, CHIPS - chips.length) }, (_, i) => (
              <span key={`e${i}`} className="qc-empty" aria-hidden />
            ))}
          </div>
        </>
      )}
      <div className="row g-8">
        <label className={cx("ls-field grow", typing && "on")}>
          <span className="sr-only">{t("composer.label")}</span>
          {!typing && <Plus size={20} className="qc-plus" aria-hidden />}
          <input
            ref={inputRef}
            value={text}
            placeholder={requestMode ? t("ls.placeholderRequest") : typing ? t("qd.placeholderTyping") : t("composer.placeholder")}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onTyping(true)}
            onBlur={() =>
              setTimeout(() => {
                if (document.activeElement !== inputRef.current) onTyping(false);
              }, 120)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) void add();
            }}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="send"
            maxLength={120}
          />
          {parsed && parsed.quantity != null && (
            <span key={`${parsed.quantity}${parsed.unit}`} className="qc-qty">
              {formatQuantity(parsed.quantity, parsed.unit ?? "ks")}
            </span>
          )}
          {!typing && speech.supported && (
            <button
              type="button"
              className="mic"
              aria-label={t("ls.dictate")}
              onClick={(e) => {
                e.preventDefault();
                haptic();
                setDict(true);
                speech.start();
              }}
            >
              <Mic size={20} />
            </button>
          )}
        </label>
        {typing && (
          <button
            type="button"
            className={cx("qc-add", parsed && "go")}
            {...keep}
            aria-label={requestMode ? t("composer.submitRequest") : t("composer.submit")}
            disabled={!parsed}
            onClick={() => void add()}
          >
            <Plus size={20} strokeWidth={2.6} />
            {parsed && <span>{t("qd.add")}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
