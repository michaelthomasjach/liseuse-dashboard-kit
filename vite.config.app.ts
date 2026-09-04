import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** The standalone demo app: the "Toutes les options" chart, alone on the page, installable.
 *
 *  Published as a subfolder of the same GitHub Pages site the Storybook goes to (see
 *  .github/workflows/deploy-storybook.yml), hence the `base` — Pages serves the repo at
 *  `/liseuse-dashboard-kit/`, and every asset URL has to carry that prefix or resolve to the
 *  account root. `root: "app"` keeps this build's own entry, public assets and stylesheet out of
 *  the library's own source tree. */
export default defineConfig({
  root: "app",
  base: "/liseuse-dashboard-kit/app/",
  plugins: [react()],
  build: { outDir: "../app-dist", emptyOutDir: true },
});
