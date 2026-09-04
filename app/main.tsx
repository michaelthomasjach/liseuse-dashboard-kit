import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./app.css";

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
