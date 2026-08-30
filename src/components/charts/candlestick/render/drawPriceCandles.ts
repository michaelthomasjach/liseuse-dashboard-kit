import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";
import type { IndicatorZigZagPoint } from "../interfaces/IndicatorZigZagPoint.interface";
import type { IndicatorSupertrendPoint } from "../interfaces/IndicatorSupertrendPoint.interface";
import type { IndicatorIchimokuPoint } from "../interfaces/IndicatorIchimokuPoint.interface";
import type { IndicatorGapPoint } from "../interfaces/IndicatorGapPoint.interface";
import type { IndicatorPivotPointsPoint } from "../interfaces/IndicatorPivotPointsPoint.interface";
import type { IndicatorSRLevel } from "../interfaces/IndicatorSRLevel.interface";
import type { IndicatorChandelierPoint } from "../interfaces/IndicatorChandelierPoint.interface";
import type { IndicatorPatternMatch } from "../interfaces/IndicatorPatternMatch.interface";
import type { IndicatorCandleMatch } from "../interfaces/IndicatorCandleMatch.interface";
import { snapPixel } from "../drawingGeometry";
import { drawPillLabel } from "../drawingRender";
import { indicatorCatalogEntry, defaultIndicatorColor } from "../indicatorCatalog";
import { drawPatternRecognitionMatches } from "./drawPatternRecognition";
import { drawCandleRecognitionMatches } from "./drawCandleRecognition";

// "gaps"/"parabolicSar"/"pivotPoints" are point-based (a rectangle, a dot, or a single flat
// segment all render fine on their own) rather than line-shaped like every other indicator here,
// so they're exempt from the "needs at least 2 points to draw anything" gate below.
// "patternRecognition"/"candleRecognition" join them for the same reason — a match found (or not)
// within their own recent window has nothing to do with how many points happen to be visible.
const POINT_BASED_KINDS = new Set(["gaps", "parabolicSar", "pivotPoints", "supportResistance", "patternRecognition", "candleRecognition"]);

// A `CustomIndicatorDef.lineStyle` (script/caller-chosen) mapped to `ctx.setLineDash` — every
// built-in indicator with a fixed dash style (Ichimoku's chikou span, pivot levels,
// support/resistance) already calls setLineDash directly with its own hardcoded array; this is
// the same mechanism, just exposed as a per-series choice instead of baked into one indicator kind.
function applyLineStyle(ctx: CanvasRenderingContext2D, style: "solid" | "dashed" | "dotted" | undefined) {
  if (style === "dashed") ctx.setLineDash([6, 4]);
  else if (style === "dotted") ctx.setLineDash([1.5, 3]);
  else ctx.setLineDash([]);
}

// TPO's own 4-stop gradient (red → green → cyan → purple, roughly matching every real TPO tool's
// own default palette) — `t` (0 = a session's first block, 1 = its last) picked over the theme's
// own colors since it's meant to read the same "how early/late in the session" way regardless of
// light/dark/E-ink, not adapt to it the way indicator lines normally do.
const TPO_GRADIENT_STOPS: [number, number, number][] = [
  [224, 92, 110],
  [111, 174, 111],
  [79, 195, 200],
  [143, 111, 209],
];
function tpoGradientColor(t: number): string {
  const scaled = Math.min(1, Math.max(0, t)) * (TPO_GRADIENT_STOPS.length - 1);
  const i = Math.min(TPO_GRADIENT_STOPS.length - 2, Math.floor(scaled));
  const localT = scaled - i;
  const [r0, g0, b0] = TPO_GRADIENT_STOPS[i];
  const [r1, g1, b1] = TPO_GRADIENT_STOPS[i + 1];
  const r = Math.round(r0 + (r1 - r0) * localT);
  const g = Math.round(g0 + (g1 - g0) * localT);
  const b = Math.round(b0 + (b1 - b0) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Phase 1 of `renderCandlestickChart`: opens the price section's own clip (left open — closed by
 *  `drawPriceDrawings`, always called right after this in the same synchronous pass, see
 *  `renderChart.ts`), then paints its gridlines, the candles themselves (or Renko/Line Break
 *  bricks, a plain close line, or TPO's histogram overlay — whichever `chartDisplayMode` is
 *  active), price-overlay indicator lines (SMA/EMA/WMA/VWAP/Bollinger), and the hover crosshair's
 *  horizontal line. */
export function drawPriceCandles(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { dims, priceHeight, zoomedPriceScale, zoomedXScale, chartDisplayMode, visible, heikinAshiCandles, candleWidth, tpoOverlays, visibleIndicators, hovered, hoverY, data, visibleRange, renkoBricks, lineBreakBricks, overlayProjections } =
    params;
  const { colorUp, colorDown, colorBg, colorText, colorMuted, colorAccent, colorGrid, fontFamily, isEink } = style;

    // Everything in price space (gridlines, candles, drawings, the price hover line) is clipped
    // to the price section's own rectangle — without this, panning/zooming the price axis could
    // push candles/drawings visually down into the volume area below, since rescaling the scale
    // doesn't clamp the pixels it produces to any particular range.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dims.boundedWidth, priceHeight);
    ctx.clip();

    // Drawn first, underneath everything else — mirrors ChartAxis's own grid (same `ticks(5)`
    // the SVG price axis would otherwise use), kept on canvas so it stays behind the candles
    // instead of the SVG (which paints on top of the canvas) covering them.
    ctx.save();
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (const tick of zoomedPriceScale.ticks(5)) {
      const y = snapPixel(zoomedPriceScale(tick));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dims.boundedWidth, y);
      ctx.stroke();
    }
    ctx.restore();

    // The "0%" baseline while comparing against a symbol overlay (see compareMode/
    // overlayProjections) — every overlay projects onto the same mainReference price, so any one
    // of them gives the level. A solid, slightly darker line (colorMuted, not the dashed
    // colorGrid above) since this one's a meaningful reference threshold, not just a scale tick.
    if (overlayProjections.length > 0) {
      const y = snapPixel(zoomedPriceScale(overlayProjections[0].mainReference));
      ctx.save();
      ctx.strokeStyle = colorMuted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dims.boundedWidth, y);
      ctx.stroke();
      ctx.restore();
    }

    if (chartDisplayMode === "line") {
      // A plain close-price line, same treatment as the light area fill under an indicator
      // band (globalAlpha 0.08) rather than a fully opaque fill, so gridlines/drawings under it
      // stay legible.
      if (visible.length > 0) {
        ctx.save();
        ctx.strokeStyle = colorAccent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        visible.forEach(({ d, i }, k) => {
          const x = zoomedXScale(i + 0.5);
          const y = zoomedPriceScale(d.close);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        if (visible.length > 1) {
          ctx.lineTo(zoomedXScale(visible[visible.length - 1].i + 0.5), priceHeight);
          ctx.lineTo(zoomedXScale(visible[0].i + 0.5), priceHeight);
          ctx.closePath();
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = colorAccent;
          ctx.fill();
        }
        ctx.restore();
      }
    } else if (chartDisplayMode === "renko" || chartDisplayMode === "lineBreak") {
      // Bricks are positioned on the *existing* index-based X scale (see PriceBrick's own
      // comment) rather than a dedicated brick-index axis, so they zoom/pan in lockstep with
      // everything else instead of needing a parallel scale threaded through the whole file.
      const bricks = chartDisplayMode === "renko" ? renkoBricks : lineBreakBricks;
      const rangeStart = Math.max(0, visibleRange.start - 2);
      const rangeEnd = Math.min(data.length, visibleRange.end + 2);
      for (let bi = 0; bi < bricks.length; bi++) {
        const brick = bricks[bi];
        if (brick.endIndex < rangeStart || brick.startIndex > rangeEnd) continue;
        const up = brick.direction > 0;
        const hueColor = up ? colorUp : colorDown;
        // A brick's own `startIndex` is set to the *previous* brick's `endIndex` (see
        // computeRenkoBricks/computeLineBreakBricks) — both bricks legitimately claim that same
        // candle when it's the one that confirmed the earlier brick AND kicked off this one, so
        // rendering both from that literal index doubled up one full candle-slot's width of
        // overlap at every single transition, painting the new brick's color over part of the
        // old one. Bumped forward by one slot here (render-only — the stored index driving the
        // price math is untouched) whenever that overlap actually applies, i.e. never for the
        // very first brick and never for one of several bricks confirmed within the same candle
        // (startIndex === endIndex there already renders as a single deliberate 1-slot sliver).
        const prevBrick = bi > 0 ? bricks[bi - 1] : null;
        const sharesBoundaryWithPrev = prevBrick !== null && brick.startIndex === prevBrick.endIndex && brick.startIndex !== brick.endIndex;
        const renderStartIndex = sharesBoundaryWithPrev ? brick.startIndex + 1 : brick.startIndex;
        const x1 = zoomedXScale(renderStartIndex);
        const x2 = zoomedXScale(brick.endIndex + 1);
        const top = zoomedPriceScale(Math.max(brick.open, brick.close));
        const bottom = zoomedPriceScale(Math.min(brick.open, brick.close));
        const inset = Math.min(1.5, (x2 - x1) / 4);
        const rectX = x1 + inset;
        const rectWidth = Math.max(1, x2 - x1 - inset * 2);
        const rectHeight = Math.max(1, bottom - top);

        ctx.lineWidth = 1;
        ctx.fillStyle = isEink ? (up ? colorBg : colorText) : hueColor;
        ctx.strokeStyle = isEink ? colorText : hueColor;
        ctx.fillRect(rectX, top, rectWidth, rectHeight);
        ctx.strokeRect(rectX, top, rectWidth, rectHeight);
      }
    } else {
      // "candle"/"heikinAshi" (same candle body/wick drawing, just fed transformed OHLC values
      // that stay 1:1 with `data`'s own indices).
      const useHA = chartDisplayMode === "heikinAshi" && heikinAshiCandles;
      for (const { d: rawD, i } of visible) {
        const d = useHA ? heikinAshiCandles![i] : rawD;
        const cx = zoomedXScale(i + 0.5);
        const up = d.close >= d.open;
        const bodyTop = zoomedPriceScale(Math.max(d.open, d.close));
        const bodyBottom = zoomedPriceScale(Math.min(d.open, d.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        const hueColor = up ? colorUp : colorDown;

        ctx.lineWidth = 1;
        ctx.strokeStyle = isEink ? colorText : hueColor;
        ctx.beginPath();
        ctx.moveTo(cx, zoomedPriceScale(d.high));
        ctx.lineTo(cx, zoomedPriceScale(d.low));
        ctx.stroke();

        // E-ink can't code up/down by hue, so it falls back to the standard hollow/filled OHLC convention.
        ctx.fillStyle = isEink ? (up ? colorBg : colorText) : hueColor;
        ctx.strokeStyle = isEink ? colorText : hueColor;
        ctx.fillRect(cx - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        ctx.strokeRect(cx - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      }
    }

    // "tpo" is an overlay indicator (like S/R or Pivot Points), not a chartDisplayMode — drawn
    // here, before the generic visibleIndicators loop below (which explicitly skips it, see its
    // own comment), so it layers over the candles just drawn but under every other overlay.
    // One profile per session (see computeTPOSessionProfiles' own doc) per active "tpo"
    // indicator, each drawn against its *own* bars, growing rightward from that session's own
    // left edge — but NOT one shared time-based column per block across every row (that draws a
    // zigzag tracing price over time, not a real TPO profile). A real TPO/Market Profile lays
    // each price ROW out on its own: every block that touched that row appends its own letter to
    // that row's own left-aligned run, in chronological order, *independently* of what any other
    // row is doing — a row many blocks lingered at reaches further right than one only a couple
    // passed through. That per-row accumulation is what produces the classic "lying bell curve"
    // silhouette (wide through the middle, narrow at the extremes), not a diagonal.
    for (const overlay of tpoOverlays) {
      for (const session of overlay.profiles) {
        const { rows, blocks, pocRow, vahRow, valRow } = session;
        const x0 = zoomedXScale(session.startIndex);
        const sessionWidth = Math.max(1, zoomedXScale(session.endIndex + 1) - x0);

        const rowLetters: { label: string; color: string }[][] = rows.map(() => []);
        blocks.forEach((block, bi) => {
          const color = tpoGradientColor(blocks.length > 1 ? bi / (blocks.length - 1) : 0);
          for (const r of block.rows) rowLetters[r].push({ label: block.label, color });
        });
        // Sized off the row with the *most* touches (normally at/near POC) so that row's own
        // run spans the full session width — same "fills its own candle's footprint" sizing the
        // old time-column approach had, just measured in touches instead of elapsed time.
        const maxTouches = rowLetters.reduce((m, letters) => Math.max(m, letters.length), 1);
        const cellWidth = sessionWidth / maxTouches;
        // "Split by blocks": a small gap between adjacent letters' own cells, even within the
        // same row, so distinct blocks read as visually separate rather than one unbroken run.
        const gap = overlay.splitByBlocks ? Math.min(1.5, cellWidth * 0.12) : 0;
        const showLetters = cellWidth > 9;

        ctx.save();
        ctx.font = `700 8px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        rowLetters.forEach((letters, r) => {
          if (letters.length === 0) return;
          const yTop = zoomedPriceScale(rows[r].priceHigh);
          const cellHeight = Math.max(1, zoomedPriceScale(rows[r].priceLow) - yTop);
          const insideValueArea = r >= valRow && r <= vahRow;
          // overlay.opacity (see Indicator.tpoOpacity's own doc) scales both tiers together
          // rather than replacing the value-area/rest distinction with one flat alpha — a row
          // outside the value area stays visibly less prominent than one inside it at any
          // opacity setting, same ~0.55 ratio the old fixed 0.5/0.9 (color) and 0.35/0.7 (E-ink)
          // pairs already had. No isEink branch anymore: TPO's own gradient is already
          // deliberately theme-blind (see tpoGradientColor's own doc) for the same reason.
          const valueAreaAlpha = Math.min(1, Math.max(0, overlay.opacity / 100));
          const cellAlpha = insideValueArea ? valueAreaAlpha : valueAreaAlpha * 0.55;
          letters.forEach((letter, ci) => {
            const cellX = x0 + ci * cellWidth;
            ctx.globalAlpha = cellAlpha;
            ctx.fillStyle = letter.color;
            ctx.fillRect(cellX + gap / 2, yTop, Math.max(1, cellWidth - gap), cellHeight);
            if (showLetters && cellHeight > 7) {
              ctx.globalAlpha = 1;
              ctx.fillStyle = "#ffffff";
              ctx.fillText(letter.label, cellX + cellWidth / 2, yTop + cellHeight / 2 + 0.5);
            }
          });
        });
        ctx.globalAlpha = 1;
        ctx.restore();

        // VAH/POC/VAL, scoped to this session's own width — same convention every other
        // horizontal-level indicator (Pivot Points, S/R) already draws its own reference lines.
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.font = `600 9px ${fontFamily}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        const levels: [number, string][] = [
          [rows[vahRow].priceHigh, "VAH"],
          [(rows[pocRow].priceLow + rows[pocRow].priceHigh) / 2, "POC"],
          [rows[valRow].priceLow, "VAL"],
        ];
        for (const [price, label] of levels) {
          const y = snapPixel(zoomedPriceScale(price));
          ctx.strokeStyle = colorMuted;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + sessionWidth, y);
          ctx.stroke();
          if (sessionWidth > 24) {
            ctx.fillStyle = colorMuted;
            ctx.fillText(label, x0 + 2, y - 2);
          }
        }
        ctx.restore();
      }
    }

    // Only price-overlay indicators draw here — "own"-pane ones (RSI/CHOP/MACD/ATR/fundamentals)
    // get their own clipped section further down, alongside volume. "tpo" is drawn separately
    // above (a session profile, not a value at a fixed index — see computeIndicatorValues' own
    // "tpo" case) and never reaches a branch below: computeIndicatorValues returns it an
    // all-null array, so `points` is always empty and the next line skips it here for free.
    visibleIndicators.forEach(({ indicator, points }, index) => {
      if (indicator.hidden || indicatorCatalogEntry(indicator).pane !== "price") return;
      if (points.length === 0 || (points.length < 2 && !POINT_BASED_KINDS.has(indicator.kind))) return;
      const color = indicator.color ?? defaultIndicatorColor(index);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.setLineDash([]);

      if (indicator.kind === "zigzag") {
        // A straight line through each confirmed pivot only (points is already compacted down to
        // just those — see computeZigZagValues/visibleIndicators), not a value at every candle —
        // this reuses the same moveTo/lineTo shape as the plain-number branch below, just walking
        // far fewer points since everything in between two pivots is skipped entirely.
        const zzPoints = points as { i: number; value: IndicatorZigZagPoint }[];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        zzPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value.price);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        if (indicator.zigzagShowLabels ?? true) {
          ctx.font = `600 10px ${fontFamily}`;
          ctx.textAlign = "center";
          ctx.fillStyle = color;
          for (const p of zzPoints) {
            if (!p.value.label) continue; // First high/first low: nothing to compare against yet.
            const x = zoomedXScale(p.i + 0.5);
            const y = zoomedPriceScale(p.value.price);
            // Above a high pivot, below a low one, so the label never sits on top of the line
            // itself or the candle wick right at the pivot.
            ctx.textBaseline = p.value.kind === "high" ? "bottom" : "top";
            ctx.fillText(p.value.label, x, y + (p.value.kind === "high" ? -5 : 5));
          }
        }
      } else if (indicator.kind === "supertrend") {
        // Colored per-segment by trend (the chart's own up/down colors unless overridden by the
        // indicator's own supertrendUpColor/supertrendDownColor — not `indicator.color`, see that
        // field's own doc) rather than one continuous stroke — each tiny 2-point segment takes
        // the color of the bar it's arriving *at*, which both reads correctly moment-to-moment
        // and keeps every segment connected to its neighbors (including right across a flip,
        // where the value itself genuinely jumps from one band to the other — that's the real
        // Supertrend "flip line" every trading platform shows, not a rendering artifact).
        const stPoints = points as { i: number; value: IndicatorSupertrendPoint }[];
        const stUpColor = indicator.supertrendUpColor ?? colorUp;
        const stDownColor = indicator.supertrendDownColor ?? colorDown;
        ctx.lineWidth = 1.5;
        for (let k = 1; k < stPoints.length; k++) {
          const from = stPoints[k - 1];
          const to = stPoints[k];
          ctx.strokeStyle = to.value.trend === "up" ? stUpColor : stDownColor;
          ctx.beginPath();
          ctx.moveTo(zoomedXScale(from.i + 0.5), zoomedPriceScale(from.value.value));
          ctx.lineTo(zoomedXScale(to.i + 0.5), zoomedPriceScale(to.value.value));
          ctx.stroke();
        }
      } else if (indicator.kind === "chandelierExit") {
        // Two *broken* lines (only one active per bar, selected by `dir` — see
        // IndicatorChandelierPoint's own doc), unlike Supertrend's own single always-connected
        // line just above: the Pine Script original plots each stop with `style_linebr`, so the
        // line stops entirely at the last bar of one direction and doesn't resume until that same
        // direction returns, rather than jumping straight across to the other stop's own level.
        const cePoints = points as { i: number; value: IndicatorChandelierPoint }[];
        const ceUpColor = indicator.chandelierUpColor ?? colorUp;
        const ceDownColor = indicator.chandelierDownColor ?? colorDown;
        const strokeStop = (get: (v: IndicatorChandelierPoint) => number | null, lineColor: string) => {
          ctx.save();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          let drawing = false;
          for (const p of cePoints) {
            const v = get(p.value);
            if (v === null) {
              drawing = false;
              continue;
            }
            const x = zoomedXScale(p.i + 0.5);
            const y = zoomedPriceScale(v);
            if (!drawing) {
              ctx.moveTo(x, y);
              drawing = true;
            } else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        };
        strokeStop((v) => (v.dir === 1 ? v.longStop : null), ceUpColor);
        strokeStop((v) => (v.dir === -1 ? v.shortStop : null), ceDownColor);

        // Fill between price (Pine's own `ohlc4`) and whichever stop is active, one small quad
        // per consecutive same-direction pair rather than one big closed path — same technique
        // Ichimoku's own cloud fill below already uses, since which stop (and so the fill's own
        // color) is active can flip partway through.
        if (indicator.chandelierHighlightState ?? true) {
          ctx.save();
          ctx.globalAlpha = 0.12;
          for (let k = 1; k < cePoints.length; k++) {
            const prev = cePoints[k - 1];
            const curr = cePoints[k];
            if (prev.value.dir !== curr.value.dir) continue;
            const stop0 = prev.value.dir === 1 ? prev.value.longStop : prev.value.shortStop;
            const stop1 = curr.value.dir === 1 ? curr.value.longStop : curr.value.shortStop;
            const candle0 = data[prev.i];
            const candle1 = data[curr.i];
            const mid0 = (candle0.open + candle0.high + candle0.low + candle0.close) / 4;
            const mid1 = (candle1.open + candle1.high + candle1.low + candle1.close) / 4;
            const x0 = zoomedXScale(prev.i + 0.5);
            const x1 = zoomedXScale(curr.i + 0.5);
            ctx.fillStyle = curr.value.dir === 1 ? ceUpColor : ceDownColor;
            ctx.beginPath();
            ctx.moveTo(x0, zoomedPriceScale(mid0));
            ctx.lineTo(x1, zoomedPriceScale(mid1));
            ctx.lineTo(x1, zoomedPriceScale(stop1));
            ctx.lineTo(x0, zoomedPriceScale(stop0));
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }

        // A small dot, plus (optionally) a pill badge ("Achat"/"Vente"), at the exact bar `dir`
        // flips — Pine's own `plotshape(..., style=shape.circle)` and `shape.labelup/labeldown`.
        for (const p of cePoints) {
          if (!p.value.buySignal && !p.value.sellSignal) continue;
          const isBuy = p.value.buySignal;
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(isBuy ? p.value.longStop : p.value.shortStop);
          const signalColor = isBuy ? ceUpColor : ceDownColor;
          ctx.beginPath();
          ctx.fillStyle = signalColor;
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          if (indicator.chandelierShowLabels ?? true) {
            drawPillLabel(ctx, x, isBuy ? y + 18 : y - 18, isBuy ? "Achat" : "Vente", signalColor, colorBg, fontFamily, "center");
          }
        }
      } else if (indicator.kind === "ichimoku") {
        const icPoints = points as { i: number; value: IndicatorIchimokuPoint }[];
        // Cloud: a small quad per consecutive pair that has both spans, rather than one big
        // closed path — the winning span (and so the fill color, bullish vs. bearish) can flip
        // partway through, needing a fresh color exactly at that crossing point.
        ctx.save();
        ctx.globalAlpha = 0.12;
        for (let k = 1; k < icPoints.length; k++) {
          const { spanA: a0, spanB: b0 } = icPoints[k - 1].value;
          const { spanA: a1, spanB: b1 } = icPoints[k].value;
          if (a0 === null || b0 === null || a1 === null || b1 === null) continue;
          const x0 = zoomedXScale(icPoints[k - 1].i + 0.5);
          const x1 = zoomedXScale(icPoints[k].i + 0.5);
          ctx.fillStyle = a0 + a1 >= b0 + b1 ? colorUp : colorDown;
          ctx.beginPath();
          ctx.moveTo(x0, zoomedPriceScale(a0));
          ctx.lineTo(x1, zoomedPriceScale(a1));
          ctx.lineTo(x1, zoomedPriceScale(b1));
          ctx.lineTo(x0, zoomedPriceScale(b0));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Four lines, each walked independently since the five components warm up at different
        // rates (some fields can be null while others on the same point aren't) — lifting the pen
        // across any null gap instead of connecting straight across it. Conventional fixed colors
        // (not `indicator.color`, which can't represent five differently-colored lines) — same
        // reasoning Supertrend's own up/down colors aren't user-configurable either.
        const strokeIchimokuField = (get: (v: IndicatorIchimokuPoint) => number | null, lineColor: string, dashed: boolean) => {
          ctx.save();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1.25;
          ctx.setLineDash(dashed ? [4, 3] : []);
          ctx.beginPath();
          let drawing = false;
          for (const p of icPoints) {
            const v = get(p.value);
            if (v === null) {
              drawing = false;
              continue;
            }
            const x = zoomedXScale(p.i + 0.5);
            const y = zoomedPriceScale(v);
            if (!drawing) {
              ctx.moveTo(x, y);
              drawing = true;
            } else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        };
        strokeIchimokuField((v) => v.conversion, "#e0a95c", false);
        strokeIchimokuField((v) => v.base, "#6c87c9", false);
        strokeIchimokuField((v) => v.spanA, colorUp, false);
        strokeIchimokuField((v) => v.spanB, colorDown, false);
        strokeIchimokuField((v) => v.chikou, colorMuted, true);
      } else if (indicator.kind === "parabolicSar") {
        // Dots, not a connected line — real Parabolic SAR jumps discontinuously at every trend
        // flip, so a line through consecutive points would draw a misleading diagonal across the
        // flip instead of the dots-flip-sides-of-price reading every trading platform shows.
        // Colored by which side of price each dot is actually on (a plain price value has no
        // trend flag of its own to read instead — see computeParabolicSARValues) rather than
        // `indicator.color`, matching Supertrend's own reasoning — sarUpColor/sarDownColor
        // override the chart's own up/down colors the same way supertrendUpColor/DownColor do.
        const sarPoints = points as { i: number; value: number }[];
        const sarUpColor = indicator.sarUpColor ?? colorUp;
        const sarDownColor = indicator.sarDownColor ?? colorDown;
        for (const p of sarPoints) {
          const candle = data[p.i];
          if (!candle) continue;
          const above = p.value > candle.close;
          ctx.fillStyle = above ? sarDownColor : sarUpColor;
          ctx.beginPath();
          ctx.arc(zoomedXScale(p.i + 0.5), zoomedPriceScale(p.value), 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (indicator.kind === "gaps") {
        // Rectangles, not a line — see IndicatorGapPoint's own doc. Faded once filled (still
        // shown, for context, but visually secondary to a still-open one).
        const gapPoints = points as { i: number; value: IndicatorGapPoint }[];
        for (const p of gapPoints) {
          const g = p.value;
          const x0 = zoomedXScale(p.i - 1 + 0.5);
          const x1 = zoomedXScale(g.endIndex + 0.5);
          const y0 = zoomedPriceScale(g.top);
          const y1 = zoomedPriceScale(g.bottom);
          ctx.save();
          ctx.globalAlpha = g.filled ? 0.08 : 0.18;
          ctx.fillStyle = g.direction === "up" ? colorUp : colorDown;
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          ctx.restore();
        }
      } else if (indicator.kind === "pivotPoints") {
        // Grouped into one segment per reference period (shared `periodStart` — see
        // IndicatorPivotPointsPoint's own doc) rather than one continuous line: each period's own
        // levels only ever apply across its own date range, the "staircase" every trading platform
        // draws for this indicator, unlike every line-shaped indicator above which is a single
        // continuous series spanning the whole visible window.
        const ppPoints = points as { i: number; value: IndicatorPivotPointsPoint }[];
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.font = `600 10px ${fontFamily}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        let groupStart = 0;
        for (let k = 0; k <= ppPoints.length; k++) {
          if (k < ppPoints.length && ppPoints[k].value.periodStart === ppPoints[groupStart].value.periodStart) continue;
          // "Show only the last pivot": every earlier group still needs walking (to find where
          // the final one actually starts), just not drawn — skip straight to advancing groupStart.
          const isLastGroup = k === ppPoints.length;
          if (indicator.pivotShowLastOnly && !isLastGroup) {
            groupStart = k;
            continue;
          }
          const first = ppPoints[groupStart];
          const last = ppPoints[k - 1];
          const x0 = zoomedXScale(first.i);
          const x1 = zoomedXScale(last.i + 1);
          const levels: [string, number][] = [
            ["R3", first.value.r3],
            ["R2", first.value.r2],
            ["R1", first.value.r1],
            ["PP", first.value.pp],
            ["S1", first.value.s1],
            ["S2", first.value.s2],
            ["S3", first.value.s3],
          ];
          for (const [label, price] of levels) {
            const y = snapPixel(zoomedPriceScale(price));
            const levelColor = label === "PP" ? color : colorMuted;
            ctx.strokeStyle = levelColor;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();
            ctx.fillStyle = levelColor;
            ctx.fillText(label, x0 + 2, y - 2);
          }
          groupStart = k;
        }
        ctx.restore();
      } else if (indicator.kind === "supportResistance") {
        // Every point in range shares the same ranked levels array (see
        // computeSupportResistanceValues) — reading it off the last one is just the simplest way
        // to get at it. Colored by whether the most recent close sits above (support) or below
        // (resistance) each — dynamic, not fixed to whichever side a level started on, since one
        // often flips role over time. Drawn from its own first touch out to the chart's right
        // edge (into "future" empty space, same as a "ray" drawing already extends), the usual
        // forward-projecting way a support/resistance line is actually used.
        const srPoints = points as { i: number; value: IndicatorSRLevel[] }[];
        const levels = srPoints.length > 0 ? srPoints[srPoints.length - 1].value : [];
        const lastClose = data.length > 0 ? data[data.length - 1].close : 0;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.font = `600 10px ${fontFamily}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        for (const level of levels) {
          const levelColor = lastClose >= level.price ? colorUp : colorDown;
          const x0 = zoomedXScale(level.startIndex);
          const y = snapPixel(zoomedPriceScale(level.price));
          ctx.strokeStyle = levelColor;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(dims.boundedWidth, y);
          ctx.stroke();
          ctx.fillStyle = levelColor;
          ctx.fillText(`${level.price.toFixed(2)} ×${level.touchCount}`, x0 + 2, y - 2);
        }
        ctx.restore();
      } else if (indicator.kind === "patternRecognition") {
        drawPatternRecognitionMatches(ctx, points as { i: number; value: IndicatorPatternMatch }[], params, style, color);
      } else if (indicator.kind === "candleRecognition") {
        drawCandleRecognitionMatches(ctx, points as { i: number; value: IndicatorCandleMatch }[], params, style);
      } else if (indicator.customData?.draw === "histogram") {
        // A custom overlay indicator drawn as bars — the price pane has no meaningful "zero"
        // baseline to bar-chart against the way an own-pane one does (see the own-pane branch's
        // own doc for that one), so bars run from the pane's own bottom edge up to each value
        // instead, same spirit as a volume pane's own bars running from its own floor.
        const numericPoints = points as { i: number; value: number }[];
        ctx.globalAlpha = isEink ? 0.35 : 0.6;
        ctx.fillStyle = isEink ? colorText : color;
        for (const p of numericPoints) {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value);
          ctx.fillRect(x - candleWidth / 2, y, Math.max(candleWidth, 1), priceHeight - y);
        }
        ctx.globalAlpha = 1;
      } else if (indicator.customData?.draw === "area") {
        const numericPoints = points as { i: number; value: number }[];
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.beginPath();
        numericPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          if (k === 0) ctx.moveTo(x, priceHeight);
          ctx.lineTo(x, zoomedPriceScale(p.value));
        });
        ctx.lineTo(zoomedXScale(numericPoints[numericPoints.length - 1].i + 0.5), priceHeight);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.lineWidth = indicator.customData?.lineWidth ?? 1.5;
        applyLineStyle(ctx, indicator.customData?.lineStyle);
        ctx.beginPath();
        numericPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (typeof points[0].value === "number") {
        ctx.lineWidth = indicator.customData?.lineWidth ?? 1.5;
        applyLineStyle(ctx, indicator.customData?.lineStyle);
        ctx.beginPath();
        points.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value as number);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else {
        // Band indicator (Bollinger, or a script/caller's own `CustomIndicatorDef` with
        // `draw: "band"` — both reach here identically, see that field's own doc): translucent
        // fill between the bands, thin upper/lower lines, and a solid middle line — the
        // conventional "channel" rendering.
        const bandPoints = points as { i: number; value: IndicatorBand }[];
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = color;
        ctx.beginPath();
        bandPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value.upper);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let k = bandPoints.length - 1; k >= 0; k--) {
          ctx.lineTo(zoomedXScale(bandPoints[k].i + 0.5), zoomedPriceScale(bandPoints[k].value.lower));
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        const bandLineWidth = indicator.customData?.lineWidth ?? 1;
        ctx.lineWidth = bandLineWidth;
        applyLineStyle(ctx, indicator.customData?.lineStyle);
        (["upper", "lower"] as const).forEach((key) => {
          ctx.beginPath();
          bandPoints.forEach((p, k) => {
            const x = zoomedXScale(p.i + 0.5);
            const y = zoomedPriceScale(p.value[key]);
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        });

        ctx.lineWidth = bandLineWidth + 0.5;
        ctx.beginPath();
        bandPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = zoomedPriceScale(p.value.middle);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.restore();
    });

    if (hovered && hoverY !== null) {
      ctx.save();
      ctx.strokeStyle = colorMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, hoverY);
      ctx.lineTo(dims.boundedWidth, hoverY);
      ctx.stroke();
      ctx.restore();
    }
}
