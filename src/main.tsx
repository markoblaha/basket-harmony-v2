import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ToastProvider } from "./components/toast";
import "./styles.css";

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
