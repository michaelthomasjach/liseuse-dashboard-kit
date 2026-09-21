import type { ReactNode } from "react";
import { projectIso } from "./warehouseIso";
import { paintOrder } from "./warehousePaint";
import "./RackV2.css";

/**
 * Étagère V2 — deux plateaux, quatre montants, et ce qui est posé dedans.
 *
 * A rack drawn as what it is in space: a rectangular box under the isometric camera, with only its
 * **horizontal members** filled in. The four sides are not drawn at all, so the eye goes straight
 * through the rack and out the other side.
 *
 * That is deliberate. Every earlier attempt at this drawing started from a filled shape and tried
 * to open it up afterwards — a grid whose cells were tinted, then transparent, then bordered, then
 * shadowed — and each one still read as a solid object with a pattern on it. An open steel frame is
 * not a solid with holes; it is members with nothing between them.
 *
 * ## Everything in the picture is a volume, and every volume is opaque
 *
 *   - the two **decks**, slabs of `deckThickness`. A deck with no thickness is a shape; a deck with
 *     an edge is a piece of steel, and it is the edge that says which side of it you are looking at;
 *   - the four **posts**, with `posts`. A line says where an upright is; a post says how thick it
 *     is, which corner of the footprint it stands on and which way it faces. Each is a square column
 *     set *inward* from its corner, so the box's silhouette is exactly the one the lines drew —
 *     turning the posts on changes what the uprights are made of, not where the rack is;
 *   - the **carton** on the bottom deck, a closed box. That contrast is the point of putting one
 *     there: a frame you see through, with something solid inside it.
 *
 * All four are drawn the same way — top face, then the two sides the camera can see, at three
 * lightnesses of one colour under one light source. What distinguishes them is their material, not
 * their manner: a deck and a post are steel, a carton is kraft. Three lightnesses rather than three
 * hues is also what survives e-ink, where every accent collapses to the text colour.
 *
 * ## One rack, or a block of them
 *
 * `width`, `depth` and `height` are one rack's three dimensions; `countX`, `countY` and `countZ`
 * are how many of it to draw along each axis. They **abut exactly** — no gap, no spacing prop:
 * racks pushed together is what a run of shelving is, and a gap is something a caller can get by
 * asking for two blocks. Stacked, one rack's bottom slab lands on the one below's top slab, which
 * is what the doubled thickness at each floor is telling you.
 *
 * A block is drawn as **one** picture, not as N pictures side by side, because depth ordering is
 * the whole difficulty here and it cannot be decided a rack at a time.
 *
 * ## What covers what
 *
 * The decks are **opaque**, and that is taken literally: nothing shows through them. A line drawn
 * over a solid deck is how a picture says "this deck is glass", so the far posts are simply hidden
 * where the upper deck stands in front of them — which is what you see looking at a real rack from
 * above, and what makes the deck read as a sheet of steel rather than a tinted pane.
 *
 * Depth is one number. Two points that land on the same pixel differ by the camera's own direction,
 * which runs along +x, +y and up, so of two such points the one with the greater **x + y** is
 * nearer — and if they are at different heights, the higher one is nearer, since reaching it from
 * the lower one means travelling along that direction. That gives the order at three scales:
 *
 *   - **between floors**, bottom to top: every point of a floor is at or above every point of the
 *     floor below, so the whole of one floor is drawn before the whole of the next;
 *   - **within a floor**, `paintOrder` — the floor plan's own sorter: of two footprints that do not
 *     overlap, the one further along +x or +y is in front, and that only decides anything when
 *     their pictures meet;
 *   - **within a rack**: the bottom slab, then its posts and carton (`paintOrder` again, since a
 *     post and a carton are just two more footprints), then the top slab.
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
  /** Longueur d'une étagère (axe X), en cases. */
  width?: number;
  /** Profondeur d'une étagère (axe Y), en cases. */
  depth?: number;
  /** Hauteur hors tout d'une étagère (axe Z), plateaux compris, en cases. */
  height?: number;
  /** Nombre d'étagères en enfilade sur l'axe X. */
  countX?: number;
  /** Nombre de rangées d'étagères sur l'axe Y. */
  countY?: number;
  /** Nombre d'étagères empilées sur l'axe Z. */
  countZ?: number;
  /** Épaisseur des deux plateaux, en cases. */
  deckThickness?: number;
  /** Des poteaux modélisés en volume à la place des quatre arêtes verticales. */
  posts?: boolean;
  /** Côté d'un poteau, en cases. Sans effet si `posts` est faux. */
  postSize?: number;
  /** Le carton posé sur le plateau du bas de chaque étagère. `null` pour des étagères vides. */
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

/** Assez épais pour se lire comme un volume à une case de large, assez mince pour rester un
 *  poteau : c'est la section d'un montant de palettier ramenée à l'échelle du plan. */
const DEFAULT_POST_SIZE = 0.22;

/** La hauteur d'une lisse de palettier, à l'échelle du plan. Mesuré : à 0,12 il ne restait que
 *  deux pixels de tranche entre les deux traits qui la bordent, et une tranche plus mince que son
 *  propre contour n'est pas une épaisseur, c'est un trait plus gras. */
const DEFAULT_DECK_THICKNESS = 0.2;

/** Par axe. Ce composant dessine chaque étagère entièrement, sans niveau de détail : au-delà, ce
 *  n'est plus un dessin mais une scène, et c'est un autre travail que celui-ci. */
const MAX_COUNT = 24;

type Point = { x: number; y: number };
type Cell = [number, number];
type Faces = { top: Point[]; front: Point[]; side: Point[] };
type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

const count = (n: number) => Math.max(1, Math.min(MAX_COUNT, Math.floor(n) || 1));

export function RackV2({
  width = 8,
  depth = 2,
  height = 2.4,
  countX = 1,
  countY = 1,
  countZ = 1,
  deckThickness = DEFAULT_DECK_THICKNESS,
  posts = false,
  postSize = DEFAULT_POST_SIZE,
  carton = DEFAULT_CARTON,
  cellSize = 22,
  className,
}: RackV2Props) {
  const at = (x: number, y: number, z: number) => projectIso(x * cellSize, y * cellSize, z * cellSize);
  const ring = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

  const nx = count(countX);
  const ny = count(countY);
  const nz = count(countZ);

  // Two slabs can never eat the whole rack: a third of the height each is already more deck than
  // rack, and past that there would be nowhere for the posts to run.
  const slabZ = Math.max(0, Math.min(deckThickness, height / 3));
  const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));

  /** The three faces of a box the camera can see: its top, and the two sides facing +y and +x. */
  const solid = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Faces => ({
    top: [at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)],
    front: [at(x0, y1, z0), at(x1, y1, z0), at(x1, y1, z1), at(x0, y1, z1)],
    side: [at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1), at(x1, y0, z1)],
  });

  /** A volume, back face to front: the far side, then the near side, then the top over both. */
  const volume = (material: string, key: string, faces: Faces, flat: boolean, seam?: [Point, Point]) => (
    <g key={key} className={`lq-rack2__solid lq-rack2__solid--${material}`}>
      {!flat && <polygon className="lq-rack2__solid-face lq-rack2__solid-face--side" points={ring(faces.side)} />}
      {!flat && <polygon className="lq-rack2__solid-face lq-rack2__solid-face--front" points={ring(faces.front)} />}
      <polygon className="lq-rack2__solid-face lq-rack2__solid-face--top" points={ring(faces.top)} />
      {seam && <line className="lq-rack2__seam" x1={seam[0].x} y1={seam[0].y} x2={seam[1].x} y2={seam[1].y} />}
    </g>
  );

  /** One rack, standing with its near-left-bottom corner at (ox, oy, oz). */
  const rack = (ox: number, oy: number, oz: number, tag: string): ReactNode[] => {
    const floorZ = oz + slabZ;
    const ceilZ = oz + height - slabZ;
    const foot: Cell[] = [
      [ox, oy],
      [ox + width, oy],
      [ox + width, oy + depth],
      [ox, oy + depth],
    ];

    const pieces: Piece[] = [];
    foot.forEach(([cx, cy], i) => {
      const x0 = cx > ox ? cx - side : cx;
      const x1 = cx > ox ? cx : cx + side;
      const y0 = cy > oy ? cy - side : cy;
      const y1 = cy > oy ? cy : cy + side;
      pieces.push({
        x: posts ? x0 : cx,
        y: posts ? y0 : cy,
        width: posts ? x1 - x0 : 0,
        height: posts ? y1 - y0 : 0,
        render: () =>
          posts ? (
            volume("post", `${tag}p${i}`, solid(x0, x1, y0, y1, floorZ, ceilZ), false)
          ) : (
            <line
              key={`${tag}p${i}`}
              className="lq-rack2__edge"
              x1={at(cx, cy, floorZ).x}
              y1={at(cx, cy, floorZ).y}
              x2={at(cx, cy, ceilZ).x}
              y2={at(cx, cy, ceilZ).y}
            />
          ),
      });
    });

    if (carton) {
      const x0 = ox + carton.x;
      const x1 = x0 + carton.width;
      const y0 = oy + carton.y;
      const y1 = y0 + carton.depth;
      const lid = floorZ + carton.height;
      pieces.push({
        x: x0,
        y: y0,
        width: carton.width,
        height: carton.depth,
        // The seam where the flaps meet is what makes it a carton rather than a block.
        render: () =>
          volume("carton", `${tag}c`, solid(x0, x1, y0, y1, floorZ, lid), false, [
            at(x0, (y0 + y1) / 2, lid),
            at(x1, (y0 + y1) / 2, lid),
          ]),
      });
    }

    const deck = (which: "upper" | "lower", z0: number, z1: number) =>
      volume(`deck-${which}`, `${tag}${which}`, solid(ox, ox + width, oy, oy + depth, z0, z1), slabZ === 0);

    return [deck("lower", oz, floorZ), ...paintOrder(pieces).map((piece) => piece.render()), deck("upper", ceilZ, oz + height)];
  };

  // Floor by floor from the ground up, and inside each floor the racks sorted back to front.
  const drawn: ReactNode[] = [];
  for (let iz = 0; iz < nz; iz += 1) {
    const floor: Piece[] = [];
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const ox = ix * width;
        const oy = iy * depth;
        floor.push({
          x: ox,
          y: oy,
          width,
          height: depth,
          render: () => <g key={`${ix}-${iy}-${iz}`}>{rack(ox, oy, iz * height, `${ix}-${iy}-${iz}-`)}</g>,
        });
      }
    }
    paintOrder(floor).forEach((piece) => drawn.push(piece.render()));
  }

  const spanX = nx * width;
  const spanY = ny * depth;
  const spanZ = nz * height;
  const corners = [at(0, 0, 0), at(spanX, 0, 0), at(spanX, spanY, 0), at(0, spanY, 0), at(0, 0, spanZ), at(spanX, spanY, spanZ)];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-rack2", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label={nx * ny * nz > 1 ? `${nx * ny * nz} étagères` : carton ? "Étagère portant un carton" : "Étagère"}
    >
      {drawn}
    </svg>
  );
}
