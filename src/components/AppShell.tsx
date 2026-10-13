import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { BarChart3, Menu, Receipt, ShoppingCart } from "lucide-react";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useHouseholdRealtime } from "@/features/realtime/useHouseholdRealtime";
import { OfflineBanner, cx } from "./ui";

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
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, match }) => (
            <li key={to}>
              <NavLink
                to={to}
                aria-current={match(pathname) ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors",
                  match(pathname) ? "text-text" : "text-text-2",
                )}
              >
                <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors", match(pathname) && "bg-accent-soft text-accent")}>
                  <Icon className="size-[1.375rem]" strokeWidth={2} aria-hidden />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
