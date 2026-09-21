import type { WarehouseItemKind } from "./warehouseModel";

/**
 * The isometric camera: one affine map, written once, and everything the view draws derived from it.
 *
 * ## Why the camera is a 2D matrix and not a CSS 3D transform
 *
 * The first version tilted the canvas with `rotateX(60deg) rotateZ(45deg)`, stood the walls up
 * with `rotateX(90deg)` / `rotateY(-90deg)` under `transform-style: preserve-3d`, and left the
 * browser to sort out what covers what. It drew the right picture — until a wall crossed the edge
 * of the surface. Chrome then dropped the *inner* end of that wall: the stretch left off-screen came
 * back as a missing stretch of the same length at the other end, mirrored, and which walls it
 * happened to depended on which other walls were on screen. Panning made it come and go. It
 * reproduces with two elements on the page, and no CSS setting reaches it — `overflow`, `clip-path`,
 * `will-change`, `backface-visibility` and dropping the walls' filters were all tried.
 *
 * There was never a need for 3D. This camera has no perspective, and an orthographic view of a
 * plane is **affine**: the floor projects through one 2×2 matrix, a height is a fixed
 * screen-vertical offset, and each standing wall is a *shear* of its own rectangle. All of that is
 * a 2D `matrix()`, which browsers draw exactly and in the order the DOM gives them. So the tilt is
 * a 2D matrix on the canvas, a wall is a sheared `<div>`, and what covers what is decided in
 * `warehousePaint.ts` rather than left to a 3D sorter.
 *
 * ## The two directions
 *
 * `projectIso` sends a floor point (and a height) to the screen; `unprojectIso` brings a screen
 * point back to the floor. Editing needs both: *which cell is under the pointer*, so a rack can
 * still be dragged and a rail traced, and *where a cell ends up*, so a label can be written flat
 * over the picture. The CSS strings below are built from the same constants, so the drawing and the
 * arithmetic cannot disagree — if they did, a dragged rack would land somewhere other than where
 * the hand was, which looks like a rendering glitch and is not.
 *
 * ## Why the inverse exists at all
 *
 * An affine map of a plane is invertible. Add perspective and this stops being true, which is the
 * reason this camera has none.
 */

/** Tilt away from the viewer. 60° is the 2∶1 isometric every tile engine uses: one cell along the
 *  floor becomes twice as wide as it is tall, so the diagonals land on whole pixels and the grid
 *  does not shimmer. */
const TILT = 60;
/** Turn about the vertical. 45° is what puts the corner of the plan toward the viewer and makes
 *  both visible walls of a box equal — anything else favours one side. */
const SWING = 45;

const RAD = Math.PI / 180;
/** Horizontal scale of the (x − y) diagonal. */
const KX = Math.cos(SWING * RAD);
/** Vertical scale of the (x + y) diagonal, already flattened by the tilt. */
const KY = Math.sin(SWING * RAD) * Math.cos(TILT * RAD);
/** How far up the screen a unit of height carries. */
const KZ = Math.sin(TILT * RAD);

/**
 * How far along *both* floor axes a unit of height steps, in the canvas's own frame.
 *
 * Inside the tilted canvas nothing can be moved "up the screen" directly — every offset is a floor
 * offset and gets projected. Straight up on screen is the (1, 1) diagonal on the floor, since only
 * `x − y` moves the screen's x, and the diagonal projects to `2·KY` per unit; so one unit of height
 * is `−KZ / (2·KY)` along each axis.
 */
const LIFT = KZ / (2 * KY);

const css = (n: number) => Number(n.toFixed(6));

/** The camera as CSS: the floor's own 2×2 map. Appended after the pan and zoom. */
export const ISO_TRANSFORM = `matrix(${css(KX)}, ${css(KY)}, ${css(-KX)}, ${css(KY)}, 0, 0)`;

/**
 * A wall along the canvas's +y edge of a box, stood up from the floor line it sits on.
 *
 * The wall is a plain `<div>` positioned on that line — `left` at the box's x, `top` at its bottom
 * edge, as wide as the box and as tall as the box is high — with `transform-origin: 0 0`. Its own
 * x runs along the floor unchanged; its own y is *height*, and a step of height is the diagonal
 * step above. So CSS-y runs up the wall, which is what RackModules draws its elevation against.
 */
export const ISO_FRONT_WALL = `matrix(1, 0, ${css(-LIFT)}, ${css(-LIFT)}, 0, 0)`;

/**
 * The wall along the +x edge: positioned at the box's right edge and top, as wide as the box is
 * high and as tall as the box is deep. Here it is the div's own *x* that is height and its y that
 * runs along the floor — the two axes swap, which RackModules' side face allows for.
 */
export const ISO_SIDE_WALL = `matrix(${css(-LIFT)}, ${css(-LIFT)}, 0, 1, 0, 0)`;

/** The transform that raises a flat element — a top face, a machine — by `zPx` canvas pixels. It
 *  goes *first* in a transform chain: it is a step in the canvas's frame, before anything the
 *  element does in its own. */
export function liftIso(zPx: number): string {
  return `translate(${css(-LIFT * zPx)}px, ${css(-LIFT * zPx)}px)`;
}

/**
 * How tall each kind stands, in cells.
 *
 * Chosen so the relief carries information rather than just announcing that the view has tilted: a
 * rack towers because a rack *is* the tall thing on a floor, a conveyor barely lifts because its
 * whole point is that goods pass over it, and a zone stays flat on the ground because it is a
 * region and not an object.
 */
export const ISO_HEIGHT: Record<WarehouseItemKind, number> = {
  rack: 2.4,
  station: 1.5,
  charger: 0.8,
  conveyor: 0.5,
  belt: 0.4,
  curve: 0.5,
  junction: 0.5,
  wall: 1.6,
  zone: 0,
};

/** A point on the floor (or above it), in canvas pixels, to its position on screen — before the
 *  pan and zoom, which the caller applies. */
export function projectIso(x: number, y: number, z = 0): { x: number; y: number } {
  return { x: KX * (x - y), y: KY * (x + y) - KZ * z };
}

/** The floor point under a screen position — the inverse of `projectIso` at z = 0.
 *
 *  Solving the two diagonals: `sx / KX` gives `x − y` and `sy / KY` gives `x + y`, and a sum and a
 *  difference are one addition away from the pair. */
export function unprojectIso(screenX: number, screenY: number): { x: number; y: number } {
  const difference = screenX / KX;
  const sum = screenY / KY;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2 };
}
