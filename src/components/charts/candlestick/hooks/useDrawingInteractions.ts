import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ScaleLinear } from "d3";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { TextEntryState } from "../interfaces/TextEntryState.interface";
import type { EditingCellState } from "../interfaces/EditingCellState.interface";
import { round4, tableCellIndexAt } from "../drawingGeometry";
import { distanceToDrawing } from "../drawingHitTest";
import { distanceToIndicator } from "../indicatorHitTest";
import type { HitTestContext } from "../drawingHitTest";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { useAxisHandleDrag } from "./useAxisHandleDrag";
import { placeDrawingOnClick } from "./placeDrawingOnClick";
import { DRAWING_HIT_DISTANCE, CLICK_DRAG_THRESHOLD, TABLE_DEFAULT_ROWS, TABLE_DEFAULT_COLS, TABLE_BORDER_HIT_MARGIN } from "../constants";

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
  /** Every enabled indicator with its own computed series, so the hover pass can ask whether the
   *  pointer is on one of their lines. Same array the axis badges already receive. */
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  /** The last revealed bar — the replay cutoff when one is armed. An indicator is only
   *  hit-testable over bars that are actually on screen. */
  lastRevealedIndex: number;
  setSelectedIndicatorId: (id: string | null) => void;
  /** Fires when the indicator under the pointer changes — *only* when it changes, never on every
   *  move. The id itself is kept in a ref below so a pointer travelling across the plot costs no
   *  renders; this exists because the legend has to outline the row belonging to whatever line the
   *  pointer is on, and that is a piece of shared state, not a ref. A change happens when the
   *  pointer crosses onto or off a curve, which is rare enough to be free. */
  onHoveredIndicatorChange: (id: string | null) => void;
  pixelYForDrawing: (dr: TrendLineDrawing) => number;
  resolveValueAxisAtY: (mouseY: number) => string;
  /** A sub-pane's current vertical transform, and how to slide it — see usePaneLayout's panPaneY.
   *  Both are needed here because a vertical drag belongs to whichever pane it started in, not to
   *  the price. */
  getPaneYTransform: (paneId: string) => d3.ZoomTransform;
  panPaneY: (paneId: string, startTransform: d3.ZoomTransform, dy: number) => void;
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
  setEditingCell: (v: EditingCellState | null) => void;
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
  indicatorValues,
  lastRevealedIndex,
  setSelectedIndicatorId,
  onHoveredIndicatorChange,
  pixelYForDrawing,
  resolveValueAxisAtY,
  getPaneYTransform,
  panPaneY,
  overlayProjections,
  xScale,
  maxXZoom,
  setXTransformAnimated,
  setTextEntry,
  setEditingCell,
}: UseDrawingInteractionsArgs) {
  // See the hover pass in updateHoverState for why this is a ref and not state.
  const hoveredIndicatorIdRef = useRef<string | null>(null);

  /** Runs the hover pass at most once per frame, on the most recent pointer position.
   *
   *  A pointer reports faster than the screen redraws — 120Hz and more on current hardware — and
   *  every one of those events used to run the whole pass: the crosshair, the nearest-drawing
   *  search over every visible drawing, and the nearest-line search over every indicator's own
   *  series. Positions in between are never seen by anyone, so that work was thrown away.
   *
   *  Measured before this: one frame in ten took two frame-times while moving the pointer over a
   *  chart carrying indicators, scripts and a strategy panel.
   *
   *  Coalescing costs at most one frame of latency on the crosshair, which is below what a hand
   *  can perceive and is what the screen imposes anyway. Drag and placement paths do *not* come
   *  through here — they return earlier in handlePointerMove — so nothing that needs to track the
   *  pointer exactly is delayed. */
  const pendingHoverRef = useRef<{ x: number; y: number; hitDistance: number } | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  function scheduleHoverUpdate(x: number, y: number, hitDistance: number) {
    pendingHoverRef.current = { x, y, hitDistance };
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const pending = pendingHoverRef.current;
      pendingHoverRef.current = null;
      if (pending) updateHoverState(pending.x, pending.y, pending.hitDistance);
    });
  }
  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
    },
    []
  );

  function toDataPoint(e: { clientX: number; clientY: number }): DataPoint {
    const rect = zoomRef.current!.getBoundingClientRect();
    const rawIndex = zoomedXScale.invert(e.clientX - rect.left);
    const rawY = zoomedPriceScale.invert(e.clientY - rect.top);
    return { x: dateForIndex(rawIndex), y: round4(magnetSnapPrice(rawIndex, rawY)) };
  }

  function handleOverlayClick(e: React.MouseEvent<SVGRectElement>) {
    placeDrawingOnClick(e, {
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
    });
  }

  function handleOverlayDoubleClick(e: React.MouseEvent<SVGRectElement>) {
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
    // "table" opens a live inline edit for whichever cell was double-clicked instead of the full
    // modal (a grid of strings has no single Texte-tab field for) — except within
    // TABLE_BORDER_HIT_MARGIN of its own outer edge, which reaches the full modal below instead
    // (its own Style tab is otherwise unreachable: cells tile the box edge to edge, so without
    // this margin no point inside it would ever miss every cell).
    if (dr.lineType === "table") {
      const rect = zoomRef.current!.getBoundingClientRect();
      const tx1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
      const ty1 = zoomedPriceScale(dr.y1);
      const tx2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
      const ty2 = zoomedPriceScale(dr.y2);
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const nearBorder =
        Math.abs(mouseX - Math.min(tx1, tx2)) < TABLE_BORDER_HIT_MARGIN ||
        Math.abs(mouseX - Math.max(tx1, tx2)) < TABLE_BORDER_HIT_MARGIN ||
        Math.abs(mouseY - Math.min(ty1, ty2)) < TABLE_BORDER_HIT_MARGIN ||
        Math.abs(mouseY - Math.max(ty1, ty2)) < TABLE_BORDER_HIT_MARGIN;
      if (!nearBorder) {
        const cellIndex = tableCellIndexAt(tx1, ty1, tx2, ty2, dr.tableRows ?? TABLE_DEFAULT_ROWS, dr.tableCols ?? TABLE_DEFAULT_COLS, mouseX, mouseY);
        if (cellIndex !== null) {
          setEditingCell({ drawingId: dr.id, cellIndex, value: dr.tableCells?.[cellIndex] ?? "" });
          return;
        }
      }
    }
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

  const { handleAxisHandlePointerDown, handleAxisHandlePointerMove, handleAxisHandlePointerUp } = useAxisHandleDrag({
    drawings,
    commitDrawings,
    drawingsLocked,
    dragAxisRef,
    zoomRef,
    zoomedXScale,
    zoomedPriceScale,
    dateForIndex,
    paneScaleAndOffset,
  });

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

    // Which indicator line the pointer is on, recorded for the click handler to read. Kept in a
    // ref rather than state because nothing renders differently on indicator *hover* — only a
    // click acts on it — and re-rendering the whole chart on every pointer move to store a value
    // no one draws would be pure cost.
    if (!activeTool) {
      let closestId: string | null = null;
      let closestDist = hitDistance;
      for (const { indicator, values } of indicatorValues) {
        const d = distanceToIndicator(indicator, values, mouseX, mouseY, { dims, zoomedXScale, paneScaleAndOffset, lastIndex: lastRevealedIndex, data });
        if (d < closestDist) {
          closestDist = d;
          closestId = indicator.id;
        }
      }
      if (hoveredIndicatorIdRef.current !== closestId) {
        hoveredIndicatorIdRef.current = closestId;
        onHoveredIndicatorChange(closestId);
      }
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
    scheduleHoverUpdate(mouseX, mouseY, e.pointerType === "touch" ? DRAWING_HIT_DISTANCE * 2 : DRAWING_HIT_DISTANCE);
  }

  /** resolveValueAxisAtY, narrowed to panes a vertical drag can actually move: a collapsed pane is
   *  only its own header strip, with no value scale on screen to slide, so a gesture landing on one
   *  goes to the price rather than disappearing into a scale nobody can see. Same test
   *  updateHoverState already applies before showing a pane's hover readout. */
  function paneForGestureAtY(mouseY: number): string {
    const axis = resolveValueAxisAtY(mouseY);
    if (axis === "price") return "price";
    if (axis === "volume") return volumeCollapsed ? "price" : "volume";
    const ind = ownPaneIndicators.find((i) => i.id === axis);
    return ind && !ind.paneCollapsed ? axis : "price";
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
    // One rect covers the whole plot column — price, volume and every indicator pane — so a
    // pointerdown here says nothing on its own about which value axis the gesture means. Asking
    // resolveValueAxisAtY is what routes it: before this, every vertical drag moved the *price*
    // scale, whichever pane it started in, so dragging inside "Entropie de permutation" left the
    // pane still and slid the candles above it instead.
    //
    // Resolved once, at pointerdown, and held for the whole gesture: recomputing it per move would
    // hand the drag to a different pane the moment the pointer crossed a boundary. X is untouched
    // either way — it stays shared, so panning sideways from anywhere still moves every pane
    // together, which is the whole point of them sitting under one time axis.
    const paneAtStart = paneForGestureAtY(e.clientY - e.currentTarget.getBoundingClientRect().top);
    const onPrice = paneAtStart === "price";
    const startYTransform = onPrice ? yTransform : getPaneYTransform(paneAtStart);
    isPanningYRef.current = true;
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startClientY;
      if (!onPrice) {
        panPaneY(paneAtStart, startYTransform, dy);
        return;
      }
      // Only flagged here (once actual movement happens), not at pointerdown — a plain click
      // with no drag shouldn't disable YAutoScaling.
      setYManuallyAdjusted(true);
      setYTransform(d3.zoomIdentity.scale(startYTransform.k).translate(0, startYTransform.y / startYTransform.k + dy / startYTransform.k));
    };
    const onUp = () => {
      isPanningYRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // A cancelled pointer (a touch the browser reclaimed) must release the flag too — without
    // this a single cancelled pan left `isPanningYRef` stuck true, and every later
    // handlePointerMove bailed on it: the tool's rubber-band preview stopped tracking for good.
    window.addEventListener("pointercancel", onUp);
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
    if (moved < CLICK_DRAG_THRESHOLD) {
      setSelectedDrawingId(drag.id);
      setSelectedIndicatorId(null);
    }
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
