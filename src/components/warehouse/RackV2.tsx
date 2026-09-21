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
 * ## The geometry
 *
 * The footprint's four corners, at z = 0 and again at z = `height`; the camera (`projectIso`, shared
 * with the floor plan so this box sits in the same space as everything else) sends each to the
 * screen. The bottom slab takes the first `deckThickness` of that height and the top slab the last,
 * so the posts run between them and whatever stands in the rack stands on the lower slab's face —
 * `height` stays the height of the whole rack, which is the only number a caller should have to
 * think about.
 *
 * ## What covers what
 *
 * The decks are **opaque**, and that is taken literally: nothing shows through them. A line drawn
 * over a solid deck is how a picture says "this deck is glass", so the far posts are simply hidden
 * where the upper deck stands in front of them — which is what you see looking at a real rack from
 * above, and what makes the deck read as a sheet of steel rather than a tinted pane.
 *
 * So the order is strict depth, back to front: the bottom slab, then everything standing on it —
 * posts and carton — sorted by `paintOrder`, then the top slab, which is nearer than all of them
 * wherever it overlaps. `paintOrder` is the floor plan's own sorter: of two footprints that do not
 * overlap, the one further along +x or +y is in front, and that only decides anything when their
 * pictures meet.
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
  /** Hauteur hors tout, plateaux compris, en cases. */
  height?: number;
  /** Épaisseur des deux plateaux, en cases. */
  deckThickness?: number;
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

/** Assez épais pour se lire comme un volume à une case de large, assez mince pour rester un
 *  poteau : c'est la section d'un montant de palettier ramenée à l'échelle du plan. */
const DEFAULT_POST_SIZE = 0.22;

/** La hauteur d'une lisse de palettier, à l'échelle du plan. Mesuré : à 0,12 il ne restait que
 *  deux pixels de tranche entre les deux traits qui la bordent, et une tranche plus mince que son
 *  propre contour n'est pas une épaisseur, c'est un trait plus gras. */
const DEFAULT_DECK_THICKNESS = 0.2;

type Point = { x: number; y: number };
type Cell = [number, number];
type Faces = { top: Point[]; front: Point[]; side: Point[] };
type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

export function RackV2({
  width = 8,
  depth = 2,
  height = 2.4,
  deckThickness = DEFAULT_DECK_THICKNESS,
  posts = false,
  postSize = DEFAULT_POST_SIZE,
  carton = DEFAULT_CARTON,
  cellSize = 22,
  className,
}: RackV2Props) {
  const at = (x: number, y: number, z: number) => projectIso(x * cellSize, y * cellSize, z * cellSize);
  const ring = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

  const foot: Cell[] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  const bottom = foot.map(([x, y]) => at(x, y, 0));
  const top = foot.map(([x, y]) => at(x, y, height));

  // Two slabs can never eat the whole rack: a third of the height each is already more deck than
  // rack, and past that there would be nowhere for the posts to run.
  const slabZ = Math.max(0, Math.min(deckThickness, height / 3));
  /** The face things stand on, and the underside of the deck above them. */
  const floorZ = slabZ;
  const ceilZ = height - slabZ;

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

  const deck = (which: "upper" | "lower", z0: number, z1: number) =>
    volume(`deck-${which}`, which, solid(0, width, 0, depth, z0, z1), slabZ === 0);

  // Everything standing on the lower deck, each with the footprint `paintOrder` sorts on.
  const pieces: Piece[] = [];

  // The uprights: four lines, or four columns set inward from their own corner so the silhouette
  // stays exactly where the lines were.
  const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));
  foot.forEach(([cx, cy], i) => {
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
        posts ? (
          volume("post", `p${i}`, solid(x0, x1, y0, y1, floorZ, ceilZ), false)
        ) : (
          <line
            key={`p${i}`}
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
    const x1 = carton.x + carton.width;
    const y1 = carton.y + carton.depth;
    const midY = (carton.y + y1) / 2;
    const lid = floorZ + carton.height;
    pieces.push({
      x: carton.x,
      y: carton.y,
      width: carton.width,
      height: carton.depth,
      // The seam where the flaps meet is what makes it a carton rather than a block.
      render: () =>
        volume("carton", "carton", solid(carton.x, x1, carton.y, y1, floorZ, lid), false, [
          at(carton.x, midY, lid),
          at(x1, midY, lid),
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
      {deck("lower", 0, floorZ)}
      {paintOrder(pieces).map((piece) => piece.render())}
      {deck("upper", ceilZ, height)}
    </svg>
  );
}
