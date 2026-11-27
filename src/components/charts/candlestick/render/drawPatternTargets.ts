import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { patternTarget, PATTERN_TARGET_TYPES } from "../patternTargets";
import { drawPillLabel } from "../drawingRender";

const formatPrice = (v: number): string => v.toLocaleString("fr-FR", { maximumFractionDigits: Math.abs(v) >= 100 ? 2 : 4 });

/**
 * Option « Projection de l'objectif théorique » des figures chartistes (`targetProjection`) : flèche verticale du niveau
 * de mesure (ligne de cou, bord de la tasse, point 4, point B) jusqu'à l'objectif, ligne pointillée à chaque objectif
 * prolongée vers la droite sur la largeur de la figure, et étiquette « Objectif théorique 12 345,60 ».
 */
export function drawPatternTargets(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorUp, colorDown, colorBg, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (!dr.targetProjection || !PATTERN_TARGET_TYPES.has(dr.lineType ?? "")) continue;
    const target = patternTarget(dr, indexForDate);
    if (!target || !target.levels.length) continue;
    const xOf = (d: Date): number => zoomedXScale(indexForDate(d) + 0.5);
    const firstX = xOf(dr.x1);
    const fromX = xOf(target.from.x);
    const width = Math.max(80, Math.min(dims.boundedWidth * 0.5, Math.abs(fromX - firstX)));
    const endX = fromX + width;
    const baseY = zoomedPriceScale(target.base);
    const main = target.levels[0]!;
    const up = main.price >= target.base;
    const color = up ? colorUp : colorDown;
    const mainY = zoomedPriceScale(main.price);

    // La mesure : flèche du niveau de départ jusqu'à l'objectif principal, au point de cassure.
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(fromX, baseY);
    ctx.lineTo(fromX, mainY);
    ctx.stroke();
    ctx.setLineDash([]);
    const dir = up ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(fromX, mainY);
    ctx.lineTo(fromX - 5, mainY + dir * 8);
    ctx.lineTo(fromX + 5, mainY + dir * 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Chaque objectif : une ligne pointillée sur la largeur de la figure, son étiquette au bout.
    target.levels.forEach((level, i) => {
      const y = zoomedPriceScale(level.price);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = i === 0 ? 1 : 0.6;
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(fromX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      ctx.restore();
      drawPillLabel(ctx, endX + 4, y, `${level.label} ${formatPrice(level.price)}`, i === 0 ? color : colorBg, i === 0 ? colorBg : color, fontFamily, "right");
    });
  }
}
