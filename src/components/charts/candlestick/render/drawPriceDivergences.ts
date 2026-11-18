import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import { DIVERGENCE_DEFAULTS, divergenceSourceName, drawDivergenceSegments } from "../divergences";

/** Les divergences d'un RSI ou d'un MACD (option « Divergences »), reportées sur le graphique des prix : un segment
 *  entre les plus hauts (baissière) ou les plus bas (haussière) des deux bougies pivots, avec son étiquette. Découpé à la
 *  zone des prix. Rien pour un indicateur masqué ou dont l'option « Sur le graphique des prix » est décochée. */
export function drawPriceDivergences(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleIndicators, zoomedXScale, zoomedPriceScale, priceHeight, dims } = params;
  const entries = visibleIndicators.filter(
    (v) => v.divergences && v.divergences.length > 0 && v.indicator.hidden !== true && (v.indicator.divergenceOnPrice ?? DIVERGENCE_DEFAULTS.onPrice)
  );
  if (entries.length === 0 || priceHeight <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dims.boundedWidth, priceHeight);
  ctx.clip();
  for (const entry of entries) {
    drawDivergenceSegments(ctx, entry.divergences ?? [], entry.indicator, zoomedXScale, (d, which) => zoomedPriceScale(which === 1 ? d.p1 : d.p2), dims.boundedWidth, style, divergenceSourceName(entry.indicator));
  }
  ctx.restore();
}
