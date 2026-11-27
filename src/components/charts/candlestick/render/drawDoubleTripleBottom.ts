import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { FILL_ALPHA } from "../drawingFills";
import { bottomPatternLevels } from "../patternTargets";

/**
 * « doubleBottom » (5 points : départ, creux 1, sommet, creux 2, sortie) et « tripleBottom » (7 points : départ,
 * creux 1, sommet 1, creux 2, sommet 2, creux 3, sortie) : la figure en ligne brisée, chaque creux et sommet nommé, la
 * ligne de cou (le plus haut des sommets intermédiaires) prolongée vers la droite, la zone entre la figure et la ligne
 * de cou remplie. Tracée à l'envers (creux au-dessus des sommets), la même figure se lit en double ou triple top.
 */
export function drawDoubleTripleBottomDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorDown, colorUp, colorMuted, colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "doubleBottom" && dr.lineType !== "tripleBottom") continue;
    const n = dr.lineType === "doubleBottom" ? 5 : 7;
    if ((dr.extraPoints?.length ?? 0) < n - 2) continue;
    const raw = [{ x: dr.x1, y: dr.y1 }, { x: dr.x2, y: dr.y2 }, ...dr.extraPoints!.slice(0, n - 2)];
    const points = raw.map((p) => ({ x: zoomedXScale(indexForDate(p.x) + 0.5), y: zoomedPriceScale(p.y) }));
    const { bottom, neck } = bottomPatternLevels(raw, n);
    const neckY = zoomedPriceScale(neck);
    const lineColor = dr.color ?? colorAccent;

    // Zone entre la figure (du creux 1 au dernier creux) et la ligne de cou.
    ctx.save();
    ctx.fillStyle = dr.fillColor ?? lineColor;
    ctx.globalAlpha = FILL_ALPHA;
    ctx.beginPath();
    ctx.moveTo(points[1]!.x, neckY);
    for (let i = 1; i < n - 1; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
    ctx.lineTo(points[n - 2]!.x, neckY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Ligne de cou, du premier sommet jusqu'au bord droit.
    ctx.save();
    ctx.strokeStyle = colorMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(points[2]!.x, neckY);
    ctx.lineTo(dims.boundedWidth, neckY);
    ctx.stroke();
    ctx.restore();

    // La figure.
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();

    // Noms des creux et des sommets (sous un creux de bottom, au-dessus d'un sommet), points marqués.
    ctx.save();
    ctx.font = `700 10px ${fontFamily}`;
    ctx.textAlign = "center";
    const multiHighs = n === 7;
    let low = 0;
    let high = 0;
    points.forEach((p, i) => {
      if (i === 0 || i === n - 1) return;
      const isLow = i % 2 === 1;
      const name = isLow ? `${bottom ? "Creux" : "Sommet"} ${++low}` : `${bottom ? "Sommet" : "Creux"}${multiHighs ? ` ${++high}` : ""}`;
      const below = isLow === bottom;
      ctx.fillStyle = isLow ? (bottom ? colorUp : colorDown) : colorMuted;
      ctx.textBaseline = below ? "top" : "bottom";
      ctx.fillText(name, p.x, below ? p.y + 8 : p.y - 8);
    });
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    for (const p of points) {
      ctx.moveTo(p.x + 3, p.y);
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
