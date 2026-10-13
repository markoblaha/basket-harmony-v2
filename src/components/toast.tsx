/**
 * Krátke hlášky dole na obrazovke ("Položka pridaná", "Nepodarilo sa uložiť").
 * Chyby nikdy nemiznú potichu – každá zlyhaná akcia ukáže hlášku.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

type Toast = { id: number; text: string; tone: "info" | "error" | "success" };
const ToastContext = createContext<{ show: (text: string, tone?: Toast["tone"]) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const show = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), tone === "error" ? 6000 : 3000);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cx(
              "max-w-md animate-rise rounded-[0.875rem] px-4 py-3 text-sm font-semibold shadow-lg",
              t.tone === "error" ? "bg-danger text-on-primary" : "bg-primary text-on-primary",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast mimo ToastProvider");
  return ctx;
}
