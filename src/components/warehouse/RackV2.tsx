import { projectIso } from "./warehouseIso";
import "./RackV2.css";

/**
 * Étagère V2 — la boîte, et ce qui est posé dedans.
 *
 * A rack drawn as what it is in space: a rectangular box under the isometric camera, with its
 * twelve edges drawn and **two** of its six faces filled — the top and the bottom, both solid. The
 * four sides are not drawn at all, so the eye goes straight through the rack and out the other side.
 *
 * That is deliberate. Every earlier attempt at this drawing started from a filled shape and tried
 * to open it up afterwards — a grid whose cells were tinted, then transparent, then bordered, then
 * shadowed — and each one still read as a solid object with a pattern on it. An open steel frame is
 * not a solid with holes; it is edges with nothing between them.
 *
 * A **carton** sits on the bottom deck, and it is the opposite kind of thing: a closed box, so it
 * gets three filled faces and no transparency at all. That contrast is the whole point of putting
 * one there — a frame you see through, with something solid inside it. Its three faces are the same
 * colour at three lightnesses, one light source, which is what stops it reading as three unrelated
 * shapes meeting at a corner; lightness rather than a hue per face is also what survives e-ink,
 * where every accent collapses to the text colour.
 *
 * ## The geometry
 *
 * Eight corners: the footprint's four, at z = 0 and again at z = `height`. The camera
 * (`projectIso`, shared with the floor plan so this box sits in the same space as everything else)
 * sends each to the screen.
 *
 * ## What covers what
 *
 * The decks are opaque, so on a strict reading of depth they would swallow the far edges and the
 * back of the frame with them. They do not, because the frame is the subject: both decks are laid
 * down first and **every** edge is drawn over them. That is the one deliberate departure from what
 * the camera would really see, and it is the whole reason this drawing exists — a rack you can
 * read is a rack whose twelve edges are all there.
 *
 * The carton is the exception to the exception. It is genuinely in front of everything it overlaps:
 * two points that land on the same pixel differ by the camera's own direction, which runs along +x,
 * +y and up, so of two such points the one with the greater **x + y** is nearer — and the only
 * edges whose picture crosses a carton sitting away from the rack's near corner are edges behind
 * it. So the edges are split on that one number: those behind the carton are drawn before it, those
 * in front after.
 */

/** Un carton posé sur le plateau : position et taille en cases, `height` compté depuis le plateau. */
export interface RackV2Carton {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
}

export interface RackV2Props {
  /** Longueur de l'étagère, en cases. */
  width?: number;
  /** Profondeur, en cases. */
  depth?: number;
  /** Hauteur, en cases. */
  height?: number;
  /** Le carton posé sur le plateau du bas. `null` pour une étagère vide. */
  carton?: RackV2Carton | null;
  /** Pixels par case. Le même défaut que le plan d'entrepôt, pour que les deux s'accordent. */
  cellSize?: number;
  className?: string;
}

/** Room for half a stroke on each side, so the silhouette is not shaved by the viewBox. */
const PAD = 2;

/** Posé vers le bout gauche du plateau, en retrait de tous les bords — un carton touche rarement
 *  les montants, et en retrait il ne passe devant aucune arête, ce que l'ordre de dessin suppose. */
const DEFAULT_CARTON: RackV2Carton = { x: 0.9, y: 0.35, width: 1.5, depth: 1.3, height: 1.1 };

type Point = { x: number; y: number };
type Cell = [number, number];

export function RackV2({
  width = 8,
  depth = 2,
  height = 2.4,
  carton = DEFAULT_CARTON,
  cellSize = 22,
  className,
}: RackV2Props) {
  const at = (x: number, y: number, z: number) => projectIso(x * cellSize, y * cellSize, z * cellSize);
  /** Nearness: of two points that project to the same pixel, the greater is in front. */
  const nearness = ([x, y]: Cell) => x + y;

  // Both rings run the same way round the box, so corner i below sits under corner i above and the
  // uprights are simply the pairs.
  const foot: Cell[] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  const bottom = foot.map(([x, y]) => at(x, y, 0));
  const top = foot.map(([x, y]) => at(x, y, height));

  const edges = [
    ...foot.map((cell, i) => ({ a: bottom[i], b: bottom[(i + 1) % 4], near: Math.min(nearness(cell), nearness(foot[(i + 1) % 4])) })),
    ...foot.map((cell, i) => ({ a: top[i], b: top[(i + 1) % 4], near: Math.min(nearness(cell), nearness(foot[(i + 1) % 4])) })),
    ...foot.map((cell, i) => ({ a: bottom[i], b: top[i], near: nearness(cell) })),
  ];
  const cartonNear = carton ? carton.x + carton.width + carton.y + carton.depth : Infinity;
  const behind = edges.filter((edge) => edge.near < cartonNear);
  const inFront = edges.filter((edge) => edge.near >= cartonNear);

  // The carton's three visible faces — its top and the two sides the camera can see — and the seam
  // where its flaps meet, which is what makes it a carton rather than a block.
  const box = carton && {
    x0: carton.x,
    x1: carton.x + carton.width,
    y0: carton.y,
    y1: carton.y + carton.depth,
    z: carton.height,
  };
  const cartonTop = box && [at(box.x0, box.y0, box.z), at(box.x1, box.y0, box.z), at(box.x1, box.y1, box.z), at(box.x0, box.y1, box.z)];
  const cartonFront = box && [at(box.x0, box.y1, 0), at(box.x1, box.y1, 0), at(box.x1, box.y1, box.z), at(box.x0, box.y1, box.z)];
  const cartonSide = box && [at(box.x1, box.y0, 0), at(box.x1, box.y1, 0), at(box.x1, box.y1, box.z), at(box.x1, box.y0, box.z)];
  const seam = box && [at(box.x0, (box.y0 + box.y1) / 2, box.z), at(box.x1, (box.y0 + box.y1) / 2, box.z)];

  const all = [...bottom, ...top, ...(cartonTop ?? [])];
  const minX = Math.min(...all.map((p) => p.x)) - PAD;
  const minY = Math.min(...all.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...all.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...all.map((p) => p.y)) + PAD - minY;

  const ring = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");
  const line = (edge: { a: Point; b: Point }, key: string) => (
    <line key={key} className="lq-rack2__edge" x1={edge.a.x} y1={edge.a.y} x2={edge.b.x} y2={edge.b.y} />
  );

  return (
    <svg
      className={["lq-rack2", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label={carton ? "Étagère portant un carton" : "Étagère"}
    >
      <polygon className="lq-rack2__face lq-rack2__face--bottom" points={ring(bottom)} />
      <polygon className="lq-rack2__face lq-rack2__face--top" points={ring(top)} />
      {behind.map((edge, i) => line(edge, `b${i}`))}
      {cartonTop && cartonFront && cartonSide && seam && (
        <g className="lq-rack2__carton">
          <polygon className="lq-rack2__carton-face lq-rack2__carton-face--side" points={ring(cartonSide)} />
          <polygon className="lq-rack2__carton-face lq-rack2__carton-face--front" points={ring(cartonFront)} />
          <polygon className="lq-rack2__carton-face lq-rack2__carton-face--top" points={ring(cartonTop)} />
          <line className="lq-rack2__carton-seam" x1={seam[0].x} y1={seam[0].y} x2={seam[1].x} y2={seam[1].y} />
        </g>
      )}
      {inFront.map((edge, i) => line(edge, `f${i}`))}
    </svg>
  );
}
