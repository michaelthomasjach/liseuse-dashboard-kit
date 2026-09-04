import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  // Without this, Vite emits any reference to a *separately-chunked* built asset (a `new
  // Worker(new URL("./x.ts", import.meta.url))` call, or the same pattern via a `?worker`
  // import) as a bare root-relative string like "/assets/x-hash.js" — same root-relative
  // problem assetsInlineLimit's own doc below already explains for images, just via a
  // different code path (Rollup's worker-chunk emission, not vite:asset). That path assumes
  // the built output is served from a site's own root the way an application build is; a
  // published library has no such root. `base: "./"` makes Vite instead emit
  // `new URL("assets/x-hash.js", import.meta.url)` — a genuinely relative reference resolved
  // against wherever *this module itself* is actually being loaded from, which is what makes
  // a Worker constructed this way keep working regardless of where a consumer's own bundler
  // or node_modules layout ends up placing this package. Confirmed by building with a throwaway
  // worker, copying the output several directories deep, and loading it from there directly —
  // the worker still resolved and ran correctly. Doesn't affect the still-necessary base64
  // inlining for images (a separate, forced code path — see assetsInlineLimit's own doc) or
  // dynamic `import()` code-splitting, which already emitted correctly-relative chunk
  // references even before this was set.
  base: "./",
  plugins: [
    react(),
    dts({
      include: ["src"],
      exclude: ["src/**/*.stories.tsx", "src/**/*.test.tsx"],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "LiseuseDashboardKit",
      fileName: (format) => `liseuse-dashboard-kit.${format === "es" ? "es" : "cjs"}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "d3"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          d3: "d3",
        },
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "style.css" : (assetInfo.name ?? "asset"),
        // Deterministic chunk names — no content hash. Hashed names are what a *site* wants (a new
        // name per deploy is how a CDN cache is busted); a published package has no cache to bust,
        // and every build minting fresh names meant `dist/` only ever grew. `emptyOutDir` was
        // supposed to prevent that and silently does nothing here — this repo sits in a
        // OneDrive-synced folder and the delete is refused, with Node's `rmSync` reporting success
        // regardless. The result was 343 files and 618 MB in `dist/`, which `files: ["dist"]`
        // packed whole into a 197 MB published tarball (v0.67.0). With fixed names each build
        // overwrites the previous one and the problem cannot recur, whether or not any clean step
        // works.
        chunkFileNames: "[name].js",
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
    // assetsInlineLimit is deliberately left at its default and NOT overridden here: Vite's own
    // build code force-inlines every imported asset as a base64 data URI whenever `build.lib` is
    // set, regardless of what assetsInlineLimit is configured to (confirmed by reading
    // node_modules/vite's own shouldInline()) — the size limit and even a per-import `?no-inline`
    // suffix are simply never consulted in lib mode. This isn't a bug to work around: opting an
    // import out (tried and reverted — see git history around the diagrams/images/ screenshots)
    // makes Vite emit a real file, but the reference it bakes into the bundle is a bare
    // root-relative path like "/sma.jpg", which assumes the built output is served from a known
    // site root the way an application build is. A published library has no such root — it's
    // imported from inside an arbitrary consumer's own app — so that path 404s in every real
    // consumer. Base64-inlining costs bundle size (the diagrams/images/ screenshots add roughly
    // 700KB) but is the only option that actually renders correctly for every consumer with zero
    // extra configuration on their part, which is why Vite defaults to forcing it here.
  },
});
