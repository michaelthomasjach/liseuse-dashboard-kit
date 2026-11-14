import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** Une alerte de prix tenue par l'application (ex. surveillée par un serveur), montrée sur le graphique. */
export interface PriceAlertLine {
  id: string;
  price: number;
  /** Libellé à droite de la ligne (« Alerte ≥ 26 000 »). */
  label?: string;
  /** Couleur ; défaut : celle de l'accent du thème. */
  color?: string;
}

/**
 * Les alertes de prix de l'application : une ligne horizontale en pointillés fins sur le panneau des prix, distincte des
 * dessins (pleins ou en tirets), avec son libellé dans une pastille au bord droit. Pas de poignée : elles se règlent
 * là où elles vivent (outils de l'application, MCP), pas en glissant la ligne.
 */
export function drawPriceAlertLines(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const lines = params.priceAlertLines;
  if (!lines?.length || params.priceHeight <= 0) return;
  const { zoomedPriceScale, dims, priceHeight } = params;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dims.boundedWidth, priceHeight);
  ctx.clip();
  ctx.font = `600 10px ${style.fontFamily}`;
  ctx.textBaseline = "middle";
  for (const line of lines) {
    const y = Math.round(zoomedPriceScale(line.price)) + 0.5;
    if (!Number.isFinite(y) || y < 0 || y > priceHeight) continue;
    const color = line.color ?? (style.colorAccent || "#7c5cff");
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dims.boundedWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (line.label) {
      const w = ctx.measureText(line.label).width + 10;
      const x = dims.boundedWidth - w - 4;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y - 8, w, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(line.label, x + 5, y);
    }
  }
  ctx.restore();
}
