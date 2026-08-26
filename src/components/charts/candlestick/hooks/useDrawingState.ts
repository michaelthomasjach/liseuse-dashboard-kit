import { useEffect, useRef, useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";
import type { TrendLineDrawing, OverlayDataPoint } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { TextEntryState } from "../interfaces/TextEntryState.interface";
import type { EditingCellState } from "../interfaces/EditingCellState.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { SymbolSearchResult } from "../interfaces/SymbolSearchResult.interface";
import { DRAWING_TOOL_CATEGORIES, categoryOfTool } from "../drawingCatalog";
import { EMPTY_DRAWINGS, DEFAULT_DRAWING_COLOR } from "../constants";
import { defaultIndicatorColor } from "../indicatorCatalog";
import { offsetDrawingUp } from "../drawingGeometry";

export interface UseDrawingStateArgs {
  data: Candle[];
  defaultDrawings: TrendLineDrawing[] | undefined;
  onDrawingsChange: ((drawings: TrendLineDrawing[]) => void) | undefined;
  onAddSymbolOverlay:
    | ((result: SymbolSearchResult) => OverlayDataPoint[] | Promise<OverlayDataPoint[]>)
    | undefined;
}

/** Every drawing (trend lines, shapes, symbol-comparison overlays…) — state, tool selection,
 *  CRUD, and the small keyboard shortcuts (Escape to cancel/finalize, Delete to remove the
 *  hovered one) that act on them. Pointer-driven placement/dragging lives in
 *  `useDrawingInteractions` instead (it needs the zoom/pane scales this hook doesn't), which takes
 *  this hook's full return value as its own input. */
export function useDrawingState({ data, defaultDrawings, onDrawingsChange, onAddSymbolOverlay }: UseDrawingStateArgs) {
  const [drawings, setDrawings] = useState<TrendLineDrawing[]>(defaultDrawings ?? []);
  const [activeTool, setActiveTool] = useState<DrawingToolType | null>(null);
  // Which tool each category's own rail button currently represents — stays selected across
  // draws, independent of whether drawing is actually active right now, and independent of the
  // other categories' own selection. Changed via that category's own flyout menu, which (unlike
  // the button itself) also activates the tool immediately — see handleSelectToolType.
  const [selectedToolByCategory, setSelectedToolByCategory] = useState<Record<string, DrawingToolType>>(() =>
    Object.fromEntries(DRAWING_TOOL_CATEGORIES.map((c) => [c.id, c.tools[0].type]))
  );
  // Which category's dropdown is open, if any — at most one at a time.
  const [openToolMenu, setOpenToolMenu] = useState<string | null>(null);
  // Which drawing tool's own "how this works" info modal is open (see DRAWING_TOOL_DESCRIPTIONS
  // and DrawingToolInfoModal) — the tool-picker equivalent of usePaneLayout's own `infoKind` for
  // indicators, living here instead for the same reason: squarely part of this hook's own
  // tool-related state cluster.
  const [infoTool, setInfoTool] = useState<DrawingToolType | null>(null);
  const [pendingPoint, setPendingPoint] = useState<DataPoint | null>(null);
  const [previewPoint, setPreviewPoint] = useState<DataPoint | null>(null);
  // "channel"'s second point (fixing line 1), set between the tool's 2nd and 3rd clicks — plain
  // pendingPoint/previewPoint alone are enough for every 2-point tool's flow, channel needs a
  // 3rd click. Every *other* multi-point tool (fibonacciExtension/elliottCorrection/
  // elliottImpulse) also passes through this same 2nd-point stage before collecting the rest
  // into pendingExtraPoints below — they don't diverge from channel until after it.
  const [pendingSecondPoint, setPendingSecondPoint] = useState<DataPoint | null>(null);
  // 3rd point onward for tools needing more than two (see MULTI_POINT_TOOLS) — irrelevant to
  // channel, which computes channelOffset from its 3rd click directly instead of collecting it
  // here.
  const [pendingExtraPoints, setPendingExtraPoints] = useState<DataPoint[]>([]);
  // When on, every new point placed by any drawing tool (via toDataPoint) snaps to whichever of
  // the nearest candle's open/high/low/close is closest — a persistent modifier rather than a
  // tool of its own, so it stays on across tool switches until toggled off again.
  const [magnetActive, setMagnetActive] = useState(false);
  // Hides every drawing (canvas render, hover/hit-testing, handles, axis badges) without
  // touching `drawings` itself — toggling it back off brings everything back exactly as it
  // was, unlike deleting. See `visibleDrawings` below, the single point every drawing-reading
  // codepath was switched to read from instead of `drawings` directly.
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  // Blocks *starting* a body/endpoint/axis-handle drag (handleOverlayPointerDown/
  // handleEndpointPointerDown/handleAxisHandlePointerDown all bail out early while this is on)
  // — hover, the delete key, and double-click-to-edit are all untouched, so a locked drawing
  // stays selectable/deletable/editable, just not draggable.
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  // Every codepath that reads drawn shapes for rendering, hit-testing, or handles reads this
  // instead of `drawings` directly — hiding never mutates `drawings` itself (toggling back on
  // restores everything exactly as it was), it just makes that read empty in the meantime.
  const visibleDrawings = drawingsHidden ? EMPTY_DRAWINGS : drawings;
  // The measure tool's own last completed 2-click measurement (not a `drawings` entry — it's
  // ephemeral, cleared on Escape/tool switch instead of persisted). `pendingPoint`/`previewPoint`
  // still drive its live 1st-click-to-cursor preview, same as every other 2-point tool.
  const [measurePoints, setMeasurePoints] = useState<{ p1: DataPoint; p2: DataPoint } | null>(null);
  // The brush tool's current in-progress stroke, for live preview only — the committed drawing
  // (on pointer up) is built from brushPointsRef below, not from this state, so a stroke can be
  // sampled at pointermove speed without every sample racing a stale closure over React state.
  const [brushPreview, setBrushPreview] = useState<DataPoint[] | null>(null);
  const brushPointsRef = useRef<DataPoint[]>([]);
  const brushDrawingRef = useRef(false);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [hoverVolumeY, setHoverVolumeY] = useState<number | null>(null);
  // Same idea as hoverVolumeY, generalized to whichever "own"-pane indicator (RSI/CHOP/MACD/
  // fundamentals) is currently hovered — id of that pane plus the pixel Y relative to *its own*
  // top (not the plot's), matching hoverVolumeY's own local-coordinate convention (the canvas
  // crosshair/badge for a given pane always reads relative to that pane's own top). Only one can
  // be hovered at a time, hence a single pair rather than one per indicator.
  const [hoverIndicatorPaneId, setHoverIndicatorPaneId] = useState<string | null>(null);
  const [hoverIndicatorPaneY, setHoverIndicatorPaneY] = useState<number | null>(null);
  // "text"/"comment"/"note"/"priceNote" only: a live on-canvas entry in progress, not yet a
  // `drawings` entry — set by their own click branch(es) in useDrawingInteractions, rendered as an
  // actual HTML input (ChartCanvasOverlay can't put an editable text cursor inside a <canvas>)
  // positioned at `point`. commitTextEntry (blur) turns it into a real drawing if non-empty,
  // cancelTextEntry (Escape) discards it — see each one's own doc below, and TextEntryState's own
  // for what `point`/`anchorPoint` each become.
  const [textEntry, setTextEntry] = useState<TextEntryState | null>(null);
  // "table" only: a live inline edit for one existing cell — see EditingCellState's own doc.
  const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TrendLineDrawing | null>(null);
  const [editModalTab, setEditModalTab] = useState<"coords" | "text" | "style">("coords");
  // Set by a plain click (no drag) on an existing drawing, with no tool active — see
  // useDrawingInteractions' own handleOverlayPointerUp, the one place this gets set. Distinct from
  // hoveredDrawingId (proximity-only, clears the moment the pointer leaves) and editingId (only
  // reachable via double-click, opens the full DrawingEditModal) — this is what
  // FloatingDrawingToolbar reads to know which drawing's own color/stroke it's currently showing.
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  // The style newly-placed drawings are created with — FloatingDrawingToolbar edits this directly
  // whenever a tool is active but nothing's selected yet (there's no drawing of its own to attach
  // a style to before it exists); every commitDrawings([...drawings, {...}]) call site in
  // useDrawingInteractions that builds a brand new drawing spreads this in.
  const [defaultDrawingStyle, setDefaultDrawingStyle] = useState<{ color: string; textColor?: string; strokeWidth: number }>({
    color: DEFAULT_DRAWING_COLOR,
    strokeWidth: 1.5,
  });
  // Tickers whose "+" is currently awaiting onAddSymbolOverlay — a Set (not one at a time) since
  // there's no reason comparing against AAPL should block also comparing against GOOGL while its
  // own fetch is still in flight. Purely for each row's own spinner; not read anywhere that
  // affects the chart itself.
  const [addingOverlaySymbols, setAddingOverlaySymbols] = useState<Set<string>>(new Set());
  // pointIndex: 0 = x1/y1, 1 = x2/y2, 2+ = extraPoints[pointIndex - 2] — see allPointsOf.
  const dragEndpointRef = useRef<{ id: string; pointIndex: number } | null>(null);
  const dragAxisRef = useRef<{ id: string } | null>(null);
  // Which of the measure tool's two completed points (not a `drawings` entry, see measurePoints
  // above) is currently being dragged — same generic pointer-capture pattern as dragEndpointRef,
  // just keyed by "p1"/"p2" instead of a drawing id + pointIndex since there's only ever one.
  const dragMeasureRef = useRef<"p1" | "p2" | null>(null);
  // Set while dragging the measurement's whole body (pointer down inside its rectangle, not on
  // either handle) — moves p1/p2 together by the same pixel delta, same "orig" + startClientX/Y
  // replay pattern as dragLineRef below, just for measurePoints instead of a `drawings` entry.
  const dragMeasureBodyRef = useRef<{ startClientX: number; startClientY: number; orig: { p1: DataPoint; p2: DataPoint } } | null>(null);
  // Kept up to date on every pointermove (see useDrawingInteractions' own handlePointerMove),
  // same "set *before* the drag-starting pointerdown, not during it" timing hoveredDrawingIdRef
  // already relies on — useZoomAndScales' own d3-zoom filter checks this the same way, since a
  // native listener attached to the same element fires before this file's React handler could
  // set anything from inside that same pointerdown.
  const measureBodyHoveredRef = useRef(false);
  const drawingIdRef = useRef(0);

  // Mirrors hoveredDrawingId so useD3Zoom's filter (a plain callback, run outside React) can
  // read it synchronously at pointerdown time, without re-attaching the zoom behavior on
  // every hover change.
  const hoveredDrawingIdRef = useRef<string | null>(null);
  function updateHoveredDrawingId(id: string | null) {
    hoveredDrawingIdRef.current = id;
    setHoveredDrawingId(id);
  }

  // Set while dragging a whole drawing (pointer down directly on its body, not an endpoint).
  const dragLineRef = useRef<{ id: string; startClientX: number; startClientY: number; orig: TrendLineDrawing } | null>(null);

  // True while dragging the plot body to pan the price axis vertically, independent of
  // d3-zoom's own horizontal pan (see handleOverlayPointerDown) — only used to have
  // handlePointerMove skip its hover-detection work while this drag is live.
  const isPanningYRef = useRef(false);

  function commitDrawings(next: TrendLineDrawing[]) {
    setDrawings(next);
    onDrawingsChange?.(next);
  }

  function removeSymbolOverlay(ticker: string) {
    commitDrawings(drawings.filter((d) => !(d.lineType === "symbolOverlay" && d.overlaySymbol === ticker)));
  }

  // Awaits `onAddSymbolOverlay` (a plain return is fine too — Promise.resolve passes it straight
  // through) rather than expecting the caller to push a new drawing in themselves: `drawings` has
  // no controlled counterpart to `defaultDrawings` (same as every other collection in this file),
  // so an async fetch has no way to land its result other than the chart committing it once the
  // promise settles. `addingOverlaySymbols` exists purely for each row's own spinner — never read
  // for anything that affects rendering the overlay itself.
  async function handleAddSymbolOverlay(result: SymbolSearchResult) {
    if (!onAddSymbolOverlay || addingOverlaySymbols.has(result.ticker)) return;
    setAddingOverlaySymbols((prev) => new Set(prev).add(result.ticker));
    try {
      const overlayData = await onAddSymbolOverlay(result);
      if (!overlayData || overlayData.length === 0) return;
      const sorted = [...overlayData].sort((a, b) => a.date.getTime() - b.date.getTime());
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          // Unused for this lineType (see its own doc comment) — just needs *some* value.
          x1: first.date,
          y1: first.value,
          x2: last.date,
          y2: last.value,
          lineType: "symbolOverlay",
          overlaySymbol: result.ticker,
          overlaySymbolName: result.name,
          overlayData: sorted,
          color: defaultIndicatorColor(drawings.filter((d) => d.lineType === "symbolOverlay").length),
        },
      ]);
    } finally {
      setAddingOverlaySymbols((prev) => {
        const next = new Set(prev);
        next.delete(result.ticker);
        return next;
      });
    }
  }

  function cancelDrawingTool() {
    setActiveTool(null);
    setPendingPoint(null);
    setPreviewPoint(null);
    setPendingSecondPoint(null);
    setPendingExtraPoints([]);
    setMeasurePoints(null);
  }

  // Commits the in-progress "elbowArrow" polyline as a real drawing if it has enough points (≥2)
  // to be a line at all — a no-op otherwise (including for every other tool, which never has
  // pendingExtraPoints to speak of). Doesn't clear the in-progress state itself; every call site
  // below follows it with cancelDrawingTool() to fully exit the tool, same as Escape always has —
  // this only ever adds a *second* way to reach that same finalize-then-exit sequence (re-picking
  // the tool from the rail, or double-clicking/double-tapping the plot while it's active) beside
  // Escape, for the one tool with no fixed point count of its own to reach on its own.
  function finalizeElbowArrow() {
    if (!(activeTool === "elbowArrow" && pendingPoint && pendingExtraPoints.length >= 1)) return;
    const points = [pendingPoint, ...pendingExtraPoints];
    const next: TrendLineDrawing[] = [
      ...drawings,
      {
        id: `drawing-${drawingIdRef.current++}`,
        ...defaultDrawingStyle,
        x1: points[0].x,
        y1: points[0].y,
        x2: points[1].x,
        y2: points[1].y,
        lineType: "elbowArrow",
        extraPoints: points.slice(2),
      },
    ];
    setDrawings(next);
    onDrawingsChange?.(next);
  }

  function handleToolClick(tool: DrawingToolType) {
    // Picking any tool (including re-picking "text"/"comment" itself) while a previous live
    // entry is still open flushes it first — same "clicking away" commit as blur, just reached
    // through the rail instead of the plot, so a still-open box never gets silently orphaned.
    commitTextEntry();
    commitCellEntry();
    if (activeTool === tool) {
      // A no-op for every tool except an in-progress elbowArrow with ≥2 points — re-tapping its
      // own rail button is the touch-friendly equivalent of pressing Escape to finish it (see
      // finalizeElbowArrow's own doc), rather than discarding it the way toggling any other tool
      // off does.
      finalizeElbowArrow();
      cancelDrawingTool();
    } else {
      setActiveTool(tool);
      setPendingPoint(null);
      setPreviewPoint(null);
      setPendingSecondPoint(null);
      setPendingExtraPoints([]);
      setMeasurePoints(null);
      setSelectedDrawingId(null);
    }
  }

  // Picking a tool from a category's flyout menu both changes what that category's own rail
  // button represents *and* activates it immediately, ready to draw — unlike clicking the
  // button itself to toggle the already-represented tool on/off, there's no extra confirmation
  // click needed here since picking a specific tool from the menu is already a deliberate choice.
  function handleSelectToolType(type: DrawingToolType) {
    commitTextEntry();
    commitCellEntry();
    setSelectedToolByCategory((prev) => ({ ...prev, [categoryOfTool(type).id]: type }));
    setOpenToolMenu(null);
    setActiveTool(type);
    setPendingPoint(null);
    setPreviewPoint(null);
    setPendingSecondPoint(null);
    setPendingExtraPoints([]);
    setMeasurePoints(null);
    setSelectedDrawingId(null);
  }

  useEffect(() => {
    // Also armed while only a completed measurement lingers (activeTool already back to null by
    // then, see the "measure" branch of handleOverlayClick) or a drawing is selected (see
    // selectedDrawingId above) so Escape can still dismiss either — every other tool only needs
    // this while still active, since none of them outlive their own deselection the way a
    // finished measurement or a selection does.
    if (!activeTool && !measurePoints && !selectedDrawingId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      // "elbowArrow" is the one tool Escape *finalizes* instead of discarding — it has no fixed
      // point count to reach on its own (see handleOverlayClick), so this used to be the only way
      // it ever completed (re-picking its own rail tool, double-clicking/double-tapping the plot,
      // or now Enter too, all also reach finalizeElbowArrow — see its own doc). Enter is a no-op
      // for every other tool/measurement (finalizeElbowArrow itself already guards on
      // activeTool === "elbowArrow"), so it only needs excluding from cancelDrawingTool() below —
      // that one action *does* apply generically (Escape's own original behavior), which an
      // Enter press has no business triggering for anything other than elbowArrow.
      finalizeElbowArrow();
      if (e.key === "Escape" || activeTool === "elbowArrow") cancelDrawingTool();
      if (e.key === "Escape") setSelectedDrawingId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, pendingPoint, pendingExtraPoints, drawings, onDrawingsChange, measurePoints, finalizeElbowArrow, selectedDrawingId]);

  // Deletes whichever drawing is currently hovered (there's no separate "select" state — hover
  // already tracks the one line the user is pointing at, same thing a click-to-select would give
  // here) when Delete/Backspace is pressed — skipped while the edit modal is open (its own
  // "Supprimer" button is the deliberate action there) or while a text input has focus (typing a
  // label in the Texte tab shouldn't delete the drawing out from under it).
  useEffect(() => {
    if (!hoveredDrawingId || editingId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement;
      const isEditableFocused = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isEditableFocused) return;
      e.preventDefault();
      const next = drawings.filter((d) => d.id !== hoveredDrawingId);
      setDrawings(next);
      onDrawingsChange?.(next);
      setHoveredDrawingId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredDrawingId, editingId, drawings, onDrawingsChange]);

  // Ctrl/Cmd+C over a hovered drawing copies it (copiedDrawingRef, not state — never read during
  // render, same reasoning usePaneLayout's own copiedIndicatorRef isn't); Ctrl/Cmd+V pastes a
  // duplicate (new id, everything else — geometry, style, text — unchanged) appended to
  // `drawings`, nudged up slightly (see offsetDrawingUp) so it doesn't land perfectly invisible on
  // top of its source. Mirrors indicators' own Ctrl+C/Ctrl+V exactly otherwise (see usePaneLayout),
  // just keyed off `hoveredDrawingId` instead of `hoveredIndicatorId` — the two never fire
  // together since a legend entry and a canvas drawing can't both be hovered at once, so both
  // hooks' own `window` listeners coexist without stepping on each other.
  const copiedDrawingRef = useRef<TrendLineDrawing | null>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v") return;
      const active = document.activeElement;
      const isEditableFocused = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isEditableFocused) return;
      if (key === "c") {
        if (!hoveredDrawingId) return;
        const drawing = drawings.find((d) => d.id === hoveredDrawingId);
        if (drawing) copiedDrawingRef.current = drawing;
        return;
      }
      if (!copiedDrawingRef.current) return;
      e.preventDefault();
      commitDrawings([...drawings, { ...offsetDrawingUp(copiedDrawingRef.current), id: `drawing-${drawingIdRef.current++}` }]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredDrawingId, drawings, commitDrawings, copiedDrawingRef, drawingIdRef]);

  // Snaps a raw price to whichever of the nearest candle's open/high/low/close sits closest —
  // the magnet toggle's whole effect, applied wherever a new point gets placed (see toDataPoint).
  // No-op when the magnet is off, so every call site stays correct without its own branch.
  function magnetSnapPrice(rawIndex: number, rawY: number): number {
    if (!magnetActive || data.length === 0) return rawY;
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(rawIndex - 0.5)));
    const candle = data[idx];
    const candidates = [candle.open, candle.high, candle.low, candle.close];
    return candidates.reduce((closest, v) => (Math.abs(v - rawY) < Math.abs(closest - rawY) ? v : closest), candidates[0]);
  }

  // Blurring the live textarea (see textEntry above) — a blank/whitespace-only entry is
  // discarded rather than committed as an empty drawing, same "clicking away with nothing typed
  // just cancels" behavior as leaving the edit modal's own Texte field blank already has, just
  // reachable without ever opening that modal at all.
  function commitTextEntry() {
    if (textEntry && textEntry.value.trim()) {
      const anchor = textEntry.anchorPoint ?? textEntry.point;
      commitDrawings([
        ...drawings,
        {
          id: `drawing-${drawingIdRef.current++}`,
          ...defaultDrawingStyle,
          x1: anchor.x,
          y1: anchor.y,
          x2: textEntry.point.x,
          y2: textEntry.point.y,
          lineType: textEntry.tool,
          text: textEntry.value,
          // Left-aligned always; vertically, "text" grows downward from its own point ("bottom")
          // while "note"/"priceNote" grow upward ("top", drawDrawingText's own default — "comment"
          // ignores both, its bubble always sitting above its anchor a fixed way regardless, see
          // drawTextAndComment.ts) — matching each one's own live input, which grows the same
          // direction (see ChartCanvasOverlay's own textEntry transform), so the committed render
          // starts exactly where the input sat instead of jumping to the opposite side once it
          // unmounts.
          textHorizontalAlign: "left",
          textVerticalAlign: textEntry.tool === "text" ? "bottom" : "top",
        },
      ]);
    }
    setTextEntry(null);
  }

  function cancelTextEntry() {
    setTextEntry(null);
  }

  // Blurring a table's own live cell input (see editingCell above) — unlike commitTextEntry, an
  // empty value still commits (clearing the cell) since there's no whole drawing here to discard,
  // just one cell of an already-existing "table".
  function commitCellEntry() {
    if (editingCell) {
      const dr = drawings.find((d) => d.id === editingCell.drawingId);
      if (dr) {
        const cells = [...(dr.tableCells ?? [])];
        while (cells.length <= editingCell.cellIndex) cells.push("");
        cells[editingCell.cellIndex] = editingCell.value;
        commitDrawings(drawings.map((d) => (d.id === editingCell.drawingId ? { ...d, tableCells: cells } : d)));
      }
    }
    setEditingCell(null);
  }

  function cancelCellEntry() {
    setEditingCell(null);
  }

  function closeEditModal() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEditModal() {
    if (!editingId || !draft) return;
    commitDrawings(drawings.map((d) => (d.id === editingId ? draft : d)));
    closeEditModal();
  }

  function deleteEditingDrawing() {
    if (!editingId) return;
    commitDrawings(drawings.filter((d) => d.id !== editingId));
    closeEditModal();
  }

  // Touch's own equivalent of Ctrl/Cmd+C→Ctrl/Cmd+V above — there's no keyboard on a touch
  // device to reach that with, but the edit modal (opened via double-tap, see
  // handleOverlayDoubleClick) is already touch-reachable, so its own footer is where this lives
  // instead. Same offsetDrawingUp nudge as the keyboard path, so a duplicate never lands
  // perfectly invisible on top of its source.
  function duplicateEditingDrawing() {
    if (!editingId || !draft) return;
    commitDrawings([...drawings, { ...offsetDrawingUp(draft), id: `drawing-${drawingIdRef.current++}` }]);
    closeEditModal();
  }

  return {
    drawings,
    setDrawings,
    activeTool,
    setActiveTool,
    selectedToolByCategory,
    setSelectedToolByCategory,
    openToolMenu,
    setOpenToolMenu,
    infoTool,
    setInfoTool,
    pendingPoint,
    setPendingPoint,
    previewPoint,
    setPreviewPoint,
    pendingSecondPoint,
    setPendingSecondPoint,
    pendingExtraPoints,
    setPendingExtraPoints,
    magnetActive,
    setMagnetActive,
    drawingsHidden,
    setDrawingsHidden,
    drawingsLocked,
    setDrawingsLocked,
    visibleDrawings,
    measurePoints,
    setMeasurePoints,
    brushPreview,
    setBrushPreview,
    brushPointsRef,
    brushDrawingRef,
    hoveredDrawingId,
    setHoveredDrawingId,
    hoverY,
    setHoverY,
    hoverVolumeY,
    setHoverVolumeY,
    hoverIndicatorPaneId,
    setHoverIndicatorPaneId,
    hoverIndicatorPaneY,
    setHoverIndicatorPaneY,
    textEntry,
    setTextEntry,
    commitTextEntry,
    cancelTextEntry,
    editingCell,
    setEditingCell,
    commitCellEntry,
    cancelCellEntry,
    editingId,
    setEditingId,
    draft,
    setDraft,
    editModalTab,
    setEditModalTab,
    selectedDrawingId,
    setSelectedDrawingId,
    defaultDrawingStyle,
    setDefaultDrawingStyle,
    addingOverlaySymbols,
    dragEndpointRef,
    dragAxisRef,
    dragMeasureRef,
    dragMeasureBodyRef,
    measureBodyHoveredRef,
    drawingIdRef,
    hoveredDrawingIdRef,
    updateHoveredDrawingId,
    dragLineRef,
    isPanningYRef,
    commitDrawings,
    removeSymbolOverlay,
    handleAddSymbolOverlay,
    cancelDrawingTool,
    finalizeElbowArrow,
    handleToolClick,
    handleSelectToolType,
    magnetSnapPrice,
    closeEditModal,
    saveEditModal,
    deleteEditingDrawing,
    duplicateEditingDrawing,
  };
}
