import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorExpectedVolatilityPoint } from "../interfaces/IndicatorExpectedVolatilityPoint.interface";
import { EXPECTED_VOLATILITY_DEFAULTS } from "../expectedVolatility";
import { withAlpha } from "../../../forms/colorUtils";
import { snapPixel } from "../drawingGeometry";

const PREFIX = "Volatilité attendue - ";

type LineStyle = "solid" | "dashed" | "dotted";

interface Level {
  price: number;
  color: string;
  style: LineStyle;
  text: string;
}

/** Les tirets de Pine (`line.style_dotted`, `line.style_dashed`) à l'échelle de l'épaisseur du trait. */
function dashFor(style: LineStyle, width: number): number[] {
  if (style === "dotted") return [width, width * 2];
  if (style === "dashed") return [width * 4, width * 3];
  return [];
}

/** Une étiquette `label.style_label_left` de Pine : une bulle dont la pointe, à gauche, touche le bout de la ligne,
 *  le texte à sa droite ; fond de la couleur de la ligne à 80 % de transparence, texte de la couleur de la ligne. */
function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, fontFamily: string) {
  ctx.save();
  ctx.font = `600 10px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  const pad = 5;
  const height = 16;
  const arrow = 5;
  ctx.setLineDash([]);
  ctx.fillStyle = withAlpha(color, 0.2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + arrow, y - height / 2);
  ctx.lineTo(x + arrow + width + pad * 2, y - height / 2);
  ctx.lineTo(x + arrow + width + pad * 2, y + height / 2);
  ctx.lineTo(x + arrow, y + height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + arrow + pad, y + 0.5);
  ctx.restore();
}

/** « Vol. jour ATR » : par période tracée (voir `IndicatorExpectedVolatilityPoint.drawn`), la médiane en pointillés,
 *  ouverture ± ATR en trait plein, ouverture ± SMA de l'ATR en tirets, du début à la fin de la période, et leurs
 *  étiquettes au bout de chaque ligne — toutes les séances en mode « 1 jour », la dernière période seule sinon,
 *  comme le script Pine qui efface les étiquettes précédentes hors mode jour. */
export function drawExpectedVolatility(
  ctx: CanvasRenderingContext2D,
  points: { i: number; value: IndicatorExpectedVolatilityPoint }[],
  indicator: Indicator,
  atrColor: string,
  params: RenderCandlestickChartParams,
  style: ChartCanvasStyle
) {
  const { zoomedXScale, zoomedPriceScale } = params;
  const d = EXPECTED_VOLATILITY_DEFAULTS;
  const width = Math.max(1, indicator.lineWidth ?? d.lineWidth);
  const medianColor = indicator.expVolMedianColor ?? d.medianColor;
  const smaColor = indicator.expVolSmaColor ?? d.smaColor;
  const showLow = indicator.expVolShowLow ?? d.showLow;
  const showSma = indicator.expVolShowSma ?? d.showSma;
  const showMedian = indicator.expVolShowMedian ?? d.showMedian;
  const showLabels = indicator.expVolShowLabels ?? d.showLabels;
  const smaPeriod = indicator.expVolSmaPeriod ?? d.smaPeriod;

  const labels: { x: number; y: number; text: string; color: string }[] = [];
  let previousStart = -1;
  for (const { value: v } of points) {
    if (v.periodStart === previousStart) continue;
    previousStart = v.periodStart;
    if (!v.drawn) continue;
    const fmt = (x: number) => x.toFixed(v.decimals);
    const levels: Level[] = [];
    if (showMedian) levels.push({ price: v.open, color: medianColor, style: "dotted", text: `Médiane (ouverture) : ${fmt(v.open)}` });
    levels.push({ price: v.open + v.atr, color: atrColor, style: "solid", text: `Haut ATR ${indicator.period} (${v.scaleLabel}) : ${fmt(v.open + v.atr)}  [ATR ${fmt(v.atr)}]` });
    if (showLow) levels.push({ price: v.open - v.atr, color: atrColor, style: "solid", text: `Bas ATR ${indicator.period} (${v.scaleLabel}) : ${fmt(v.open - v.atr)}` });
    if (showSma && v.sma !== null) {
      levels.push({ price: v.open + v.sma, color: smaColor, style: "dashed", text: `Haut SMA ${smaPeriod} de l'ATR : ${fmt(v.open + v.sma)}  [SMA ${fmt(v.sma)}]` });
      if (showLow) levels.push({ price: v.open - v.sma, color: smaColor, style: "dashed", text: `Bas SMA ${smaPeriod} de l'ATR : ${fmt(v.open - v.sma)}` });
    }
    // Du bord gauche de la première bougie au bord droit de la dernière : la période entière, sans trou entre deux.
    const x0 = zoomedXScale(v.periodStart - 0.5);
    const x1 = zoomedXScale(v.periodEnd - 0.5);
    const withLabels = showLabels && (v.dayMode || v.latest);
    for (const level of levels) {
      const y = snapPixel(zoomedPriceScale(level.price));
      ctx.save();
      ctx.strokeStyle = level.color;
      ctx.lineWidth = width;
      ctx.setLineDash(dashFor(level.style, width));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.restore();
      if (withLabels) labels.push({ x: x1, y, text: PREFIX + level.text, color: level.color });
    }
  }
  // Par-dessus toutes les lignes, pour qu'une ligne de la séance suivante ne barre pas une étiquette.
  for (const l of labels) drawLabel(ctx, l.x, l.y, l.text, l.color, style.fontFamily);
}
