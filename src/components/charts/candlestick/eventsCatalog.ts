// Distinct from INDICATOR_COLORS so an event badge never accidentally matches an indicator
// line's own color at a glance.
export const EVENT_COLORS = ["#d18b3d", "#4f8fd1", "#3ea377", "#c15d7a", "#8a6fd6", "#c9a13a"];

export function defaultEventColor(index: number): string {
  return EVENT_COLORS[((index % EVENT_COLORS.length) + EVENT_COLORS.length) % EVENT_COLORS.length];
}

// Event badges (see `ChartEvent`) sit in a fixed row this many px above the price/volume
// divider (or, with volume hidden, the X axis itself) — always tied to that boundary, never to
// whatever's currently the tallest/shortest visible candle, so the row doesn't jump around while
// panning/zooming. Comfortably larger than EVENT_MARKER_RADIUS on purpose (was 14, barely more
// than the radius itself, leaving only ~6px of clearance below the marker's own hit target) — too
// close to the boundary put the marker's own clickable circle right on top of the X axis's own
// date-tick labels/buttons directly beneath it, which this offset increase is what a real user
// bug report asked to fix.
export const EVENT_MARKER_OFFSET = 26;
export const EVENT_MARKER_RADIUS = 8;
/** Several events sharing a candle index render as a small fanned-out cascade of individually
 *  colored/lettered circles (each nudged this many px up-and-right of the previous one) rather
 *  than one generic "N" badge that hides which events are actually there — see
 *  `ChartCanvasOverlay.tsx`'s own render of `eventStacks`. */
export const EVENT_STACK_OFFSET = 5;
/** Past this many events on the same bar, the cluster stops growing — the topmost circle becomes
 *  a "+N" overflow badge (neutral accent color) instead of drawing every single one, so an
 *  unusually eventful bar can't make the fanned-out cluster sprawl without bound. */
export const MAX_STACKED_EVENT_MARKERS = 4;
/** Fixed width (px) of the event-stack popover — fixed, not measured, so its horizontal
 *  clamp-to-bounds position can be computed synchronously in the same render as the click that
 *  opens it, no post-mount measurement pass (and the flash-of-unpositioned-content that would
 *  come with one) needed. */
export const EVENT_TOOLTIP_WIDTH = 320;
/** Gap (px) between the popover's own bottom edge and the top of the event marker it's anchored
 *  to (see `EVENT_MARKER_RADIUS`). */
export const EVENT_TOOLTIP_GAP = 15;
