import { drawPriceAlertLines } from "./drawPriceAlertLines";
import { indicatorAxisAnnotations } from "../axisAnnotations";
import { drawDaySeparators } from "../daySeparators";
import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import { drawSelectedIndicatorMarkers } from "./drawSelectedIndicatorMarkers";
import { applyChartStyle, readChartCanvasStyle } from "./readChartCanvasStyle";
import { drawFutureZone, drawPastZone } from "./drawFutureZone";
import { drawScriptHeatmaps } from "./drawScriptHeatmaps";
import { drawPriceCandles } from "./drawPriceCandles";
import { drawPriceDrawings } from "./drawPriceDrawings";
import { drawPriceDivergences } from "./drawPriceDivergences";
import { drawVolumeAndPanes } from "./drawVolumeAndPanes";
import { drawIndicatorProjections } from "./drawIndicatorProjections";
import { drawReplayMask } from "./drawReplayMask";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** The fields that follow the mouse. The main canvas is painted without them; the crosshair
 *  they describe goes on its own thin canvas above it (`renderCrosshair`), so moving the mouse
 *  repaints a few dashed lines instead of every candle, pane and drawing. */
export const HOVER_PARAM_KEYS = ["hovered", "hoverY", "hoverVolumeY", "hoverIndicatorPaneId", "hoverIndicatorPaneY", "hoverIndex", "crosshairIndex"] as const;
const NO_HOVER = { hovered: null, hoverY: null, hoverVolumeY: null, hoverIndicatorPaneId: null, hoverIndicatorPaneY: null, hoverIndex: null, crosshairIndex: null };

/** Sizes a canvas backing store to its CSS box, only when it actually changed: assigning
 *  `width`/`height` reallocates and clears the whole bitmap even with an identical value. */
function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number, dpr: number) {
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

export type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";

/** Imperatively paints the whole price/volume/indicator-panes canvas — candles (or whichever
 *  display mode is active), drawings, live indicator lines, hover crosshair, and every
 *  in-progress drawing-tool preview. Pulled out of CandlestickChart's own draw `useEffect` as a
 *  pure function (reads `params`, paints `canvas` — no state of its own, no React) purely to keep
 *  every file in this codebase under its 1000-line budget; the call site (still a `useEffect`, now
 *  just a thin wrapper around this) is unchanged in behavior.
 *
 *  Split into five phases, called in this fixed order: `drawFutureZone`/`drawPastZone` paint their
 *  own hatched background markers first (see their own doc), entirely independent of the clip
 *  stack the other three share; `drawPriceCandles` opens the price section's own clip and paints
 *  candles/
 *  gridlines/price-overlay indicators, leaving the clip open; `drawPriceDrawings` continues inside
 *  that same clip (every drawing type, tool previews, the live-price line, symbol overlays) and
 *  closes it; `drawVolumeAndPanes` paints outside the clip (volume, each "own"-pane indicator's
 *  own clipped strip, "vertical" drawings, the crosshair's vertical line); `drawReplayMask` paints
 *  last of all, over everything above, covering replay's own "future" from wherever it's currently
 *  cut (see its own doc). Splitting this way
 *  (rather than each phase re-opening its own independent clip) mirrors the source exactly as it
 *  always flowed as one function — the three clip-sharing phases share one canvas
 *  `save()`/`clip()`/`restore()` stack across the (synchronous, always same-order) calls below,
 *  not three independent ones. */
/** `style` : couleurs déjà lues (voir useRenderCandlestickChart), sinon lues ici sur le DOM. */
export function renderCandlestickChart(canvas: HTMLCanvasElement, wrapper: HTMLElement, withHover: RenderCandlestickChartParams, style?: ChartCanvasStyle): ChartCanvasStyle | null {
  // Never the crosshair here: see HOVER_PARAM_KEYS.
  const params: RenderCandlestickChartParams = { ...withHover, ...NO_HOVER };
  const { dims, plotBoundedHeight, upColorOverride, downColorOverride } = params;
  if (dims.boundedWidth <= 0 || plotBoundedHeight <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  fitCanvas(canvas, dims.boundedWidth, plotBoundedHeight, dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // A context keeps its state across draws now that the bitmap is no longer reset by a size
  // assignment each time: start every pass from a clean state, as before.
  if (typeof (ctx as { reset?: () => void }).reset === "function") (ctx as { reset: () => void }).reset();
  else {
    // Older engines: re-assigning the width is the documented way to reset a context's state.
    const w = canvas.width;
    canvas.width = w;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dims.boundedWidth, plotBoundedHeight);

  style = applyChartStyle(style ?? readChartCanvasStyle(wrapper, upColorOverride, downColorOverride), params.chartStyle);

  drawFutureZone(ctx, params, style);
  drawPastZone(ctx, params, style);
  // Séparateurs de jours : un fond, sous les bougies.
  drawDaySeparators(ctx, params, style);
  // Grille verticale (réglage « Toile ») : aux dates de l'axe du temps, sur toute la hauteur, sous les bougies.
  drawVerticalGrid(ctx, params, style);
  // Before the candles: a liquidity field is a background the price moves over. Drawn after them
  // it would be a curtain across the very thing it exists to give context to.
  drawScriptHeatmaps(ctx, params);
  drawPriceCandles(ctx, params, style);
  // Divergences d'un RSI ou d'un MACD, reportées sur les prix : par-dessus les bougies, sous les dessins.
  drawPriceDivergences(ctx, params, style);
  // Replay : les dessins sont peints APRÈS le masque (plus bas), pour rester visibles dans le futur masqué.
  if (!params.replayActive) drawPriceDrawings(ctx, params, style);
  // Alertes de prix de l'application : au-dessus des bougies et des dessins.
  drawPriceAlertLines(ctx, params, style);
  drawVolumeAndPanes(ctx, params, style);
  // After the panes and the price lines, so a projection is always drawn over the series it
  // continues rather than under it — and before the replay mask, which is allowed to cover it.
  drawIndicatorProjections(ctx, params, style);
  // L'indicateur sélectionné : ses cercles par-dessus sa ligne et sa projection.
  drawSelectedIndicatorMarkers(ctx, params, style);
  drawReplayMask(ctx, params, style);
  // Replay : le masque ne cache que ce qui dérive des bougies (bougies, volume, indicateurs et leurs projections) —
  // ce qui ne peut pas exister après l'instant du replay. Les dessins (lignes, canaux, textes, prévisions…), eux,
  // sont repeints par-dessus et restent visibles dans le futur, y compris pendant leur tracé ; seule la ligne du
  // dernier cours réel reste masquée (elle trahirait le futur).
  if (params.replayActive) drawPriceDrawings(ctx, { ...params, livePrice: false }, style);
  return style;
}

/** The hover crosshair, alone on its own canvas stacked over the main one: the vertical line
 *  through the hovered candle across every section, and the horizontal line in whichever section
 *  the cursor is in (price, volume or one pane), each clipped to that section, exactly where the
 *  main canvas used to draw them. Above everything, the replay mask included (which used to paint
 *  the same lines over itself for that very reason). */
export function renderCrosshair(canvas: HTMLCanvasElement, params: RenderCandlestickChartParams, style: ChartCanvasStyle | null) {
  const { dims, plotBoundedHeight, hovered, hoverIndex, hoverY, hoverVolumeY, hoverIndicatorPaneId, hoverIndicatorPaneY } = params;
  // Réticule dans l'espace vide à droite de la dernière bougie (ou à gauche de la première) : pas de bougie sous la
  // ligne verticale, donc pas de lignes de valeur dans les autres sections.
  const crosshairIndex = params.crosshairIndex ?? hoverIndex;
  const outsideData = crosshairIndex !== hoverIndex;
  if (dims.boundedWidth <= 0 || plotBoundedHeight <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  fitCanvas(canvas, dims.boundedWidth, plotBoundedHeight, dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dims.boundedWidth, plotBoundedHeight);
  if (!hovered || !style) return;

  ctx.save();
  ctx.strokeStyle = style.crosshair?.color ?? style.colorMuted;
  ctx.lineWidth = style.crosshair?.width ?? 1;
  ctx.setLineDash(style.crosshair?.dash ?? [3, 3]);
  const hline = (top: number, height: number, y: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, dims.boundedWidth, height);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(0, top + y);
    ctx.lineTo(dims.boundedWidth, top + y);
    ctx.stroke();
    ctx.restore();
  };
  if (hoverY !== null) hline(0, params.priceHeight, hoverY);
  if (hoverVolumeY !== null && params.volumeVisible && params.volumeHeight > 0 && !params.volumeCollapsed) {
    hline(params.priceHeight + params.volumeTop, params.volumeHeight, hoverVolumeY);
  }
  if (hoverIndicatorPaneId !== null && hoverIndicatorPaneY !== null) {
    const idx = params.ownPaneIndicators.findIndex((ind) => ind.id === hoverIndicatorPaneId);
    const ind = params.ownPaneIndicators[idx];
    if (ind && !ind.paneCollapsed && params.zoomedOwnPaneScales[ind.id]) {
      hline(params.priceHeight + params.indicatorPaneTops[idx], params.indicatorPaneHeights[idx], hoverIndicatorPaneY);
    }
  }
  // Les autres sections que celle du pointeur : une ligne à leur valeur à la bougie survolée, là où leur axe affiche
  // déjà son étiquette (ChartHoverBadges) — le cours de clôture sur le graphique principal, le volume, chaque courbe
  // d'un panneau (RSI, MACD et signal… ; pas l'histogramme, qui n'est pas une ligne).
  if (hoverIndex !== null && !outsideData) {
    if (hoverY === null) {
      const y = params.zoomedPriceScale(hovered.close);
      if (y >= 0 && y <= params.priceHeight) hline(0, params.priceHeight, y);
    }
    if (hoverVolumeY === null && params.volumeVisible && params.volumeHeight > 0 && !params.volumeCollapsed && typeof hovered.volume === "number") {
      const y = params.zoomedVolumeScale(hovered.volume);
      if (y >= 0 && y <= params.volumeHeight) hline(params.priceHeight + params.volumeTop, params.volumeHeight, y);
    }
    params.ownPaneIndicators.forEach((ind, idx) => {
      if (ind.id === hoverIndicatorPaneId || ind.paneCollapsed || ind.hidden || ind.hoverSync !== true) return;
      const scale = params.zoomedOwnPaneScales[ind.id];
      const height = params.indicatorPaneHeights[idx];
      if (!scale || !(height > 0)) return;
      // Sa série et celles des indicateurs posés sur lui (une SMA du RSI…).
      for (const member of params.visibleIndicators) {
        if ((member.indicator.id !== ind.id && member.indicator.sourceId !== ind.id) || member.indicator.hidden) continue;
        const point = member.points.find((p) => p.i === hoverIndex);
        if (!point) continue;
        for (const line of indicatorAxisAnnotations(member.indicator, [point.value], 0, undefined).y) {
          if (/hist/i.test(line.label ?? "") || /hist/i.test(line.key)) continue;
          const y = scale(line.at);
          if (Number.isFinite(y) && y >= 0 && y <= height) hline(params.priceHeight + params.indicatorPaneTops[idx], height, y);
        }
      }
    });
  }
  if (crosshairIndex !== null) {
    const hx = params.zoomedXScale(crosshairIndex + 0.5);
    if (hx >= 0 && hx <= dims.boundedWidth) {
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, plotBoundedHeight);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** La grille verticale, quand elle est demandée (`style.vertGrid`) : une ligne à chaque date de l'axe du temps. */
function drawVerticalGrid(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const ticks = params.dateTickValues;
  if (!style.vertGrid || !ticks || ticks.length === 0) return;
  const { dims, plotBoundedHeight, zoomedXScale } = params;
  ctx.save();
  ctx.strokeStyle = style.vertGrid.color;
  ctx.lineWidth = style.gridWidth;
  ctx.setLineDash(style.vertGrid.dash);
  ctx.beginPath();
  for (const t of ticks) {
    const x = Math.round(zoomedXScale(t)) + 0.5;
    if (x < 0 || x > dims.boundedWidth) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, plotBoundedHeight);
  }
  ctx.stroke();
  ctx.restore();
}
