import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
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
