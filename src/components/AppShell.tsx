import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AudioLines, ChartColumn, ChefHat, Menu, ShoppingBasket } from "lucide-react";
import { useToast } from "./toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useHouseholdRealtime } from "@/features/realtime/useHouseholdRealtime";
import { useLists } from "@/features/lists/api";
import { needsAttention, useReceipts } from "@/features/receipts/api";
import { t, tn, type Key } from "@/i18n";
import { OfflineBanner, cx } from "./ui";

const VoiceSession = lazy(() => import("@/features/voice/VoiceSession").then((m) => ({ default: m.VoiceSession })));

type Badge = "recipes" | "analytics";
const TABS: { to: string; label: Key; icon: typeof Menu; match: (p: string) => boolean; badge?: Badge }[] = [
  { to: "/", label: "nav.lists", icon: ShoppingBasket, match: (p) => p === "/" || p.startsWith("/lists") || p.startsWith("/history") },
  { to: "/recipes", label: "nav.recipes", icon: ChefHat, match: (p) => p.startsWith("/recipes"), badge: "recipes" },
  // Doklady sú časťou Analytiky (záložka Doklady).
  { to: "/analytics", label: "nav.analytics", icon: ChartColumn, match: (p) => p.startsWith("/analytics") || p.startsWith("/receipts"), badge: "analytics" },
  { to: "/more", label: "nav.more", icon: Menu, match: (p) => p.startsWith("/more") },
];

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Počet vecí, ktoré čakajú na používateľa – číslo na ikone lišty.
 * Analytika: nákupy bez dokladu za posledných 30 dní + bločky na kontrolu.
 * Recepty: zatiaľ 0 (čakajúce recepty pribudnú s receptami).
 */
function useBadges(householdId: string): Record<Badge, number> {
  const lists = useLists(householdId);
  const receipts = useReceipts(householdId);
  const now = Date.now();
  const missing = (lists.data ?? []).filter(
    (l) => l.completed_at && l.receipt_state === "LATER" && now - new Date(l.completed_at).getTime() <= MONTH_MS,
  ).length;
  const review = (receipts.data ?? []).filter(needsAttention).length;
  return { recipes: 0, analytics: missing + review };
}

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
  const badges = useBadges(household.id);

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
      <nav aria-label={t("nav.label")} className="tabbar fixed inset-x-0 bottom-0 z-40 pb-safe">
        {/* Mäkký prechod nad lištou namiesto ostrej čiary: obsah sa pod ňou plynulo stráca. */}
        <div className="tabbar-fade" aria-hidden />
        <ul className="relative mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((tab, i) => (
            <TabItem
              key={tab.to}
              tab={tab}
              active={tab.match(pathname)}
              count={tab.badge ? badges[tab.badge] : 0}
              before={i === 2 ? <VoiceButton onClick={() => setVoice(true)} /> : null}
            />
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

function TabItem({ tab, active, count, before }: { tab: Tab; active: boolean; count: number; before: ReactNode }) {
  const Icon = tab.icon;
  return (
    <>
      {before}
      <li>
        <NavLink
          to={tab.to}
          aria-current={active ? "page" : undefined}
          aria-label={count > 0 ? `${t(tab.label)}, ${tn("nav.waiting", count)}` : undefined}
          className={cx(
            "flex h-16 flex-col items-center justify-center gap-1 text-xs font-strong transition-colors",
            active ? "text-text" : "text-text-3",
          )}
        >
          <span className={cx("relative grid h-8 w-14 place-items-center rounded-full transition-colors duration-200", active && "tab-on bg-accent-soft text-accent-text")}>
            <Icon className="size-[1.375rem]" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            {/* Počet čakajúcich vecí: malá značka v rohu ikony, „9+“ pri väčšom počte. */}
            {count > 0 && (
              <span key={count} className="tab-count" aria-hidden>
                {count > 9 ? "9+" : count}
              </span>
            )}
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
        className="voice-orb relative z-[1] -mt-6 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-raised transition-transform duration-[120ms] active:scale-95 active:bg-primary-pressed"
      >
        <AudioLines className="size-6" strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
