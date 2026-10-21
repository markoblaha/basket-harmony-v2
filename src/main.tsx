import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ToastProvider } from "./components/toast";
import { TestEnvBadge } from "./components/ui";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./styles.css";
import "./design.css";
import "./styles/shell.css";
import "./styles/lists.css";
import "./styles/list-detail.css";
import "./styles/shopping.css";
import "./styles/analytics.css";
import "./styles/receipts.css";
import "./styles/recipes.css";
import "./styles/more.css";
import "./styles/voice.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Údaje sa obnovia pri návrate do aplikácie (napr. z inej appky v mobile).
      refetchOnWindowFocus: true,
      staleTime: 10_000,
      retry: (count, error) => {
        // Chyby oprávnení nemá zmysel opakovať.
        const msg = (error as { message?: string })?.message ?? "";
        if (/^[A-Z_]+$/.test(msg) || /permission/i.test(msg)) return false;
        return count < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <I18nProvider>
              <App />
              <TestEnvBadge />
            </I18nProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
