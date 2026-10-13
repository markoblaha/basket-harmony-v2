import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Čas zostavenia sa ukazuje na dne sekcie Viac – podľa neho vidno, či sa nová verzia už nasadila.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // Knižnice v samostatných súboroch: pri aktualizácii aplikácie si ich
        // prehliadač nemusí sťahovať znova.
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  test: { environment: "node" },
});
