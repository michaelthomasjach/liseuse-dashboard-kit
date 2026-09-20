import type { WarehouseItem } from "./warehouseModel";

/**
 * The centre line a conveyor's goods actually travel along, and the chevrons that say which way.
 *
 * Why a shared path rather than a CSS background per shape: a straight run, a corner and a
 * junction are the same drawing problem — a line through the box, with arrows laid along it — and
 * the only thing that differs is the line. Expressing that once means the corner gets the same
 * chevron spacing, the same reversal rule and the same theming as the straight run, instead of
 * three treatments that almost match.
 *
 * Everything is in the item's **own frame**, before rotation: the length runs along `+x`. The
 * component rotates the whole drawing afterwards, which is what keeps a corner's turn correct at
 * all four orientations without four sets of coordinates.
 */

export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowChevron {
  x: number;
  y: number;
  /** Degrees, 0 pointing along `+x`. */
  angle: number;
}

/** Cells between chevrons. Close enough to read as a direction, far enough not to become a
 *  texture — at one per cell a long conveyor turns into a hatched bar. */
const CHEVRON_EVERY = 1.1;

/** How many segments a quarter turn is sampled into. Twelve is where the corner stops looking
 *  like a chamfer at the zoom levels this plan actually uses. */
const ARC_STEPS = 12;

/**
 * The line (or lines) a conveyor of this kind carries, in cells, in the item's own frame.
 *
 * A junction returns two: the main run and the branch that joins it. Two polylines rather than a
 * forked one, because a fork has no single direction and the chevrons have to be laid along each
 * arm separately — which is also how it reads on a real floor.
 */
export function conveyorLines(kind: WarehouseItem["kind"], width: number, height: number): FlowPoint[][] {
  const midY = height / 2;
  const midX = width / 2;

  if (kind === "curve") {
    // A quarter turn: in on the left at mid-height heading east, out at the bottom at mid-width
    // heading south.
    //
    // A quarter *ellipse*, not a circular arc. The turn has to leave both edges at a right angle —
    // that is what lets two corners meet a straight run without a kink — and a circle can only do
    // that on a square box, because its radius would have to equal half the width and half the
    // height at once. Sized to the box, the ellipse does it at any proportion:
    //
    //   p(t) = (midX·sin t, height − midY·cos t),  t from 0 to π/2
    //
    // whose tangent is (midX·cos t, midY·sin t) — due east at t = 0, due south at t = π/2.
    //
    // The first attempt was a circle centred on the inner corner. It did not even meet its own
    // entry point: the arc started at the box's top-left while the line arrived at mid-height, so
    // the first chevron pointed *north* on a conveyor running east. Caught by reading the drawn
    // chevron angles rather than by looking at it.
    const points: FlowPoint[] = [];
    for (let i = 0; i <= ARC_STEPS; i += 1) {
      const t = (i / ARC_STEPS) * (Math.PI / 2);
      points.push({ x: midX * Math.sin(t), y: height - midY * Math.cos(t) });
    }
    return [points];
  }

  if (kind === "junction") {
    return [
      // The main run, straight through.
      [
        { x: 0, y: midY },
        { x: width, y: midY },
      ],
      // The branch, joining it from below at the middle.
      [
        { x: midX, y: height },
        { x: midX, y: midY },
      ],
    ];
  }

  return [
    [
      { x: 0, y: midY },
      { x: width, y: midY },
    ],
  ];
}

/** Length of a polyline. */
function lengthOf(points: FlowPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return total;
}

/**
 * Chevrons laid at even spacing **along the line**, not at even index.
 *
 * On a straight run the two are the same and the distinction costs nothing. On a corner they are
 * not: the arc is sampled into a dozen short segments and a chevron per point would crowd the turn
 * and leave the straight approaches bare — the arrows would be densest exactly where the eye needs
 * them least.
 *
 * `reversed` flips the travel: the chevrons are laid from the far end and turned about, rather
 * than the whole drawing being mirrored, so a reversed corner still turns the same corner.
 */
export function flowChevrons(points: FlowPoint[], reversed: boolean): FlowChevron[] {
  const total = lengthOf(points);
  if (total === 0) return [];
  const count = Math.max(1, Math.floor(total / CHEVRON_EVERY));
  const chevrons: FlowChevron[] = [];

  for (let n = 0; n < count; n += 1) {
    // Offset by half a step so the first chevron sits inside the box rather than on its edge.
    const target = ((n + 0.5) / count) * total;
    let travelled = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const step = Math.hypot(b.x - a.x, b.y - a.y);
      if (step === 0) continue;
      if (travelled + step >= target) {
        const local = (target - travelled) / step;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        chevrons.push({
          x: a.x + (b.x - a.x) * local,
          y: a.y + (b.y - a.y) * local,
          angle: reversed ? angle + 180 : angle,
        });
        break;
      }
      travelled += step;
    }
  }
  return chevrons;
}

/** The compass direction a conveyor runs, once its rotation and `reversed` are applied — for the
 *  inspector's read-out, which is the one place a caller needs it in words. */
export function flowHeading(item: WarehouseItem): "est" | "sud" | "ouest" | "nord" {
  const quarters = (((item.rotation ?? 0) / 90 + (item.reversed ? 2 : 0)) % 4 + 4) % 4;
  return (["est", "sud", "ouest", "nord"] as const)[quarters];
}
