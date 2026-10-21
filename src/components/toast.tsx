/**
 * Krátke hlášky ("Zoznam upravený", "Nepodarilo sa uložiť") ako v prototype: tmavá
 * pilulka nad spodnou lištou, voliteľne s tlačidlom Vrátiť. Pridanie položky ukáže
 * nenápadná bublina hore („✓ Mlieko 2 ks · Lidl“), ktorá sa sama rozplynie.
 * Chyby nikdy nemiznú potichu – každá zlyhaná akcia ukáže hlášku.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Check } from "lucide-react";
import { haptic } from "./kit";
import { t } from "@/i18n";

type Tone = "info" | "error" | "success";
type Toast = { id: number; text: string; tone: Tone; undo?: () => void; high: boolean };
/** Upozornenie v appke (banner hore): kto/čo sa stalo, ťuknutím otvorí cieľ. */
export type Notice = { title: string; body?: string; onOpen?: () => void };
export type Added = { title: string; qty?: string; note?: string; undo?: () => void };
type Api = {
  show: (text: string, tone?: Tone, opts?: { undo?: () => void }) => void;
  /** Bublina hore po pridaní položky. */
  added: (a: Added) => void;
  /** Banner hore ako upozornenie z telefónu; sám zmizne po 5 s. */
  notify: (n: Notice) => void;
};
const ToastContext = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [pill, setPill] = useState<(Added & { id: number }) | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pillTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [notice, setNotice] = useState<(Notice & { id: number }) | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Api["show"]>((text, tone = "info", opts) => {
    const id = nextId.current++;
    // Bez spodnej lišty (nákup, hlas, varenie) je hláška hore, aby neprekryla tlačidlá dole.
    // Celoobrazovkový režim, ktorý lištu len prekrýva, sa označí atribútom data-notab na svojom obale.
    const high = typeof document !== "undefined" && (!document.querySelector("nav.tabbar") || !!document.querySelector("[data-notab]"));
    setToast({ id, text, tone, undo: opts?.undo, high });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), tone === "error" ? 6000 : opts?.undo ? 5000 : 3000);
  }, []);
  const added = useCallback<Api["added"]>((a) => {
    const id = nextId.current++;
    setPill({ ...a, id });
    clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => setPill((x) => (x?.id === id ? null : x)), 3400);
  }, []);
  const notify = useCallback<Api["notify"]>((n) => {
    const id = nextId.current++;
    setNotice({ ...n, id });
    haptic(20);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice((x) => (x?.id === id ? null : x)), 5000);
  }, []);
  const value = useMemo(() => ({ show, added, notify }), [show, added, notify]);

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
        <div
          className={toast.high ? "toast high fixed top-[calc(env(safe-area-inset-top)+4rem)]" : "toast fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))]"}
          aria-live="polite"
        >
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
      {notice && (
        <div className="banner fixed top-[calc(env(safe-area-inset-top)+0.5rem)]" key={notice.id} role="status" aria-live="polite">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              notice.onOpen?.();
            }}
          >
            <span className="app-ic">
              <Bell size={18} />
            </span>
            <span className="grow stack g-2">
              <span className="t-xs t-2">{t("notice.from")}</span>
              <span className="t-h">{notice.title}</span>
              {notice.body && <span className="t-sm t-2">{notice.body}</span>}
            </span>
          </button>
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
