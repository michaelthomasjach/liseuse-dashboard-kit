import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/** How far a finger may travel between down and up and still count as a tap rather than a drag.
 *  Larger than the mouse equivalent (CLICK_DRAG_THRESHOLD) on purpose — a finger deciding to tap
 *  still rolls a few pixels. */
const TAP_SLOP = 8;

export interface UseMobilePointPlacementArgs {
  /** Off entirely on the desktop layout, and off with no tool selected — a chart being read rather
   *  than drawn on must keep its ordinary pan/zoom/hover behaviour. */
  enabled: boolean;
  /** The plot's own hit rect, for turning viewport coordinates into plot-local ones and back. */
  plotRef: RefObject<SVGRectElement>;
  /** Hands the finished position to whatever normally handles a click on the plot — a synthetic
   *  `{ clientX, clientY }`, which is all `useDrawingInteractions`' own placement path ever reads
   *  from the event (`toDataPoint` is typed for exactly that shape). Every tool is therefore
   *  driven unchanged, with no per-tool work here. */
  onCommit: (point: { clientX: number; clientY: number }) => void;
  /** Called with the same synthetic point whenever the marker moves, so a half-drawn tool's own
   *  rubber-band preview follows it — the second point of a trend line tracking the marker instead
   *  of a finger that isn't touching the screen. */
  onPreview: (point: { clientX: number; clientY: number }) => void;
}

/**
 * Touch placement for every drawing tool: tap once to drop a marker roughly where you want it,
 * then drag anywhere on the chart to nudge it precisely, then tap again to commit.
 *
 * The point of the middle step is that a fingertip is about 8mm wide and the thing being placed is
 * a pixel. Dragging *anywhere* — not on the marker itself, which the finger would then cover —
 * moves it by the same delta from wherever it already was, so the hand never hides the target.
 *
 * Deliberately a layer above `useDrawingInteractions` rather than a change inside it: this stages
 * a position and eventually replays it as an ordinary click, so every tool, and every multi-point
 * tool's every point, goes through its existing branch untouched. Nothing here knows what is being
 * drawn.
 */
export function useMobilePointPlacement({ enabled, plotRef, onCommit, onPreview }: UseMobilePointPlacementArgs) {
  // The staged marker, in plot-local pixels — null when nothing is being placed. Local rather than
  // viewport coordinates because that is what the overlay draws it in; the conversion back to
  // client space happens once, at commit.
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  // Where the marker was when the current gesture started, plus the finger's own start, so a drag
  // is applied as a delta rather than teleporting the marker under the finger.
  const gestureRef = useRef<{ startClientX: number; startClientY: number; originX: number; originY: number; createdNow: boolean } | null>(null);
  const movedRef = useRef(false);

  const toClient = useCallback(
    (local: { x: number; y: number }) => {
      const rect = plotRef.current?.getBoundingClientRect();
      return { clientX: (rect?.left ?? 0) + local.x, clientY: (rect?.top ?? 0) + local.y };
    },
    [plotRef]
  );

  function onPointerDown(e: ReactPointerEvent<SVGRectElement>) {
    if (!enabled) return;
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    movedRef.current = false;
    // No marker yet: this press both creates one and starts dragging it, so a press-and-slide
    // places a point in a single gesture without giving up the tap-then-adjust rhythm.
    const origin = marker ?? { x: e.clientX - rect.left, y: e.clientY - rect.top };
    gestureRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      createdNow: marker === null,
    };
    if (marker === null) {
      setMarker(origin);
      onPreview(toClient(origin));
    }
  }

  function onPointerMove(e: ReactPointerEvent<SVGRectElement>) {
    const gesture = gestureRef.current;
    if (!enabled || !gesture) return;
    const dx = e.clientX - gesture.startClientX;
    const dy = e.clientY - gesture.startClientY;
    if (!movedRef.current && Math.hypot(dx, dy) <= TAP_SLOP) return;
    movedRef.current = true;
    const next = { x: gesture.originX + dx, y: gesture.originY + dy };
    setMarker(next);
    onPreview(toClient(next));
  }

  function onPointerUp() {
    const gesture = gestureRef.current;
    if (!enabled || !gesture) return;
    gestureRef.current = null;
    // A tap on an *already staged* marker is the confirmation. A tap that created the marker is
    // the first half of the gesture and leaves it staged; a drag of either kind likewise leaves it
    // staged, so the position can still be adjusted, or re-adjusted, before being committed.
    if (movedRef.current || gesture.createdNow) return;
    const staged = marker;
    setMarker(null);
    if (staged) onCommit(toClient(staged));
  }

  /** Drops the staged marker without committing it — for whoever cancels the tool (Escape, picking
   *  another tool, finishing a drawing), so a stale marker can't outlive what it was placing. */
  const clear = useCallback(() => {
    gestureRef.current = null;
    movedRef.current = false;
    setMarker(null);
  }, []);

  return { marker: enabled ? marker : null, onPointerDown, onPointerMove, onPointerUp, clear };
}
