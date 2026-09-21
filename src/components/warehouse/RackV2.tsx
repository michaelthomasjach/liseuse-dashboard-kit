import { projectIso } from "./warehouseIso";
import "./RackV2.css";

/**
 * Étagère V2 — la boîte, et rien que la boîte.
 *
 * A rack drawn as what it is in space: a rectangular box under the isometric camera, with its
 * twelve edges drawn and **two** of its six faces filled — the top and the bottom. The four sides
 * are not drawn at all, so the eye goes straight through the rack and out the other side.
 *
 * That is the whole of it, deliberately. Every earlier attempt at this drawing started from a
 * filled shape and tried to open it up afterwards — a grid whose cells were tinted, then
 * transparent, then bordered, then shadowed — and each one still read as a solid object with a
 * pattern on it. An open steel frame is not a solid with holes; it is edges with nothing between
 * them, and the only honest way to draw it is to draw the edges and leave the rest empty.
 *
 * ## The geometry
 *
 * Eight corners: the footprint's four, at z = 0 and again at z = `height`. The camera
 * (`projectIso`, shared with the floor plan so this box sits in the same space as everything else)
 * sends each to the screen. Then:
 *
 *   - the **bottom** face, drawn first because it is furthest away and shows through the open sides;
 *   - the **top** face over it — both translucent, because the two faces project to the same rhombus
 *     a height apart and overlap whenever the box is wider than it is tall, and an opaque top would
 *     hide the very floor that has to stay visible;
 *   - the **twelve edges** last, over both fills, so nothing softens them: four along the bottom,
 *     four along the top, four uprights joining them.
 *
 * No face is hidden, so no edge is hidden either: all twelve are drawn at the same weight, which is
 * what a frame you can see through actually looks like.
 */

export interface RackV2Props {
  /** Longueur de l'étagère, en cases. */
  width?: number;
  /** Profondeur, en cases. */
  depth?: number;
  /** Hauteur, en cases. */
  height?: number;
  /** Pixels par case. Le même défaut que le plan d'entrepôt, pour que les deux s'accordent. */
  cellSize?: number;
  className?: string;
}

/** Room for half a stroke on each side, so the silhouette is not shaved by the viewBox. */
const PAD = 2;

export function RackV2({ width = 8, depth = 2, height = 2.4, cellSize = 22, className }: RackV2Props) {
  const corner = (x: number, y: number, z: number) => projectIso(x * cellSize, y * cellSize, z * cellSize);

  // Both rings run the same way round the box, so corner i below sits under corner i above and the
  // uprights are simply the pairs.
  const bottom = [corner(0, 0, 0), corner(width, 0, 0), corner(width, depth, 0), corner(0, depth, 0)];
  const top = [corner(0, 0, height), corner(width, 0, height), corner(width, depth, height), corner(0, depth, height)];

  const all = [...bottom, ...top];
  const minX = Math.min(...all.map((p) => p.x)) - PAD;
  const minY = Math.min(...all.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...all.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...all.map((p) => p.y)) + PAD - minY;

  const ring = (points: { x: number; y: number }[]) => points.map((p) => `${p.x},${p.y}`).join(" ");
  const edges = [
    ...bottom.map((from, i) => [from, bottom[(i + 1) % 4]]),
    ...top.map((from, i) => [from, top[(i + 1) % 4]]),
    ...bottom.map((from, i) => [from, top[i]]),
  ];

  return (
    <svg
      className={["lq-rack2", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Étagère"
    >
      <polygon className="lq-rack2__face lq-rack2__face--bottom" points={ring(bottom)} />
      <polygon className="lq-rack2__face lq-rack2__face--top" points={ring(top)} />
      {edges.map(([from, to], i) => (
        <line key={i} className="lq-rack2__edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      ))}
    </svg>
  );
}
