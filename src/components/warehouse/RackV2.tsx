import type { ReactNode } from "react";
import { projectIso } from "./warehouseIso";
import { paintOrder } from "./warehousePaint";
import "./RackV2.css";

/**
 * Étagère V2 — la boîte, ses poteaux, et ce qui est posé dedans.
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
 * Two things in the picture are genuine volumes rather than edges, and both are opaque:
 *
 *   - the **carton** on the bottom deck, a closed box with three filled faces. That contrast is the
 *     point of putting one there — a frame you see through, with something solid inside it;
 *   - the **posts**, with `posts`. A line says where an upright is; a post says how thick it is,
 *     which corner of the footprint it stands on and which way it faces. Each one is a square
 *     column set *inward* from its corner, so the box's silhouette is exactly the one the lines
 *     drew — turning the posts on changes what the uprights are made of, not where the rack is.
 *
 * Their faces are the same colour at three lightnesses, one light source, which is what stops a
 * volume reading as three unrelated shapes meeting at a corner; lightness rather than a hue per
 * face is also what survives e-ink, where every accent collapses to the text colour.
 *
 * ## The geometry
 *
 * Eight corners: the footprint's four, at z = 0 and again at z = `height`. The camera
 * (`projectIso`, shared with the floor plan so this box sits in the same space as everything else)
 * sends each to the screen.
 *
 * ## What covers what
 *
 * The decks are **opaque**, and that is taken literally: nothing shows through them. A line drawn
 * over a solid deck is how a picture says "this deck is glass", so the far uprights and the far
 * rails are simply hidden where the upper deck stands in front of them — which is what you see
 * looking at a real rack from above, and what makes the deck read as a sheet of steel rather than a
 * tinted pane.
 *
 * So the order is strict depth, back to front: the bottom deck, then everything standing on it —
 * rails, uprights and carton — sorted by `paintOrder`, then the top deck, which is nearer than all
 * of them wherever it overlaps, and last that deck's own four edges, which are its silhouette and
 * so can never be behind it. `paintOrder` is the floor plan's own sorter: of two footprints that do
 * not overlap, the one further along +x or +y is in front, and that only decides anything when
 * their pictures meet. A rail is passed to it as a footprint of zero width, which is what it is.
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
  /** Des poteaux modélisés en volume à la place des quatre arêtes verticales. */
  posts?: boolean;
  /** Côté d'un poteau, en cases. Sans effet si `posts` est faux. */
  postSize?: number;
  /** Le carton posé sur le plateau du bas. `null` pour une étagère vide. */
  carton?: RackV2Carton | null;
  /** Pixels par case. Le même défaut que le plan d'entrepôt, pour que les deux s'accordent. */
  cellSize?: number;
  className?: string;
}

/** Room for half a stroke on each side, so the silhouette is not shaved by the viewBox. */
const PAD = 2;

/** Posé vers le bout gauche du plateau, en retrait de tous les bords — un carton touche rarement
 *  les montants. */
const DEFAULT_CARTON: RackV2Carton = { x: 0.9, y: 0.35, width: 1.5, depth: 1.3, height: 1.1 };

/** Un poteau fait à peu près un cinquième de la profondeur d'une étagère standard. Assez épais pour
 *  se lire comme un volume à une case de large, assez mince pour rester un poteau. */
const DEFAULT_POST_SIZE = 0.22;

type Point = { x: number; y: number };
type Cell = [number, number];
type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

export function RackV2({
  width = 8,
  depth = 2,
  height = 2.4,
  posts = false,
  postSize = DEFAULT_POST_SIZE,
  carton = DEFAULT_CARTON,
  cellSize = 22,
  className,
}: RackV2Props) {
  const at = (x: number, y: number, z: number) => projectIso(x * cellSize, y * cellSize, z * cellSize);
  const ring = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

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

  /** The three faces of a box the camera can see: its top, and the two sides facing +y and +x. */
  const solid = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => ({
    top: [at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)],
    front: [at(x0, y1, z0), at(x1, y1, z0), at(x1, y1, z1), at(x0, y1, z1)],
    side: [at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1), at(x1, y0, z1)],
  });
  const volume = (kind: "post" | "carton", key: string, faces: ReturnType<typeof solid>, seam?: [Point, Point]) => (
    <g key={key} className={`lq-rack2__${kind}`}>
      <polygon className={`lq-rack2__${kind}-face lq-rack2__${kind}-face--side`} points={ring(faces.side)} />
      <polygon className={`lq-rack2__${kind}-face lq-rack2__${kind}-face--front`} points={ring(faces.front)} />
      <polygon className={`lq-rack2__${kind}-face lq-rack2__${kind}-face--top`} points={ring(faces.top)} />
      {seam && <line className="lq-rack2__carton-seam" x1={seam[0].x} y1={seam[0].y} x2={seam[1].x} y2={seam[1].y} />}
    </g>
  );

  // Everything that stands on the bottom deck, each with the footprint `paintOrder` sorts on.
  const pieces: Piece[] = [];

  // The four floor rails: footprints of zero width, which is what a line on the floor is.
  foot.forEach((cell, i) => {
    const next = foot[(i + 1) % 4];
    pieces.push({
      x: Math.min(cell[0], next[0]),
      y: Math.min(cell[1], next[1]),
      width: Math.abs(next[0] - cell[0]),
      height: Math.abs(next[1] - cell[1]),
      render: () => <line key={`r${i}`} className="lq-rack2__edge" x1={bottom[i].x} y1={bottom[i].y} x2={bottom[(i + 1) % 4].x} y2={bottom[(i + 1) % 4].y} />,
    });
  });

  // The uprights: four lines, or four columns set inward from their own corner so the silhouette
  // stays exactly where the lines were.
  const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));
  foot.forEach((cell, i) => {
    const [cx, cy] = cell;
    const x0 = cx > 0 ? cx - side : cx;
    const x1 = cx > 0 ? cx : cx + side;
    const y0 = cy > 0 ? cy - side : cy;
    const y1 = cy > 0 ? cy : cy + side;
    pieces.push({
      x: posts ? x0 : cx,
      y: posts ? y0 : cy,
      width: posts ? x1 - x0 : 0,
      height: posts ? y1 - y0 : 0,
      render: () =>
        posts
          ? volume("post", `p${i}`, solid(x0, x1, y0, y1, 0, height))
          : <line key={`p${i}`} className="lq-rack2__edge" x1={bottom[i].x} y1={bottom[i].y} x2={top[i].x} y2={top[i].y} />,
    });
  });

  if (carton) {
    const x1 = carton.x + carton.width;
    const y1 = carton.y + carton.depth;
    const midY = (carton.y + y1) / 2;
    pieces.push({
      x: carton.x,
      y: carton.y,
      width: carton.width,
      height: carton.depth,
      // The seam where the flaps meet is what makes it a carton rather than a block.
      render: () =>
        volume("carton", "carton", solid(carton.x, x1, carton.y, y1, 0, carton.height), [
          at(carton.x, midY, carton.height),
          at(x1, midY, carton.height),
        ]),
    });
  }

  const all = [...bottom, ...top];
  const minX = Math.min(...all.map((p) => p.x)) - PAD;
  const minY = Math.min(...all.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...all.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...all.map((p) => p.y)) + PAD - minY;

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
      {paintOrder(pieces).map((piece) => piece.render())}
      <polygon className="lq-rack2__face lq-rack2__face--top" points={ring(top)} />
      {foot.map((_, i) => (
        <line key={`t${i}`} className="lq-rack2__edge" x1={top[i].x} y1={top[i].y} x2={top[(i + 1) % 4].x} y2={top[(i + 1) % 4].y} />
      ))}
    </svg>
  );
}
