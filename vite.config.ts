/**
 * Vite configuration for Type Siege.
 *
 * This is a pure client-side SPA — no SSR, no server adapter.
 * `base` is set to the GitHub Pages sub-path so all asset URLs resolve
 * correctly when deployed to https://progharshith.github.io/type-siege/.
 *
 * Plugin stack:
 *   - @vitejs/plugin-react     — React fast-refresh and JSX transform
 *   - @tailwindcss/vite        — Tailwind CSS v4 vite integration
 *   - vite-tsconfig-paths      — Resolves TypeScript path aliases (e.g. @/)
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  /** Sub-path for GitHub Pages deployment at /type-siege/ */
  base: "/type-siege/",

  plugins: [
    /** React plugin — enables JSX transform and fast-refresh in dev. */
    react(),

    /** Tailwind CSS v4 — processes utility classes at build time. */
    tailwindcss(),

    /** Resolves the @/ path alias defined in tsconfig.json. */
    tsConfigPaths(),
  ],
});
