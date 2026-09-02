import { useRef } from "react";
import type { RefObject } from "react";
import type * as React from "react";
import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import { useRenderSidePaneColumn } from "../hooks/useRenderSidePaneColumn";
import { SidePaneHeaders } from "./SidePaneHeaders";
import { SideDockCollapsedStrip } from "./SideDockCollapsedStrip";
import { ChartAxis } from "../../ChartAxis";
import { computeProfileValueScale } from "../render/drawPaneProfile";
import type { DockSide } from "../hooks/useDockedPaneColumns";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { SUB_PANE_COLLAPSED_HEIGHT, SIDE_DOCK_AXIS_WIDTH, SIDE_DOCK_COLLAPSED_WIDTH } from "../constants";

export interface ChartSidePaneColumnProps {
  side: DockSide;
  panelRef: RefObject<HTMLDivElement>;
  widthPx: number | null;
  defaultWidthPx: number;
  startResize: (e: React.PointerEvent) => void;
  columnWidth: number;
  plotBoundedHeight: number;
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
  /** The main chart's own zoomed price scale — see SidePaneColumnRenderParams' own doc. Used by a
   *  `draw: "profile"` pane, both for its canvas and for its own price axis. */
  zoomedPriceScale: ScaleLinear<number, number>;
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  /** Every indicator, every dock side combined — read-only, only for the canvas draw's own
   *  color-cycling (`defaultIndicatorColor(indicators.indexOf(ind))`, see
   *  `drawOwnPaneIndicatorSeries`'s own doc) so a given indicator's color stays consistent with
   *  wherever else it's referenced. Not the same array `commitIndicators` below reads/writes —
   *  see that prop's own doc. */
  indicators: Indicator[];
  data: Candle[];
  hoverIndex: number | null;
  /** See SidePaneColumnRenderParams' own `hovered`/`hoverY` doc — also used here, beyond the canvas
   *  draw, to position a price badge on this column's own axis, mirroring `ChartHoverBadges`' main
   *  chart one. */
  hovered: Candle | null;
  hoverY: number | null;
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  /** Folds/unfolds one pane of this column — its own UI state rather than `Indicator.paneCollapsed`
   *  written through `commitIndicators`, see usePaneLayout's own `sidePaneCollapsed` doc. */
  toggleSidePaneCollapsed: (paneId: string, collapsed: boolean) => void;
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onOpenIndicatorInfo: (target: IndicatorInfoTarget) => void;
  onEditScript?: (scriptId: string) => void;
  /** Which candle indices (see computeDateTickValues) the shared date axis at the bottom of this
   *  column draws a tick at — computed against this column's own (narrower) width, not the main
   *  plot's, see useDockedPaneColumnsState's own leftDateTickValues/rightDateTickValues doc. */
  dateTickValues: number[];
  dateTickFormat: (value: number) => string;
}

/** A `plot.pane(name, { dock: "left"|"right" })` script pane's own column — a flex sibling of
 *  `.lq-chart__plot-column` inside `.lq-chart__main-row` (nested there, below `.lq-chart__main`'s
 *  own header, rather than a sibling of `.lq-chart__main` itself in the outer `.lq-chart` row, so
 *  that header's own background/border naturally spans this column's own width too — see
 *  CandlestickChart.tsx's own doc). Its own small `<canvas>` (not part of the main plot's
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
  marginBottom,
  themeTick,
  zoomedXScale,
  candleWidth,
  paneIndicators,
  paneHeights,
  paneTops,
  zoomedPaneScales,
  zoomedPriceScale,
  visibleIndicators,
  indicators,
  data,
  hoverIndex,
  hovered,
  hoverY,
  startPaneResize,
  toggleSidePaneCollapsed,
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
    side,
    zoomedPriceScale,
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
    hovered,
    hoverY,
  });

  // Reserved strips — toggled off `Indicator.sideAxesVisible` (default true, see its own doc), a
  // plain field on the runtime Indicator like every other Style-tab setting, not a `dock`-adjacent
  // one on customData. Both strips are *added* beyond the plot's own resizable box, mirroring how
  // the main plot's own dims.margin.right/bottom work — never carved out of it — so a caller that
  // turns axes off simply gets that space back rather than redistributing it.
  // A folded pane leaves the vertical stack entirely (see stackSidePanes' own doc) and becomes its
  // own vertical band instead, so the two groups are laid out independently from here down.
  const expandedPanes = paneIndicators.filter((ind) => !ind.paneCollapsed);
  const collapsedPanes = paneIndicators.filter((ind) => ind.paneCollapsed);
  const hasExpanded = expandedPanes.length > 0;

  const showAxes = hasExpanded && expandedPanes.some((ind) => ind.sideAxesVisible !== false);
  const axisWidth = showAxes ? SIDE_DOCK_AXIS_WIDTH : 0;
  const axisHeight = showAxes ? marginBottom : 0;
  // Fold every pane in the column and the plot box disappears altogether — the column is then just
  // its bands, and the main chart reclaims the rest of the row through ordinary flexbox.
  const plotWidth = hasExpanded ? (widthPx ?? defaultWidthPx) : 0;
  const foldedWidth = collapsedPanes.length * SIDE_DOCK_COLLAPSED_WIDTH;
  // Bands sit on the column's own *outer* edge — the direction a pane folds toward — so on a
  // left-docked column the [axis][plot] block starts after them rather than at the group's origin.
  const contentLeft = side === "left" ? foldedWidth : 0;
  const plotLeft = side === "left" ? axisWidth : 0;
  // Outer edge — facing away from the main chart — same convention the main plot's own price axis
  // uses on its far-right edge.
  const priceAxisX = side === "right" ? columnWidth : axisWidth;
  const priceAxisFmt = (v: number) => Number(v).toFixed(2);
  // Same compact SI-prefix format the main volume pane's own axis falls back to (CandlestickChart's
  // `vFmt`) — a profile's own value has no inherent unit (whatever a script's kernel/weighting
  // produces), so a generic magnitude format reads reasonably whether that's a raw density near 0
  // or a summed weight in the thousands.
  const profileValueFmt = (v: number) => d3.format(".2s")(v);

  // Whether the column's foot needs a rule drawn across it — see its own <line> below.
  const hasBottomAxis = paneIndicators.some(
    (ind, i) => !ind.paneCollapsed && ind.sideAxesVisible !== false && paneHeights[i] > 0
  );


  return (
    <div
      className="lq-chart__side-dock-pane-group"
      // height: 100% (not the plotBoundedHeight + axisHeight pixel value below, still used for
      // this group's own children) — same reasoning `.lq-chart__plot-column` already stretches to
      // 100% of `.lq-chart__main-row` instead of a JS-computed pixel height: this group is that
      // row's other flex item, and the two must land on the *exact* same real height (any drift
      // between a CSS-stretched sibling and a separately-computed pixel value here would show up
      // as the two columns' own axis lines/canvases ending at very slightly different heights).
      style={{ position: "relative", flex: `0 0 ${plotWidth + axisWidth + foldedWidth}px`, height: "100%" }}
    >
      {collapsedPanes.length > 0 && (
        <div
          className="lq-chart__side-dock-collapsed-rail"
          style={{ position: "absolute", top: 0, left: side === "left" ? 0 : plotWidth + axisWidth, width: foldedWidth, height: plotBoundedHeight }}
        >
          {collapsedPanes.map((ind) => (
            <SideDockCollapsedStrip key={ind.id} side={side} label={indicatorLabel(ind)} onExpand={() => toggleSidePaneCollapsed(ind.id, false)} />
          ))}
        </div>
      )}
      {hasExpanded && (
      <div
        ref={panelRef}
        className={["lq-chart__side-dock-pane", `lq-chart__side-dock-pane--${side}`].join(" ")}
        // `+ axisHeight`: this element's own border (see .lq-chart__side-dock-pane--left/--right)
        // is the rule separating the column from the chart, and it should run the column's whole
        // height — including the strip the value/date axis labels sit in, which `plotBoundedHeight`
        // stops just short of. Sized to the plot alone it ended level with the axis line and left
        // the last ~20px of the column open on both sides. The canvas below keeps its own
        // `plotBoundedHeight` (there is nothing to paint down there) and the headers are positioned
        // from the top, so only the border and the edge's own drag zone actually grow.
        style={{ position: "absolute", top: 0, left: contentLeft + plotLeft, width: plotWidth, height: plotBoundedHeight + axisHeight }}
      >
        <div
          className={["lq-chart__side-dock-pane-resize-handle", `lq-chart__side-dock-pane-resize-handle--${side}`].join(" ")}
          onPointerDown={startResize}
        />
        <canvas ref={canvasRef} className="lq-chart__canvas" style={{ top: 0, left: 0, width: columnWidth, height: plotBoundedHeight }} />
        <SidePaneHeaders
          side={side}
          toggleSidePaneCollapsed={toggleSidePaneCollapsed}
          paneIndicators={paneIndicators}
          paneTops={paneTops}
          startPaneResize={startPaneResize}
          SUB_PANE_COLLAPSED_HEIGHT={SUB_PANE_COLLAPSED_HEIGHT}
          data={data}
          hoverIndex={hoverIndex}
          indicatorLabel={indicatorLabel}
          openIndicatorSettings={openIndicatorSettings}
          removeIndicator={removeIndicator}
          indicatorValues={indicatorValues}
          onOpenIndicatorInfo={onOpenIndicatorInfo}
          onEditScript={onEditScript}
        />
      </div>
      )}
      {showAxes && (
        <svg
          className="lq-chart__side-dock-axes"
          style={{ left: contentLeft }}
          width={plotWidth + axisWidth}
          height={plotBoundedHeight + axisHeight}
        >
          {/* The rule closing the column at its foot, drawn edge to edge across the whole width —
              price gutter included, which is where the vertical axis and its labels sit and where
              the bottom axis's own line stops. A plain <line> rather than stretching that axis's
              own domain path through `domainExtent`: the path belongs to d3-axis, which rewrites it
              from an effect on every render, so anything set there is a value fighting its owner. */}
          {hasBottomAxis && (
            <line
              className="lq-chart-axis__domain"
              x1={0}
              x2={plotWidth + axisWidth}
              y1={plotBoundedHeight + 0.5}
              y2={plotBoundedHeight + 0.5}
            />
          )}
          {paneIndicators.map((ind, idx) => {
            // A profile pane's axis *is* the main chart's price axis (see drawPaneProfile) — same
            // scale, so the ticks it prints are the same prices at the same heights as the ones
            // beside the candles. It is not offset by the pane's own top either: that scale is
            // already expressed in the column's own coordinates.
            const isProfile = ind.customData?.draw === "profile";
            const scale = isProfile ? zoomedPriceScale : zoomedPaneScales[ind.id];
            if (ind.paneCollapsed || ind.sideAxesVisible === false || !scale || paneHeights[idx] <= 0) return null;
            return (
              <g key={ind.id} transform={isProfile ? undefined : `translate(0, ${paneTops[idx]})`}>
                {/* `domainExtent` spans the pane's *whole* height, not the scale's own (shorter)
                    range: `usePaneStackScales`'s own `headerReserve` deliberately pulls the top of
                    that range down by a header's worth of pixels so plotted values clear the pane
                    header above them, and without this the axis *line* stopped at that same inset
                    — visibly short of the pane's own top edge, with the gap wider the taller the
                    header. Ticks and series still use the reserved range; only the line is drawn
                    edge to edge, so it meets the pane divider above it and the date axis below.

                    A profile's own line runs the height of the whole *column*, not of a pane: its
                    scale is the main chart's price scale, whose range only covers the price section
                    (see `isProfile` above), so left to itself the line stopped wherever the candles
                    stop — flush against the bottom of the chart when nothing else is stacked below
                    it, but leaving the column visibly open-ended the moment a sub-pane pushes the
                    price section up. Drawn to `plotBoundedHeight` it always meets the value axis at
                    the column's own foot. Ticks stay on the price scale either way, so they keep
                    labelling the same prices at the same heights as the candles beside them. */}
                <ChartAxis
                  scale={scale}
                  orientation={side === "right" ? "right" : "left"}
                  transform={`translate(${priceAxisX}, 0)`}
                  ticks={3}
                  tickFormat={priceAxisFmt}
                  domainExtent={isProfile ? [plotBoundedHeight, 0] : [paneHeights[idx], 0]}
                />
              </g>
            );
          })}
          {/* A profile pane's own value/magnitude axis — its "X axis" — at the same bottom slot the
              date axis below would otherwise occupy (see computeProfileValueScale's own doc for the
              shared scale). Rendered per profile indicator, same guard the price axis loop above
              uses, so a folded or axis-hidden profile draws neither. */}
          {paneIndicators.map((ind, idx) => {
            if (ind.customData?.draw !== "profile" || ind.paneCollapsed || ind.sideAxesVisible === false || paneHeights[idx] <= 0) return null;
            const valueScale = computeProfileValueScale(
              ind.customData?.profile ?? [],
              side,
              columnWidth,
              ind.customData?.profileHeadroom
            );
            if (!valueScale) return null;
            return (
              <ChartAxis
                key={`${ind.id}-value-axis`}
                scale={valueScale}
                orientation="bottom"
                transform={`translate(${plotLeft}, ${plotBoundedHeight})`}
                ticks={3}
                tickFormat={profileValueFmt}
              />
            );
          })}
          {/* One shared date axis for the whole column, at its true bottom (plotBoundedHeight,
              *before* the added axisHeight strip) — exactly where the main plot's own date axis
              sits relative to its candles (see ChartCanvasOverlay.tsx's own `transform`), so the
              two line up at the same absolute height. */}
          {/* The column's shared date axis, suppressed when every pane in it is a profile: a
              profile's horizontal axis is the value, not time, so dates below it would label an
              axis that means nothing. A column mixing a profile with an ordinary time series still
              gets it, for the series that does run over time. */}
          {!expandedPanes.every((ind) => ind.customData?.draw === "profile") && (
            <ChartAxis
              scale={zoomedXScale}
              orientation="bottom"
              transform={`translate(${plotLeft}, ${plotBoundedHeight})`}
              tickValues={dateTickValues}
              tickFormat={dateTickFormat}
            />
          )}
        </svg>
      )}
      {/* The main chart's own hover-price badge, continued onto this column's own axis at the exact
          same pixel Y (see SidePaneColumnRenderParams' own `hoverY` doc for why no reprojection is
          needed) — same classes as ChartHoverBadges' main-chart one, so it looks identical, minus
          its "+ add price line" button (this column isn't a drawing surface, same reasoning
          renderSidePaneColumn's own doc gives for excluding drawings entirely). Anchored to the
          gutter `showAxes` already reserves (`axisWidth`), on whichever edge is this column's own
          outer one — text hugs the axis line itself (`flex-start` beside it on a right-docked
          column, `flex-end` on a left-docked one, where the line sits at the gutter's own *right*
          edge instead). */}
      {showAxes && hovered && hoverY !== null && (
        <div
          className="lq-chart__axis-value lq-chart__axis-value--y"
          style={{
            top: hoverY,
            left: side === "right" ? contentLeft + priceAxisX : contentLeft,
            width: axisWidth,
            justifyContent: side === "right" ? "flex-start" : "flex-end",
          }}
        >
          <span className="lq-chart__axis-value-text">{priceAxisFmt(zoomedPriceScale.invert(hoverY))}</span>
        </div>
      )}
    </div>
  );
}
