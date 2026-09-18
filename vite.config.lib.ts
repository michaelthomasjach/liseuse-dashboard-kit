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
      // `formats`/`fileName` are deliberately omitted: `rollupOptions.output` below is an array, and
      // Vite ignores both when it is. Each format's entry and chunk names are declared there instead,
      // which is what keeps the two builds from writing over each other — see that note.
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "d3"],
      // One output per format, rather than one shared output config.
      //
      // Both formats used to share `chunkFileNames: "[name].js"`, which meant the ES pass wrote
      // `dist/index.js` and the CJS pass then overwrote that exact file with its own CommonJS
      // chunk. The ESM entry was left importing named bindings from a CommonJS module, so
      // `dist/liseuse-dashboard-kit.es.js` — the `module`/`import` entry point, i.e. the one every
      // modern bundler picks — failed to build in any consumer with `"<id>" is not exported by
      // "index.js"`. Nothing in this repo caught it because Storybook and the app build both
      // consume `src/`, never `dist/`.
      //
      // Giving each format its own chunk directory fixes the collision while keeping the property
      // the names were chosen for in the first place: they are still content-hash-free, so each
      // build overwrites the previous one instead of `dist/` growing without bound (see the
      // chunkFileNames note that used to live here, and emptyOutDir's own caveat above).
      output: ["es", "cjs"].map((format) => ({
        format: format as "es" | "cjs",
        entryFileNames: `liseuse-dashboard-kit.${format}.js`,
        chunkFileNames: `${format}/[name].js`,
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          d3: "d3",
        },
        assetFileNames: (assetInfo: { name?: string }) =>
          assetInfo.name?.endsWith(".css") ? "style.css" : (assetInfo.name ?? "asset"),
      })),
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
