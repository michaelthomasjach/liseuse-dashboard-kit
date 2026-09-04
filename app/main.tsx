import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { LqThemeProvider, type LqPalette, type LqSurface } from "../src/theme";
import { AllFeatures } from "../src/components/charts/CandlestickChart.stories";
import "./app.css";

// The story's own `render` is a plain function component — Storybook only ever calls it as one —
// so the app mounts it directly. Importing the story rather than copying it is deliberate: it owns
// ~450 lines of generated candles, watchlists, events, symbol profiles and alert plumbing, and the
// whole point of this app is to be *that*, on a phone. A copy would drift the first time either
// side changed. `@storybook/react` is imported there for types only, so nothing of Storybook's
// runtime ends up in this bundle.
const AllOptions = AllFeatures.render as () => React.ReactElement;

/** Palette and surface are the two globals Storybook's toolbar exposes (see .storybook/preview.tsx).
 *  With no toolbar here they become a small control of the app's own, kept in the corner — the
 *  e-ink palette is the point of this library, and being able to flip it on the actual device is
 *  worth more than the pixels the two buttons cost. */
function App() {
  const [palette, setPalette] = useState<LqPalette>("eink");
  const [surface, setSurface] = useState<LqSurface>("light");
  return (
    <LqThemeProvider palette={palette} surface={surface} font="manrope">
      <div className="app-root">
        <div className="app-theme-switch">
          <button type="button" onClick={() => setPalette((p) => (p === "eink" ? "color" : "eink"))}>
            {palette === "eink" ? "E-ink" : "Couleur"}
          </button>
          <button type="button" onClick={() => setSurface((s) => (s === "light" ? "dark" : "light"))}>
            {surface === "light" ? "Clair" : "Sombre"}
          </button>
        </div>
        <AllOptions />
      </div>
    </LqThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  // After load, so the worker never delays the chart's first paint. Failures are swallowed: without
  // HTTPS (a plain http://<lan-ip>:5173 while testing on the phone) registration throws, and that
  // must not stop the app itself from working.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
  });
}
