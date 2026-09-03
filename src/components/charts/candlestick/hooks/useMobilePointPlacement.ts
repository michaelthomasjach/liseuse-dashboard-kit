import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/** How far a finger may travel between down and up and still count as a tap rather than a drag.
 *  Larger than the mouse equivalent (CLICK_DRAG_THRESHOLD) on purpose — a finger deciding to tap
 *  still rolls a few pixels. */
const TAP_SLOP = 8;

/** What `toClient` below builds: enough of a pointer event for the plot's own handlers, and
 *  nothing more. Structural on purpose — nothing here is a real DOM event. */
export interface SyntheticPlotEvent {
  clientX: number;
  clientY: number;
  pointerType: string;
  pointerId: number;
  currentTarget: { getBoundingClientRect: () => DOMRect; setPointerCapture: () => void; releasePointerCapture: () => void };
  preventDefault: () => void;
  stopPropagation: () => void;
}

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
  onCommit: (point: SyntheticPlotEvent) => void;
  /** Called with the same synthetic point whenever the marker moves, so a half-drawn tool's own
   *  rubber-band preview follows it — the second point of a trend line tracking the marker instead
   *  of a finger that isn't touching the screen. */
  onPreview: (point: SyntheticPlotEvent) => void;
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

  /** The staged position dressed up as the event the plot's own handlers expect. `clientX`/`clientY`
   *  are what the placement path reads (see `toDataPoint`), but `handlePointerMove` also measures
   *  the plot off `currentTarget` and branches on `pointerType` — passing the bare coordinate pair
   *  threw on its very first line, on every frame of a drag, which is what made the marker move in
   *  fits. `currentTarget` is a stand-in rather than the element itself so that
   *  `setPointerCapture` stays a no-op: there is no pointer to capture here, the finger driving
   *  this is somewhere else on the screen entirely, and handing a real element a synthetic
   *  `pointerId` would throw in its place. */
  const toClient = useCallback(
    (local: { x: number; y: number }) => {
      const rect = plotRef.current?.getBoundingClientRect();
      return {
        clientX: (rect?.left ?? 0) + local.x,
        clientY: (rect?.top ?? 0) + local.y,
        pointerType: "touch",
        pointerId: -1,
        currentTarget: {
          getBoundingClientRect: () => plotRef.current?.getBoundingClientRect() ?? new DOMRect(),
          setPointerCapture: () => {},
          releasePointerCapture: () => {},
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
    },
    [plotRef]
  );

  function onPointerDown(e: ReactPointerEvent<SVGRectElement>) {
    if (!enabled) return;
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.stopPropagation();
    // Deliberately no `e.preventDefault()` here: on a pointerdown it does nothing against touch
    // scrolling (only touch-action and the underlying touch events' own preventDefault do), and
    // leaving one in place made this hook look defended when it had no defence at all.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that has already ended (a very fast tap) throws here and needs no capture.
    }
    const pointerId = e.pointerId;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    // No marker yet: this press both creates one and starts dragging it, so a press-and-slide
    // places a point in a single gesture without giving up the tap-then-adjust rhythm.
    const origin = marker ?? { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const createdNow = marker === null;
    if (createdNow) {
      setMarker(origin);
      onPreview(toClient(origin));
    }
    // Window listeners for the rest of the gesture, not React props on the plot rect — the same
    // shape every other drag in this library uses (useSymbolProfileSplit, the details sheet's own
    // grab bar, the price-scale pan). A drag tracked through the element's own onPointerMove dies
    // the moment the browser retargets or cancels the pointer, which is exactly what it did here:
    // the marker crept a few pixels past the tap threshold and then stopped until the finger was
    // lifted and put down again. `pointercancel` is handled alongside `pointerup` for the same
    // reason — a cancelled pointer must end the gesture, not strand it.
    let moved = false;
    // THE guard that keeps Chrome/Android from taking the drag as a page scroll ~8px in and
    // firing `pointercancel` at it — which ended the gesture and read, exactly, as "the marker
    // moves a few pixels and freezes until the finger is lifted". Nothing else in this path
    // provides it: `touch-action: none` on the plot's SVG <rect> is silently dropped by Blink (a
    // non-replaced inline element, which the property excludes), a preventDefault on pointerdown
    // does not block scrolling, and a React `onTouchMove` is registered passive by React DOM and so
    // cannot cancel anything. d3-zoom is what does this for every *other* touch drag on the chart
    // (its `touchmoved` calls preventDefault on the native touchmove) — and d3-zoom is detached the
    // whole time a tool is active, i.e. the only time this hook runs. So this listener does the one
    // thing d3-zoom would have done: a non-passive touchmove that cancels the default.
    const swallowTouchMove = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    window.addEventListener("touchmove", swallowTouchMove, { passive: false });
    // Every handler is gated on the pointer that started the gesture — a resting thumb on the
    // tools rail, a palm on the bezel, a stray second tap Chrome cancels, all dispatch their own
    // pointerup/pointercancel at window, and an ungated onUp would end the real finger's drag with
    // them.
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!moved && Math.hypot(dx, dy) <= TAP_SLOP) return;
      moved = true;
      const next = { x: origin.x + dx, y: origin.y + dy };
      setMarker(next);
      onPreview(toClient(next));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("touchmove", swallowTouchMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      // A tap on an *already staged* marker is the confirmation. A tap that created the marker is
      // the first half of the gesture and leaves it staged; a drag of either kind likewise leaves
      // it staged, so the position can be adjusted, and re-adjusted, before being committed.
      if (moved || createdNow) return;
      setMarker(null);
      onCommit(toClient(origin));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  /** Drops the staged marker without committing it — for whoever cancels the tool (Escape, picking
   *  another tool, finishing a drawing), so a stale marker can't outlive what it was placing. */
  const clear = useCallback(() => setMarker(null), []);

  return { marker: enabled ? marker : null, onPointerDown, clear };
}
