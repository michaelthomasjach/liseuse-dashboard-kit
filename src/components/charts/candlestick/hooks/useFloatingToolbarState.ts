import { useEffect, useRef } from "react";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { toolMetaForType, drawingToolMeta } from "../drawingCatalog";
import { useFloatingToolbarPosition } from "./useFloatingToolbarPosition";

export interface UseFloatingToolbarStateArgs {
  activeTool: DrawingToolType | null;
  selectedDrawingId: string | null;
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  defaultDrawingStyle: { color: string; textColor?: string; strokeWidth: number };
  setDefaultDrawingStyle: (update: (prev: { color: string; textColor?: string; strokeWidth: number }) => { color: string; textColor?: string; strokeWidth: number }) => void;
  /** The theme's own resolved accent color (see useDefaultDrawingColor) — what a fresh,
   *  never-recolored drawing already fell back to at render time before every new drawing started
   *  carrying an explicit color of its own (see defaultDrawingStyle's own doc). */
  defaultDrawingColor: string;
  plotWidth: number;
}

/** Everything `CandlestickChart` needs to render `FloatingDrawingToolbar` — split out purely to
 *  keep that file under its own 1000-line cap (same reasoning every other `use*` extraction in
 *  this file already follows), not because this logic has a life of its own beyond the toolbar. */
export function useFloatingToolbarState({
  activeTool,
  selectedDrawingId,
  drawings,
  commitDrawings,
  defaultDrawingStyle,
  setDefaultDrawingStyle,
  defaultDrawingColor,
  plotWidth,
}: UseFloatingToolbarStateArgs) {
  // Keeps defaultDrawingStyle's own color in sync with the theme's accent color until the user
  // actually picks a different one via the toolbar's own pencil swatch, at which point this stops
  // overriding it.
  const userCustomizedDrawingStyleRef = useRef(false);
  useEffect(() => {
    if (userCustomizedDrawingStyleRef.current) return;
    setDefaultDrawingStyle((prev) => ({ ...prev, color: defaultDrawingColor }));
  }, [defaultDrawingColor, setDefaultDrawingStyle]);

  // Edits whichever the floating toolbar is currently showing — the selected drawing's own fields
  // if one is selected, else the style the *next* drawing will be created with.
  function updateDrawingOrDefaultStyle(patch: Partial<{ color: string; textColor: string; strokeWidth: number }>) {
    if (selectedDrawingId) {
      commitDrawings(drawings.map((d) => (d.id === selectedDrawingId ? { ...d, ...patch } : d)));
    } else {
      userCustomizedDrawingStyleRef.current = true;
      setDefaultDrawingStyle((prev) => ({ ...prev, ...patch }));
    }
  }

  const selectedDrawing = selectedDrawingId ? (drawings.find((d) => d.id === selectedDrawingId) ?? null) : null;
  // Deliberately not `activeTool !== null` too — merely arming a tool from the rail (before
  // anything is actually clicked/placed on the chart) shouldn't pop the toolbar up on its own;
  // it should only appear once there's a real drawing to style, i.e. one the user has selected.
  const showFloatingToolbar = selectedDrawingId !== null;
  // "measure"/"zoomIn" produce no persistent styled drawing — the pencil/text/stroke sections
  // have nothing to act on for either, only the grip and bell apply.
  const showToolbarStyleControls = activeTool !== "measure" && activeTool !== "zoomIn";
  const toolbarColor = selectedDrawing ? (selectedDrawing.color ?? defaultDrawingColor) : defaultDrawingStyle.color;
  const toolbarTextColor = selectedDrawing
    ? (selectedDrawing.textColor ?? selectedDrawing.color ?? defaultDrawingColor)
    : (defaultDrawingStyle.textColor ?? defaultDrawingStyle.color);
  const toolbarStrokeWidth = selectedDrawing ? (selectedDrawing.strokeWidth ?? 1.5) : defaultDrawingStyle.strokeWidth;
  const toolbarResetKey = activeTool ? `tool:${activeTool}` : selectedDrawingId ? `drawing:${selectedDrawingId}` : null;
  const {
    position: floatingToolbarPosition,
    toolbarRef: floatingToolbarRef,
    startDrag: startFloatingToolbarDrag,
  } = useFloatingToolbarPosition({ resetKey: toolbarResetKey, plotWidth });

  // The bell button's own target info — the selected drawing's real lineType if one exists,
  // else the bare active tool (nothing placed yet). "fibonacci"/"fibonacciExtension" are the only
  // tool types AlertCreateModal treats differently (a level picker instead of the standard
  // crossing options — see its own doc); every other tool/drawing shares the same options.
  const toolMeta = selectedDrawing ? drawingToolMeta(selectedDrawing) : activeTool ? toolMetaForType(activeTool) : null;
  const targetLineType = selectedDrawing ? selectedDrawing.lineType : activeTool;
  const alertTarget = {
    drawingId: selectedDrawingId,
    isFibonacciTarget: targetLineType === "fibonacci" || targetLineType === "fibonacciExtension",
    fibonacciExtension: targetLineType === "fibonacciExtension",
    targetLabel: toolMeta?.label ?? "",
  };

  return {
    showFloatingToolbar,
    showToolbarStyleControls,
    toolbarColor,
    toolbarTextColor,
    toolbarStrokeWidth,
    updateDrawingOrDefaultStyle,
    floatingToolbarPosition,
    floatingToolbarRef,
    startFloatingToolbarDrag,
    alertTarget,
  };
}
