import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import { drawMarkerIcon, MARKER_ICON_GAP } from "./drawMarkerIcon";

/**
 * Icônes du style conditionnel des bougies (« Ajouter une icône », voir `computeCandleIcons`) : chacune au-dessus du
 * plus haut ou en dessous du plus bas de sa bougie (de la bougie Heikin Ashi affichée, de la clôture en mode Ligne).
 * Plusieurs icônes du même côté d'une bougie s'empilent en s'éloignant d'elle, dans l'ordre des règles. Seules les
 * bougies visibles sont parcourues. Renko et Line Break n'ont pas une bougie par date : rien n'y est posé.
 */
export function drawCandleIcons(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, halo: string): void {
  const { candleIcons, chartDisplayMode, heikinAshiCandles, data, zoomedXScale, zoomedPriceScale, visibleRange } = params;
  if (!candleIcons || candleIcons.length === 0) return;
  if (chartDisplayMode === "renko" || chartDisplayMode === "lineBreak") return;
  const from = Math.floor(visibleRange.start);
  const to = Math.ceil(visibleRange.end);
  // Empilement : ce qui est déjà posé au-dessus / en dessous de chaque bougie, en pixels.
  const stackAbove = new Map<number, number>();
  const stackBelow = new Map<number, number>();
  for (const mark of candleIcons) {
    const i = mark.index;
    if (i < from - 1 || i > to + 1) continue;
    const d = chartDisplayMode === "heikinAshi" && heikinAshiCandles ? heikinAshiCandles[i] : data[i];
    if (!d) continue;
    const line = chartDisplayMode === "line";
    const yTop = zoomedPriceScale(line ? d.close : Math.max(d.high, d.open, d.close));
    const yBottom = zoomedPriceScale(line ? d.close : Math.min(d.low, d.open, d.close));
    const x = zoomedXScale(i + 0.5);
    const above = mark.position === "above";
    const stack = above ? stackAbove : stackBelow;
    const offset = stack.get(i) ?? 0;
    stack.set(i, offset + mark.size + 2);
    const cy = above ? Math.min(yTop, yBottom) - MARKER_ICON_GAP - offset - mark.size / 2 : Math.max(yTop, yBottom) + MARKER_ICON_GAP + offset + mark.size / 2;
    drawMarkerIcon(ctx, mark.icon, x, cy, mark.size, mark.color, halo);
  }
}
