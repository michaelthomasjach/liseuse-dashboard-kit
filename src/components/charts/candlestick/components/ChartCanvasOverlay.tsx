import type { RefObject, Dispatch, SetStateAction } from "react";
import type * as React from "react";
import * as d3 from "d3";
import { ChartAxis } from "../../ChartAxis";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { ChartEvent } from "../interfaces/ChartEvent.interface";
import { allPointsOf, snapPixel } from "../drawingGeometry";
import { isFundamentalKind, formatFundamentalValue } from "../indicatorCatalog";
import { AXIS_HANDLE_FRACTION_X, AXIS_HANDLE_FRACTION_Y } from "../constants";
import { EVENT_MARKER_OFFSET, EVENT_MARKER_RADIUS, EVENT_STACK_OFFSET, MAX_STACKED_EVENT_MARKERS } from "../eventsCatalog";
import type { TextEntryState } from "../interfaces/TextEntryState.interface";
import type { EditingCellState } from "../interfaces/EditingCellState.interface";
import { TABLE_DEFAULT_ROWS, TABLE_DEFAULT_COLS } from "../constants";
import { tableCellRect } from "../drawingGeometry";

// One per TextEntryState.tool — module-scope since it depends on nothing render-specific.
const TEXT_ENTRY_PLACEHOLDERS: Record<TextEntryState["tool"], string> = {
  text: "Ajouter du texte",
  comment: "Ajouter un commentaire",
  note: "Ajouter une note",
  priceNote: "Ajouter une note",
  signpost: "Ajouter un signpost",
};

interface AxisDragHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export interface ChartCanvasOverlayProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  dims: { margin: { top: number; left: number; right: number; bottom: number }; boundedWidth: number; width: number | undefined };
  plotBoundedHeight: number;
  plotHeight: number;
  clipId: string;
  zoomedPriceScale: d3.ScaleLinear<number, number>;
  priceAxisFmt: (value: number) => string;
  volumeVisible: boolean;
  volumeCollapsed: boolean;
  priceHeight: number;
  volumeTop: number;
  zoomedVolumeScale: d3.ScaleLinear<number, number>;
  vFmt: (value: number) => string;
  handlePaneYAxisPointerDown: (paneId: string, size: number) => (e: React.PointerEvent) => void;
  handlePaneYAxisPointerMove: (e: React.PointerEvent) => void;
  handlePaneYAxisPointerUp: (e: React.PointerEvent) => void;
  resetPaneYAxis: (paneId: string) => void;
  volumeHeight: number;
  ownPaneIndicators: Indicator[];
  indicatorPaneTops: number[];
  indicatorPaneHeights: number[];
  zoomedOwnPaneScales: Record<string, d3.ScaleLinear<number, number>>;
  zoomedXScale: d3.ScaleLinear<number, number>;
  dateTickValues: number[];
  dateTickFormat: (value: number) => string;
  zoomRef: RefObject<SVGRectElement>;
  activeTool: DrawingToolType | null;
  handleOverlayPointerDown: (e: React.PointerEvent<SVGRectElement>) => void;
  handlePointerMove: (e: React.PointerEvent<SVGRectElement>) => void;
  handleOverlayPointerUp: (e: React.PointerEvent<SVGRectElement>) => void;
  handleOverlayClick: (e: React.MouseEvent<SVGRectElement>) => void;
  handleOverlayDoubleClick: (e: React.MouseEvent<SVGRectElement>) => void;
  yAxisWheelRef: RefObject<SVGRectElement>;
  yAxisDrag: AxisDragHandlers;
  resetYAxis: () => void;
  xAxisWheelRef: RefObject<SVGRectElement>;
  xAxisDrag: AxisDragHandlers;
  resetX: () => void;
  visibleDrawings: TrendLineDrawing[];
  hoveredDrawingId: string | null;
  indexForDate: (date: Date) => number;
  pixelYForDrawing: (dr: TrendLineDrawing) => number;
  handleAxisHandlePointerDown: (drawingId: string) => (e: React.PointerEvent<SVGCircleElement>) => void;
  handleAxisHandlePointerMove: (e: React.PointerEvent<SVGCircleElement>) => void;
  handleAxisHandlePointerUp: (e: React.PointerEvent<SVGCircleElement>) => void;
  handleEndpointPointerDown: (drawingId: string, pointIndex: number) => (e: React.PointerEvent<SVGCircleElement>) => void;
  handleEndpointPointerMove: (e: React.PointerEvent<SVGCircleElement>) => void;
  handleEndpointPointerUp: (e: React.PointerEvent<SVGCircleElement>) => void;
  measurePoints: { p1: DataPoint; p2: DataPoint } | null;
  handleMeasureHandlePointerDown: (point: "p1" | "p2") => (e: React.PointerEvent<SVGCircleElement>) => void;
  handleMeasureHandlePointerMove: (e: React.PointerEvent<SVGCircleElement>) => void;
  handleMeasureHandlePointerUp: (e: React.PointerEvent<SVGCircleElement>) => void;
  eventStacks: { i: number; events: ChartEvent[] }[];
  dFmt: (date: Date) => string;
  setEventModalOpen: Dispatch<SetStateAction<boolean>>;
  setActiveEventStack: Dispatch<SetStateAction<{ i: number; events: ChartEvent[] } | null>>;
  /** "text"/"comment" only — see useDrawingState's own `textEntry` doc. Bundled into one object
   *  (rather than 4 separate props) purely to keep CandlestickChart.tsx's own call site to a
   *  single new line — it's already at its 1000-line cap. */
  textEntry: {
    entry: TextEntryState | null;
    setEntry: (v: TextEntryState | null) => void;
    onCommit: () => void;
    onCancel: () => void;
  };
  /** "table" only — see useDrawingState's own `editingCell` doc. Same one-object bundling as
   *  `textEntry` above, same reasoning. */
  editingCell: {
    entry: EditingCellState | null;
    setEntry: (v: EditingCellState | null) => void;
    onCommit: () => void;
    onCancel: () => void;
  };
}

/** A drawing's own draggable point — the small always-visible accent-ring dot every handle site
 *  below used to render directly as a single `r=5` circle, now split into that same visible dot
 *  (`pointer-events: none`, purely decorative) plus a same-position invisible sibling that alone
 *  receives every pointer event. SVG hit-tests a shape's own painted geometry, so growing the
 *  visible dot itself to make it easier to land a fingertip on would also clutter dense
 *  multi-point drawings (Fibonacci extension, pitchforks, Elliott) with bigger rings; a
 *  same-position invisible circle grows only the *hit* area, and only on a coarse (touch) pointer
 *  (see `.lq-chart__drawing-handle-hitarea` in charts-shared.css) — zero change for mouse. */
function DrawingHandle({
  cx,
  cy,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  cx: number;
  cy: number;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGCircleElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <>
      <circle className="lq-chart__drawing-handle-hitarea" cx={cx} cy={cy} r={5} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      <circle className="lq-chart__drawing-handle" cx={cx} cy={cy} r={5} />
    </>
  );
}

/** A small "you can drag this axis" hint — a double-headed arrow in a pill, invisible until the
 *  axis-drag `<rect>` immediately before it in the DOM is hovered (see
 *  `.lq-chart__axis-drag:hover ~ .lq-chart__axis-hint` in charts-shared.css; a CSS reveal, not a
 *  JS one, so it needs no pointer-tracking state of its own). Always rendered right after that
 *  rect, centered at a fixed point within its own strip (see each call site's own `cx`/`cy`). */
function AxisHintIcon({ orientation, cx, cy }: { orientation: "x" | "y"; cx: number; cy: number }) {
  return (
    <g className="lq-chart__axis-hint" transform={`translate(${cx}, ${cy})`}>
      <circle className="lq-chart__axis-hint-bg" r={10} />
      {orientation === "y" ? (
        <path className="lq-chart__axis-hint-arrow" d="M0,-5 L0,5 M0,-5 L-3,-2 M0,-5 L3,-2 M0,5 L-3,2 M0,5 L3,2" />
      ) : (
        <path className="lq-chart__axis-hint-arrow" d="M-5,0 L5,0 M-5,0 L-2,-3 M-5,0 L-2,3 M5,0 L2,-3 M5,0 L2,3" />
      )}
    </g>
  );
}

/** The chart's canvas (candles/volume/indicators/drawings, all pixel-drawn — see the render
 *  effect) plus the SVG layer stacked on top of it: axes, the pan/zoom overlay rect, per-pane
 *  Y-axis drag/wheel strips, drawing/measure handles, and event markers. Purely presentational —
 *  every interaction is a callback prop from useZoomAndScales/useIndicatorPaneScales/
 *  useDrawingInteractions/useChartEvents. */
export function ChartCanvasOverlay({
  canvasRef,
  dims,
  plotBoundedHeight,
  plotHeight,
  clipId,
  zoomedPriceScale,
  priceAxisFmt,
  volumeVisible,
  volumeCollapsed,
  priceHeight,
  volumeTop,
  zoomedVolumeScale,
  vFmt,
  handlePaneYAxisPointerDown,
  handlePaneYAxisPointerMove,
  handlePaneYAxisPointerUp,
  resetPaneYAxis,
  volumeHeight,
  ownPaneIndicators,
  indicatorPaneTops,
  indicatorPaneHeights,
  zoomedOwnPaneScales,
  zoomedXScale,
  dateTickValues,
  dateTickFormat,
  zoomRef,
  activeTool,
  handleOverlayPointerDown,
  handlePointerMove,
  handleOverlayPointerUp,
  handleOverlayClick,
  handleOverlayDoubleClick,
  yAxisWheelRef,
  yAxisDrag,
  resetYAxis,
  xAxisWheelRef,
  xAxisDrag,
  resetX,
  visibleDrawings,
  hoveredDrawingId,
  indexForDate,
  pixelYForDrawing,
  handleAxisHandlePointerDown,
  handleAxisHandlePointerMove,
  handleAxisHandlePointerUp,
  handleEndpointPointerDown,
  handleEndpointPointerMove,
  handleEndpointPointerUp,
  measurePoints,
  handleMeasureHandlePointerDown,
  handleMeasureHandlePointerMove,
  handleMeasureHandlePointerUp,
  eventStacks,
  dFmt,
  setEventModalOpen,
  setActiveEventStack,
  textEntry,
  editingCell,
}: ChartCanvasOverlayProps) {
  const editingCellDrawing = editingCell.entry ? visibleDrawings.find((d) => d.id === editingCell.entry!.drawingId) : undefined;
  const editingCellRect =
    editingCellDrawing && editingCell.entry
      ? tableCellRect(
          zoomedXScale(indexForDate(editingCellDrawing.x1) + 0.5),
          zoomedPriceScale(editingCellDrawing.y1),
          zoomedXScale(indexForDate(editingCellDrawing.x2) + 0.5),
          zoomedPriceScale(editingCellDrawing.y2),
          editingCellDrawing.tableRows ?? TABLE_DEFAULT_ROWS,
          editingCellDrawing.tableCols ?? TABLE_DEFAULT_COLS,
          editingCell.entry.cellIndex
        )
      : null;
  return (
    <>
      <canvas
        ref={canvasRef}
        className="lq-chart__canvas"
        style={{
          left: dims.margin.left,
          top: dims.margin.top,
          width: dims.boundedWidth,
          height: plotBoundedHeight,
        }}
      />
      <svg className="lq-chart__svg" width={dims.width} height={plotHeight} role="img">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={dims.boundedWidth} height={plotBoundedHeight} />
          </clipPath>
        </defs>
        <g transform={`translate(${dims.margin.left}, ${dims.margin.top})`}>
          {/* priceHeight is 0 whenever a sub-pane is fullscreened (see usePaneLayout's own
              priceHeight formula) — without this, the axis would render its ticks against a
              degenerate zero-height scale, bunching every price label at the very top. */}
          {priceHeight > 0 && (
            <ChartAxis
              scale={zoomedPriceScale}
              orientation="right"
              transform={`translate(${dims.boundedWidth}, 0)`}
              tickFormat={(v) => priceAxisFmt(Number(v))}
            />
          )}

          {/* volumeHeight is 0 whenever some *other* pane is fullscreened (see usePaneLayout's
              own volumeHeight branch) — volumeVisible alone doesn't capture that, so without this
              the axis ticks/drag-rect/divider below would still render against a degenerate
              zero-height scale. */}
          {volumeVisible && volumeHeight > 0 && (
            <>
              {!volumeCollapsed && (
                <g transform={`translate(0, ${priceHeight + volumeTop})`}>
                  <ChartAxis
                    scale={zoomedVolumeScale}
                    orientation="right"
                    transform={`translate(${dims.boundedWidth}, 0)`}
                    ticks={2}
                    tickFormat={(v) => vFmt(Number(v))}
                  />
                  {/* Drag (or double-click to reset) the volume pane's own axis to rescale just
                      this pane vertically — same convention as the price axis's own strip,
                      independent of it and of every other pane's own rescale. */}
                  <rect
                    className="lq-chart__axis-drag lq-chart__axis-drag--y"
                    x={dims.boundedWidth}
                    y={0}
                    width={dims.margin.right}
                    height={volumeHeight}
                    onPointerDown={handlePaneYAxisPointerDown("volume", volumeHeight)}
                    onPointerMove={handlePaneYAxisPointerMove}
                    onPointerUp={handlePaneYAxisPointerUp}
                    onDoubleClick={() => resetPaneYAxis("volume")}
                  />
                  <AxisHintIcon orientation="y" cx={dims.boundedWidth + dims.margin.right / 2} cy={volumeHeight / 2} />
                </g>
              )}
              {/* Continues the canvas-drawn divider above volume (which only covers
                  [0, boundedWidth], the canvas's own extent) across the price axis's
                  tick-label column so the divider reaches the full chart width and visually
                  separates volume's own ticks from whatever's above it — priceHeight + volumeTop,
                  not always priceHeight, now that volume isn't necessarily right after price. */}
              <line
                className="lq-chart__price-volume-divider"
                x1={dims.boundedWidth}
                x2={dims.boundedWidth + dims.margin.right}
                y1={snapPixel(priceHeight + volumeTop)}
                y2={snapPixel(priceHeight + volumeTop)}
              />
            </>
          )}

          {/* Same pair (a few ticks + a divider extension into the price-axis label column) as
              volume above, once per "own"-pane indicator — zoomedOwnPaneScales is shared with
              the canvas draw effect so these ticks always land exactly on what's actually
              drawn, manual rescale included. A drag strip over the ticks lets that rescale
              happen in the first place, same convention as the price/volume axes. */}
          {ownPaneIndicators.map((ind, idx) => {
            const paneTop = priceHeight + indicatorPaneTops[idx];
            const paneHeight = indicatorPaneHeights[idx];
            const scale = zoomedOwnPaneScales[ind.id];
            if (!scale) return null;
            return (
              <g key={ind.id}>
                {!ind.paneCollapsed && (
                  <g transform={`translate(0, ${paneTop})`}>
                    <ChartAxis
                      scale={scale}
                      orientation="right"
                      transform={`translate(${dims.boundedWidth}, 0)`}
                      ticks={3}
                      tickFormat={
                        isFundamentalKind(ind.kind) ? (v) => formatFundamentalValue(ind.kind, Number(v), ind.fundamentalDisplayMode) : undefined
                      }
                    />
                    <rect
                      className="lq-chart__axis-drag lq-chart__axis-drag--y"
                      x={dims.boundedWidth}
                      y={0}
                      width={dims.margin.right}
                      height={paneHeight}
                      onPointerDown={handlePaneYAxisPointerDown(ind.id, paneHeight)}
                      onPointerMove={handlePaneYAxisPointerMove}
                      onPointerUp={handlePaneYAxisPointerUp}
                      onDoubleClick={() => resetPaneYAxis(ind.id)}
                    />
                    <AxisHintIcon orientation="y" cx={dims.boundedWidth + dims.margin.right / 2} cy={paneHeight / 2} />
                  </g>
                )}
                <line
                  className="lq-chart__price-volume-divider"
                  x1={dims.boundedWidth}
                  x2={dims.boundedWidth + dims.margin.right}
                  y1={snapPixel(paneTop)}
                  y2={snapPixel(paneTop)}
                />
              </g>
            );
          })}

          <ChartAxis
            scale={zoomedXScale}
            orientation="bottom"
            transform={`translate(0, ${plotBoundedHeight})`}
            tickValues={dateTickValues}
            tickFormat={dateTickFormat}
          />
          {/* The date axis's own domain line only spans [0, boundedWidth] — its own scale's
              range, i.e. the canvas/plot area — so it stopped short of the chart's actual
              right edge, leaving the price-axis label column above it without a matching
              line underneath. Same fix as the price/volume divider above: continue it across
              that column with a plain SVG line. */}
          <line
            className="lq-chart__axis-line-extension"
            x1={dims.boundedWidth}
            x2={dims.boundedWidth + dims.margin.right}
            y1={snapPixel(plotBoundedHeight)}
            y2={snapPixel(plotBoundedHeight)}
          />

          <rect
            ref={zoomRef}
            className={["lq-chart__overlay", activeTool && "lq-chart__overlay--drawing"].filter(Boolean).join(" ")}
            width={dims.boundedWidth}
            height={plotBoundedHeight}
            onPointerDown={handleOverlayPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handleOverlayPointerUp}
            onClick={handleOverlayClick}
            onDoubleClick={handleOverlayDoubleClick}
          />

          <rect
            ref={yAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--y"
            x={dims.boundedWidth}
            y={0}
            width={dims.margin.right}
            height={priceHeight}
            onPointerDown={yAxisDrag.onPointerDown}
            onPointerMove={yAxisDrag.onPointerMove}
            onPointerUp={yAxisDrag.onPointerUp}
            onDoubleClick={resetYAxis}
          />
          <AxisHintIcon orientation="y" cx={dims.boundedWidth + dims.margin.right / 2} cy={priceHeight / 2} />
          <rect
            ref={xAxisWheelRef}
            className="lq-chart__axis-drag lq-chart__axis-drag--x"
            x={0}
            y={plotBoundedHeight}
            width={dims.boundedWidth}
            height={dims.margin.bottom}
            onPointerDown={xAxisDrag.onPointerDown}
            onPointerMove={xAxisDrag.onPointerMove}
            onPointerUp={xAxisDrag.onPointerUp}
            onDoubleClick={resetX}
          />
          <AxisHintIcon orientation="x" cx={dims.boundedWidth / 2} cy={plotBoundedHeight + dims.margin.bottom / 2} />

          {/* Rendered last (on top of the zoom/pan overlay and axis-drag strips) so the handles
              actually receive pointer events instead of the overlay swallowing them first. */}
          <g clipPath={`url(#${clipId})`}>
            {visibleDrawings.map((dr) => {
              const isHovered = hoveredDrawingId === dr.id;
              if (!isHovered) return null;
              // A freehand stroke can have dozens of sampled points — individually draggable
              // handles for each would be impractical clutter, so it only moves as a whole
              // (the generic whole-body drag in handlePointerMove already covers that, no
              // per-type code needed there since it shifts every point — extraPoints included —
              // by the same pixel delta regardless of how many there are).
              if (dr.lineType === "brush") return null;
              // Data-driven (see onAddSymbolOverlay) — x1/y1/x2/y2 aren't real coordinates for
              // it (see its own doc comment), so there's nothing meaningful to drag by point or
              // as a whole (see handlePointerMove's own exclusion). Still hoverable/selectable/
              // deletable via Suppr and editable via double-click, same as brush above.
              if (dr.lineType === "symbolOverlay") return null;
              // Axis-constrained lines get a single handle at a fixed point along the axis
              // they don't move on (never at their data endpoints, which aren't meaningful
              // drag targets here — the whole line only has one degree of freedom).
              if (dr.lineType === "horizontal") {
                return (
                  <DrawingHandle
                    key={dr.id}
                    cx={dims.boundedWidth * AXIS_HANDLE_FRACTION_X}
                    cy={pixelYForDrawing(dr)}
                    onPointerDown={handleAxisHandlePointerDown(dr.id)}
                    onPointerMove={handleAxisHandlePointerMove}
                    onPointerUp={handleAxisHandlePointerUp}
                  />
                );
              }
              if (dr.lineType === "vertical") {
                return (
                  <DrawingHandle
                    key={dr.id}
                    cx={zoomedXScale(indexForDate(dr.x1) + 0.5)}
                    cy={plotBoundedHeight * AXIS_HANDLE_FRACTION_Y}
                    onPointerDown={handleAxisHandlePointerDown(dr.id)}
                    onPointerMove={handleAxisHandlePointerMove}
                    onPointerUp={handleAxisHandlePointerUp}
                  />
                );
              }
              // A ray's one handle sits right at its actual anchor point (unlike
              // horizontal/vertical's fixed-fraction handle) since that anchor is itself
              // meaningful and draggable in both axes.
              if (dr.lineType === "ray") {
                return (
                  <DrawingHandle
                    key={dr.id}
                    cx={zoomedXScale(indexForDate(dr.x1) + 0.5)}
                    cy={pixelYForDrawing(dr)}
                    onPointerDown={handleAxisHandlePointerDown(dr.id)}
                    onPointerMove={handleAxisHandlePointerMove}
                    onPointerUp={handleAxisHandlePointerUp}
                  />
                );
              }
              // An arrow marker's one handle sits at its own point, same as a ray's anchor
              // above — x2/y2 mirrors x1/y1 automatically (see handleAxisHandlePointerMove).
              // "text"/"comment"/"pin"/"flagMark"/"signpost" share the exact same single-point
              // shape (see the lineType's own doc), so they share this same handle instead of
              // falling through to the generic per-point loop below, which would otherwise draw
              // two overlapping handles at the same pixel (x1/y1 and x2/y2 both resolve to the
              // same point).
              if (["arrowUp", "arrowDown", "text", "comment", "pin", "flagMark", "signpost", "priceLabel"].includes(dr.lineType ?? "")) {
                return (
                  <DrawingHandle
                    key={dr.id}
                    cx={zoomedXScale(indexForDate(dr.x1) + 0.5)}
                    cy={zoomedPriceScale(dr.y1)}
                    onPointerDown={handleAxisHandlePointerDown(dr.id)}
                    onPointerMove={handleAxisHandlePointerMove}
                    onPointerUp={handleAxisHandlePointerUp}
                  />
                );
              }
              // Every point (x1/y1, x2/y2, and any extraPoints) gets its own independently
              // draggable handle via the same generic pointIndex-based handler — covers a
              // regular trend line/extended/fibonacci's two points and
              // fibonacciExtension/elliottCorrection/elliottImpulse's extra ones alike, with no
              // per-tool-specific handle code needed beyond channel's own 3rd (below), which
              // adjusts channelOffset instead of a raw point.
              const points = allPointsOf(dr);
              const x1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
              const x2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
              return (
                <g key={dr.id}>
                  {points.map((p, i) => (
                    <DrawingHandle
                      key={i}
                      cx={zoomedXScale(indexForDate(p.x) + 0.5)}
                      cy={zoomedPriceScale(p.y)}
                      onPointerDown={handleEndpointPointerDown(dr.id, i)}
                      onPointerMove={handleEndpointPointerMove}
                      onPointerUp={handleEndpointPointerUp}
                    />
                  ))}
                  {dr.lineType === "channel" && (
                    <DrawingHandle
                      cx={(x1 + x2) / 2}
                      cy={zoomedPriceScale((dr.y1 + dr.y2) / 2 + (dr.channelOffset ?? 0))}
                      onPointerDown={handleAxisHandlePointerDown(dr.id)}
                      onPointerMove={handleAxisHandlePointerMove}
                      onPointerUp={handleAxisHandlePointerUp}
                    />
                  )}
                </g>
              );
            })}
            {/* The measure tool's own two points, draggable to redefine the measurement after
                the tool has already deselected itself (see the "measure" branch of
                handleOverlayClick) — always shown while a measurement exists rather than
                hover-gated like the drawing handles above, since there's only ever at most one
                measurement on screen at a time. */}
            {measurePoints && (
              <>
                <DrawingHandle
                  cx={zoomedXScale(indexForDate(measurePoints.p1.x) + 0.5)}
                  cy={zoomedPriceScale(measurePoints.p1.y)}
                  onPointerDown={handleMeasureHandlePointerDown("p1")}
                  onPointerMove={handleMeasureHandlePointerMove}
                  onPointerUp={handleMeasureHandlePointerUp}
                />
                <DrawingHandle
                  cx={zoomedXScale(indexForDate(measurePoints.p2.x) + 0.5)}
                  cy={zoomedPriceScale(measurePoints.p2.y)}
                  onPointerDown={handleMeasureHandlePointerDown("p2")}
                  onPointerMove={handleMeasureHandlePointerMove}
                  onPointerUp={handleMeasureHandlePointerUp}
                />
              </>
            )}
          </g>

          {/* "note"/"priceNote" only, while their own live text input is open (see textEntry
              below) — the anchor-to-label line the committed drawing will have, previewed live
              since the tool itself already exits (see useDrawingInteractions' own note/priceNote
              branch) the moment this opens, so the regular activeTool-driven preview line further
              up (drawn on canvas, not here) is already gone by then. */}
          {textEntry.entry?.anchorPoint && (
            <line
              className="lq-chart__text-entry-preview-line"
              x1={zoomedXScale(indexForDate(textEntry.entry.anchorPoint.x) + 0.5)}
              y1={zoomedPriceScale(textEntry.entry.anchorPoint.y)}
              x2={zoomedXScale(indexForDate(textEntry.entry.point.x) + 0.5)}
              y2={zoomedPriceScale(textEntry.entry.point.y)}
            />
          )}

          {/* Rendered last, same reasoning as the drawing handles above — needs to sit on top
              of the pan/zoom overlay to receive the pointer events its own <title> tooltip
              (and, now, its click) depends on. Anchored to the price/volume divider (not the
              tallest/shortest visible candle) so the row stays put while panning/zooming. One
              group per `eventStacks` entry, not per raw event — several events sharing a candle
              index render as a small cascade of individually-colored/lettered circles, each
              nudged slightly up-and-right of the previous one (a fanned-out stack, like a hand
              of cards) rather than either fully overlapping into one indistinguishable blob or
              collapsing into a single generic "N" badge that hides which events are actually
              there. Capped at MAX_STACKED_EVENT_MARKERS individually-drawn circles — the
              topmost one becomes a "+N" overflow badge past that, so an unusually eventful bar
              can't make the cluster grow without bound. */}
          {eventStacks.length > 0 && (
            <g className="lq-chart__events">
              {eventStacks.map((stack) => {
                const cx = zoomedXScale(stack.i + 0.5);
                const cy = priceHeight - EVENT_MARKER_OFFSET;
                const stacked = stack.events.length > 1;
                const shown = stack.events.slice(0, MAX_STACKED_EVENT_MARKERS);
                const overflow = stack.events.length - shown.length;
                const title = stacked
                  ? `${stack.events.length} évènements — cliquer pour les afficher`
                  : `${dFmt(stack.events[0].date)} — ${stack.events[0].label}`;
                return (
                  <g
                    key={stack.i}
                    className="lq-chart__event-marker"
                    transform={`translate(${cx}, ${cy})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEventModalOpen(false);
                      setActiveEventStack({ i: stack.i, events: stack.events });
                    }}
                  >
                    <title>{title}</title>
                    <line x1={0} x2={0} y1={EVENT_MARKER_RADIUS} y2={priceHeight - cy} stroke={shown[0].color} strokeDasharray="2,2" />
                    {/* Invisible, cluster-wide sibling that alone widens the tap target on a
                        coarse (touch) pointer — same "grow only the hit area, not the visible
                        dot" reasoning as DrawingHandle's own hitarea circle, just sized (and
                        re-centered) to cover the whole fanned-out cluster rather than a single
                        circle. The marker's onClick lives on the parent <g>; a click landing on
                        this still-painted-but-transparent circle bubbles up to it exactly like
                        one landing on any visible circle below already does. */}
                    <circle
                      className="lq-chart__event-marker-hitarea"
                      r={EVENT_MARKER_RADIUS + (shown.length - 1) * (EVENT_STACK_OFFSET / 2)}
                      cx={(shown.length - 1) * (EVENT_STACK_OFFSET / 2)}
                      cy={-(shown.length - 1) * (EVENT_STACK_OFFSET / 2)}
                    />
                    {shown.map((event, i) => {
                      const isTop = i === shown.length - 1;
                      const glyph = isTop && overflow > 0 ? `+${overflow}` : (event.symbol ?? event.kind.charAt(0)).slice(0, 2).toUpperCase();
                      return (
                        <g key={i} transform={`translate(${i * EVENT_STACK_OFFSET}, ${-i * EVENT_STACK_OFFSET})`}>
                          <circle r={EVENT_MARKER_RADIUS} fill={isTop && overflow > 0 ? "var(--lq-color-accent)" : event.color} />
                          {/* dominantBaseline="central" alone renders visibly high in Chromium
                              for this glyph's own small font-size (see charts-shared.css) — a
                              manual dy nudge is the standard cross-browser fix for that
                              well-known SVG baseline quirk. */}
                          <text textAnchor="middle" dominantBaseline="central" dy="0.5">
                            {glyph}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>
      {/* "text"/"comment"/"note"/"priceNote" — a real HTML input, not anything canvas/SVG can
          offer an editable text cursor inside of, positioned at the click that opened it (see
          useDrawingState's own textEntry) and unmounted the moment it commits or cancels; the
          drawing itself only starts existing once that happens (see drawTextAndComment.ts/
          drawNote.ts for each one's own *committed* look). Absolutely positioned against
          `.lq-chart__plot` (`.lq-chart__canvas`'s own positioning context, see charts-shared.css),
          so it needs the same margin offset the canvas already adds via its own inline
          `left`/`top` above. */}
      {textEntry.entry && (
        <input
          type="text"
          autoFocus
          className="lq-chart__text-entry-input"
          style={{
            left: dims.margin.left + zoomedXScale(indexForDate(textEntry.entry.point.x) + 0.5),
            top: dims.margin.top + zoomedPriceScale(textEntry.entry.point.y),
            // "comment"/"note"/"priceNote" all grow upward from their own anchor (a comment's
            // bubble tail points down at it; a note's own label sits above the line it's attached
            // to, see drawNote.ts) — "text" grows downward instead (see commitTextEntry's own
            // textVerticalAlign: "bottom") — so only "text" is left un-pulled.
            transform: textEntry.entry.tool === "text" ? undefined : "translateY(-100%)",
          }}
          value={textEntry.entry.value}
          placeholder={TEXT_ENTRY_PLACEHOLDERS[textEntry.entry.tool]}
          onChange={(e) => textEntry.entry && textEntry.setEntry({ ...textEntry.entry, value: e.target.value })}
          onBlur={textEntry.onCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              textEntry.onCancel();
            } else if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
      )}
      {/* "table" only — sized/positioned to exactly fill the one cell being edited (see
          editingCellRect above), unlike textEntry's own input which only ever anchors to a point
          and grows with its content. */}
      {editingCell.entry && editingCellRect && (
        <input
          type="text"
          autoFocus
          className="lq-chart__table-cell-input"
          style={{
            left: dims.margin.left + editingCellRect.x,
            top: dims.margin.top + editingCellRect.y,
            width: editingCellRect.w,
            height: editingCellRect.h,
          }}
          value={editingCell.entry.value}
          onChange={(e) => editingCell.entry && editingCell.setEntry({ ...editingCell.entry, value: e.target.value })}
          onBlur={editingCell.onCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              editingCell.onCancel();
            } else if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
      )}
    </>
  );
}
