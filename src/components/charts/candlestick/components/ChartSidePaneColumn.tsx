import { useRef } from "react";
import type { RefObject } from "react";
import type * as React from "react";
import type { ScaleLinear } from "d3";
import { useRenderSidePaneColumn } from "../hooks/useRenderSidePaneColumn";
import { SidePaneHeaders } from "./SidePaneHeaders";
import { ChartAxis } from "../../ChartAxis";
import type { DockSide } from "../hooks/useDockedPaneColumns";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { SUB_PANE_COLLAPSED_HEIGHT, SIDE_DOCK_AXIS_WIDTH } from "../constants";

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
  /** `dims.margin.bottom` — see useDockedPaneColumnsState's own `marginBottom` doc: added beyond
   *  `plotBoundedHeight` for this column's own date axis, exactly like the main plot's own bottom
   *  margin, so the two line up at the same absolute height instead of this column falling short
   *  by however much room its axis needed. */
  marginBottom: number;
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
  /** Which candle indices (see computeDateTickValues) the shared date axis at the bottom of this
   *  column draws a tick at — computed against this column's own (narrower) width, not the main
   *  plot's, see useDockedPaneColumnsState's own leftDateTickValues/rightDateTickValues doc. */
  dateTickValues: number[];
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
  marginBottom,
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
  dateTickValues,
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
  // one on customData. Both strips are *added* beyond the plot's own resizable box, mirroring how
  // the main plot's own dims.margin.right/bottom work — never carved out of it — so a caller that
  // turns axes off simply gets that space back rather than redistributing it.
  const showAxes = paneIndicators.some((ind) => ind.sideAxesVisible !== false);
  const axisWidth = showAxes ? SIDE_DOCK_AXIS_WIDTH : 0;
  const axisHeight = showAxes ? marginBottom : 0;
  const plotWidth = widthPx ?? defaultWidthPx;
  const plotLeft = side === "left" ? axisWidth : 0;
  // Outer edge — facing away from the main chart — same convention the main plot's own price axis
  // uses on its far-right edge.
  const priceAxisX = side === "right" ? columnWidth : axisWidth;
  const priceAxisFmt = (v: number) => Number(v).toFixed(2);

  return (
    <div
      className="lq-chart__side-dock-pane-group"
      style={{ position: "relative", flex: `0 0 ${plotWidth + axisWidth}px`, height: plotBoundedHeight + axisHeight, marginTop: topOffset }}
    >
      {/* Backfills the gap `marginTop` opens above this column with the exact same background +
          bottom border `.lq-chart__header` (the timeframe/replay toolbar) already paints above
          `.lq-chart__main` — without this, that toolbar's own row visually stops at the main
          plot's own right edge instead of reading as one continuous bar all the way across to the
          watchlist panel. An empty div reusing that class rather than a new rule of its own, so it
          can never silently drift from the real header's own look. */}
      {topOffset > 0 && (
        <div className="lq-chart__header" style={{ position: "absolute", top: -topOffset, left: 0, width: "100%", height: topOffset }} />
      )}
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
        <svg className="lq-chart__side-dock-axes" width={plotWidth + axisWidth} height={plotBoundedHeight + axisHeight}>
          {paneIndicators.map((ind, idx) => {
            const scale = zoomedPaneScales[ind.id];
            if (ind.paneCollapsed || ind.sideAxesVisible === false || !scale || paneHeights[idx] <= 0) return null;
            return (
              <g key={ind.id} transform={`translate(0, ${paneTops[idx]})`}>
                <ChartAxis scale={scale} orientation={side === "right" ? "right" : "left"} transform={`translate(${priceAxisX}, 0)`} ticks={3} tickFormat={priceAxisFmt} />
              </g>
            );
          })}
          {/* One shared date axis for the whole column, at its true bottom (plotBoundedHeight,
              *before* the added axisHeight strip) — exactly where the main plot's own date axis
              sits relative to its candles (see ChartCanvasOverlay.tsx's own `transform`), so the
              two line up at the same absolute height. */}
          <ChartAxis
            scale={zoomedXScale}
            orientation="bottom"
            transform={`translate(${plotLeft}, ${plotBoundedHeight})`}
            tickValues={dateTickValues}
            tickFormat={dateTickFormat}
          />
        </svg>
      )}
    </div>
  );
}
