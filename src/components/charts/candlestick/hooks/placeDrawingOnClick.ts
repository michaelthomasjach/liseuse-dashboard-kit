import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import type { Candle } from "../interfaces/Candle.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { TextEntryState } from "../interfaces/TextEntryState.interface";
import { MULTI_POINT_TOOLS } from "../drawingCatalog";
import { round4, channelOffsetFromClick, rangeForecastMaxMin, longShortPositionDefaults } from "../drawingGeometry";
import { POSITION_TOOL_DEFAULT_BARS, TABLE_DEFAULT_ROWS, TABLE_DEFAULT_COLS } from "../constants";

/** Plain mutable ref shape — see the identical note in useDrawingInteractions on why React's own
 *  `RefObject<T>` will not do for a ref merely passed through as a parameter. */
interface MutableRef<T> {
  current: T;
}

/** Everything placing a drawing needs. Long, and honestly so: this *is* the surface a click has to
 *  reach, and naming it here is what lets the placement rules live apart from the gesture handling
 *  that raises them. */
export interface DrawingPlacementContext {
  data: Candle[];
  dims: { boundedWidth: number };
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawingIdRef: MutableRef<number>;
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
  setMeasurePoints: (v: { p1: DataPoint; p2: DataPoint } | null | ((prev: { p1: DataPoint; p2: DataPoint } | null) => { p1: DataPoint; p2: DataPoint } | null)) => void;
  hoveredDrawingId: string | null;
  setSelectedDrawingId: (id: string | null) => void;
  cancelDrawingTool: () => void;
  zoomRef: MutableRef<SVGRectElement | null>;
  indexForDate: (d: Date) => number;
  dateForIndex: (rawIndex: number) => Date;
  priceScale: ScaleLinear<number, number>;
  setYManuallyAdjusted: (v: boolean) => void;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: ScaleLinear<number, number>; offset: number };
  setSelectedIndicatorId: (id: string | null) => void;
  resolveValueAxisAtY: (mouseY: number) => string;
  xScale: ScaleLinear<number, number>;
  maxXZoom: number;
  setXTransformAnimated: (t: d3.ZoomTransform, duration?: number) => void;
  setTextEntry: (v: TextEntryState | null) => void;
  /** Which indicator the pointer is over, if any — read when a click lands on empty space, so a
   *  click that misses every drawing can still select the line underneath. */
  hoveredIndicatorIdRef: MutableRef<string | null>;
  /** Screen point to data point, the same conversion the hover path uses. */
  toDataPoint: (e: { clientX: number; clientY: number }) => DataPoint;
}

/** What a click on the plot does, per drawing tool.
 *
 *  Split out of `useDrawingInteractions` because it is a different kind of thing from the rest of
 *  that hook: the others are *gestures* — press, move, release, hit-test — while this is the
 *  catalogue of what each of the twenty-odd tools means by "click here". Single-click tools commit
 *  immediately; the multi-point ones stage a pending point and wait for the next click. Reading
 *  one no longer means scrolling past the other. */
export function placeDrawingOnClick(e: React.MouseEvent<SVGRectElement>, ctx: DrawingPlacementContext) {
  const {
    data,
    dims,
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
    setMeasurePoints,
    hoveredDrawingId,
    setSelectedDrawingId,
    cancelDrawingTool,
    zoomRef,
    indexForDate,
    dateForIndex,
    priceScale,
    setYManuallyAdjusted,
    paneScaleAndOffset,
    setSelectedIndicatorId,
    resolveValueAxisAtY,
    xScale,
    maxXZoom,
    setXTransformAnimated,
    setTextEntry,
    hoveredIndicatorIdRef,
    toDataPoint,
  } = ctx;

    if (!activeTool) {
      // A plain click on empty plot space (nothing hovered — a click that landed on an existing
      // drawing instead is handled by the pointerdown/pointerup pair below, which is what tells a
      // click apart from a body-drag) clears whatever's currently selected, same as Escape.
      if (!hoveredDrawingId) {
        // Nothing drawn is under the cursor, so this click is either on an indicator's own line
        // or on genuinely empty space. Drawings win when both are under it — a hand-placed shape
        // sitting on top of an indicator is the one the user is pointing at — which is why this
        // only runs once `hoveredDrawingId` has come back empty.
        // Clearing the drawing selection is unconditional here, exactly as it was before
        // indicators became selectable: this click landed away from every drawing, so whatever
        // was selected is no longer what the user is pointing at. Leaving it set while an
        // indicator took the selection would strand the floating toolbar on a drawing that no
        // longer reads as selected anywhere else.
        setSelectedDrawingId(null);
        setSelectedIndicatorId(hoveredIndicatorIdRef.current);
      }
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
    // handleEndpointPointerMove). "pin"/"flagMark"/"priceLabel" share this same shape, so they
    // share this branch too. (Explicit `||`, not array.includes — `lineType: activeTool` below
    // needs it actually narrowed.)
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
          x1: pendingPoint.x, y1: pendingPoint.y, x2: max.x, y2: max.y,
          lineType: "rangeForecast",
          extraPoints: [min],
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "longPosition"/"shortPosition" are single-click tools — entry is the click itself, target/
    // stop derived immediately from it (see longShortPositionDefaults for the price side; the
    // date side is a fixed bar offset, computed here since the geometry helper lacks
    // indexForDate/dateForIndex) — then ordinary, independently draggable points.
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

    // "text"/"comment"/"signpost" open a live textarea instead of committing on click (see
    // useDrawingState's own textEntry/commitTextEntry, which is what actually creates the
    // drawing) — exits the tool immediately so a further click doesn't start a 2nd entry.
    if (activeTool === "text" || activeTool === "comment" || activeTool === "signpost") {
      setTextEntry({ tool: activeTool, point, value: "" });
      cancelDrawingTool();
      return;
    }

    // "note"/"priceNote": same live entry as above, reached after a 2nd click — the anchor comes
    // first, same pendingPoint/previewPoint staging every 2-click tool uses for its own preview
    // line (drawn by drawPriceDrawings.ts's plain fallback branch, no dedicated case needed).
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

    // "table" is a plain 2-click box like "rectangle" — its own branch (not the shared
    // trendline/extended/fibonacci/rectangle/zones/forecast one further down) since its
    // MULTI_POINT_TOOLS entry (edit-modal corner labels only, see drawingCatalog.ts) would
    // otherwise let the generic multiPoint branch below intercept it, waiting on a 3rd click.
    if (activeTool === "table") {
      if (!pendingPoint) {
        setPendingPoint(point);
        setPreviewPoint(point);
        return;
      }
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: pendingPoint.x, y1: pendingPoint.y, x2: point.x, y2: point.y,
          lineType: "table",
          tableRows: TABLE_DEFAULT_ROWS, tableCols: TABLE_DEFAULT_COLS, tableCells: [],
        },
      ]);
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
          x1: pendingPoint.x, y1: pendingPoint.y, x2: pendingSecondPoint.x, y2: pendingSecondPoint.y,
          // MULTI_POINT_TOOLS only has entries for these (disjointChannel's own 4th point is
          // computed, not clicked, so it never reaches this generic branch — see MULTI_POINT_TOOLS'
          // own doc), guaranteed by `multiPoint` above — narrower than what TS can infer just from
          // the (wider-keyed) lookup being truthy.
          lineType: activeTool as
            | "fibonacciExtension" | "elliottCorrection" | "elliottImpulse" | "headShoulders" | "cupHandle"
            | "pitchfork" | "schiffPitchfork" | "modifiedSchiffPitchfork" | "insidePitchfork" | "rangeForecast",
          extraPoints: nextExtra,
        },
      ]);
      cancelDrawingTool();
      return;
    }

    // "trendline", "extended", "fibonacci", "rectangle", "zones", "forecast" and "table" all
    // share the same 2-click flow — they only differ in how they're drawn (see the canvas draw
    // effect) and, for "rectangle"/"zones", hit-tested, not in how they're placed. "arrowLine" is
    // the same flow again but stays lineType-less like a plain trend line, just with arrowRight
    // preset.
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
