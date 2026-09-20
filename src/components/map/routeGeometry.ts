/**
 * Screen-space geometry for the route overlay — hit-testing a line, and finding somewhere sensible
 * to put its badge.
 *
 * Kept apart from the component for the same reason `tileMath.ts` is: it is arithmetic, it has no
 * use for a canvas, and it is the part where being slightly wrong looks entirely plausible.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Distance from a point to a segment, in pixels. */
export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  // A degenerate segment (both ends projected to the same pixel, which happens constantly on a
  // zoomed-out route with hundreds of points) is just its own endpoint.
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Closest a point comes to a projected polyline, in pixels. `Infinity` for an empty path. */
export function distanceToPath(points: ScreenPoint[], x: number, y: number): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(x - points[0].x, y - points[0].y);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = distanceToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Where to hang the route's badge: the halfway point *of the part that is on screen*, measured
 * along the line rather than by counting points.
 *
 * Both halves of that matter. Taking the midpoint of the whole route puts the badge off-screen the
 * moment anyone zooms into one end — which is most of the time, since zooming in is what you do to
 * a route. And taking the middle *index* rather than the middle *distance* pulls the badge toward
 * wherever the routing service happened to emit points most densely, which is junctions: the badge
 * ends up in the tangle instead of on the long clear stretch where there is room for it.
 *
 * Returns `null` when no part of the route is visible, which is the caller's signal to draw no
 * badge at all rather than to clamp one to the edge.
 */
export function badgeAnchor(points: ScreenPoint[], width: number, height: number, margin = 24): ScreenPoint | null {
  const inside = (p: ScreenPoint) => p.x >= -margin && p.x <= width + margin && p.y >= -margin && p.y <= height + margin;

  const visible: ScreenPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    // A segment with one end inside counts: the crossing itself is on screen even though the far
    // endpoint is not, and dropping it would leave a route that enters and leaves the view with no
    // badge at all.
    const previous = points[i - 1];
    const next = points[i + 1];
    if (inside(points[i]) || (previous && inside(previous)) || (next && inside(next))) visible.push(points[i]);
  }
  if (visible.length === 0) return null;
  if (visible.length === 1) return visible[0];

  let total = 0;
  for (let i = 0; i < visible.length - 1; i += 1) total += Math.hypot(visible[i + 1].x - visible[i].x, visible[i + 1].y - visible[i].y);
  if (total === 0) return visible[0];

  let travelled = 0;
  for (let i = 0; i < visible.length - 1; i += 1) {
    const step = Math.hypot(visible[i + 1].x - visible[i].x, visible[i + 1].y - visible[i].y);
    if (travelled + step >= total / 2) {
      const t = step === 0 ? 0 : (total / 2 - travelled) / step;
      return {
        x: visible[i].x + (visible[i + 1].x - visible[i].x) * t,
        y: visible[i].y + (visible[i + 1].y - visible[i].y) * t,
      };
    }
    travelled += step;
  }
  return visible[visible.length - 1];
}

/** Total length of a path on the ground, in km — the haversine sum over its segments.
 *
 *  Offered so a caller with a bare list of coordinates and no routing service still has a figure
 *  to put in the badge. A real routing service returns its own distance, which follows the road
 *  rather than the drawn simplification of it, and should always be preferred. */
export function pathLengthKm(path: { lon: number; lat: number }[]): number {
  const R = 6371;
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}
