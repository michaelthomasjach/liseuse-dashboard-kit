/**
 * Back-to-front order for things standing on the floor, under the isometric camera.
 *
 * ## Why the order is computed at all
 *
 * The isometric view is drawn in 2D (see warehouseIso.ts for why the CSS 3D version was dropped),
 * so what covers what is simply the DOM order — and the DOM order has to be the depth order. That
 * is this function's one job.
 *
 * ## The rule
 *
 * The camera looks from the +x, +y corner of the plan, so of two boxes that do not overlap on the
 * floor, the one further along +x or +y is nearer. That only matters when their *pictures* overlap,
 * and two axis-aligned boxes' pictures overlap only when the boxes share some range on one axis and
 * are separated on the other. Separated on both — diagonal neighbours — their pictures never touch:
 * the nearer one's left edge is exactly where the further one's right edge ends. So the rule never
 * has to guess about that case, which is the case every "sort by x + y" shortcut gets wrong.
 *
 *   A is behind B when they share some x and A ends before B starts in y,
 *                or they share some y and A ends before B starts in x.
 *
 * For boxes that do not overlap on the floor this relation has no cycles, and a topological sort of
 * it is the paint order. Boxes that *do* overlap on the floor — a rack dropped onto a rack — have no
 * right answer; the rule leaves them unordered and they fall back to the x + y key, nearer last.
 * The same key breaks any cycle, so every box is painted exactly once whatever the input.
 */

export interface PaintBox {
  /** Position and size on the floor, in cells. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** D'où regarde la caméra, en direction du sol. Par défaut `(1, 1)` : depuis le coin +x, +y. */
export interface PaintView {
  x: number;
  y: number;
}

const DEFAULT_VIEW: PaintView = { x: 1, y: 1 };

/** A is behind B. Along an axis the camera looks down, the nearer box is the one further along the
 *  camera's direction; along an axis it looks straight across (a zero component), neither is. */
function isBehind(a: PaintBox, b: PaintBox, view: PaintView): boolean {
  const shareX = a.x < b.x + b.width && b.x < a.x + a.width;
  const shareY = a.y < b.y + b.height && b.y < a.y + a.height;
  const alongY = view.y > 1e-9 ? a.y + a.height <= b.y : view.y < -1e-9 ? b.y + b.height <= a.y : false;
  const alongX = view.x > 1e-9 ? a.x + a.width <= b.x : view.x < -1e-9 ? b.x + b.width <= a.x : false;
  return (shareX && alongY) || (shareY && alongX);
}

/** The boxes, furthest first. Stable for boxes the rule does not order. */
export function paintOrder<T extends PaintBox>(boxes: T[], view: PaintView = DEFAULT_VIEW): T[] {
  const n = boxes.length;
  // `after[a]` is everything a must be painted before; `waits[b]` how many boxes b still waits on.
  const after: number[][] = boxes.map(() => []);
  const waits = new Array<number>(n).fill(0);
  for (let a = 0; a < n; a += 1) {
    for (let b = 0; b < n; b += 1) {
      if (a !== b && isBehind(boxes[a], boxes[b], view)) {
        after[a].push(b);
        waits[b] += 1;
      }
    }
  }

  // The depth of a box's centre along the camera's direction.
  const key = (i: number) => (boxes[i].x + boxes[i].width / 2) * view.x + (boxes[i].y + boxes[i].height / 2) * view.y;
  const done = new Array<boolean>(n).fill(false);
  let ready: number[] = [];
  for (let i = 0; i < n; i += 1) if (waits[i] === 0) ready.push(i);

  const out: T[] = [];
  while (out.length < n) {
    let pick = -1;
    if (ready.length > 0) {
      // Of everything that may be painted now, the furthest back first — the tie-break that keeps
      // unordered boxes (overlapping footprints) from swapping between renders.
      for (const i of ready) if (pick === -1 || key(i) < key(pick) || (key(i) === key(pick) && i < pick)) pick = i;
      ready = ready.filter((i) => i !== pick);
    } else {
      // A cycle: only overlapping footprints can make one. Take the furthest back of what is left.
      for (let i = 0; i < n; i += 1) if (!done[i] && (pick === -1 || key(i) < key(pick))) pick = i;
    }
    done[pick] = true;
    out.push(boxes[pick]);
    for (const b of after[pick]) {
      waits[b] -= 1;
      if (waits[b] === 0 && !done[b]) ready.push(b);
    }
  }
  return out;
}
