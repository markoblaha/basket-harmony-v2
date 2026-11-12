import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MotionRouter } from "@/components/navMotion";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { AuthPage } from "@/features/auth/AuthPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { HouseholdProvider } from "@/features/household/HouseholdProvider";
import { JoinPage } from "@/features/household/JoinPage";
import { OnboardingPage } from "@/features/household/OnboardingPage";
import { ShoppingPage } from "@/features/lists/ShoppingPage";
import { ShoppingHub } from "@/features/lists/ShoppingHub";
// Domov je úvodná obrazovka – v hlavnom balíku, aby sa po štarte nečakalo na ďalší súbor.
import { HomePage } from "@/features/home/HomePage";

/*
 * Domov a zoznamy sú v hlavnom balíku. Ostatné časti appky sa načítajú zvlášť,
 * aby sa appka spustila rýchlejšie – a keď sa načítajú prvé údaje, potichu sa stiahnu
 * všetky, takže prepnutie záložky už na nič nečaká.
 */
const loaders: (() => Promise<unknown>)[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<M extends Record<string, any>>(load: () => Promise<M>, name: keyof M) {
  let mod: M | undefined;
  const keep = () => load().then((m) => (mod = m));
  loaders.push(keep);
  // Už stiahnutá obrazovka sa vykreslí hneď (bez čakania na ďalší krok) – inak by pri prechode
  // na chvíľu prebehla prázdna stránka.
  type Lazy = Promise<{ default: ComponentType }>;
  return lazy(() => (mod ? ({ then: (ok: (v: { default: ComponentType }) => void) => ok({ default: mod![name] as ComponentType }) } as unknown as Lazy) : keep().then((m) => ({ default: m[name] as ComponentType }))));
}
/**
 * Ostatné obrazovky sa stiahnu až po prvých údajoch (domácnosť, zoznamy) a po troch naraz –
 * na pomalej sieti by inak ~40 súborov naraz brzdilo načítanie toho, čo človek práve čaká.
 */
function usePreloadPages() {
  const qc = useQueryClient();
  useEffect(() => {
    let stop = false;
    const t0 = Date.now();
    const queue = [...loaders];
    const worker = async () => {
      while (!stop && queue.length) await queue.shift()!().catch(() => undefined);
    };
    const run = () => void Promise.all([worker(), worker(), worker()]);
    let timer = 0;
    const wait = () => {
      if (stop) return;
      if (qc.isFetching() > 0 && Date.now() - t0 < 8000) {
        timer = window.setTimeout(wait, 300);
        return;
      }
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 1500 });
      else run();
    };
    timer = window.setTimeout(wait, 800);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [qc]);
}

const more = () => import("@/features/more/MorePage");
const settings = () => import("@/features/more/SettingsPages");
const MorePage = page(more, "MorePage");
const HouseholdPage = page(() => import("@/features/more/HouseholdPage"), "HouseholdPage");
const NotificationsPage = page(settings, "NotificationsPage");
const StoresPage = page(settings, "StoresPage");
const HistoryPage = page(() => import("@/features/lists/HistoryScreens"), "HistoryPage");
const HistoryDetailPage = page(() => import("@/features/lists/HistoryScreens"), "HistoryDetailPage");
const CollectionPage = page(() => import("@/features/recipes/CollectionPage"), "CollectionPage");
const TastePage = page(() => import("@/features/recipes/TastePage"), "TastePage");
const ScanScreen = page(() => import("@/features/lists/ScanScreen"), "ScanScreen");
const MoneyPage = page(() => import("@/features/analytics/MoneyPage"), "MoneyPage");
const CategoryPage = page(() => import("@/features/analytics/CategoryPage"), "CategoryPage");
const ProductPage = page(() => import("@/features/analytics/ProductPage"), "ProductPage");
const KindPage = page(() => import("@/features/analytics/KindPage"), "KindPage");
const ProductsTab = page(() => import("@/features/analytics/ProductsTab"), "ProductsTab");
const StorePage = page(() => import("@/features/analytics/StorePage"), "StorePage");
const SizesPage = page(() => import("@/features/analytics/SizesPage"), "SizesPage");
const ReceiptsPage = page(() => import("@/features/receipts/ReceiptsPage"), "ReceiptsPage");
const MatchPage = page(() => import("@/features/receipts/MatchPage"), "MatchPage");
const ReceiptDetailPage = page(() => import("@/features/receipts/ReceiptDetailPage"), "ReceiptDetailPage");
const StatementImportPage = page(() => import("@/features/receipts/StatementImportPage"), "StatementImportPage");
const RecipesPage = page(() => import("@/features/recipes/RecipesPage"), "RecipesPage");
const RecipeSearchPage = page(() => import("@/features/recipes/SearchPage"), "SearchPage");
const RecipeCheckPage = page(() => import("@/features/recipes/CheckPage"), "CheckPage");
const RecipePage = page(() => import("@/features/recipes/RecipePage"), "RecipePage");
const RecipeCartPage = page(() => import("@/features/recipes/CartPage"), "CartPage");
const CookPage = page(() => import("@/features/recipes/CookPage"), "CookPage");
const PrivacyPage = page(() => import("@/features/legal/LegalPage"), "PrivacyPage");
const TermsPage = page(() => import("@/features/legal/LegalPage"), "TermsPage");

/** Stránky dostupné iba po prihlásení. Neprihláseného pošle na prihlásenie a potom späť. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, passwordRecovery } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (passwordRecovery) return <Navigate to="/reset-password" replace />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    const mode = location.pathname.startsWith("/join/") ? "&mode=signup" : "";
    return <Navigate to={`/auth?next=${next}${mode}`} replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (session) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} replace />;
  }
  return <>{children}</>;
}

export function App() {
  usePreloadPages();
  return (
    <MotionRouter>
      <Routes>
        <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Zásady a podmienky: aj bez prihlásenia (odkaz pri registrácii). */}
        <Route path="/privacy" element={<Suspense fallback={<Spinner />}><PrivacyPage /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<Spinner />}><TermsPage /></Suspense>} />
        <Route path="/join/:token" element={<RequireAuth><JoinPage /></RequireAuth>} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route
          element={
            <RequireAuth>
              <HouseholdProvider>
                <AppShell />
              </HouseholdProvider>
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="lists" element={<ShoppingHub />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="lists/:listId" element={<ShoppingPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:id" element={<HistoryDetailPage />} />
          <Route path="scan" element={<ScanScreen />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/search" element={<RecipeSearchPage />} />
          <Route path="recipes/c/:kind/:id" element={<CollectionPage />} />
          <Route path="recipes/taste" element={<TastePage />} />
          <Route path="recipes/check" element={<RecipeCheckPage />} />
          <Route path="recipes/cart" element={<RecipeCartPage />} />
          <Route path="recipes/r/:id" element={<RecipePage />} />
          <Route path="recipes/r/:id/cook" element={<CookPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="receipts/statement" element={<StatementImportPage />} />
          <Route path="receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="receipts/:id/match" element={<MatchPage />} />
          <Route path="analytics" element={<MoneyPage />} />
          <Route path="analytics/categories" element={<Navigate to="/analytics" replace />} />
          <Route path="analytics/stores" element={<Navigate to="/analytics" replace />} />
          <Route path="analytics/products" element={<ProductsTab />} />
          <Route path="analytics/category/:id" element={<CategoryPage />} />
          <Route path="analytics/store/:key" element={<StorePage />} />
          <Route path="analytics/product/:id" element={<ProductPage />} />
          <Route path="analytics/kind/:key" element={<KindPage />} />
          <Route path="analytics/sizes" element={<SizesPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/household" element={<HouseholdPage />} />
          <Route path="more/notifications" element={<NotificationsPage />} />
          <Route path="more/stores" element={<StoresPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionRouter>
  );
}
