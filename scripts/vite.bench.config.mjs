import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Page autonome du banc de performance du survol (src/components/charts/candlestick/perf/app),
 * construite en production comme une application : voir scripts/benchChartHover.cjs.
 *   npx vite build --config scripts/vite.bench.config.mjs --outDir <dossier> */
export default defineConfig({
  root: fileURLToPath(new URL("../src/components/charts/candlestick/perf/app", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: { emptyOutDir: true, sourcemap: false },
});
