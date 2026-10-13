import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AudioLines, BarChart3, Menu, Receipt, ShoppingCart } from "lucide-react";
import { useToast } from "./toast";
import { itemsWord } from "@/features/lists/qty";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useHouseholdRealtime } from "@/features/realtime/useHouseholdRealtime";
import { OfflineBanner, cx } from "./ui";

const VoiceSession = lazy(() => import("@/features/voice/VoiceSession").then((m) => ({ default: m.VoiceSession })));

const TABS = [
  { to: "/", label: "Nákup", icon: ShoppingCart, match: (p: string) => p === "/" || p.startsWith("/lists") },
  { to: "/receipts", label: "Bločky", icon: Receipt, match: (p: string) => p.startsWith("/receipts") },
  { to: "/analytics", label: "Prehľady", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { to: "/more", label: "Viac", icon: Menu, match: (p: string) => p.startsWith("/more") },
];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Rám aplikácie: obsah + spodná navigácia + hlásenia o spojení. */
export function AppShell() {
  const { household } = useHousehold();
  const realtime = useHouseholdRealtime(household.id);
  const online = useOnline();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [voice, setVoice] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pt-safe">
      {!online && <OfflineBanner />}
      {online && realtime === "reconnecting" && (
        <div role="status" className="bg-info-soft px-4 py-1.5 text-center text-sm text-info">
          Obnovujem živé spojenie…
        </div>
      )}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav
        aria-label="Hlavná navigácia"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated/95 pb-safe backdrop-blur-md"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((tab, i) => (
            <TabItem key={tab.to} tab={tab} active={tab.match(pathname)} before={i === 2 ? <VoiceButton onClick={() => setVoice(true)} /> : null} />
          ))}
        </ul>
      </nav>
      {voice && (
        <Suspense fallback={null}>
          <VoiceSession
            onClose={() => setVoice(false)}
            onSaved={(store, r) => {
              setVoice(false);
              navigate(`/lists/${r.listId}`);
              const n = r.added + r.merged + r.requests;
              toast.show(
                r.requests
                  ? `${store}: ${r.requests} ${itemsWord(r.requests)} čaká na schválenie nakupujúcim`
                  : `Uložené do Nákup · ${store} · ${n} ${itemsWord(n)}`,
                "success",
              );
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

type Tab = (typeof TABS)[number];

function TabItem({ tab, active, before }: { tab: Tab; active: boolean; before: ReactNode }) {
  const Icon = tab.icon;
  return (
    <>
      {before}
      <li>
        <NavLink
          to={tab.to}
          aria-current={active ? "page" : undefined}
          className={cx(
            "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors",
            active ? "text-text" : "text-text-2",
          )}
        >
          <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent-soft text-accent")}>
            <Icon className="size-[1.375rem]" strokeWidth={2} aria-hidden />
          </span>
          {tab.label}
        </NavLink>
      </li>
    </>
  );
}

/** Stredné tlačidlo navigácie: otvorí hlasový nákup s už zapnutým mikrofónom. */
function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex items-start justify-center">
      <button
        type="button"
        onClick={() => {
          try {
            navigator.vibrate?.(12);
          } catch {
            /* nepodporované */
          }
          onClick();
        }}
        aria-label="Hlasový nákup"
        className="-mt-5 grid size-[3.75rem] place-items-center rounded-full bg-primary text-on-primary shadow-[0_0_0_6px_var(--bg)] transition-transform active:scale-[0.93]"
      >
        <AudioLines className="size-[1.625rem]" strokeWidth={2.1} aria-hidden />
      </button>
    </li>
  );
}
