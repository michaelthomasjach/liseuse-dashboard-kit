import type { ScaleLinear } from "d3";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { IndicatorMACD } from "../interfaces/IndicatorMACD.interface";
import type { IndicatorADXPoint } from "../interfaces/IndicatorADXPoint.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";
import { defaultIndicatorColor, isFundamentalKind } from "../indicatorCatalog";
import { applyLineStyle } from "./drawPriceCandles";

/** One "own"-pane indicator's own series (RSI/CHOP/MACD/ADX/correlation/a fundamental/a
 *  `plot.pane`-produced custom line/area/histogram/band/multi pane), drawn into whatever clipped
 *  rect the caller has already `ctx.translate`d/clipped to — extracted out of
 *  `drawVolumeAndPanes.ts`'s own bottom-stack loop (which still calls this, unchanged in
 *  behavior) so a `plot.pane(name, { dock: "left"|"right" })` script pane's own column
 *  (`renderSidePaneColumn.ts`) can paint its own indicators the *exact* same way, against its own
 *  (differently-scaled) `zoomedXScale`/`width` instead of the main plot's — every reference to
 *  the main canvas' own `dims.boundedWidth` below is `width`, a plain parameter, for exactly that
 *  reason. Deliberately excludes the hover crosshair line and "horizontal"/"ray" drawings anchored
 *  to this pane (`hoverIndicatorPaneY`/`visibleDrawings` in the original) — those stay in
 *  `drawVolumeAndPanes.ts` itself, a bottom-stack-only affordance a docked side column doesn't
 *  offer in this first version. */
export function drawOwnPaneIndicatorSeries(
  ctx: CanvasRenderingContext2D,
  ind: Indicator,
  points: { i: number; value: IndicatorValue }[],
  zoomedXScale: (i: number) => number,
  candleWidth: number,
  width: number,
  indicators: Indicator[],
  scale: ScaleLinear<number, number>,
  style: ChartCanvasStyle
) {
  const { colorUp, colorDown, colorText, colorGrid, isEink } = style;
  const color = ind.color ?? defaultIndicatorColor(indicators.indexOf(ind));

  if (ind.kind === "rsi" || ind.kind === "chop") {
    // Reference levels are user-adjustable (rsiOverbought/rsiOversold, chopUpperThreshold/
    // chopLowerThreshold — see their own docs on Indicator) but default to exactly the
    // levels this block always drew before those settings existed.
    const levels =
      ind.kind === "rsi" ? [ind.rsiOversold ?? 30, ind.rsiOverbought ?? 70] : [ind.chopLowerThreshold ?? 38.2, ind.chopUpperThreshold ?? 61.8];
    ctx.save();
    ctx.strokeStyle = colorGrid;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    for (const level of levels) {
      const y = scale(level);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value as number);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else if (ind.kind === "correlation") {
    // Zero line unconditionally (same role MACD's own zero line plays just below), plus the
    // user-adjustable "strongly correlated" reference pair (correlationStrongThreshold — see
    // its own doc on Indicator) at +/- that value.
    ctx.save();
    ctx.strokeStyle = colorGrid;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    const threshold = ind.correlationStrongThreshold ?? 0.7;
    for (const level of [0, threshold, -threshold]) {
      const y = scale(level);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value as number);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else if (ind.kind === "macd") {
    const macdPoints = points as { i: number; value: IndicatorMACD }[];
    const zeroY = scale(0);

    ctx.save();
    ctx.strokeStyle = colorGrid;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.restore();

    if (ind.macdShowHistogram !== false) {
      const histUpColor = ind.macdHistogramUpColor ?? colorUp;
      const histDownColor = ind.macdHistogramDownColor ?? colorDown;
      for (const p of macdPoints) {
        if (p.value.histogram === null) continue;
        const x = zoomedXScale(p.i + 0.5);
        const y = scale(p.value.histogram);
        const up = p.value.histogram >= 0;
        ctx.globalAlpha = isEink ? (up ? 0.25 : 0.45) : 0.6;
        ctx.fillStyle = isEink ? colorText : up ? histUpColor : histDownColor;
        ctx.fillRect(x - candleWidth / 2, Math.min(y, zeroY), Math.max(candleWidth, 1), Math.abs(y - zeroY));
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    macdPoints.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value.macd);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = style.colorMuted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (const p of macdPoints) {
      if (p.value.signal === null) continue;
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value.signal);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  } else if (ind.kind === "adx") {
    // Three independent lines sharing this pane's own fixed 0-100 scale (see
    // useIndicatorPaneScales) — the ADX line itself in this indicator's own configurable
    // color (the "how strong" reading), +DI/-DI in their own configurable colors (the "which
    // direction" reading), defaulting to the chart's own up/down colors, same "leaving both
    // unset reproduces the exact prior behavior" convention as Supertrend/Parabolic SAR/
    // Chandelier Exit's own directional-color pairs — plus the user-adjustable "strong trend"
    // reference level (adxThreshold — see its own doc on Indicator).
    ctx.save();
    ctx.strokeStyle = colorGrid;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    const thresholdY = scale(ind.adxThreshold ?? 25);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.restore();

    const adxPoints = points as { i: number; value: IndicatorADXPoint }[];
    const strokeField = (get: (v: IndicatorADXPoint) => number, lineColor: string, lineWidth: number) => {
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      adxPoints.forEach((p, k) => {
        const x = zoomedXScale(p.i + 0.5);
        const y = scale(get(p.value));
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };
    strokeField((v) => v.plusDI, ind.adxPlusColor ?? colorUp, 1);
    strokeField((v) => v.minusDI, ind.adxMinusColor ?? colorDown, 1);
    strokeField((v) => v.adx, color, 1.5);
  } else if (ind.customData?.draw === "histogram") {
    // Same zero-baseline bar shape as MACD's own histogram above, just against this pane's
    // own auto-fit scale instead of MACD's fixed one — `scale(0)` still works as a baseline
    // even when the visible values never actually cross zero (e.g. a metric that's always
    // positive), since it just lands outside the pane's own clipped area rather than at some
    // meaningless position.
    const numericPoints = points as { i: number; value: number }[];
    const zeroY = scale(0);
    ctx.globalAlpha = isEink ? 0.35 : 0.6;
    ctx.fillStyle = isEink ? colorText : color;
    for (const p of numericPoints) {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value);
      ctx.fillRect(x - candleWidth / 2, Math.min(y, zeroY), Math.max(candleWidth, 1), Math.abs(y - zeroY));
    }
    ctx.globalAlpha = 1;
  } else if (ind.customData?.draw === "area") {
    const numericPoints = points as { i: number; value: number }[];
    const zeroY = scale(0);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    numericPoints.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      if (k === 0) ctx.moveTo(x, zeroY);
      ctx.lineTo(x, scale(p.value));
    });
    ctx.lineTo(zoomedXScale(numericPoints[numericPoints.length - 1].i + 0.5), zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    numericPoints.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else if (ind.customData?.draw === "multi") {
    // A `plot.pane("Nom").line/.area/.histogram/.band(...)` pane with 2+ of its own series —
    // same shape as the ADX branch above (several independent fields sharing this one pane's
    // own scale), generalized to an arbitrary, script-declared list instead of 3 fixed ones.
    const multiPoints = points as { i: number; value: { multi: Record<string, number | IndicatorBand | null> } }[];
    (ind.customData.multiSeries ?? []).forEach((subEntry, subIdx) => {
      const seriesColor = subEntry.color ?? defaultIndicatorColor(indicators.indexOf(ind) + subIdx);
      const seriesPoints = multiPoints.filter((p) => p.value.multi[subEntry.key] !== null);
      if (seriesPoints.length === 0) return;
      if (subEntry.draw === "band") {
        const bandSeriesPoints = seriesPoints as { i: number; value: { multi: Record<string, IndicatorBand> } }[];
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = seriesColor;
        ctx.beginPath();
        bandSeriesPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value.multi[subEntry.key].upper);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let k = bandSeriesPoints.length - 1; k >= 0; k--) {
          ctx.lineTo(zoomedXScale(bandSeriesPoints[k].i + 0.5), scale(bandSeriesPoints[k].value.multi[subEntry.key].lower));
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = seriesColor;
        ctx.lineWidth = subEntry.lineWidth ?? 1;
        applyLineStyle(ctx, subEntry.lineStyle);
        (["upper", "lower"] as const).forEach((key) => {
          ctx.beginPath();
          bandSeriesPoints.forEach((p, k) => {
            const x = zoomedXScale(p.i + 0.5);
            const y = scale(p.value.multi[subEntry.key][key]);
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        });
      } else if (subEntry.draw === "histogram") {
        const zeroY = scale(0);
        ctx.globalAlpha = isEink ? 0.35 : 0.6;
        ctx.fillStyle = isEink ? colorText : seriesColor;
        for (const p of seriesPoints) {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value.multi[subEntry.key] as number);
          ctx.fillRect(x - candleWidth / 2, Math.min(y, zeroY), Math.max(candleWidth, 1), Math.abs(y - zeroY));
        }
        ctx.globalAlpha = 1;
      } else {
        if (subEntry.draw === "area") {
          const zeroY = scale(0);
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = seriesColor;
          ctx.beginPath();
          seriesPoints.forEach((p, k) => {
            const x = zoomedXScale(p.i + 0.5);
            if (k === 0) ctx.moveTo(x, zeroY);
            ctx.lineTo(x, scale(p.value.multi[subEntry.key] as number));
          });
          ctx.lineTo(zoomedXScale(seriesPoints[seriesPoints.length - 1].i + 0.5), zeroY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = seriesColor;
        ctx.lineWidth = subEntry.lineWidth ?? 1.5;
        applyLineStyle(ctx, subEntry.lineStyle);
        ctx.beginPath();
        seriesPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value.multi[subEntry.key] as number);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    });
  } else {
    // Fundamental indicators (Free Cash Flow, Net Income, P/E…) and a custom "line"-draw one:
    // no fixed reference levels either way — unlike RSI/CHOP there's no universal
    // "overbought/oversold"-style threshold that would mean anything across arbitrary
    // metrics/companies. A fundamental's own `fundamentalChartStyle` (see its doc on
    // Indicator) picks "step"/"area" instead of the default plain diagonal line — a custom
    // indicator has no such setting and always gets the plain line.
    const numericPoints = points as { i: number; value: number }[];
    const lineStyle = isFundamentalKind(ind.kind) ? (ind.fundamentalChartStyle ?? "line") : "line";

    if (lineStyle === "area") {
      const zeroY = scale(0);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      ctx.beginPath();
      numericPoints.forEach((p, k) => {
        const x = zoomedXScale(p.i + 0.5);
        if (k === 0) ctx.moveTo(x, zeroY);
        ctx.lineTo(x, scale(p.value));
      });
      ctx.lineTo(zoomedXScale(numericPoints[numericPoints.length - 1].i + 0.5), zeroY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    numericPoints.forEach((p, k) => {
      const x = zoomedXScale(p.i + 0.5);
      const y = scale(p.value);
      if (k === 0) ctx.moveTo(x, y);
      else if (lineStyle === "step") {
        // A flat hold at the previous value's own height, then a vertical jump to this one —
        // the step function the underlying data (forward-filled between report dates) already
        // literally is, rather than "line"'s diagonal interpolation implying a gradual change
        // that didn't really happen.
        const prevY = scale(numericPoints[k - 1].value);
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
}
