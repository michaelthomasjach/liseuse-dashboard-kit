import type { WarehouseItemKind } from "./warehouseModel";

/**
 * The isometric camera: the one transform, and the arithmetic to undo it.
 *
 * ## Why the projection is written out here as well as in CSS
 *
 * The plan is tilted with a CSS 3D transform — `rotateX` then `rotateZ` on the canvas layer — and
 * that does the whole job of *drawing*: the racks, the rails, the slot grids and the conveyor
 * chevrons all tilt together, with the browser sorting out what covers what. Nothing is redrawn.
 *
 * What CSS cannot do is answer the two questions editing needs:
 *
 *   - **which cell is under the pointer** — so a rack can still be dragged, a rail still traced.
 *   - **where on screen a given cell ends up** — so a label can be written flat over it.
 *
 * Both are the same matrix, one forwards and one backwards, so it is written once here and the CSS
 * is made to agree with it rather than the other way round. If the two ever disagree, dragging
 * lands the rack somewhere other than where the hand was, which is the kind of wrongness that
 * looks like a rendering glitch and is not.
 *
 * ## Why the inverse exists at all
 *
 * A 3D rotation projected orthographically — no perspective, which is what a CSS transform with no
 * `perspective` set gives — is **affine** on any plane. The floor is the plane z = 0, every cell
 * sits on it, and an affine map of a plane is invertible. Add perspective and this stops being
 * true, which is the reason this camera has none.
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

/** The CSS that must match the arithmetic above. Appended after the pan and zoom. */
export const ISO_TRANSFORM = `rotateX(${TILT}deg) rotateZ(${SWING}deg)`;

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
