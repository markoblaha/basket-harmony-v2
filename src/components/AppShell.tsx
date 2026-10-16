import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AudioLines, BarChart3, Menu, Receipt, ShoppingCart } from "lucide-react";
import { useToast } from "./toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useHouseholdRealtime } from "@/features/realtime/useHouseholdRealtime";
import { t, tn, type Key } from "@/i18n";
import { OfflineBanner, cx } from "./ui";

const VoiceSession = lazy(() => import("@/features/voice/VoiceSession").then((m) => ({ default: m.VoiceSession })));

const TABS: { to: string; label: Key; icon: typeof Menu; match: (p: string) => boolean }[] = [
  { to: "/", label: "nav.shopping", icon: ShoppingCart, match: (p) => p === "/" || p.startsWith("/lists") },
  { to: "/receipts", label: "nav.receipts", icon: Receipt, match: (p) => p.startsWith("/receipts") },
  { to: "/analytics", label: "nav.analytics", icon: BarChart3, match: (p) => p.startsWith("/analytics") },
  { to: "/more", label: "nav.more", icon: Menu, match: (p) => p.startsWith("/more") },
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
        <div role="status" className="bg-info-soft px-4 py-2 text-center text-sm text-info">
          {t("status.reconnecting")}
        </div>
      )}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {/* Prechod obrazovky: nová sekcia sa jemne zosvetlí a posunie o 8 px (0,2 s). */}
        <div key={screenKey(pathname)} className="animate-screen">
          <Outlet />
        </div>
      </main>
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-40 bg-elevated/95 pb-safe shadow-[0_-1px_0_var(--line)] backdrop-blur-md"
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
                  ? tn("voice.savedRequests", r.requests, { store })
                  : t("voice.savedItems", { store, count: tn("shop.itemCount", n) }),
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

/** Obrazovka pre animáciu prechodu: záložky Prehľadov sú jedna obrazovka (animuje sa len obsah pod nimi). */
function screenKey(pathname: string) {
  return /^\/analytics(\/(products|stores))?\/?$/.test(pathname) ? "/analytics" : pathname;
}

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
            "flex h-16 flex-col items-center justify-center gap-1 text-xs font-strong transition-colors",
            active ? "text-text" : "text-text-2",
          )}
        >
          <span className={cx("grid h-8 w-14 place-items-center rounded-full transition-colors duration-200", active && "bg-primary-soft text-primary")}>
            <Icon className="size-[1.375rem]" strokeWidth={active ? 2.1 : 1.85} aria-hidden />
          </span>
          {t(tab.label)}
        </NavLink>
      </li>
    </>
  );
}

/** Stredné tlačidlo navigácie: otvorí hlasový nákup s už zapnutým mikrofónom. */
function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex items-center justify-center">
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
        aria-label={t("voice.open")}
        className="grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-raised transition-transform duration-[120ms] active:scale-95 active:bg-primary-pressed"
      >
        <AudioLines className="size-6" strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
