import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ToastProvider } from "./components/toast";
import { TestEnvBadge } from "./components/ui";
import { I18nProvider, getLocale } from "./i18n";
import { loadLocale, setActiveLocale } from "./i18n/core";
import { ThemeProvider } from "./theme/ThemeProvider";
import { isNetworkError, persistCache, restoreCache } from "./lib/offlineCache";
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
import "./styles/themes.css";
import "./mockup/mockup.css";
import "./mockup/assets.css";
import "./features/recipes/kniha.css";
import "./mockup/adapt.css";
import "./mockup/finish.css";

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
    mutations: {
      // Slabý signál v obchode: úprava sa skúsi znova (s odstupom), kým sa nepodarí. Bez signálu čaká
      // a odošle sa sama po pripojení. Opakovanie je bezpečné: odškrtnutie nastavuje stav a pridanie má
      // jedinečné ID požiadavky (server ho nevytvorí dvakrát).
      retry: (count, error) => isNetworkError(error) && count < 8,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    },
  },
});
// Posledné údaje z telefónu (zoznamy, položky…) – appka sa ukáže hneď, aj bez signálu.
restoreCache(queryClient);
persistCache(queryClient);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}

// Anglický slovník sa stiahne pred prvým vykreslením len vtedy, keď je zvolená angličtina.
// Keď sa nestiahne (napr. prvé spustenie bez signálu), appka sa ukáže po slovensky.
void loadLocale(getLocale())
  .catch(() => setActiveLocale("sk"))
  .then(render);

function render() {
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
}
