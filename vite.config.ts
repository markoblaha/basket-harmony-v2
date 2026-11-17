import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Testovacie prostredie: Cloudflare zostavuje každú vetvu zvlášť a meno vetvy dáva do
// WORKERS_CI_BRANCH. Vetva iná než main sa zostaví v režime "staging" – načíta .env.staging,
// teda testovaciu databázu (basket-harmony-v2-test), a v appke ukáže štítok „Testovacie prostredie“.
// Ostrá appka (main) ostáva v bežnom režime s .env.production.
const branch = process.env.WORKERS_CI_BRANCH;
const ciMode = branch && branch !== "main" ? "staging" : undefined;

export default defineConfig({
  mode: ciMode,
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
