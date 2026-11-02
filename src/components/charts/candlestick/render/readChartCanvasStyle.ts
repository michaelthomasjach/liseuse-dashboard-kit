import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** Lit une fois, sur le DOM, les couleurs et réglages de dessin du canvas (un canvas n'a aucune
 *  liaison vivante avec les propriétés CSS). Partagé par le graphique principal et la colonne des
 *  volets ancrés, pour qu'ils ne divergent jamais. Les surcharges de couleur (props) passent devant. */
export function readChartCanvasStyle(wrapper: HTMLElement, upColorOverride?: string, downColorOverride?: string): ChartCanvasStyle {
  const computed = getComputedStyle(wrapper);
  // Les variables optionnelles --lq-chart-* (jamais déclarées par tokens.css) : vides si le thème
  // ne les pose pas, d'où les replis — qui sont les valeurs d'avant leur introduction.
  const token = (name: string) => computed.getPropertyValue(name).trim();
  const tokenNumber = (name: string, fallback: number) => {
    const n = parseFloat(token(name));
    return Number.isFinite(n) ? n : fallback;
  };
  const dashToken = token("--lq-chart-grid-dash");
  const gridDash =
    dashToken === "" ? [2, 3] : dashToken === "none" ? [] : dashToken.split(/[\s,]+/).map(parseFloat).filter((n) => Number.isFinite(n));
  const colorUp = computed.getPropertyValue("--lq-color-up").trim();
  const colorDown = computed.getPropertyValue("--lq-color-down").trim();
  return {
    colorUp: upColorOverride ?? colorUp,
    colorDown: downColorOverride ?? colorDown,
    colorCandleUp: upColorOverride ?? (token("--lq-chart-candle-up") || colorUp),
    colorCandleDown: downColorOverride ?? (token("--lq-chart-candle-down") || colorDown),
    wickWidth: tokenNumber("--lq-chart-candle-wick-width", 1),
    gridWidth: tokenNumber("--lq-chart-grid-width", 1),
    gridDash,
    volumeOpacity: tokenNumber("--lq-chart-volume-opacity", 0.55),
    colorBg: computed.getPropertyValue("--lq-color-bg").trim(),
    colorText: computed.getPropertyValue("--lq-color-text").trim(),
    colorMuted: computed.getPropertyValue("--lq-color-text-muted").trim(),
    colorAccent: computed.getPropertyValue("--lq-color-accent").trim(),
    colorGrid: token("--lq-chart-grid-color") || computed.getPropertyValue("--lq-color-border-subtle").trim(),
    fontFamily: computed.getPropertyValue("--lq-font-family").trim() || "sans-serif",
    isEink: wrapper.closest('[data-lq-palette="eink"]') !== null,
  };
}
