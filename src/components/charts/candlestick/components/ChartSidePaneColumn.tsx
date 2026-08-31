import { useRef } from "react";
import type { RefObject } from "react";
import type * as React from "react";
import type { ScaleLinear } from "d3";
import { useRenderSidePaneColumn } from "../hooks/useRenderSidePaneColumn";
import { SidePaneHeaders } from "./SidePaneHeaders";
import type { DockSide } from "../hooks/useDockedPaneColumns";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { SUB_PANE_COLLAPSED_HEIGHT } from "../constants";

export interface ChartSidePaneColumnProps {
  side: DockSide;
  panelRef: RefObject<HTMLDivElement>;
  widthPx: number | null;
  defaultWidthPx: number;
  startResize: (e: React.PointerEvent) => void;
  columnWidth: number;
  plotBoundedHeight: number;
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

  return (
    <div
      ref={panelRef}
      className={["lq-chart__side-dock-pane", `lq-chart__side-dock-pane--${side}`].join(" ")}
      style={{ flex: `0 0 ${widthPx ?? defaultWidthPx}px`, height: plotBoundedHeight }}
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
  );
}
