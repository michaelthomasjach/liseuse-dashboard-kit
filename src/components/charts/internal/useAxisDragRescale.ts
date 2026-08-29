import { useRef } from "react";
import * as d3 from "d3";

export interface UseAxisDragRescaleOptions {
  /** Which axis this strip rescales. */
  axis: "x" | "y";
  /** boundedWidth (for "x") or boundedHeight (for "y") — the drag zooms around the midpoint of this. */
  size: number;
  /** Current transform, read fresh at the start of each drag (not memoized — always pass the live value). */
  transform: d3.ZoomTransform;
  onChange: (transform: d3.ZoomTransform) => void;
  scaleExtent?: [number, number];
}

/**
 * Drag-to-rescale for an axis strip: dragging the vertical (price) axis
 * rescales Y, dragging the horizontal (time) axis rescales X — the
 * TradingView-style convention, independent of panning/zooming the plot
 * itself. Scales around the strip's midpoint so the rescale feels centered
 * rather than anchored to wherever the drag happened to start.
 */
// Unlike the X axis (naturally capped at data.length — one candle can only ever get so wide, see
// useZoomAndScales' own maxXZoom), price has no natural zoom ceiling of its own: a very large or
// very small instrument can legitimately need to be seen down to a tiny fraction of its own
// range. 10000 isn't a real limit the user should ever bump into in practice — a finite (if very
// generous) default rather than Infinity purely so d3's own scale/tick math never has to handle
// an unbounded domain, not because 10000x is a deliberately "enough" ceiling. The floor mirrors
// the ceiling (0.0001 = 1/10000) rather than 1 — flooring at 1 (the base/identity scale) made
// dragging/scrolling to zoom *out* from a fresh or just-reset axis a permanent no-op: k0 starts
// at 1, so any factor < 1 was immediately clamped straight back up to 1, with no way to ever get
// below it from there (same bug already fixed for a sub-pane's own Y axis in usePaneLayout.ts —
// this shared hook, used by the *main* price/value axis on every cartesian chart, had the same
// floor and was never given the same fix).
const DEFAULT_Y_SCALE_EXTENT: [number, number] = [0.0001, 10000];

export function useAxisDragRescale({ axis, size, transform, onChange, scaleExtent = DEFAULT_Y_SCALE_EXTENT }: UseAxisDragRescaleOptions) {
  const dragRef = useRef<{ startPos: number; startTransform: d3.ZoomTransform } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startPos: axis === "y" ? e.clientY : e.clientX, startTransform: transform };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = axis === "y" ? e.clientY : e.clientX;
    const delta = pos - drag.startPos;
    // Dragging a price axis up (delta < 0) conventionally zooms in; dragging a time axis right zooms in.
    const direction = axis === "y" ? -1 : 1;
    const factor = Math.exp(direction * delta * 0.008);
    const k0 = drag.startTransform.k;
    const k1 = Math.min(scaleExtent[1], Math.max(scaleExtent[0], k0 * factor));
    const center = size / 2;
    const t0 = axis === "y" ? drag.startTransform.y : drag.startTransform.x;
    const t1 = center - (center - t0) * (k1 / k0);
    const next = axis === "y" ? d3.zoomIdentity.scale(k1).translate(0, t1 / k1) : d3.zoomIdentity.scale(k1).translate(t1 / k1, 0);
    onChange(next);
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null;
    if ((e.currentTarget as Element).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
