import type { Dispatch, SetStateAction } from "react";
import type * as d3 from "d3";
import { PlusIcon } from "../../../icons";
import { ChartEventTooltip } from "../../EventTooltip";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { ChartEvent } from "../interfaces/ChartEvent.interface";
import { indicatorCatalogEntry, defaultIndicatorColor } from "../indicatorCatalog";
import { CROSSHAIR_ADD_INSET, LIVE_COUNTDOWN_OFFSET } from "../constants";
import { EVENT_MARKER_OFFSET, EVENT_MARKER_RADIUS, EVENT_TOOLTIP_WIDTH, EVENT_TOOLTIP_GAP } from "../eventsCatalog";
import { formatCountdown, formatCompactNumber } from "../formatting";

// Kinds whose value shape this file's own "latest overlay value" badge doesn't understand (a
// plain number, or a band's own middle line) — see where this is used, below.
const OVERLAY_BADGE_EXCLUDED_KINDS: string[] = [
  "zigzag",
  "supertrend",
  "ichimoku",
  "gaps",
  "pivotPoints",
  "supportResistance",
  "patternRecognition",
  "candleRecognition",
];

export interface ChartHoverBadgesProps {
  hoverY: number | null;
  dims: { margin: { top: number; left: number; right: number }; boundedWidth: number; width: number };
  addPriceLine: () => void;
  zoomedPriceScale: d3.ScaleLinear<number, number>;
  priceAxisFmt: (value: number) => string;
  hoverVolumeY: number | null;
  priceHeight: number;
  volumeTop: number;
  addVolumeLine: () => void;
  zoomedVolumeScale: d3.ScaleLinear<number, number>;
  vFmt: (value: number) => string;
  hoverIndicatorPaneId: string | null;
  hoverIndicatorPaneY: number | null;
  addIndicatorPaneLine: () => void;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: d3.ScaleLinear<number, number>; offset: number };
  hovered: Candle | null;
  zoomedXScale: d3.ScaleLinear<number, number>;
  hoverIndex: number | null;
  plotBoundedHeight: number;
  dFmt: (date: Date) => string;
  addDateLine: () => void;
  livePrice: boolean;
  data: Candle[];
  clampToPriceAxis: (y: number) => number;
  now: number;
  showIndicators: boolean;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  visibleDrawings: TrendLineDrawing[];
  volumeVisible: boolean;
  pixelYForDrawing: (dr: TrendLineDrawing) => number;
  hoveredDrawingId: string | null;
  indexForDate: (date: Date) => number;
  activeEventStack: { i: number; events: ChartEvent[] } | null;
  eventModalOpen: boolean;
  plotHeight: number;
  setEventModalOpen: Dispatch<SetStateAction<boolean>>;
  setActiveEventStack: Dispatch<SetStateAction<{ i: number; events: ChartEvent[] } | null>>;
}

/** Every plain-DOM badge anchored to the plot's axes: the hover price/volume/date "+" badges
 *  (add a horizontal/vertical line at the cursor), the live last-close price plus its countdown
 *  to the next candle, each active price-overlay indicator's own latest-value badge, a
 *  horizontal/ray drawing's permanent value badge (and, while hovered, a ray's own start-date
 *  badge), and the event-stack tooltip popover. Plain DOM rather than SVG/canvas because some of
 *  it (the countdown) needs to re-render on its own timer, independent of the canvas draw
 *  effect. Purely presentational; every interaction is a callback prop. */
export function ChartHoverBadges({
  hoverY,
  dims,
  addPriceLine,
  zoomedPriceScale,
  priceAxisFmt,
  hoverVolumeY,
  priceHeight,
  volumeTop,
  addVolumeLine,
  zoomedVolumeScale,
  vFmt,
  hoverIndicatorPaneId,
  hoverIndicatorPaneY,
  addIndicatorPaneLine,
  paneScaleAndOffset,
  hovered,
  zoomedXScale,
  hoverIndex,
  plotBoundedHeight,
  dFmt,
  addDateLine,
  livePrice,
  data,
  clampToPriceAxis,
  now,
  showIndicators,
  indicatorValues,
  visibleDrawings,
  volumeVisible,
  pixelYForDrawing,
  hoveredDrawingId,
  indexForDate,
  activeEventStack,
  eventModalOpen,
  plotHeight,
  setEventModalOpen,
  setActiveEventStack,
}: ChartHoverBadgesProps) {
  return (
    <>
      {hoverY !== null && (
        // The badge itself is pinned flush to the axis boundary so it never bleeds into the
        // chart — only the standalone "+" button (own square, own background) is allowed to
        // Flush to the axis boundary and at least as wide as the axis gutter itself (min-width,
        // not width — a long price string must still be able to grow further right rather than
        // clip, exactly as before) so the badge reads as filling the axis, not a narrower chip
        // floating inside it. The "+" button lives inside this same flex row (stretched to its
        // full height via align-items: stretch, no border-radius/height of its own) so it reads
        // as one integrated piece — never a separate element overlapping the chart.
        <div
          className="lq-chart__axis-value lq-chart__axis-value--y"
          style={{ top: dims.margin.top + hoverY, left: dims.margin.left + dims.boundedWidth, minWidth: dims.margin.right }}
        >
          <button type="button" className="lq-chart__axis-value-add" onClick={addPriceLine} aria-label="Ajouter une ligne de prix horizontale">
            <PlusIcon size={9} />
          </button>
          <span className="lq-chart__axis-value-text">{priceAxisFmt(zoomedPriceScale.invert(hoverY))}</span>
        </div>
      )}
      {hoverVolumeY !== null && (
        <div
          className="lq-chart__axis-value lq-chart__axis-value--y"
          style={{
            top: dims.margin.top + priceHeight + volumeTop + hoverVolumeY,
            left: dims.margin.left + dims.boundedWidth,
            minWidth: dims.margin.right,
          }}
        >
          <button type="button" className="lq-chart__axis-value-add" onClick={addVolumeLine} aria-label="Ajouter une ligne de volume horizontale">
            <PlusIcon size={9} />
          </button>
          <span className="lq-chart__axis-value-text">{vFmt(zoomedVolumeScale.invert(hoverVolumeY))}</span>
        </div>
      )}
      {/* Same "+"-to-add badge as price/volume above, generalized to whichever "own"-pane
          indicator (RSI/CHOP/MACD/fundamentals) is currently hovered — hoverIndicatorPaneY is
          relative to that pane's own top (see useDrawingInteractions), so its absolute position
          needs that pane's own offset added back via paneScaleAndOffset. */}
      {hoverIndicatorPaneId !== null &&
        hoverIndicatorPaneY !== null &&
        (() => {
          const { scale, offset } = paneScaleAndOffset(hoverIndicatorPaneId);
          return (
            <div
              className="lq-chart__axis-value lq-chart__axis-value--y"
              style={{
                top: dims.margin.top + offset + hoverIndicatorPaneY,
                left: dims.margin.left + dims.boundedWidth,
                minWidth: dims.margin.right,
              }}
            >
              <button type="button" className="lq-chart__axis-value-add" onClick={addIndicatorPaneLine} aria-label="Ajouter une ligne horizontale">
                <PlusIcon size={9} />
              </button>
              <span className="lq-chart__axis-value-text">{formatCompactNumber(scale.invert(hoverIndicatorPaneY))}</span>
            </div>
          );
        })()}
      {hovered && (
        <>
          <div
            className="lq-chart__axis-value lq-chart__axis-value--x"
            style={{ left: dims.margin.left + zoomedXScale(hoverIndex! + 0.5), top: dims.margin.top + plotBoundedHeight }}
          >
            <span className="lq-chart__axis-value-text">{dFmt(hovered.date)}</span>
          </div>
          {/* A standalone square button (not englobed by the date badge below the plot, since
              that badge is unreachable — reaching it means leaving the interactive rect
              entirely). Anchored inside the plot instead, in line with the vertical
              crosshair. */}
          <button
            type="button"
            className="lq-chart__crosshair-add lq-chart__crosshair-add--x"
            style={{ left: dims.margin.left + zoomedXScale(hoverIndex! + 0.5), top: dims.margin.top + plotBoundedHeight - CROSSHAIR_ADD_INSET }}
            onClick={addDateLine}
            aria-label="Ajouter une ligne de date verticale"
          >
            <PlusIcon size={9} />
          </button>
        </>
      )}

      {/* Live last-close price (up/down colored against the previous close) and, right below
          it, a countdown to the next candle — the dashed line itself is canvas (see the draw
          effect), this is just its own Y-axis badge plus the countdown, both plain DOM since
          the countdown needs to re-render every second independent of the canvas. The interval
          is inferred from the last two candles' own dates, not a separate prop. */}
      {livePrice &&
        data.length > 0 &&
        (() => {
          const lastCandle = data[data.length - 1];
          const prevCandle = data.length > 1 ? data[data.length - 2] : null;
          const up = prevCandle ? lastCandle.close >= prevCandle.close : true;
          const y = dims.margin.top + clampToPriceAxis(zoomedPriceScale(lastCandle.close));
          const intervalMs = prevCandle ? lastCandle.date.getTime() - prevCandle.date.getTime() : null;
          const remainingMs = intervalMs ? lastCandle.date.getTime() + intervalMs - now : null;
          return (
            <>
              <div
                className="lq-chart__axis-value lq-chart__axis-value--y"
                style={{
                  top: y,
                  left: dims.margin.left + dims.boundedWidth,
                  minWidth: dims.margin.right,
                  backgroundColor: `var(${up ? "--lq-color-up" : "--lq-color-down"})`,
                }}
              >
                <span className="lq-chart__axis-value-text">{priceAxisFmt(lastCandle.close)}</span>
              </div>
              {remainingMs !== null && (
                <div
                  className="lq-chart__live-countdown"
                  style={{ top: y + LIVE_COUNTDOWN_OFFSET, left: dims.margin.left + dims.boundedWidth }}
                >
                  {formatCountdown(remainingMs)}
                </div>
              )}
            </>
          );
        })()}

      {/* Each active price-overlay indicator's own latest value, same axis-badge style,
          colored to match that indicator's own line instead of the theme accent. "own"-pane
          indicators (RSI/CHOP/MACD) already get axis ticks on their own separate scale below,
          so they're excluded here — this is price-pane overlays only (SMA/EMA/WMA/VWAP/
          Bollinger, whose "value" is a plain number; Bollinger's own band uses its middle
          line). */}
      {showIndicators &&
        indicatorValues.map(({ indicator, values }, idx) => {
          // ZigZag/Supertrend/Ichimoku/Gaps excluded here — none of them have a value shape this
          // generic "plain number, or a band's own middle line" badge understands (see the next
          // check below), and for ZigZag/Gaps specifically their "latest value" wouldn't be a
          // meaningful "right now" reading anyway (a stale confirmed pivot, or a gap rectangle
          // rather than a price at all) — each already gets its own on-chart labels instead
          // (ZigZag's HH/HL/LH/LL, Gaps' shaded rectangle). Parabolic SAR and a custom "line"/
          // "area"/"histogram" indicator are plain numbers, so they're deliberately *not* excluded
          // here — they get this badge exactly like SMA/EMA does.
          if (indicator.hidden || indicatorCatalogEntry(indicator).pane !== "price" || OVERLAY_BADGE_EXCLUDED_KINDS.includes(indicator.kind)) return null;
          const last = values[values.length - 1];
          if (last === null) return null;
          // Only ever a plain number (SMA/EMA/WMA/VWAP) or a band (Bollinger, use its middle
          // line) here — MACD's own shape only exists on the "own"-pane branch this filter
          // above already excludes, but the values array's type covers all three.
          const value = typeof last === "number" ? last : "middle" in last ? last.middle : null;
          if (value === null) return null;
          const color = indicator.color ?? defaultIndicatorColor(idx);
          return (
            <div
              key={indicator.id}
              className="lq-chart__axis-value lq-chart__axis-value--y"
              style={{
                top: dims.margin.top + clampToPriceAxis(zoomedPriceScale(value)),
                left: dims.margin.left + dims.boundedWidth,
                minWidth: dims.margin.right,
                backgroundColor: color,
              }}
            >
              <span className="lq-chart__axis-value-text">{priceAxisFmt(value)}</span>
            </div>
          );
        })}

      {/* A horizontal/ray line's own value, permanently on its own pane's axis (not just on
          hover, unlike the badges above) — same visual as the hover badge, minus its "+"
          button since there's nothing left to add. Anchored to whichever pane the line's
          `valueAxis` says (price, volume, or an own-pane indicator), same as the hover volume
          badge already does for volume specifically. Only clamped to stay within its own pane
          when that pane is price — volume/indicator ones are left unclamped, same as volume's
          badge always has been (no report of that being an issue in practice). */}
      {visibleDrawings
        .filter((dr) => (dr.lineType === "horizontal" || dr.lineType === "ray") && (dr.valueAxis !== "volume" || volumeVisible))
        .map((dr) => {
          const isPrice = !dr.valueAxis || dr.valueAxis === "price";
          const y = isPrice ? clampToPriceAxis(pixelYForDrawing(dr)) : pixelYForDrawing(dr);
          return (
            <div
              key={dr.id}
              className="lq-chart__axis-value lq-chart__axis-value--y"
              style={{
                top: dims.margin.top + y,
                left: dims.margin.left + dims.boundedWidth,
                minWidth: dims.margin.right,
              }}
            >
              <span className="lq-chart__axis-value-text">{isPrice ? priceAxisFmt(dr.y1) : dr.valueAxis === "volume" ? vFmt(dr.y1) : formatCompactNumber(dr.y1)}</span>
            </div>
          );
        })}

      {/* A "ray"'s own start date, only while its line is hovered (unlike the price badge
          above, which stays up permanently) — same X-axis badge style as the hover date
          badge, anchored to the line's own x1 instead of the live cursor position. */}
      {visibleDrawings
        .filter((dr) => dr.lineType === "ray" && dr.id === hoveredDrawingId)
        .map((dr) => (
          <div
            key={dr.id}
            className="lq-chart__axis-value lq-chart__axis-value--x"
            style={{ left: dims.margin.left + zoomedXScale(indexForDate(dr.x1) + 0.5), top: dims.margin.top + plotBoundedHeight }}
          >
            <span className="lq-chart__axis-value-text">{dFmt(dr.x1)}</span>
          </div>
        ))}

      {/* Anchored via left/bottom (not top) so its own content-driven height — capped at
          350px, see EventTooltip.css — never needs measuring just to keep its bottom edge
          pinned EVENT_TOOLTIP_GAP above the marker; see the component's own doc comment. Hidden
          (not unmounted-with-different-props) once the modal takes over, same as any other
          "expand" hand-off in this file. */}
      {activeEventStack &&
        !eventModalOpen &&
        (() => {
          const anchorX = dims.margin.left + zoomedXScale(activeEventStack.i + 0.5);
          const anchorY = dims.margin.top + (priceHeight - EVENT_MARKER_OFFSET);
          const tooltipWidth = Math.min(EVENT_TOOLTIP_WIDTH, dims.width);
          let left = anchorX - tooltipWidth / 2;
          left = Math.min(left, dims.width - tooltipWidth);
          left = Math.max(left, 0);
          const bottom = plotHeight - (anchorY - EVENT_MARKER_RADIUS - EVENT_TOOLTIP_GAP);
          return (
            <ChartEventTooltip
              events={activeEventStack.events}
              mode="popover"
              left={left}
              bottom={bottom}
              width={tooltipWidth}
              formatDate={dFmt}
              onExpand={() => setEventModalOpen(true)}
              onClose={() => setActiveEventStack(null)}
            />
          );
        })()}
    </>
  );
}
