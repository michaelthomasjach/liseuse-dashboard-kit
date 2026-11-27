import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";

/** Dessins tracés comme une droite (x1/y1 → x2/y2) : leur niveau au bord droit est celui de la droite prolongée, comme
 *  l'alerte le compare au cours. Les autres (zones, figures…) gardent le niveau de leur premier point. */
const LINE_LIKE = new Set(["", "extended", "ray", "channel", "disjointChannel", "arrowLine", "forecast"]);

/** Prix d'un dessin à l'index de barre `atIndex`. */
export function drawingLevelAtIndex(dr: TrendLineDrawing, indexOf: (d: Date) => number, atIndex: number): number {
  const kind = dr.lineType ?? "";
  if (kind === "horizontal" || !LINE_LIKE.has(kind)) return dr.y1;
  const i1 = indexOf(dr.x1);
  const i2 = indexOf(dr.x2);
  if (i1 === i2) return dr.y1;
  return dr.y1 + ((dr.y2 - dr.y1) * (atIndex - i1)) / (i2 - i1);
}

/** Petite cloche (16 px) centrée en (cx, cy). */
function bellPath(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 3);
  ctx.lineTo(cx - 4, cy + 1.5);
  ctx.lineTo(cx - 4, cy - 1.5);
  ctx.bezierCurveTo(cx - 4, cy - 5, cx - 2, cy - 6, cx, cy - 6);
  ctx.bezierCurveTo(cx + 2, cy - 6, cx + 4, cy - 5, cx + 4, cy - 1.5);
  ctx.lineTo(cx + 4, cy + 1.5);
  ctx.lineTo(cx + 5, cy + 3);
  ctx.closePath();
}

/**
 * Une cloche contre l'axe des prix, juste au-dessus de chaque ligne (droite, horizontale, canal…) qui porte une
 * alerte, à la hauteur de la ligne au bord droit du tracé ; aussi pour une alerte de prix posée sans dessin, à son
 * niveau. Hors de la zone visible, rien n'est dessiné.
 */
export function drawAlertMarkers(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const markers = params.alertMarkers;
  if (!markers || (markers.drawingIds.length === 0 && markers.priceLevels.length === 0)) return;
  const { visibleDrawings, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorAccent, colorBg } = style;
  // Index de barre au bord droit du tracé (inverse de zoomedXScale, linéaire en index).
  const x0 = zoomedXScale(0);
  const x1 = zoomedXScale(1);
  const rightIndex = x1 === x0 ? 0 : (dims.boundedWidth - x0) / (x1 - x0) - 0.5;
  const ids = new Set(markers.drawingIds);
  const spots: { y: number; color: string }[] = [];
  for (const dr of visibleDrawings) {
    if (!ids.has(dr.id) || dr.hidden) continue;
    if (dr.valueAxis && dr.valueAxis !== "price") continue;
    spots.push({ y: zoomedPriceScale(drawingLevelAtIndex(dr, indexForDate, rightIndex)), color: dr.color ?? colorAccent });
  }
  for (const level of markers.priceLevels) spots.push({ y: zoomedPriceScale(level), color: colorAccent });

  const cx = dims.boundedWidth - 12;
  for (const { y, color } of spots) {
    // Le tracé des prix est déjà découpé (clip) : une ligne sortie par le bas n'y paraît pas.
    if (!Number.isFinite(y) || y < 0) continue;
    const cy = Math.max(10, y - 11);
    ctx.save();
    // Pastille ronde au fond du graphique, cloche et bord dans la couleur de la ligne.
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = colorBg || "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    bellPath(ctx, cx, cy - 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
