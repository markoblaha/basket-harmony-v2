import { lazy, Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router";
import { CookingPot, House, Mic, ShoppingBasket, Wallet, type LucideIcon } from "lucide-react";
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
/** Spodná lišta ako v mockupe: Domov · Nákupy · (mikrofón) · Recepty · Výdavky. Viac je pod avatarom vľavo hore. */
const TABS: { to: string; label: Key; icon: LucideIcon; match: (p: string) => boolean; badge?: Badge }[] = [
  { to: "/home", label: "nav.home", icon: House, match: (p) => p.startsWith("/home") },
  { to: "/", label: "nav.lists", icon: ShoppingBasket, match: (p) => p === "/" || p.startsWith("/lists") || p.startsWith("/history"), badge: "lists" },
  { to: "/recipes", label: "nav.recipes", icon: CookingPot, match: (p) => p.startsWith("/recipes"), badge: "recipes" },
  // Doklady sú časťou Výdavkov (záložka Doklady).
  { to: "/analytics", label: "nav.analytics", icon: Wallet, match: (p) => p.startsWith("/analytics") || p.startsWith("/receipts"), badge: "analytics" },
];

/** Koreňové obrazovky záložiek: z nich sa potiahnutím z okraja nevracia. */
const ROOTS = ["/", "/home", "/recipes", "/analytics", "/analytics/categories", "/analytics/stores", "/receipts"];

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
  const screen = useRef<HTMLDivElement>(null);
  const motion = useScreenMotion(pathname);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pt-safe">
      {!online && <OfflineBanner />}
      {online && realtime === "reconnecting" && (
        <div role="status" className="bg-info-soft px-4 py-2 text-center text-sm text-info">
          {t("status.reconnecting")}
        </div>
      )}
      <main className="flex-1" style={showTabs ? { paddingBottom: "var(--tabbar-space)" } : undefined}>
        {/* Prechod obrazovky ako v mockupe: dopredu sprava, späť zľava, medzi záložkami jemné vynorenie. */}
        <div key={screenKey(pathname)} ref={screen} className={`screen-in ${motion}`}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <EdgeBack screen={screen} enabled={!ROOTS.includes(pathname.replace(/\/$/, "") || "/")} />
      {showTabs && (
        <>
          <div className="tabfade" aria-hidden />
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
        </>
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

const tabOf = (p: string) => TABS.findIndex((tab) => tab.match(p));

/**
 * Druh prechodu: v rámci jednej záložky dopredu = „push“ (sprava), späť = „pop“ (zľava);
 * prepnutie záložky = jemné vynorenie. Prvé vykreslenie appky sa neanimuje.
 */
function useScreenMotion(pathname: string): "push" | "pop" | "" {
  const type = useNavigationType();
  const state = useRef<{ path: string | null; motion: "push" | "pop" | "" }>({ path: null, motion: "" });
  if (state.current.path !== pathname) {
    const last = state.current.path;
    const motion = last === null || tabOf(last) !== tabOf(pathname) ? "" : type === "POP" ? "pop" : "push";
    state.current = { path: pathname, motion };
  }
  return state.current.motion;
}

/**
 * Návrat potiahnutím z ľavého okraja doprava (ako v iPhone appkách). Obrazovka ide za prstom
 * a za ňou sa stmaví; po pustení za tretinou šírky (alebo rýchlym švihom) sa appka vráti späť.
 * Len v appke spustenej z plochy – v Safari má rovnaké gesto prehliadač sám.
 */
function EdgeBack({ screen, enabled }: { screen: RefObject<HTMLDivElement | null>; enabled: boolean }) {
  const navigate = useNavigate();
  const dim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!enabled || !standalone) return;
    let start: { x: number; y: number; t: number } | null = null;
    let dx = 0;
    let active = false;
    const el = () => screen.current;
    const paint = (x: number, anim: boolean) => {
      const node = el();
      if (!node) return;
      node.style.transition = anim ? "transform var(--dur-3) var(--ease-out)" : "none";
      node.style.transform = x ? `translateX(${x}px)` : "";
      if (dim.current) {
        dim.current.style.transition = anim ? "opacity var(--dur-3)" : "none";
        dim.current.style.setProperty("--dim", String(Math.max(0, 0.18 * (1 - x / window.innerWidth))));
        dim.current.style.opacity = x ? "1" : "0";
      }
    };
    const down = (e: TouchEvent) => {
      const p = e.touches[0];
      if (!p || p.clientX > 20 || e.touches.length > 1) return;
      start = { x: p.clientX, y: p.clientY, t: Date.now() };
      dx = 0;
      active = false;
    };
    const move = (e: TouchEvent) => {
      const p = e.touches[0];
      if (!start || !p) return;
      const x = p.clientX - start.x;
      const y = p.clientY - start.y;
      if (!active) {
        if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) { start = null; return; }
        if (x < 10) return;
        active = true;
      }
      e.preventDefault();
      dx = Math.max(0, x);
      paint(dx, false);
    };
    const up = () => {
      if (!start || !active) { start = null; return; }
      const fast = dx > 40 && Date.now() - start.t < 250;
      start = null;
      active = false;
      if (dx > window.innerWidth / 3 || fast) {
        haptic(8);
        paint(window.innerWidth, true);
        window.setTimeout(() => {
          const node = el();
          if (node) { node.style.transition = ""; node.style.transform = ""; }
          if (dim.current) dim.current.style.opacity = "0";
          navigate(-1);
        }, 200);
      } else paint(0, true);
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
    document.addEventListener("touchcancel", up);
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
      document.removeEventListener("touchcancel", up);
    };
  }, [enabled, navigate, screen]);
  return <div ref={dim} className="edge-dim" style={{ opacity: 0 }} aria-hidden />;
}

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
        <span className="ic">
          <Icon size={26} strokeWidth={active ? 2.1 : 1.8} aria-hidden />
          {dot && <span className="dot" aria-hidden />}
          {/* Počet čakajúcich vecí: malá značka v rohu ikony, „9+“ pri väčšom počte. */}
          {count > 0 && (
            <span key={count} className="cnt num" aria-hidden>
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        <span className="lbl">{t(tab.label)}</span>
      </NavLink>
    </>
  );
}

/** Stredné tlačidlo navigácie: otvorí hlasový nákup. */
function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="tmic">
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
        <Mic size={25} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
