import type { ChartStyleSettings } from "./chartStyle";

/** Couleurs des bougies réglées à la main (corps, bordures, mèches), partagées par la page « Symbole » des paramètres
 *  système et l'onglet du symbole des paramètres du graphique. */
interface CandleColorState {
  upColorOverride: string | undefined;
  downColorOverride: string | undefined;
  setUpColorOverride: (color: string | undefined) => void;
  setDownColorOverride: (color: string | undefined) => void;
  chartStyle: ChartStyleSettings;
  setChartStyle: (style: ChartStyleSettings) => void;
}

/** Vrai quand une couleur des bougies s'écarte de celles du thème. */
export function hasCandleColorOverrides(p: Pick<CandleColorState, "upColorOverride" | "downColorOverride" | "chartStyle">): boolean {
  const st = p.chartStyle;
  return Boolean(p.upColorOverride || p.downColorOverride || st.wickUpColor || st.wickDownColor || st.borderUpColor || st.borderDownColor);
}

/** Rend aux bougies les couleurs du thème (corps, bordures, mèches). */
export function resetCandleColors(p: Pick<CandleColorState, "setUpColorOverride" | "setDownColorOverride" | "chartStyle" | "setChartStyle">): void {
  p.setUpColorOverride(undefined);
  p.setDownColorOverride(undefined);
  const next: ChartStyleSettings = { ...p.chartStyle };
  delete next.wickUpColor;
  delete next.wickDownColor;
  delete next.borderUpColor;
  delete next.borderDownColor;
  p.setChartStyle(next);
}

