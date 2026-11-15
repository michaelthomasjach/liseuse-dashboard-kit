import { useEffect, useState } from "react";
import type { ChartColorMode } from "../chartStyle";

export interface HostColorScheme {
  /** Jour (`light`) ou nuit (`dark`) du site qui affiche le graphique. */
  scheme: ChartColorMode;
  /** Palette du thème du kit, pour les couleurs par défaut d'un mode imposé. */
  palette: "color" | "eink";
}

function readDom(): HostColorScheme {
  if (typeof document === "undefined") return { scheme: "light", palette: "color" };
  const surface = document.querySelector("[data-lq-surface]")?.getAttribute("data-lq-surface");
  const palette = document.querySelector("[data-lq-palette]")?.getAttribute("data-lq-palette");
  return { scheme: surface === "dark" ? "dark" : "light", palette: palette === "eink" ? "eink" : "color" };
}

/**
 * Le thème jour / nuit du site : `hostColorScheme` quand l'application le passe, sinon la surface posée par le thème
 * du kit (`data-lq-surface` de LqThemeProvider), suivie en direct.
 */
export function useHostColorScheme(hostColorScheme: ChartColorMode | undefined): HostColorScheme {
  const [dom, setDom] = useState<HostColorScheme>(readDom);
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const update = () =>
      setDom((prev) => {
        const next = readDom();
        return prev.scheme === next.scheme && prev.palette === next.palette ? prev : next;
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-lq-surface", "data-lq-palette"] });
    return () => observer.disconnect();
  }, []);
  return hostColorScheme ? { scheme: hostColorScheme, palette: dom.palette } : dom;
}
