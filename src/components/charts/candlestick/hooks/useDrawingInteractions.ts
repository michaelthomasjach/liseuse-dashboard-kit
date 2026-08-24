import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { TextEntryState } from "../interfaces/TextEntryState.interface";
import { MULTI_POINT_TOOLS } from "../drawingCatalog";
import { round4, channelOffsetFromClick, rangeForecastMaxMin, longShortPositionDefaults } from "../drawingGeometry";
import { distanceToDrawing } from "../drawingHitTest";
import type { HitTestContext } from "../drawingHitTest";
import { DRAWING_HIT_DISTANCE, CLICK_DRAG_THRESHOLD, POSITION_TOOL_DEFAULT_BARS } from "../constants";

/** Plain mutable ref shape (matches what `useRef` in another hook already returns) — used instead
 *  of React's own `RefObject<T>` because that type's `current` is only ever mutable when the ref
 *  is declared with `useRef` in *this* file; a same-shaped object merely passed through as a
 *  parameter type would otherwise type-check as read-only. */
interface MutableRef<T> {
  current: T;
}

export interface UseDrawingInteractionsArgs {
  data: Candle[];
  dims: { boundedWidth: number };
  plotBoundedHeight: number;
  priceHeight: number;
  volumeHeight: number;
  volumeTop: number;
  volumeVisible: boolean;
  volumeCollapsed: boolean;
  setHoverIndex: (v: number | null) => void;
  setHoverY: (v: number | null) => void;
  setHoverVolumeY: (v: number | null) => void;
  setHoverIndicatorPaneId: (v: string | null) => void;
  setHoverIndicatorPaneY: (v: number | null) => void;
  ownPaneIndicators: Indicator[];
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawingIdRef: MutableRef<number>;
  /** The style every freshly-placed drawing below is created with — see useDrawingState's own
   *  doc, edited live by FloatingDrawingToolbar while a tool is active. */
  defaultDrawingStyle: { color: string; textColor?: string; strokeWidth: number };
  activeTool: DrawingToolType | null;
  setActiveTool: (v: DrawingToolType | null) => void;
  pendingPoint: DataPoint | null;
  setPendingPoint: (v: DataPoint | null) => void;
  setPreviewPoint: (v: DataPoint | null) => void;
  pendingSecondPoint: DataPoint | null;
  setPendingSecondPoint: (v: DataPoint | null) => void;
  pendingExtraPoints: DataPoint[];
  setPendingExtraPoints: (v: DataPoint[] | ((prev: DataPoint[]) => DataPoint[])) => void;
  measurePoints: { p1: DataPoint; p2: DataPoint } | null;
  setMeasurePoints: (v: { p1: DataPoint; p2: DataPoint } | null | ((prev: { p1: DataPoint; p2: DataPoint } | null) => { p1: DataPoint; p2: DataPoint } | null)) => void;
  drawingsLocked: boolean;
  visibleDrawings: TrendLineDrawing[];
  setBrushPreview: (v: DataPoint[] | null) => void;
  brushPointsRef: MutableRef<DataPoint[]>;
  brushDrawingRef: MutableRef<boolean>;
  hoveredDrawingId: string | null;
  hoveredDrawingIdRef: MutableRef<string | null>;
  updateHoveredDrawingId: (id: string | null) => void;
  setSelectedDrawingId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setDraft: (d: TrendLineDrawing | null) => void;
  setEditModalTab: (t: "coords" | "text" | "style") => void;
  dragEndpointRef: MutableRef<{ id: string; pointIndex: number } | null>;
  dragAxisRef: MutableRef<{ id: string } | null>;
  dragMeasureRef: MutableRef<"p1" | "p2" | null>;
  dragMeasureBodyRef: MutableRef<{ startClientX: number; startClientY: number; orig: { p1: DataPoint; p2: DataPoint } } | null>;
  measureBodyHoveredRef: MutableRef<boolean>;
  dragLineRef: MutableRef<{ id: string; startClientX: number; startClientY: number; orig: TrendLineDrawing } | null>;
  isPanningYRef: MutableRef<boolean>;
  cancelDrawingTool: () => void;
  finalizeElbowArrow: () => void;
  magnetSnapPrice: (rawIndex: number, rawY: number) => number;
  zoomRef: MutableRef<SVGRectElement | null>;
  zoomedXScale: ScaleLinear<number, number>;
  zoomedPriceScale: ScaleLinear<number, number>;
  indexForDate: (d: Date) => number;
  dateForIndex: (rawIndex: number) => Date;
  priceScale: ScaleLinear<number, number>;
  resetZoom: () => void;
  yTransform: d3.ZoomTransform;
  setYTransform: (t: d3.ZoomTransform) => void;
  setYManuallyAdjusted: (v: boolean) => void;
  zoomable: boolean;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: ScaleLinear<number, number>; offset: number };
  pixelYForDrawing: (dr: TrendLineDrawing) => number;
  resolveValueAxisAtY: (mouseY: number) => string;
  overlayProjections: { drawing: TrendLineDrawing; mainReference: number; points: { i: number; price: number }[] }[];
  /** The "zoomIn" tool's own math — see its own click-handling branch below. `xScale` is the base
   *  (unzoomed) index-domain scale (distinct from `zoomedXScale` above, already rescaled by
   *  whatever transform is currently applied) since the whole point is computing a *fresh*
   *  transform independent of the current one, same as `useZoomAndScales`' own
   *  `initialVisibleCandles` effect already does. */
  xScale: ScaleLinear<number, number>;
  maxXZoom: number;
  setXTransformAnimated: (t: d3.ZoomTransform, duration?: number) => void;
  setTextEntry: (v: TextEntryState | null) => void;
}

/** Every pointer-driven interaction with drawings: placing a new one (click-to-place tools,
 *  brush's drag-to-place), dragging an existing one (whole body, a single endpoint, the measure
 *  tool's handles, an axis-constrained line's single handle), and the crosshair/hover-detection
 *  that drives which one is currently "hovered" (this library's stand-in for selection). Takes
 *  `useDrawingState`'s full state plus the zoom/pane scales (`useZoomAndScales`/
 *  `useIndicatorPaneScales`) needed to convert between pixels and data — kept as its own hook,
 *  separate from `useDrawingState`, specifically because of that extra scale dependency: state
 *  alone doesn't need it, only interpreting where a pointer event lands does. */
export function useDrawingInteractions({
  data,
  dims,
  plotBoundedHeight,
  priceHeight,
  volumeHeight,
  volumeTop,
  volumeVisible,
  volumeCollapsed,
  setHoverIndex,
  setHoverY,
  setHoverVolumeY,
  setHoverIndicatorPaneId,
  setHoverIndicatorPaneY,
  ownPaneIndicators,
  drawings,
  commitDrawings,
  drawingIdRef,
  defaultDrawingStyle,
  activeTool,
  setActiveTool,
  pendingPoint,
  setPendingPoint,
  setPreviewPoint,
  pendingSecondPoint,
  setPendingSecondPoint,
  pendingExtraPoints,
  setPendingExtraPoints,
  measurePoints,
  setMeasurePoints,
  drawingsLocked,
  visibleDrawings,
  setBrushPreview,
  brushPointsRef,
  brushDrawingRef,
  hoveredDrawingId,
  hoveredDrawingIdRef,
  updateHoveredDrawingId,
  setSelectedDrawingId,
  setEditingId,
  setDraft,
  setEditModalTab,
  dragEndpointRef,
  dragAxisRef,
  dragMeasureRef,
  dragMeasureBodyRef,
  measureBodyHoveredRef,
  dragLineRef,
  isPanningYRef,
  cancelDrawingTool,
  finalizeElbowArrow,
  magnetSnapPrice,
  zoomRef,
  zoomedXScale,
  zoomedPriceScale,
  indexForDate,
  dateForIndex,
  priceScale,
  resetZoom,
  yTransform,
  setYTransform,
  setYManuallyAdjusted,
  zoomable,
  paneScaleAndOffset,
  pixelYForDrawing,
  resolveValueAxisAtY,
  overlayProjections,
  xScale,
  maxXZoom,
  setXTransformAnimated,
  setTextEntry,
}: UseDrawingInteractionsArgs) {
  function toDataPoint(e: { clientX: number; clientY: number }): DataPoint {
    const rect = zoomRef.current!.getBoundingClientRect();
    const rawIndex = zoomedXScale.invert(e.clientX - rect.left);
    const rawY = zoomedPriceScale.invert(e.clientY - rect.top);
    return { x: dateForIndex(rawIndex), y: round4(magnetSnapPrice(rawIndex, rawY)) };
  }

  function handleOverlayClick(e: React.MouseEvent<SVGRectElement>) {
    if (!activeTool) {
      // A plain click on empty plot space (nothing hovered — a click that landed on an existing
      // drawing instead is handled by the pointerdown/pointerup pair below, which is what tells a
      // click apart from a body-drag) clears whatever's currently selected, same as Escape.
      if (!hoveredDrawingId) setSelectedDrawingId(null);
      return;
    }
    const point = toDataPoint(e);

    // Axis-constrained lines only have one degree of freedom, so a single click places them —
    // no pending/preview step like the free trend line below.
    if (activeTool === "horizontal") {
      const rect = zoomRef.current!.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const d0 = data[0].date;
      const d1 = data[data.length - 1].date;
      // Any pane the click landed in — price, volume, or an own-pane indicator (see
      // resolveValueAxisAtY/paneScaleAndOffset and TrendLineDrawing.valueAxis). Price alone
      // keeps going through `point` (already magnet-snapped by toDataPoint above) instead of a
      // fresh invert() here — magnet-snapping to the nearest OHLC only makes sense against price.
      const valueAxis = resolveValueAxisAtY(mouseY);
      const pane = paneScaleAndOffset(valueAxis);
      const value = valueAxis === "price" ? point.y : round4(pane.scale.invert(mouseY - pane.offset));
      const drawing: TrendLineDrawing = {
        id: `drawing-${drawingIdRef.current++}`,
        ...defaultDrawingStyle,
        x1: d0,
        y1: value,
        x2: d1,
        y2: value,
        lineType: "horizontal",
        ...(valueAxis !== "price" ? { valueAxis } : {}),
      };
      commitDrawings([...drawings, drawing]);
      cancelDrawingTool();
      return;
    }
    if (activeTool === "vertical") {
      const [p0, p1] = priceScale.domain() as [number, number];
      commitDrawings([
        ...drawings,
        { id: `drawing-${drawingIdRef.current++}`, ...defaultDrawingStyle, x1: point.x, y1: p0, x2: point.x, y2: p1, lineType: "vertical" },
      ]);
      cancelDrawingTool();
      return;
    }
    // Arrow markers are single-point, like horizontal/vertical — x2/y2 just mirrors x1/y1 (kept
    // in sync by both the generic whole-body drag and a dedicated single-handle case, see
    // handleEndpointPointerMove) so there's nothing meaningful a second point could add. "pin"/
    // "flagMark"/"priceLabel" share this exact same shape (see TrendLineDrawing.lineType's own
    // doc), so they share this branch too instead of duplicating it. (Explicit `||` chain, not
    // array.includes — `lineType: activeTool` just below needs activeTool actually narrowed.)
    if (activeTool === "arrowUp" || activeTool === "arrowDown" || activeTool === "pin" || activeTool === "flagMark" || activeTool === "priceLabel") {
      commitDrawings([
        ...drawings,
        { id: `drawing-${drawingIdRef.current++}`, ...defaultDrawingStyle, x1: point.x, y1: point.y, x2: point.x, y2: point.y, lineType: activeTool },
      ]);
      cancelDrawingTool();
      return;
    }
    // "elbowArrow" is an open-ended polyline: every click appends another point (1st into
    // pendingPoint, everything after into pendingExtraPoints) and the tool stays active — unlike
    // every other multi-point tool, there's no fixed point count to reach, so nothing here ever
    // commits or calls cancelDrawingTool(). Escape is what finalizes it (see the keydown effect
    // below), using however many points have been placed by then.
    if (activeTool === "elbowArrow") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      setPendingExtraPoints((prev) => [...prev, point]);
      setPreviewPoint(point);
      return;
    }
    // Measure doesn't create a `drawings` entry — its result is ephemeral (measurePoints, cleared
    // on Escape/tool switch). The tool deselects itself right after the 2nd click (unlike every
    // other tool, which stays active until Escape/reclick) — the completed measurement then stays
    // on screen with its own draggable handles (see the measure-handle drag functions below)
    // instead of disappearing, so re-clicking the tool button is what starts a fresh one.
    if (activeTool === "measure") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      setMeasurePoints({ p1: pendingPoint, p2: point });
      setPendingPoint(null);
      setPreviewPoint(null);
      setActiveTool(null);
      return;
    }
    // Same two-click shape as "measure" right above (place point 1, then point 2 deselects the
    // tool automatically) but the 2nd click drives an actual zoom instead of leaving anything on
    // the chart — animated to whatever X range the two clicked points span, same
    // `k = width / (x1 - x0)`, `tx = -k * x0` transform math `useZoomAndScales`' own
    // `initialVisibleCandles` effect already uses to fit a specific index range to the viewport.
    // Y is left alone here: re-engaging auto-fit (see setYManuallyAdjusted below) already lands it
    // correctly on whatever's now visible on X, without this needing its own price-range math.
    if (activeTool === "zoomIn") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      const i0 = indexForDate(pendingPoint.x);
      const i1 = indexForDate(point.x);
      const x0 = xScale(Math.min(i0, i1));
      const x1 = xScale(Math.max(i0, i1));
      if (x1 - x0 > 0) {
        const k = Math.min(maxXZoom, Math.max(1, dims.boundedWidth / (x1 - x0)));
        setXTransformAnimated(new d3.ZoomTransform(k, -k * x0, 0));
        setYManuallyAdjusted(false);
      }
      setPendingPoint(null);
      setPreviewPoint(null);
      setActiveTool(null);
      return;
    }
    // Same price/volume detection as "horizontal" above, but anchored at the clicked date
    // instead of the dataset's own start (see the "ray" rendering/hit-testing below, which draws
    // from that anchor to the plot's right edge only).
    if (activeTool === "ray") {
      const rect = zoomRef.current!.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const valueAxis = resolveValueAxisAtY(mouseY);
      const pane = paneScaleAndOffset(valueAxis);
      const value = valueAxis === "price" ? point.y : round4(pane.scale.invert(mouseY - pane.offset));
      const drawing: TrendLineDrawing = {
        id: `drawing-${drawingIdRef.current++}`,
        ...defaultDrawingStyle,
        x1: point.x,
        y1: value,
        x2: point.x,
        y2: value,
        lineType: "ray",
        ...(valueAxis !== "price" ? { valueAxis } : {}),
      };
      commitDrawings([...drawings, drawing]);
      cancelDrawingTool();
      return;
    }

    // "channel" needs a 3rd click (the tool's whole point): the first two fix line 1 exactly
    // like a regular trend line, the third sets a constant price offset for a second line
    // parallel to it — measured as the clicked point's own vertical distance from line 1 at
    // that same date, not a true perpendicular distance (same simplification most trading
    // platforms use for this tool).
    if (activeTool === "channel") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      if (!pendingSecondPoint) {
        setPendingSecondPoint(point);
        setPreviewPoint(point);
        return;
      }
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: pendingPoint.x, y1: pendingPoint.y, x2: pendingSecondPoint.x, y2: pendingSecondPoint.y,
          lineType: "channel",
          channelOffset: round4(channelOffsetFromClick(pendingPoint, pendingSecondPoint, point, indexForDate)),
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "disjointChannel": same first three clicks as "channel" (line 1's two points, then a 3rd
    // that sets a price offset the same way) — but instead of applying that offset as a constant
    // shift to a *parallel* line 2, it computes two independent points: extraPoints[0] (lined up
    // with x2/y2, "point 3") sits at the offset exactly like channel's line 2 would, and
    // extraPoints[1] (lined up with x1/y1, "point 4") is that same offset applied to point1's
    // price *mirrored* across point2's price level — 2*y2 - y1 + offset instead of plain y1 +
    // offset — so line 2 slopes the opposite way from line 1 instead of running parallel to it.
    // Both points are then ordinary, independently draggable ones (handled generically by
    // allPointsOf/the endpoint-drag system) for reshaping the angle by hand afterward.
    if (activeTool === "disjointChannel") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      if (!pendingSecondPoint) {
        setPendingSecondPoint(point);
        setPreviewPoint(point);
        return;
      }
      const offset = round4(channelOffsetFromClick(pendingPoint, pendingSecondPoint, point, indexForDate));
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: pendingPoint.x, y1: pendingPoint.y, x2: pendingSecondPoint.x, y2: pendingSecondPoint.y,
          lineType: "disjointChannel",
          extraPoints: [
            { x: pendingSecondPoint.x, y: round4(pendingSecondPoint.y + offset) },
            { x: pendingPoint.x, y: round4(2 * pendingSecondPoint.y - pendingPoint.y + offset) },
          ],
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "rangeForecast" only takes 2 clicks — the start, then a "direction" click that's never
    // itself stored, only used to derive where Max/Min first land (see rangeForecastMaxMin) —
    // both then ordinary, independently draggable points like any other tool's.
    if (activeTool === "rangeForecast") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      const { max, min } = rangeForecastMaxMin(point);
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: pendingPoint.x,
          y1: pendingPoint.y,
          x2: max.x,
          y2: max.y,
          lineType: "rangeForecast",
          extraPoints: [min],
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "longPosition"/"shortPosition" are single-click tools — entry is the click itself, target/
    // stop both derived immediately from it (see longShortPositionDefaults for the price side;
    // the date side is just a fixed bar offset, computed here since the pure geometry helper has
    // no access to indexForDate/dateForIndex) — then ordinary, independently draggable points like
    // any other tool's.
    if (activeTool === "longPosition" || activeTool === "shortPosition") {
      const { targetPrice, stopPrice } = longShortPositionDefaults(point.y, activeTool);
      const exitDate = dateForIndex(indexForDate(point.x) + POSITION_TOOL_DEFAULT_BARS);
      commitDrawings([
        ...drawings,
        { id: `drawing-${drawingIdRef.current++}`, ...defaultDrawingStyle, x1: point.x, y1: point.y, x2: exitDate, y2: targetPrice, lineType: activeTool, extraPoints: [{ x: exitDate, y: stopPrice }] },
      ]);
      cancelDrawingTool();
      return;
    }

    // "text"/"comment"/"signpost" don't commit a `drawings` entry on their own click at all —
    // they open a live textarea instead (see useDrawingState's own textEntry/commitTextEntry),
    // which is what actually creates the drawing once the user clicks away. Exits the tool
    // immediately so a further click elsewhere doesn't start a 2nd entry on top of the still-open
    // one.
    if (activeTool === "text" || activeTool === "comment" || activeTool === "signpost") {
      setTextEntry({ tool: activeTool, point, value: "" });
      cancelDrawingTool();
      return;
    }

    // "note"/"priceNote": same live-textarea entry as "text"/"comment" above, just reached after
    // a 2nd click (the anchor comes first, same pendingPoint/previewPoint staging every other
    // 2-click tool already uses for its own live preview line to the cursor — see
    // drawPriceDrawings.ts's fallback preview branch, which already draws a plain straight line
    // and so needs no dedicated case of its own for these two).
    if (activeTool === "note" || activeTool === "priceNote") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      setTextEntry({ tool: activeTool, point, anchorPoint: pendingPoint, value: "" });
      cancelDrawingTool();
      return;
    }

    // "fibonacciExtension"/"elliottCorrection"/"elliottImpulse" all collect more than two points
    // — the first two go through the same pendingPoint/pendingSecondPoint stages "channel" uses
    // above, the rest accumulate into pendingExtraPoints until MULTI_POINT_TOOLS' count for this
    // tool is reached, then commit with everything gathered.
    const multiPoint = MULTI_POINT_TOOLS[activeTool];
    if (multiPoint) {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      if (!pendingSecondPoint) {
        setPendingSecondPoint(point);
        setPreviewPoint(point);
        return;
      }
      const nextExtra = [...pendingExtraPoints, point];
      if (nextExtra.length < multiPoint.extraPoints) {
        setPendingExtraPoints(nextExtra);
        setPreviewPoint(point);
        return;
      }
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: pendingPoint.x,
          y1: pendingPoint.y,
          x2: pendingSecondPoint.x,
          y2: pendingSecondPoint.y,
          // MULTI_POINT_TOOLS only has entries for these (disjointChannel's own 4th point is
          // computed, not clicked, so it never reaches this generic branch — see MULTI_POINT_TOOLS'
          // own doc), guaranteed by `multiPoint` above — narrower than what TS can infer just from
          // the (wider-keyed) lookup being truthy.
          lineType: activeTool as
            | "fibonacciExtension"
            | "elliottCorrection"
            | "elliottImpulse"
            | "headShoulders"
            | "pitchfork"
            | "schiffPitchfork"
            | "modifiedSchiffPitchfork"
            | "insidePitchfork"
            | "rangeForecast",
          extraPoints: nextExtra,
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "trendline", "extended", "fibonacci", "rectangle", "zones" and "forecast" all share the
    // same 2-click flow — they only differ in how they're drawn (see the canvas draw effect) and,
    // for "rectangle"/"zones", hit-tested, not in how they're placed. "arrowLine" is the same flow
    // again but stays lineType-less like a plain trend line, just with arrowRight preset.
    if (!pendingPoint) {
      setPendingPoint(point);
      setPreviewPoint(point);
      return;
    }
    const drawing: TrendLineDrawing = {
      id: `drawing-${drawingIdRef.current++}`,
      ...defaultDrawingStyle,
      x1: pendingPoint.x,
      y1: pendingPoint.y,
      x2: point.x,
      y2: point.y,
      ...(activeTool === "extended" || activeTool === "fibonacci" || activeTool === "rectangle" || activeTool === "zones" || activeTool === "forecast"
        ? { lineType: activeTool }
        : {}),
      ...(activeTool === "arrowLine" ? { arrowRight: true } : {}),
    };
    commitDrawings([...drawings, drawing]);
    cancelDrawingTool();
  }

  function handleOverlayDoubleClick() {
    // A double-click/double-tap while drawing an in-progress elbowArrow finishes it — the same
    // touch-reachable finalize path re-tapping its own rail button now offers (see
    // finalizeElbowArrow's own doc); this one doesn't require switching tools first.
    if (activeTool === "elbowArrow") {
      finalizeElbowArrow();
      cancelDrawingTool();
      return;
    }
    if (activeTool) return;
    // Double-clicking a drawing edits it (existing behavior) — double-clicking empty plot space
    // resets the zoom instead, same gesture the axis strips already use for their own axis.
    if (!hoveredDrawingId) {
      resetZoom();
      return;
    }
    const dr = drawings.find((d) => d.id === hoveredDrawingId);
    if (!dr) return;
    setEditingId(dr.id);
    setDraft(dr);
    // Coordonnées/Texte don't apply to a symbolOverlay (see the modal's own tab filtering) — Style
    // is the only tab it actually has.
    setEditModalTab(dr.lineType === "symbolOverlay" ? "style" : "coords");
  }
  function handleEndpointPointerDown(drawingId: string, pointIndex: number) {
    return (e: React.PointerEvent<SVGCircleElement>) => {
      // Still stops propagation while locked — otherwise the blocked click would bubble up to
      // the overlay underneath and start a whole-body drag instead, defeating the lock entirely.
      e.stopPropagation();
      if (drawingsLocked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragEndpointRef.current = { id: drawingId, pointIndex };
    };
  }

  function handleEndpointPointerMove(e: React.PointerEvent<SVGCircleElement>) {
    const drag = dragEndpointRef.current;
    if (!drag) return;
    const point = toDataPoint(e);
    commitDrawings(
      drawings.map((d) => {
        if (d.id !== drag.id) return d;
        if (drag.pointIndex === 0) return { ...d, x1: point.x, y1: point.y };
        if (drag.pointIndex === 1) return { ...d, x2: point.x, y2: point.y };
        const extraPoints = [...(d.extraPoints ?? [])];
        extraPoints[drag.pointIndex - 2] = point;
        return { ...d, extraPoints };
      })
    );
  }

  function handleEndpointPointerUp(e: React.PointerEvent<SVGCircleElement>) {
    dragEndpointRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Redefines one of the measure tool's two completed points by dragging its handle — same
  // pointer-capture-on-the-handle pattern as a drawing endpoint above, just writing to
  // measurePoints instead of `drawings` (a measurement was never one to begin with).
  function handleMeasureHandlePointerDown(point: "p1" | "p2") {
    return (e: React.PointerEvent<SVGCircleElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragMeasureRef.current = point;
    };
  }

  function handleMeasureHandlePointerMove(e: React.PointerEvent<SVGCircleElement>) {
    const point = dragMeasureRef.current;
    if (!point) return;
    const next = toDataPoint(e);
    setMeasurePoints((mp) => (mp ? { ...mp, [point]: next } : mp));
  }

  function handleMeasureHandlePointerUp(e: React.PointerEvent<SVGCircleElement>) {
    dragMeasureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Single-handle drag for an axis-constrained line: sets its value directly from the pointer's
  // absolute position (like the two-endpoint drag above), but along one axis only — a
  // "horizontal" line's handle only ever changes y1/y2 (kept equal), a "vertical" line's handle
  // only ever changes x1/x2 (kept equal).
  function handleAxisHandlePointerDown(drawingId: string) {
    return (e: React.PointerEvent<SVGCircleElement>) => {
      // Still stops propagation while locked — same reasoning as handleEndpointPointerDown above.
      e.stopPropagation();
      if (drawingsLocked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragAxisRef.current = { id: drawingId };
    };
  }

  function handleAxisHandlePointerMove(e: React.PointerEvent<SVGCircleElement>) {
    const drag = dragAxisRef.current;
    if (!drag) return;
    const dr = drawings.find((d) => d.id === drag.id);
    if (!dr) return;
    const rect = zoomRef.current!.getBoundingClientRect();
    if (dr.lineType === "horizontal") {
      const mouseY = e.clientY - rect.top;
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, y1: value, y2: value } : d)));
    } else if (dr.lineType === "vertical") {
      const mouseX = e.clientX - rect.left;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue } : d)));
    } else if (
      dr.lineType === "ray" ||
      ["arrowUp", "arrowDown", "pin", "flagMark", "text", "comment", "signpost", "priceLabel"].includes(dr.lineType ?? "")
    ) {
      // Both a ray's anchor and every single-point marker above have both degrees of freedom,
      // unlike horizontal/vertical's single axis — none of them are ever one of the pane-aware
      // lineTypes, so paneScaleAndOffset always resolves to price same as before.
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue, y1: value, y2: value } : d)));
    } else if (dr.lineType === "channel") {
      // A channel's 3rd handle only adjusts channelOffset (single axis, vertical) — line 1's own
      // two endpoints already have their own draggable handles, same as a regular trend line.
      // Recomputes the offset so line 2 passes through the new mouseY at the handle's own X (its
      // line 2 midpoint) — the midpoint's line-1 price simplifies to a plain average of y1/y2.
      const mouseY = e.clientY - rect.top;
      const midPrice = (dr.y1 + dr.y2) / 2;
      commitDrawings(
        drawings.map((d) => (d.id === drag.id ? { ...d, channelOffset: round4(zoomedPriceScale.invert(mouseY) - midPrice) } : d))
      );
    }
  }

  function handleAxisHandlePointerUp(e: React.PointerEvent<SVGCircleElement>) {
    dragAxisRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // The crosshair/quick-add-badge/nearest-drawing computation shared between plain hover
  // (handlePointerMove, continuously fired on mouse) and a touch tap's own pointerdown
  // (handleOverlayPointerDown) — a stationary tap isn't guaranteed to fire a pointermove first on
  // every mobile browser, so touch calls this directly on contact instead of only ever reacting
  // to movement. `hitDistance` widens the whole-line hover/drag-body hit test below for a touch
  // contact (see its own caller) — far less precise than a mouse pointer — without touching
  // DRAWING_HIT_DISTANCE, mouse's own precision.
  function updateHoverState(mouseX: number, mouseY: number, hitDistance: number) {
    const index = Math.min(data.length - 1, Math.max(0, Math.round(zoomedXScale.invert(mouseX) - 0.5)));
    setHoverIndex(index);
    setHoverY(mouseY <= priceHeight ? mouseY : null);
    // Bounded to volume's own [top, bottom) range (wherever it currently sits among the
    // indicator panes — see volumeTop), not just a bare "> priceHeight" — without both bounds,
    // hovering into an "own"-pane indicator (RSI/MACD/CHOP, which also satisfies mouseY >
    // priceHeight) incorrectly kept showing the volume hover line/badge there too, since nothing
    // distinguished "below the price section" from "specifically inside the volume pane".
    setHoverVolumeY(
      volumeVisible && !volumeCollapsed && mouseY > priceHeight + volumeTop && mouseY <= priceHeight + volumeTop + volumeHeight
        ? mouseY - priceHeight - volumeTop
        : null
    );
    // Same idea, generalized to whichever "own"-pane indicator (RSI/CHOP/MACD/fundamentals) the
    // pointer is currently over — resolveValueAxisAtY already knows every pane's own bounds, so
    // this only needs to filter its answer down to "an indicator, and it isn't collapsed" (a
    // collapsed pane is just its own header strip, same reasoning as volumeCollapsed above).
    if (mouseY > priceHeight) {
      const valueAxis = resolveValueAxisAtY(mouseY);
      const ind = valueAxis !== "price" && valueAxis !== "volume" ? ownPaneIndicators.find((i) => i.id === valueAxis) : undefined;
      if (ind && !ind.paneCollapsed) {
        setHoverIndicatorPaneId(ind.id);
        setHoverIndicatorPaneY(mouseY - paneScaleAndOffset(ind.id).offset);
      } else {
        setHoverIndicatorPaneId(null);
        setHoverIndicatorPaneY(null);
      }
    } else {
      setHoverIndicatorPaneId(null);
      setHoverIndicatorPaneY(null);
    }

    if (activeTool && pendingPoint) {
      setPreviewPoint({ x: dateForIndex(zoomedXScale.invert(mouseX)), y: zoomedPriceScale.invert(mouseY) });
    } else if (!activeTool && visibleDrawings.length > 0) {
      let closestId: string | null = null;
      let closestDist = hitDistance;
      const hitTestCtx: HitTestContext = { dims, plotBoundedHeight, priceHeight, zoomedXScale, zoomedPriceScale, indexForDate, pixelYForDrawing, overlayProjections, data };
      for (const dr of visibleDrawings) {
        const d = distanceToDrawing(dr, mouseX, mouseY, hitTestCtx);
        if (d < closestDist) {
          closestDist = d;
          closestId = dr.id;
        }
      }
      updateHoveredDrawingId(closestId);
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    if (data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Freehand capture: samples points into brushPointsRef (a ref, not state — pointermove can
    // fire faster than React re-renders, and the committed drawing on pointer up reads straight
    // from the ref instead of racing a stale closure over React state) throttled to roughly every
    // 3px of on-screen movement, so a slow stroke isn't hundreds of near-duplicate points. Mirrors
    // the same array into brushPreview state purely so the draw effect has something to render
    // live — the ref stays the single source of truth for what actually gets committed.
    if (brushDrawingRef.current) {
      const last = brushPointsRef.current[brushPointsRef.current.length - 1];
      if (last) {
        const lastX = zoomedXScale(indexForDate(last.x) + 0.5);
        const lastY = zoomedPriceScale(last.y);
        if (Math.hypot(mouseX - lastX, mouseY - lastY) < 3) return;
      }
      const point = toDataPoint(e);
      brushPointsRef.current = [...brushPointsRef.current, point];
      setBrushPreview(brushPointsRef.current);
      return;
    }

    if (dragMeasureBodyRef.current) {
      const drag = dragMeasureBodyRef.current;
      const dxPixels = e.clientX - drag.startClientX;
      const dyPixels = e.clientY - drag.startClientY;
      const shift = (p: DataPoint): DataPoint => {
        const origX = zoomedXScale(indexForDate(p.x) + 0.5);
        return {
          x: dateForIndex(zoomedXScale.invert(origX + dxPixels)),
          y: round4(zoomedPriceScale.invert(zoomedPriceScale(p.y) + dyPixels)),
        };
      };
      setMeasurePoints({ p1: shift(drag.orig.p1), p2: shift(drag.orig.p2) });
      return;
    }

    if (dragLineRef.current) {
      const drag = dragLineRef.current;
      const dxPixels = e.clientX - drag.startClientX;
      const dyPixels = e.clientY - drag.startClientY;
      if (drag.orig.lineType === "horizontal") {
        // Dragging the body moves it exactly like its single handle would — only the
        // perpendicular axis (here, whichever pane it's anchored to) can change.
        const { scale } = paneScaleAndOffset(drag.orig.valueAxis);
        const newValue = round4(scale.invert(scale(drag.orig.y1) + dyPixels));
        commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, y1: newValue, y2: newValue } : d)));
      } else if (drag.orig.lineType === "vertical") {
        const origX = zoomedXScale(indexForDate(drag.orig.x1) + 0.5);
        const newDate = dateForIndex(zoomedXScale.invert(origX + dxPixels));
        commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: newDate, x2: newDate } : d)));
      } else if (drag.orig.lineType === "ray") {
        // A ray has both degrees of freedom (unlike horizontal/vertical), so dragging its body
        // moves its one anchor point in both date and its own pane's value at once.
        const origX = zoomedXScale(indexForDate(drag.orig.x1) + 0.5);
        const newDate = dateForIndex(zoomedXScale.invert(origX + dxPixels));
        const { scale } = paneScaleAndOffset(drag.orig.valueAxis);
        const newValue = round4(scale.invert(scale(drag.orig.y1) + dyPixels));
        commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: newDate, x2: newDate, y1: newValue, y2: newValue } : d)));
      } else {
        const origX1 = zoomedXScale(indexForDate(drag.orig.x1) + 0.5);
        const origX2 = zoomedXScale(indexForDate(drag.orig.x2) + 0.5);
        const newX1 = dateForIndex(zoomedXScale.invert(origX1 + dxPixels));
        const newY1 = round4(zoomedPriceScale.invert(zoomedPriceScale(drag.orig.y1) + dyPixels));
        const newX2 = dateForIndex(zoomedXScale.invert(origX2 + dxPixels));
        const newY2 = round4(zoomedPriceScale.invert(zoomedPriceScale(drag.orig.y2) + dyPixels));
        // Any extraPoints (fibonacciExtension/elliottCorrection/elliottImpulse) move by the same
        // pixel delta as x1/x2, keeping the whole multi-point shape intact.
        const newExtraPoints = drag.orig.extraPoints?.map((p) => {
          const origX = zoomedXScale(indexForDate(p.x) + 0.5);
          return {
            x: dateForIndex(zoomedXScale.invert(origX + dxPixels)),
            y: round4(zoomedPriceScale.invert(zoomedPriceScale(p.y) + dyPixels)),
          };
        });
        commitDrawings(
          drawings.map((d) =>
            d.id === drag.id
              ? { ...d, x1: newX1, y1: newY1, x2: newX2, y2: newY2, ...(newExtraPoints ? { extraPoints: newExtraPoints } : {}) }
              : d
          )
        );
      }
      return;
    }

    if (isPanningYRef.current) return;

    // Kept current on every move (not just computed at drag-start) so it's already correct by
    // the time a *later* pointerdown needs it — see measureBodyHoveredRef's own doc for why.
    if (measurePoints) {
      const mx1 = zoomedXScale(indexForDate(measurePoints.p1.x) + 0.5);
      const my1 = zoomedPriceScale(measurePoints.p1.y);
      const mx2 = zoomedXScale(indexForDate(measurePoints.p2.x) + 0.5);
      const my2 = zoomedPriceScale(measurePoints.p2.y);
      measureBodyHoveredRef.current =
        mouseX >= Math.min(mx1, mx2) && mouseX <= Math.max(mx1, mx2) && mouseY >= Math.min(my1, my2) && mouseY <= Math.max(my1, my2);
    } else {
      measureBodyHoveredRef.current = false;
    }

    // A touch contact is a much blunter instrument than a mouse pointer, so it gets a wider
    // whole-line hit tolerance than DRAWING_HIT_DISTANCE alone would give a mouse.
    updateHoverState(mouseX, mouseY, e.pointerType === "touch" ? DRAWING_HIT_DISTANCE * 2 : DRAWING_HIT_DISTANCE);
  }

  // When hovering a drawing, starts a "drag the whole line" gesture — d3-zoom already backs off
  // in that case via the filter above, so capturing the pointer here doesn't compete with
  // anything. Otherwise starts an independent Y-pan via plain window listeners (same pattern
  // RangeSlider's drag uses) rather than a second setPointerCapture on the SAME overlay d3-zoom
  // is attached to — an earlier attempt did that, and it raced with d3-zoom's own native pointer
  // handling and broke X panning entirely. Window listeners never touch this element's pointer
  // capture, so d3-zoom's own gesture (handling X) is completely unaffected by this running
  // alongside it for Y.
  function handleOverlayPointerDown(e: React.PointerEvent<SVGRectElement>) {
    // Brush is the one drawing tool that places points by dragging instead of clicking — starts
    // capturing here instead of falling through to the click-based tools' shared handleOverlayClick.
    if (activeTool === "brush") {
      e.currentTarget.setPointerCapture(e.pointerId);
      const point = toDataPoint(e);
      brushDrawingRef.current = true;
      brushPointsRef.current = [point];
      setBrushPreview(brushPointsRef.current);
      return;
    }
    if (activeTool) return;
    // Touch has no hover: a stationary tap isn't guaranteed to fire a pointermove before this
    // (mobile browsers vary), and even when it does, "hovering a drawing" has to already be true
    // *before* this handler runs to reach the whole-body-drag branch below — there's simply
    // nothing to have hovered yet on a first touch. Computing it fresh, right here, off the touch
    // contact's own position is what makes tap-and-drag an existing line actually draggable on
    // the very first touch instead of always falling through to a Y-pan. Reads back via the ref
    // (not the `hoveredDrawingId` state param below) since updateHoverState's own setState call
    // hasn't re-rendered this closure yet — hoveredDrawingIdRef is the one thing it updates
    // synchronously (see its own doc in useDrawingState).
    if (e.pointerType === "touch") {
      const rect = e.currentTarget.getBoundingClientRect();
      updateHoverState(e.clientX - rect.left, e.clientY - rect.top, DRAWING_HIT_DISTANCE * 2);
    }
    const hoveredId = e.pointerType === "touch" ? hoveredDrawingIdRef.current : hoveredDrawingId;
    if (hoveredId) {
      // Locked: absorb the gesture instead of dragging the line OR falling through to Y-pan —
      // otherwise panning would shift the price scale under the (unmoved) line, breaking hit
      // testing at the original screen position. The drawing stays selectable/deletable/editable
      // (all driven by hover/double-click, untouched here), just not draggable.
      if (drawingsLocked) return;
      const dr = drawings.find((d) => d.id === hoveredId);
      // Data-driven, same reasoning "locked" absorbs the gesture above — there's no coordinate
      // for a whole-body drag to shift (see the lineType's own doc comment), and falling through
      // to Y-pan here would have the same hit-testing-drifts-under-you problem "locked" avoids.
      if (dr && dr.lineType === "symbolOverlay") return;
      if (dr) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragLineRef.current = { id: dr.id, startClientX: e.clientX, startClientY: e.clientY, orig: dr };
        return;
      }
    }
    // Pointer down inside the measurement's own rectangle (not on either handle, already handled
    // by handleMeasureHandlePointerDown before this ever fires) — drags the whole thing, moving
    // p1/p2 together instead of only ever being able to redefine one endpoint at a time. Reads
    // the hover ref (kept live by handlePointerMove) rather than re-deriving it here, since that's
    // also what useZoomAndScales' own filter already had to check *before* this same pointerdown
    // to back off its own pan — recomputing a fresh answer here would just disagree with it.
    if (measurePoints && measureBodyHoveredRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragMeasureBodyRef.current = { startClientX: e.clientX, startClientY: e.clientY, orig: measurePoints };
      return;
    }
    if (!zoomable) return;
    const startClientY = e.clientY;
    const startYTransform = yTransform;
    isPanningYRef.current = true;
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startClientY;
      // Only flagged here (once actual movement happens), not at pointerdown — a plain click
      // with no drag shouldn't disable YAutoScaling.
      setYManuallyAdjusted(true);
      setYTransform(d3.zoomIdentity.scale(startYTransform.k).translate(0, startYTransform.y / startYTransform.k + dy / startYTransform.k));
    };
    const onUp = () => {
      isPanningYRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleOverlayPointerUp(e: React.PointerEvent<SVGRectElement>) {
    if (brushDrawingRef.current) {
      brushDrawingRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      const points = brushPointsRef.current;
      brushPointsRef.current = [];
      setBrushPreview(null);
      if (points.length >= 2) {
        const first = points[0];
        const last = points[points.length - 1];
        commitDrawings([
          ...drawings,
          {
            id: `drawing-${drawingIdRef.current++}`,
            ...defaultDrawingStyle,
            x1: first.x,
            y1: first.y,
            x2: last.x,
            y2: last.y,
            lineType: "brush",
            extraPoints: points.slice(1, -1),
          },
        ]);
      }
      cancelDrawingTool();
      return;
    }
    if (dragMeasureBodyRef.current) {
      dragMeasureBodyRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (!dragLineRef.current) return;
    const drag = dragLineRef.current;
    dragLineRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // A plain click (barely any movement since pointerdown) selects the drawing instead of
    // leaving it as just a no-op drag — an actual drag already committed its own move via the
    // dragLineRef.current branch in handlePointerMove above, so this only ever fires for a
    // gesture that never really moved.
    const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
    if (moved < CLICK_DRAG_THRESHOLD) setSelectedDrawingId(drag.id);
  }


  return {
    toDataPoint,
    handleOverlayClick,
    handleOverlayDoubleClick,
    handleEndpointPointerDown,
    handleEndpointPointerMove,
    handleEndpointPointerUp,
    handleMeasureHandlePointerDown,
    handleMeasureHandlePointerMove,
    handleMeasureHandlePointerUp,
    handleAxisHandlePointerDown,
    handleAxisHandlePointerMove,
    handleAxisHandlePointerUp,
    handlePointerMove,
    handleOverlayPointerDown,
    handleOverlayPointerUp,
  };
}
