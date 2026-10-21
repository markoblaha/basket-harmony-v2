import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AudioLines, ChartColumn, ChefHat, Menu, ShoppingBasket } from "lucide-react";
import { useToast } from "./toast";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useHouseholdRealtime } from "@/features/realtime/useHouseholdRealtime";
import { useHubSessions, useLists, useRequests } from "@/features/lists/api";
import { useUserId } from "@/features/auth/AuthProvider";
import { haptic } from "./kit";
import { useInAppNotices } from "./useInAppNotices";
import { needsAttention, useReceipts } from "@/features/receipts/api";
import { useRecipePlans } from "@/features/recipes/api";
import { useCart } from "@/features/recipes/cart";
import { t, tn, type Key } from "@/i18n";
import { OfflineBanner } from "./ui";
import { primeAudio } from "@/features/voice/useRecorder";

const VoiceSession = lazy(() => import("@/features/voice/VoiceSession").then((m) => ({ default: m.VoiceSession })));

type Badge = "recipes" | "analytics" | "lists";
const TABS: { to: string; label: Key; icon: typeof Menu; match: (p: string) => boolean; badge?: Badge }[] = [
  { to: "/", label: "nav.lists", icon: ShoppingBasket, match: (p) => p === "/" || p.startsWith("/lists") || p.startsWith("/history"), badge: "lists" },
  { to: "/recipes", label: "nav.recipes", icon: ChefHat, match: (p) => p.startsWith("/recipes"), badge: "recipes" },
  // Doklady sú časťou Analytiky (záložka Doklady).
  { to: "/analytics", label: "nav.analytics", icon: ChartColumn, match: (p) => p.startsWith("/analytics") || p.startsWith("/receipts"), badge: "analytics" },
  { to: "/more", label: "nav.more", icon: Menu, match: (p) => p.startsWith("/more") },
];

/**
 * Obrazovky bez spodnej lišty (v prototype tabBar: false / celá plocha): kontrola surovín,
 * košík receptov, varenie. Hlášky (toast) sa na nich ukazujú hore (pozri toast.tsx).
 */
const NO_TABBAR = [/^\/recipes\/check\/?$/, /^\/recipes\/cart\/?$/, /^\/recipes\/r\/[^/]+\/cook\/?$/];

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Počet vecí, ktoré čakajú na používateľa – číslo na ikone lišty.
 * Analytika: nákupy bez dokladu za posledných 30 dní + bločky na kontrolu.
 * Recepty: recepty čakajúce na uvarenie + rozpracovaný košík receptov (počíta sa ako jeden).
 */
function useBadges(householdId: string): Record<Badge, number> {
  // Zoznamy: fialová bodka, keď nakupujem a čaká na mňa žiadosť o pridanie.
  const me = useUserId();
  const mine = (useHubSessions(householdId).data ?? []).find((s) => s.shopper_id === me);
  const requests = useRequests(mine?.list_id, mine?.id);
  const pendingReq = (requests.data ?? []).filter((r) => r.status === "PENDING").length;
  const lists = useLists(householdId);
  const receipts = useReceipts(householdId);
  const now = Date.now();
  const missing = (lists.data ?? []).filter(
    (l) => l.completed_at && l.receipt_state === "LATER" && now - new Date(l.completed_at).getTime() <= MONTH_MS,
  ).length;
  const review = (receipts.data ?? []).filter(needsAttention).length;
  const plans = useRecipePlans(householdId);
  const cart = useCart(householdId);
  const waiting = (plans.data ?? []).filter((p) => p.status === "PENDING").length + (cart.items.length ? 1 : 0);
  return { recipes: waiting, analytics: missing + review, lists: pendingReq };
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
  useInAppNotices(household.id);
  const showTabs = !NO_TABBAR.some((re) => re.test(pathname));

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pt-safe">
      {!online && <OfflineBanner />}
      {online && realtime === "reconnecting" && (
        <div role="status" className="bg-info-soft px-4 py-2 text-center text-sm text-info">
          {t("status.reconnecting")}
        </div>
      )}
      <main className={showTabs ? "flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : "flex-1"}>
        {/* Prechod obrazovky ako v prototype: nová obrazovka sa vynorí zdola (10 px) a zosvetlí (0,24 s). */}
        <div key={screenKey(pathname)} className="screen-in">
          <Outlet />
        </div>
      </main>
      {showTabs && (
      <nav aria-label={t("nav.label")} className="tabbar">
        <div className="tabbar-in">
          {TABS.map((tab, i) => (
            <TabItem
              key={tab.to}
              tab={tab}
              active={tab.match(pathname)}
              count={tab.badge && tab.badge !== "lists" ? badges[tab.badge] : 0}
              dot={tab.badge === "lists" && badges.lists > 0}
              before={i === 2 ? <VoiceButton onClick={() => setVoice(true)} /> : null}
            />
          ))}
        </div>
      </nav>
      )}
      {voice && (
        <Suspense fallback={null}>
          {/* Hlasový režim prekrýva lištu – hlášky idú hore. */}
          <div data-notab style={{ display: "contents" }} />
          <VoiceSession
            onClose={() => setVoice(false)}
            onSaved={(store, r) => {
              setVoice(false);
              navigate(`/lists/${r.listId}`);
              const n = r.added + r.merged + r.requests;
              // Až po zatvorení hlasového režimu, aby sa hláška ukázala nad lištou (nie hore).
              setTimeout(() =>
                toast.show(
                  r.requests
                    ? tn("voice.savedRequests", r.requests, { store })
                    : t("voice.savedItems", { store, count: tn("shop.itemCount", n) }),
                  "success",
                ),
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

function TabItem({ tab, active, count, dot, before }: { tab: Tab; active: boolean; count: number; dot: boolean; before: ReactNode }) {
  const Icon = tab.icon;
  const extra = count > 0 ? `, ${tn("nav.waiting", count)}` : dot ? `, ${t("nav.request")}` : "";
  return (
    <>
      {before}
      <NavLink
        to={tab.to}
        className={active ? "tab on" : "tab"}
        aria-current={active ? "page" : undefined}
        aria-label={extra ? `${t(tab.label)}${extra}` : undefined}
        onClick={() => {
          // Ťuk na aktívnu kartu = späť na jej začiatok a navrch.
          if (active) window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <span className="pill">
          <Icon size={21} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
          {dot && <span className="dot" aria-hidden />}
          {/* Počet čakajúcich vecí: malá značka v rohu ikony, „9+“ pri väčšom počte. */}
          {count > 0 && (
            <span key={count} className="cnt num" aria-hidden>
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        {t(tab.label)}
      </NavLink>
    </>
  );
}

/** Stredné tlačidlo navigácie: otvorí hlasový nákup. */
function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="center">
      <button
        type="button"
        onClick={() => {
          haptic(12);
          // iPhone pustí mikrofón do nahrávania len z ťuknutia – pripravíme ho hneď.
          primeAudio();
          onClick();
        }}
        aria-label={t("voice.open")}
        className="voice-btn"
      >
        <AudioLines size={26} aria-hidden />
      </button>
    </div>
  );
}
