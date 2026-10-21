/**
 * Krátke hlášky ("Zoznam upravený", "Nepodarilo sa uložiť") ako v prototype: tmavá
 * pilulka nad spodnou lištou, voliteľne s tlačidlom Vrátiť. Pridanie položky ukáže
 * nenápadná bublina hore („✓ Mlieko 2 ks · Lidl“), ktorá sa sama rozplynie.
 * Chyby nikdy nemiznú potichu – každá zlyhaná akcia ukáže hlášku.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { t } from "@/i18n";

type Tone = "info" | "error" | "success";
type Toast = { id: number; text: string; tone: Tone; undo?: () => void };
export type Added = { title: string; qty?: string; note?: string; undo?: () => void };
type Api = {
  show: (text: string, tone?: Tone, opts?: { undo?: () => void }) => void;
  /** Bublina hore po pridaní položky. */
  added: (a: Added) => void;
};
const ToastContext = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [pill, setPill] = useState<(Added & { id: number }) | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pillTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Api["show"]>((text, tone = "info", opts) => {
    const id = nextId.current++;
    setToast({ id, text, tone, undo: opts?.undo });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), tone === "error" ? 6000 : opts?.undo ? 5000 : 3000);
  }, []);
  const added = useCallback<Api["added"]>((a) => {
    const id = nextId.current++;
    setPill({ ...a, id });
    clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => setPill((x) => (x?.id === id ? null : x)), 3400);
  }, []);
  const value = useMemo(() => ({ show, added }), [show, added]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {pill && (
        <div className="addpill fixed top-[calc(env(safe-area-inset-top)+0.5rem)]" role="status" aria-live="polite">
          <div key={pill.id}>
            <span className="ok">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="tt">{pill.title}</span>
            {pill.qty && <span className="qq num">{pill.qty}</span>}
            {pill.note && <span className="nn">{pill.note}</span>}
            {pill.undo && (
              <button
                type="button"
                onClick={() => {
                  pill.undo?.();
                  setPill(null);
                }}
              >
                {t("common.undo")}
              </button>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))]" aria-live="polite">
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            style={toast.tone === "error" ? { background: "var(--danger-solid)", color: "var(--on-danger-solid)" } : undefined}
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                {t("common.undo")}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast mimo ToastProvider");
  return ctx;
}
