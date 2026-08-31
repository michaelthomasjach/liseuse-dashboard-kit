import { useRef } from "react";
import type { RefObject } from "react";
import type * as React from "react";
import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import { useRenderSidePaneColumn } from "../hooks/useRenderSidePaneColumn";
import { computeDateTickValues } from "../hooks/useZoomAndScales";
import { SidePaneHeaders } from "./SidePaneHeaders";
import { ChartAxis } from "../../ChartAxis";
import type { DockSide } from "../hooks/useDockedPaneColumns";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import {
  SUB_PANE_COLLAPSED_HEIGHT,
  SIDE_DOCK_AXIS_WIDTH,
  SIDE_DOCK_AXIS_HEIGHT,
  SIDE_DOCK_HEADER_GAP,
  MIN_DATE_TICK_SPACING_PX_VERTICAL,
} from "../constants";

export interface ChartSidePaneColumnProps {
  side: DockSide;
  panelRef: RefObject<HTMLDivElement>;
  widthPx: number | null;
  defaultWidthPx: number;
  startResize: (e: React.PointerEvent) => void;
  columnWidth: number;
  plotBoundedHeight: number;
  /** Pushes this whole column down from the outer `.lq-chart` row's own top — see
   *  useDockedPaneColumnsState's own `topOffset` doc for why a flex *sibling* of `.lq-chart__main`
   *  needs this at all (it doesn't automatically inherit `.lq-chart__main`'s own `<ChartHeader>`
   *  space above its plot). */
  topOffset: number;
  themeTick: number;
  zoomedXScale: ScaleLinear<number, number>;
  candleWidth: number;
  paneIndicators: Indicator[];
  paneHeights: number[];
  paneTops: number[];
  zoomedPaneScales: Record<string, ScaleLinear<number, number>>;
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  /** Every indicator, every dock side combined — read-only, only for the canvas draw's own
   *  color-cycling (`defaultIndicatorColor(indicators.indexOf(ind))`, see
   *  `drawOwnPaneIndicatorSeries`'s own doc) so a given indicator's color stays consistent with
   *  wherever else it's referenced. Not the same array `commitIndicators` below reads/writes —
   *  see that prop's own doc. */
  indicators: Indicator[];
  data: Candle[];
  hoverIndex: number | null;
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  /** The CRUD-managed indicator list `commitIndicators`/`removeIndicator` actually operate on
   *  (never includes script-produced ones — see `usePaneLayout`'s own `extraIndicators` doc) —
   *  passed straight through to `SidePaneHeaders`, same split `PaneHeaders` already has between
   *  this and the combined list above. */
  commitTargetIndicators: Indicator[];
  commitIndicators: (indicators: Indicator[]) => void;
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onOpenIndicatorInfo: (kind: IndicatorKind | "volume") => void;
  onEditScript?: (scriptId: string) => void;
  dateTickFormat: (value: number) => string;
}

/** A `plot.pane(name, { dock: "left"|"right" })` script pane's own column — a flex sibling of
 *  `.lq-chart__main` in the outer `.lq-chart` row (same shape as `ChartSidePanel`'s own watchlist
 *  panel, see its own doc: this is what lets `.lq-chart__main` genuinely shrink to make room via
 *  ordinary flexbox, with zero changes needed to any of the axis/margin math the *main* plot's own
 *  16-odd files already read `dims` from). Its own small `<canvas>` (not part of the main plot's
 *  own canvas/DOM box) painted by `useRenderSidePaneColumn`/`renderSidePaneColumn.ts` — synced to
 *  the *same* candles as the main chart via `zoomedXScale` (the same pan/zoom `transform`,
 *  rescaling a scale ranged to this column's own width instead — computed by the caller, see
 *  CandlestickChart.tsx), not an interaction surface of its own: panning/zooming always happens on
 *  the main chart, this column just follows along.
 *
 *  Resizable only along its own axis (its width — the plan's own "je peux la bouger seulement sur
 *  l'axe sur laquelle elle est positionnée" requirement): the handle sits on whichever edge faces
 *  the main chart, dragging it grows/shrinks the *whole* column (every pane docked to this side
 *  shares one column width, same as they already share one column of vertical stacking — see
 *  usePaneLayout's own leftPaneIndicators/rightPaneIndicators doc). Each individual pane inside
 *  still resizes its own *height* via the ordinary top-divider drag (`startPaneResize`, unchanged
 *  from the bottom stack's own mechanism — it's already keyed by pane id, not by which stack the
 *  pane is in). */
export function ChartSidePaneColumn({
  side,
  panelRef,
  widthPx,
  defaultWidthPx,
  startResize,
  columnWidth,
  plotBoundedHeight,
  topOffset,
  themeTick,
  zoomedXScale,
  candleWidth,
  paneIndicators,
  paneHeights,
  paneTops,
  zoomedPaneScales,
  visibleIndicators,
  indicators,
  data,
  hoverIndex,
  startPaneResize,
  commitTargetIndicators,
  commitIndicators,
  indicatorLabel,
  openIndicatorSettings,
  removeIndicator,
  indicatorValues,
  onOpenIndicatorInfo,
  onEditScript,
  dateTickFormat,
}: ChartSidePaneColumnProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useRenderSidePaneColumn({
    canvasRef,
    wrapperRef: panelRef,
    themeTick,
    columnWidth,
    plotBoundedHeight,
    zoomedXScale,
    candleWidth,
    paneIndicators,
    paneHeights,
    paneTops,
    zoomedPaneScales,
    visibleIndicators,
    indicators,
  });

  // Reserved strips — toggled off `Indicator.sideAxesVisible` (default true, see its own doc), a
  // plain field on the runtime Indicator like every other Style-tab setting, not a `dock`-adjacent
  // one on customData. The *date* axis is vertical, on the column's own outer edge (facing away
  // from the main chart), reserving extra column *width* (SIDE_DOCK_AXIS_WIDTH) beyond the plot's
  // own resizable columnWidth. The *price* axis is horizontal, one per pane, at that pane's own
  // *bottom* — reserved by shrinking usePaneStackScales' own value range (`footerReserve`, applied
  // in useDockedPaneColumnsState.ts) rather than adding column height, so nothing here needs to
  // grow the group beyond plotBoundedHeight.
  const showAxes = paneIndicators.some((ind) => ind.sideAxesVisible !== false);
  const axisWidth = showAxes ? SIDE_DOCK_AXIS_WIDTH : 0;
  const headerReserve = SUB_PANE_COLLAPSED_HEIGHT + SIDE_DOCK_HEADER_GAP;
  const plotWidth = widthPx ?? defaultWidthPx;
  const plotLeft = side === "left" ? axisWidth : 0;
  // Same outer-edge convention the price axis used before this swap — still the side facing away
  // from the main chart, just carrying dates now instead of price (see this component's own doc
  // on why: a plain per-tick "16 Sep 2025"-style label needs its own full width to stay readable,
  // which only fits stacked *vertically* in a narrow column, not crammed side by side).
  const verticalAxisX = side === "right" ? columnWidth : axisWidth;
  const priceAxisFmt = (v: number) => Number(v).toFixed(2);

  return (
    <div
      className="lq-chart__side-dock-pane-group"
      style={{ position: "relative", flex: `0 0 ${plotWidth + axisWidth}px`, height: plotBoundedHeight, marginTop: topOffset }}
    >
      <div
        ref={panelRef}
        className={["lq-chart__side-dock-pane", `lq-chart__side-dock-pane--${side}`].join(" ")}
        style={{ position: "absolute", top: 0, left: plotLeft, width: plotWidth, height: plotBoundedHeight }}
      >
        <div
          className={["lq-chart__side-dock-pane-resize-handle", `lq-chart__side-dock-pane-resize-handle--${side}`].join(" ")}
          onPointerDown={startResize}
        />
        <canvas ref={canvasRef} className="lq-chart__canvas" style={{ top: 0, left: 0, width: columnWidth, height: plotBoundedHeight }} />
        <SidePaneHeaders
          paneIndicators={paneIndicators}
          paneTops={paneTops}
          startPaneResize={startPaneResize}
          SUB_PANE_COLLAPSED_HEIGHT={SUB_PANE_COLLAPSED_HEIGHT}
          data={data}
          hoverIndex={hoverIndex}
          commitIndicators={commitIndicators}
          indicators={commitTargetIndicators}
          indicatorLabel={indicatorLabel}
          openIndicatorSettings={openIndicatorSettings}
          removeIndicator={removeIndicator}
          indicatorValues={indicatorValues}
          onOpenIndicatorInfo={onOpenIndicatorInfo}
          onEditScript={onEditScript}
        />
      </div>
      {showAxes && (
        <svg className="lq-chart__side-dock-axes" width={plotWidth + axisWidth} height={plotBoundedHeight}>
          {paneIndicators.map((ind, idx) => {
            const valueScale = zoomedPaneScales[ind.id];
            const paneHeight = paneHeights[idx];
            if (ind.paneCollapsed || ind.sideAxesVisible === false || !valueScale || paneHeight <= 0) return null;
            const footerReserve = SIDE_DOCK_AXIS_HEIGHT;
            // Horizontal, at this pane's own bottom — its own value domain (already auto-fit by
            // usePaneStackScales) re-ranged onto the plot's own width instead of its own height.
            const horizontalPriceScale = d3.scaleLinear().domain(valueScale.domain()).range([0, columnWidth]);
            // Vertical, spanning the *same* [headerReserve, paneHeight - footerReserve] band the
            // value curve itself is drawn in (see usePaneStackScales' own header/footerReserve) —
            // visually aligned with the actual content, not the header/footer strips around it.
            const verticalDateScale = d3.scaleLinear().domain(zoomedXScale.domain()).range([paneHeight - footerReserve, headerReserve]);
            const verticalTickValues = computeDateTickValues(
              verticalDateScale,
              data.length,
              paneHeight - footerReserve - headerReserve,
              MIN_DATE_TICK_SPACING_PX_VERTICAL
            );
            return (
              <g key={ind.id} transform={`translate(0, ${paneTops[idx]})`}>
                <ChartAxis
                  scale={horizontalPriceScale}
                  orientation="bottom"
                  transform={`translate(${plotLeft}, ${paneHeight - footerReserve})`}
                  ticks={3}
                  tickFormat={priceAxisFmt}
                />
                <ChartAxis
                  scale={verticalDateScale}
                  orientation={side === "right" ? "right" : "left"}
                  transform={`translate(${verticalAxisX}, 0)`}
                  tickValues={verticalTickValues}
                  tickFormat={dateTickFormat}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
