import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Nitro picks its deployment preset from the build environment: on Vercel it emits
// Vercel functions automatically; locally it builds a Node server (`vite preview`).
export default defineConfig({
  server: { port: 3000 },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // src/server.ts wraps the SSR handler with the branded error page.
    tanstackStart({ server: { entry: "server" } }),
    // London: next to the Supabase project (eu-west-2) and the closest region to Nigeria.
    nitro({ vercel: { functions: { regions: ["lhr1"], maxDuration: 60 } } }),
    viteReact(),
  ],
});
