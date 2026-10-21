import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { AuthPage } from "@/features/auth/AuthPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { HouseholdProvider } from "@/features/household/HouseholdProvider";
import { JoinPage } from "@/features/household/JoinPage";
import { OnboardingPage } from "@/features/household/OnboardingPage";
import { HouseholdPage } from "@/features/more/HouseholdPage";
import { MorePage } from "@/features/more/MorePage";
import { NotificationsPage, StoresPage, TilesPage } from "@/features/more/SettingsPages";
import { ShoppingPage } from "@/features/lists/ShoppingPage";
import { HistoryPage } from "@/features/lists/HistoryPage";
import { ShoppingHub } from "@/features/lists/ShoppingHub";
import { AnalyticsLayout } from "@/features/analytics/AnalyticsLayout";
import { CategoriesTab } from "@/features/analytics/CategoriesTab";
import { CategoryPage } from "@/features/analytics/CategoryPage";
import { OverviewTab } from "@/features/analytics/OverviewTab";
import { ProductPage } from "@/features/analytics/ProductPage";
import { ProductsTab } from "@/features/analytics/ProductsTab";
import { StorePage } from "@/features/analytics/StorePage";
import { StoresTab } from "@/features/analytics/StoresTab";
import { ReceiptsPage } from "@/features/receipts/ReceiptsPage";
import { MatchPage } from "@/features/receipts/MatchPage";
import { ReceiptDetailPage } from "@/features/receipts/ReceiptDetailPage";
import { StatementImportPage } from "@/features/receipts/StatementImportPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { SearchPage as RecipeSearchPage } from "@/features/recipes/SearchPage";
import { CheckPage as RecipeCheckPage } from "@/features/recipes/CheckPage";
import { RecipePage } from "@/features/recipes/RecipePage";
import { CartPage as RecipeCartPage } from "@/features/recipes/CartPage";
import { CookPage } from "@/features/recipes/CookPage";

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
