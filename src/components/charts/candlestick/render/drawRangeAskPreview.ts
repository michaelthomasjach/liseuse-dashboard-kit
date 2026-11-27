import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";

/** Couleurs du halo de l'IA (mêmes teintes que le liseré et les boutons de l'IA), très atténuées. */
export const RANGE_ASK_AI_STOPS = ["#4285f4", "#9b72cb", "#d96570", "#f4b400"];

/**
 * Zone « Interroger l'IA » en cours de pose : du 1er clic au pointeur, sur toute la hauteur du graphique (prix,
 * volume et panneaux d'indicateurs), en dégradé léger aux couleurs de l'IA, deux traits fins à ses bords. Dessinée
 * après les panneaux, hors de tout découpage, pour que la pose se voie et se fasse depuis n'importe quel panneau.
 */
export function drawRangeAskPreview(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams) {
  const { activeTool, pendingPoint, previewPoint, zoomedXScale, indexForDate, dims } = params;
  if (activeTool !== "rangeAsk" || !pendingPoint || !previewPoint) return;
  const height = dims.boundedHeight;
  const xa = zoomedXScale(indexForDate(pendingPoint.x) + 0.5);
  const xb = zoomedXScale(indexForDate(previewPoint.x) + 0.5);
  const left = Math.min(xa, xb);
  const width = Math.abs(xb - xa);
  ctx.save();
  if (width > 0) {
    const g = ctx.createLinearGradient(left, 0, left + width, 0);
    RANGE_ASK_AI_STOPS.forEach((c, i) => g.addColorStop(i / (RANGE_ASK_AI_STOPS.length - 1), c));
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = g;
    ctx.fillRect(left, 0, width, height);
  }
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeStyle = RANGE_ASK_AI_STOPS[0]!;
  ctx.beginPath();
  ctx.moveTo(xa, 0);
  ctx.lineTo(xa, height);
  ctx.stroke();
  ctx.strokeStyle = RANGE_ASK_AI_STOPS[2]!;
  ctx.beginPath();
  ctx.moveTo(xb, 0);
  ctx.lineTo(xb, height);
  ctx.stroke();
  ctx.restore();
}
