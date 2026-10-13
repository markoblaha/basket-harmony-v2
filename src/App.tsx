import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { AuthPage } from "@/features/auth/AuthPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { HouseholdProvider } from "@/features/household/HouseholdProvider";
import { JoinPage } from "@/features/household/JoinPage";
import { MorePage } from "@/features/household/MorePage";
import { OnboardingPage } from "@/features/household/OnboardingPage";
import { ShoppingPage } from "@/features/lists/ShoppingPage";
import { AnalyticsLayout } from "@/features/analytics/AnalyticsLayout";
import { CategoryPage } from "@/features/analytics/CategoryPage";
import { OverviewTab } from "@/features/analytics/OverviewTab";
import { ProductPage } from "@/features/analytics/ProductPage";
import { ProductsTab } from "@/features/analytics/ProductsTab";
import { StorePage } from "@/features/analytics/StorePage";
import { StoresTab } from "@/features/analytics/StoresTab";
import { ReceiptsPage } from "@/features/receipts/ReceiptsPage";
import { ReceiptDetailPage } from "@/features/receipts/ReceiptDetailPage";

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
          <Route index element={<ShoppingPage />} />
          <Route path="lists/:listId" element={<ShoppingPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="analytics" element={<AnalyticsLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="products" element={<ProductsTab />} />
            <Route path="stores" element={<StoresTab />} />
          </Route>
          <Route path="analytics/category/:id" element={<CategoryPage />} />
          <Route path="analytics/store/:key" element={<StorePage />} />
          <Route path="analytics/product/:id" element={<ProductPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
