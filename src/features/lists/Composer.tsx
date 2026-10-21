import { useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Keyboard, Mic, Plus } from "lucide-react";
import { CatIcon, Stepper, haptic } from "@/components/kit";
import { guessCategory, normalizeName } from "@/lib/categories";
import { parseItemInput } from "@/lib/parseItem";
import { t } from "@/i18n";
import { parseLocal } from "@/features/voice/parse";
import { useSpeech } from "@/features/voice/useSpeech";
import { useFrequentItems } from "./api";
import type { AddOutcome } from "./useSmartAdd";

export const UNITS = ["ks", "g", "kg", "ml", "l"] as const;
/** Krok tlačidiel +/− podľa jednotky: kusy po 1, gramy po 50, kilá a litre po 0,5. */
const stepFor = (u: string) => (u === "g" || u === "ml" ? 50 : u === "kg" || u === "l" ? 0.5 : 1);

export type AddInput = { name: string; quantity: number | null; unit: string | null; note: string | null; quiet?: boolean };

/**
 * Pole na pridávanie (prototyp N3): názov s mikrofónom, počet (− 1 +), tlačidlo +,
 * pod tým upresnenie a jednotka. Pri písaní ponúkne produkty z histórie domácnosti.
 * Mikrofón diktuje celé vety („dve mlieka, maslo a štyri rožky“).
 */
export function Composer({
  householdId,
  requestMode,
  onAdd,
  onRemove,
}: {
  householdId: string;
  requestMode?: boolean;
  onAdd: (input: AddInput) => Promise<AddOutcome>;
  /** Diktovanie „zmaž maslo“. */
  onRemove?: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<string>("ks");
  const [focus, setFocus] = useState(false);
  const [dict, setDict] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const frequent = useFrequentItems(householdId);
  const toast = useToast();

  // Nadiktovaná veta: všetky položky naraz, potom jedna hláška „Pridané hlasom: …“ (prototyp).
  const speech = useSpeech(async (said) => {
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
  });

  const suggestions = useMemo(() => {
    const k = normalizeName(text);
    if (!k) return [];
    const scored: [number, string, string][] = [];
    for (const f of frequent.data ?? []) {
      const n = normalizeName(f.name);
      const score = n.startsWith(k) ? 2 : n.includes(k) ? 1 : 0;
      if (score && n !== k) scored.push([score, f.name, f.category_id]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, 5);
  }, [text, frequent.data]);

  const reset = () => {
    setText("");
    setDetail("");
    setQty(1);
    setUnit("ks");
  };

  async function add(picked?: string) {
    const untouched = qty === 1 && unit === "ks";
    let input: AddInput;
    if (picked) {
      input = { name: picked, quantity: qty, unit: unit === "ks" ? null : unit, note: detail.trim() || null };
    } else {
      const p = parseItemInput(text);
      if (!p.name) return;
      const fromText = p.quantity != null;
      input = {
        name: p.name,
        quantity: fromText && untouched ? p.quantity : qty,
        unit: fromText && untouched ? p.unit : unit === "ks" ? null : unit,
        note: detail.trim() || null,
      };
    }
    const before = { text, detail, qty, unit };
    reset();
    inputRef.current?.focus();
    const outcome = await onAdd(input);
    if (outcome === "FAILED") {
      // nič sa nestratí – text vrátime do polí
      setText(before.text);
      setDetail(before.detail);
      setQty(before.qty);
      setUnit(before.unit);
    }
  }

  if (dict) {
    return (
      <div className="ls-composer">
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
                <>
                  <Wave height={18} />
                  <span className="t-2">{t("ls.listening")}</span>
                </>
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

  return (
    <div className="ls-composer">
      <div className="row g-8">
        <label className="ls-field grow">
          <span className="sr-only">{t("composer.label")}</span>
          <input
            ref={inputRef}
            value={text}
            placeholder={requestMode ? t("ls.placeholderRequest") : t("composer.placeholder")}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) void add();
            }}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={120}
          />
          {speech.supported && (
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
        <Stepper value={qty} onChange={setQty} min={unit === "ks" ? 1 : stepFor(unit)} step={stepFor(unit)} unit={unit} small />
        <button
          type="button"
          className="ibtn ink"
          aria-label={requestMode ? t("composer.submitRequest") : t("composer.submit")}
          disabled={!text.trim()}
          style={{ opacity: text.trim() ? 1 : 0.35 }}
          onClick={() => void add()}
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      </div>
      <div className="ls-detail">
        <input
          placeholder={t("ls.detailPlaceholder")}
          value={detail}
          maxLength={300}
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && void add()}
        />
        <select
          className="ls-unit"
          aria-label={t("edit.unit")}
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            setQty(e.target.value === "g" || e.target.value === "ml" ? 250 : 1);
          }}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {focus && suggestions.length > 0 && (
        <div className="ls-suggest">
          {suggestions.map(([, name, cat]) => (
            <button key={name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void add(name)}>
              <CatIcon id={cat || guessCategory(name)} size="sm" />
              <span className="grow t-body fw-5 ellipsis">{name}</span>
              <Plus size={16} className="t-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Zvlnená animácia počúvania (prototyp Wave). */
function Wave({ height = 22, bars = 7 }: { height?: number; bars?: number }) {
  return (
    <span className="row g-4" style={{ height, color: "var(--red)", flex: "none" }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{ width: 4, height: "100%", borderRadius: 99, background: "currentColor", transformOrigin: "center", animation: `wave 1s ease-in-out ${i * 0.12}s infinite` }}
        />
      ))}
    </span>
  );
}
