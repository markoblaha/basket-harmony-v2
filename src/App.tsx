import { lazy, useEffect, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
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

/*
 * Zoznamy (úvodná obrazovka) sú v hlavnom balíku. Ostatné časti appky sa načítajú zvlášť,
 * aby sa appka spustila rýchlejšie – a hneď potom, keď je telefón voľný, sa potichu stiahnu
 * všetky, takže prepnutie záložky už na nič nečaká.
 */
const loaders: (() => Promise<unknown>)[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<M extends Record<string, any>>(load: () => Promise<M>, name: keyof M) {
  loaders.push(load);
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
}
function usePreloadPages() {
  useEffect(() => {
    const run = () => loaders.forEach((l) => void l().catch(() => undefined));
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1200);
  }, []);
}

const more = () => import("@/features/more/MorePage");
const settings = () => import("@/features/more/SettingsPages");
const analytics = () => import("@/features/analytics/AnalyticsLayout");
const MorePage = page(more, "MorePage");
const HouseholdPage = page(() => import("@/features/more/HouseholdPage"), "HouseholdPage");
const NotificationsPage = page(settings, "NotificationsPage");
const StoresPage = page(settings, "StoresPage");
const TilesPage = page(settings, "TilesPage");
const HistoryPage = page(() => import("@/features/lists/HistoryPage"), "HistoryPage");
const AnalyticsLayout = page(analytics, "AnalyticsLayout");
const CategoriesTab = page(() => import("@/features/analytics/CategoriesTab"), "CategoriesTab");
const CategoryPage = page(() => import("@/features/analytics/CategoryPage"), "CategoryPage");
const OverviewTab = page(() => import("@/features/analytics/OverviewTab"), "OverviewTab");
const ProductPage = page(() => import("@/features/analytics/ProductPage"), "ProductPage");
const ProductsTab = page(() => import("@/features/analytics/ProductsTab"), "ProductsTab");
const StorePage = page(() => import("@/features/analytics/StorePage"), "StorePage");
const StoresTab = page(() => import("@/features/analytics/StoresTab"), "StoresTab");
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
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route index element={<ShoppingHub />} />
          <Route path="lists/:listId" element={<ShoppingPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/search" element={<RecipeSearchPage />} />
          <Route path="recipes/check" element={<RecipeCheckPage />} />
          <Route path="recipes/cart" element={<RecipeCartPage />} />
          <Route path="recipes/r/:id" element={<RecipePage />} />
          <Route path="recipes/r/:id/cook" element={<CookPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="receipts/statement" element={<StatementImportPage />} />
          <Route path="receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="receipts/:id/match" element={<MatchPage />} />
          <Route path="analytics" element={<AnalyticsLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="categories" element={<CategoriesTab />} />
            <Route path="stores" element={<StoresTab />} />
          </Route>
          <Route path="analytics/products" element={<ProductsTab />} />
          <Route path="analytics/category/:id" element={<CategoryPage />} />
          <Route path="analytics/store/:key" element={<StorePage />} />
          <Route path="analytics/product/:id" element={<ProductPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/household" element={<HouseholdPage />} />
          <Route path="more/notifications" element={<NotificationsPage />} />
          <Route path="more/stores" element={<StoresPage />} />
          <Route path="more/tiles" element={<TilesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
