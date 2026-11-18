import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";
import { defaultIndicatorColor } from "../indicatorCatalog";
import { VOLUME_PANE_ID } from "../attachedIndicators";
import { drawOwnPaneIndicatorSeries } from "./drawOwnPaneIndicatorSeries";
import { drawIndicatorStyleRules, type StyleRulePane } from "./drawIndicatorStyleRules";

/** Part de la hauteur de la zone des prix occupée par le volume en overlay (en bas), comme sur les plateformes de
 *  marché : assez pour lire les pics, sans couvrir les bougies. */
export const VOLUME_OVERLAY_FRACTION = 0.22;

type Member = { indicator: Indicator; points: { i: number; value: IndicatorValue }[] };

/** Trace les indicateurs posés sur une série (une SMA du volume, des bandes de Bollinger du RSI…) sur l'échelle de cette
 *  série. Des bandes se dessinent comme le Bollinger des prix : fond translucide entre elles, bandes haute et basse fines,
 *  médiane un peu plus épaisse. */
export function drawAttachedLines(ctx: CanvasRenderingContext2D, attached: Member[], xAt: (i: number) => number, yAt: (v: number) => number, indicators: Indicator[]): void {
  for (const { indicator, points } of attached) {
    if (indicator.hidden || points.length < 2) continue;
    const color = indicator.color ?? defaultIndicatorColor(indicators.indexOf(indicator));
    ctx.strokeStyle = color;
    ctx.lineWidth = indicator.lineWidth ?? 1.5;
    ctx.setLineDash([]);
    if (typeof points[0].value !== "number") {
      drawAttachedBand(ctx, points as { i: number; value: IndicatorBand }[], xAt, yAt, color, indicator.lineWidth ?? 1);
      continue;
    }
    ctx.beginPath();
    points.forEach((p, k) => {
      const x = xAt(p.i + 0.5);
      const y = yAt(p.value as number);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

function drawAttachedBand(ctx: CanvasRenderingContext2D, points: { i: number; value: IndicatorBand }[], xAt: (i: number) => number, yAt: (v: number) => number, color: string, lineWidth: number): void {
  const line = (key: keyof IndicatorBand) => {
    ctx.beginPath();
    points.forEach((p, k) => {
      if (k === 0) ctx.moveTo(xAt(p.i + 0.5), yAt(p.value[key]));
      else ctx.lineTo(xAt(p.i + 0.5), yAt(p.value[key]));
    });
  };
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  line("upper");
  for (let k = points.length - 1; k >= 0; k--) ctx.lineTo(xAt(points[k].i + 0.5), yAt(points[k].value.lower));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = lineWidth;
  line("upper");
  ctx.stroke();
  line("lower");
  ctx.stroke();
  ctx.lineWidth = lineWidth + 0.5;
  line("middle");
  ctx.stroke();
}

/**
 * Le volume sur le graphique des prix (paramètres du panneau Volume → « Afficher sur le graphique des prix ») : des
 * barres en bas de la zone des prix, sur leur propre échelle (le plus fort volume visible atteint
 * `VOLUME_OVERLAY_FRACTION` de la hauteur), translucides, sous les bougies — l'axe des prix n'en est pas changé. Les
 * moyennes posées sur le volume suivent, sur la même échelle, avec leurs zones et couleurs conditionnelles.
 * À appeler dans le repère (et la découpe) de la zone des prix, avant les bougies.
 */
export function drawVolumeOnPrice(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle): void {
  const { volumeOnPrice, visible, zoomedXScale, candleWidth, priceHeight, visibleIndicators, indicators, data } = params;
  if (!volumeOnPrice || visible.length === 0 || priceHeight <= 0) return;
  let max = 0;
  for (const { d } of visible) if ((d.volume ?? 0) > max) max = d.volume ?? 0;
  const attached = visibleIndicators.filter((v) => v.indicator.sourceId === VOLUME_PANE_ID);
  for (const a of attached) for (const p of a.points) {
    const top = typeof p.value === "number" ? p.value : (p.value as IndicatorBand).upper;
    if (typeof top === "number" && top > max) max = top;
  }
  if (max <= 0) return;
  const band = priceHeight * VOLUME_OVERLAY_FRACTION;
  const yAt = (v: number) => priceHeight - (Math.max(0, v) / max) * band;
  const volColorUp = params.volumeUpColorOverride ?? style.colorCandleUp;
  const volColorDown = params.volumeDownColorOverride ?? style.colorCandleDown;
  ctx.save();
  for (const up of [true, false]) {
    ctx.beginPath();
    for (const { d, i } of visible) {
      if (d.close >= d.open !== up) continue;
      const top = yAt(d.volume ?? 0);
      ctx.rect(zoomedXScale(i + 0.5) - candleWidth / 2, top, candleWidth, priceHeight - top);
    }
    // Plus pâle que dans son panneau : les bougies passent devant.
    ctx.globalAlpha = style.isEink ? (up ? 0.1 : 0.22) : Math.min(0.35, style.volumeOpacity * 0.6);
    ctx.fillStyle = style.isEink ? style.colorText : up ? volColorUp : volColorDown;
    ctx.fill();
  }
  ctx.restore();
  const pane: StyleRulePane = { members: attached, xAt: zoomedXScale, yAt, volumeAt: (i) => data[i]?.volume, candleWidth, height: priceHeight, ringColor: style.colorBg };
  drawIndicatorStyleRules(ctx, pane, "under");
  ctx.save();
  drawAttachedLines(ctx, attached, zoomedXScale, yAt, indicators);
  ctx.restore();
  drawIndicatorStyleRules(ctx, pane, "over");
}

/**
 * Les séries de panneau affichées sur le graphique des prix (`Indicator.priceOverlay` : un RSI, une MACD, un panneau
 * de script…). Chacune garde sa propre échelle — celle de son panneau (0-100 pour un RSI, ajustée aux valeurs
 * visibles sinon), étendue à la hauteur des prix et non affichée : ses unités ne sont pas celles du cours, la tracer sur
 * l'échelle des prix l'écraserait contre un bord ou fausserait l'axe. Les indicateurs posés sur elle la suivent.
 * À appeler dans le repère (et la découpe) de la zone des prix, après les indicateurs des prix.
 */
export function drawPaneSeriesOnPrice(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle): void {
  const { priceOverlayIndicators, priceOverlayScales, visibleIndicators, zoomedXScale, candleWidth, dims, indicators, priceHeight } = params;
  if (!priceOverlayIndicators?.length || !priceOverlayScales) return;
  for (const ind of priceOverlayIndicators) {
    const scale = priceOverlayScales[ind.id];
    const entry = visibleIndicators.find((v) => v.indicator.id === ind.id);
    if (!scale || !entry || ind.hidden) continue;
    const attached = visibleIndicators.filter((v) => v.indicator.sourceId === ind.id);
    const pane: StyleRulePane = { members: [entry, ...attached], xAt: zoomedXScale, yAt: scale, candleWidth, height: priceHeight, ringColor: style.colorBg };
    drawIndicatorStyleRules(ctx, pane, "under");
    ctx.save();
    drawOwnPaneIndicatorSeries(ctx, entry.indicator, entry.points, zoomedXScale, candleWidth, dims.boundedWidth, indicators, scale, style, entry);
    ctx.restore();
    ctx.save();
    drawAttachedLines(ctx, attached, zoomedXScale, scale, indicators);
    ctx.restore();
    drawIndicatorStyleRules(ctx, pane, "over");
  }
}
