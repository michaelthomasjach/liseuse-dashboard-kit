import type { ReactNode } from "react";
import { projectIso } from "./warehouseIso";
import { paintOrder } from "./warehousePaint";
import {
  boxFaces,
  fitRackItem,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import "./RackV2.css";

/**
 * Étagère V2 — deux plateaux, quatre montants, et ce qu'on pose dessus.
 *
 * A rack drawn as what it is in space: a rectangular box under the isometric camera, with only its
 * **members** filled in. The long sides are not closed, so the eye goes straight through the rack
 * and out the other side.
 *
 * That is deliberate. Every earlier attempt at this drawing started from a filled shape and tried
 * to open it up afterwards — a grid whose cells were tinted, then transparent, then bordered, then
 * shadowed — and each one still read as a solid object with a pattern on it. An open steel frame is
 * not a solid with holes; it is members with nothing between them.
 *
 * ## The members
 *
 *   - the two **decks**, slabs of `deckThickness`. A deck with no thickness is a shape; a deck with
 *     an edge is a piece of steel, and it is the edge that says which side of it you are looking at;
 *   - the four **posts**, with `posts`. A line says where an upright is; a post says how thick it
 *     is, which corner of the footprint it stands on and which way it faces. Each is a square column
 *     set *inward* from its corner, so the box's silhouette is exactly the one the lines drew —
 *     turning the posts on changes what the uprights are made of, not where the rack is;
 *   - the four **feet**, with `feet`: the uprights carrying on below the bottom deck, on the racks
 *     that actually stand on the ground — a stacked rack rests on the one under it and has nothing
 *     to lift. A foot is not an extra part, it is the post continuing to the floor, so it has the
 *     post's own section;
 *   - the two **braces**, with `braces`: one diagonal across each end frame, from the near post's
 *     foot to the far post's head. It is the member that makes a rack a rack rather than four legs
 *     under two shelves — an unbraced frame is a parallelogram waiting to happen, and every real
 *     upright frame carries one. It lies *in* the frame, on the plane through the two posts'
 *     centres, because that is where it is welded.
 *
 * ## What is put on the lower deck
 *
 * The lower deck divides into `slotsX` × `slotsY` **portions**, and `contents` gives each one's
 * state, in reading order: a kind of thing standing on it, `"interdit"` if nothing may be put there,
 * or `null` if it is free. A portion is the unit of "somewhere to put something": whatever a
 * kind is, it is centred on its own portion and fitted to it, so filling a rack is a matter of
 * naming things rather than of placing them. The kinds themselves — carton, boîte, palette, bidon,
 * bouteille — live in `rackItems.tsx`, where each is drawn once and shown from two cameras.
 *
 * ## One rack, or a block of them
 *
 * `width`, `depth` and `height` are one rack's three dimensions; `countX`, `countY` and `countZ`
 * are how many of it to draw along each axis. They **abut exactly** — no gap, no spacing prop:
 * racks pushed together is what a run of shelving is, and a gap is something a caller can get by
 * asking for two blocks.
 *
 * Stacked, a deck is **shared rather than doubled**: only the rack with nothing above it carries a
 * top deck, and the others run their uprights straight up to the underside of the one overhead. A
 * shelf between two floors is one piece of steel, not two lying on each other — drawing both put a
 * seam across every floor of the stack and made the whole thing read as boxes piled up instead of
 * as shelving.
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
 *   - **within a rack**: the bottom slab, then its posts, braces and contents (`paintOrder` again,
 *     since each is just one more footprint), then the top slab.
 */

/**
 * L'état d'une portion de plateau : ce qui est dessus, ou le fait que rien ne peut y aller.
 *
 * Un seul champ et non deux listes parallèles : une portion répond à une seule question, et deux
 * tableaux à tenir en phase par leur indice finiraient par se contredire — une portion à la fois
 * interdite et occupée n'a pas de sens, et le type est l'endroit où le dire.
 */
export type RackV2Slot = RackItemKind | "interdit" | null;

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
  /** Portions du plateau du bas sur l'axe X. */
  slotsX?: number;
  /** Portions du plateau du bas sur l'axe Y. */
  slotsY?: number;
  /** L'état de chaque portion, en ordre de lecture (une rangée Y après l'autre) : une sorte de
   *  chose posée dessus, `"interdit"` si rien ne peut y être déposé, `null` si elle est libre.
   *  La liste peut être plus courte que le nombre de portions. */
  contents?: RackV2Slot[];
  /** Épaisseur des deux plateaux, en cases. */
  deckThickness?: number;
  /** Des poteaux modélisés en volume à la place des quatre arêtes verticales. */
  posts?: boolean;
  /** Côté d'un poteau, en cases. */
  postSize?: number;
  /** Une diagonale de contreventement dans chacun des deux cadres d'about. */
  braces?: boolean;
  /** Des pieds sous les étagères qui touchent le sol, pour que leur plateau n'y soit pas posé. */
  feet?: boolean;
  /** Pixels par case. Le même défaut que le plan d'entrepôt, pour que les deux s'accordent. */
  cellSize?: number;
  className?: string;
}

/** Room for half a stroke on each side, so the silhouette is not shaved by the viewBox. */
const PAD = 2;

/** Assez épais pour se lire comme un volume à une case de large, assez mince pour rester un
 *  poteau : c'est la section d'un montant de palettier ramenée à l'échelle du plan. */
const DEFAULT_POST_SIZE = 0.22;

/** La hauteur d'une lisse de palettier, à l'échelle du plan. Mesuré : à 0,12 il ne restait que
 *  deux pixels de tranche entre les deux traits qui la bordent, et une tranche plus mince que son
 *  propre contour n'est pas une épaisseur, c'est un trait plus gras. */
const DEFAULT_DECK_THICKNESS = 0.2;

/** Ce qu'un pied dépasse sous le plateau, en fraction de la section d'un montant. Un pied est le
 *  montant qui continue jusqu'au sol, pas une pièce de plus : il a donc la même section, et il ne
 *  dépasse que de quoi décoller le plateau — assez pour qu'on voie le jour dessous, pas assez pour
 *  que l'étagère ait l'air montée sur pilotis. */
const FOOT_RISE = 0.75;

/** Par axe. Ce composant dessine chaque étagère entièrement, sans niveau de détail : au-delà, ce
 *  n'est plus un dessin mais une scène, et c'est un autre travail que celui-ci. */
const MAX_COUNT = 24;

/** Pas des rayures d'une zone interdite, en cases. Fixe, et non proportionnel à la portion : des
 *  rayures plus serrées sur une petite zone se liraient comme un motif différent, or c'est le même
 *  interdit. */
const HATCH_STEP = 0.3;

type Cell = [number, number];
type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

const count = (n: number) => Math.max(1, Math.min(MAX_COUNT, Math.floor(n) || 1));

export function RackV2({
  width = 8,
  depth = 2,
  height = 2.4,
  countX = 1,
  countY = 1,
  countZ = 1,
  slotsX = 1,
  slotsY = 1,
  contents = ["carton"],
  deckThickness = DEFAULT_DECK_THICKNESS,
  posts = false,
  postSize = DEFAULT_POST_SIZE,
  braces = false,
  feet = false,
  cellSize = 22,
  className,
}: RackV2Props) {
  const at: Project = (x, y, z) => projectIso(x * cellSize, y * cellSize, z * cellSize);
  const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const nx = count(countX);
  const ny = count(countY);
  const nz = count(countZ);
  const sx = count(slotsX);
  const sy = count(slotsY);

  // Two slabs can never eat the whole rack: a third of the height each is already more deck than
  // rack, and past that there would be nowhere for the posts to run.
  const slabZ = Math.max(0, Math.min(deckThickness, height / 3));
  const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));

  /** One rack, standing with its far-left-bottom corner at (ox, oy, oz). `roofed` is false when
   *  another rack is stacked on this one: the deck above then belongs to *that* rack, and this one
   *  carries its uprights right up to it. */
  const rack = (ox: number, oy: number, oz: number, roofed: boolean, tag: string): ReactNode[] => {
    const floorZ = oz + slabZ;
    const ceilZ = oz + height - (roofed ? slabZ : 0);
    const clearance = ceilZ - floorZ;
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
            solidVolume("post", `${tag}p${i}`, boxFaces(at, x0, x1, y0, y1, floorZ, ceilZ))
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

    if (braces) {
      // The diagonal across each end frame, from the near upright's foot to the far upright's head.
      //
      // It is made of whatever the frame is made of: a strap when the uprights are posts, a line
      // when they are lines. A solid diagonal between two drawn lines would say that the brace is
      // the real member and the uprights are guides — and it would be the only volume in a drawing
      // that had decided not to have any.
      //
      // Where it sits follows from the same thing. Against posts it lies *in* the frame, on the
      // plane through both posts' centres, because that is where it is welded; against lines there
      // is no thickness to be inside of, so it runs corner to corner, exactly where those lines are.
      const inset = posts ? side / 2 : 0;
      const yNear = oy + depth - inset;
      const yFar = oy + inset;
      const run = yFar - yNear;
      const rise = ceilZ - floorZ;
      const span = Math.hypot(run, rise) || 1;
      const strap = side * 0.5;
      // The normal to the diagonal, within the (y, z) plane — so the strap keeps its section
      // however tall or deep the rack is.
      const ny2 = (-rise / span) * (strap / 2);
      const nz2 = (run / span) * (strap / 2);
      [ox + inset, ox + width - inset].forEach((planeX, i) => {
        pieces.push({
          x: planeX,
          y: yFar,
          width: 0,
          height: depth - 2 * inset,
          render: () =>
            posts ? (
              <g key={`${tag}b${i}`} className="lq-iso__solid lq-iso__solid--post">
                <polygon
                  className="lq-iso__face lq-iso__face--front"
                  points={ring([
                    at(planeX, yNear + ny2, floorZ + nz2),
                    at(planeX, yFar + ny2, ceilZ + nz2),
                    at(planeX, yFar - ny2, ceilZ - nz2),
                    at(planeX, yNear - ny2, floorZ - nz2),
                  ])}
                />
              </g>
            ) : (
              <line
                key={`${tag}b${i}`}
                className="lq-rack2__edge"
                x1={at(planeX, yNear, floorZ).x}
                y1={at(planeX, yNear, floorZ).y}
                x2={at(planeX, yFar, ceilZ).x}
                y2={at(planeX, yFar, ceilZ).y}
              />
            ),
        });
      });
    }

    // The lower deck's portions: the area between the posts, divided in reading order.
    const areaX = ox + side;
    const areaY = oy + side;
    const slotW = (width - 2 * side) / sx;
    const slotD = (depth - 2 * side) / sy;
    // Les zones interdites, hachurées à même le plateau : les rayures sont tracées *dans* le plan
    // du plateau, pas plaquées à l'écran, donc elles suivent la surface comme une peinture au sol
    // et non comme un filtre posé sur l'image. Elles portent seules le message sous e-ink, où la
    // teinte d'alerte s'effondre sur la couleur du texte.
    const barred: ReactNode[] = [];
    const hatch = (x0: number, x1: number, y0: number, y1: number, z: number, key: string) => {
      const out: ReactNode[] = [];
      // Les rayures sont les droites x − y = c : à 45° des bords de la portion, ce qu'une hachure
      // d'interdiction doit être.
      const from = Math.ceil((x0 - y1) / HATCH_STEP) * HATCH_STEP;
      for (let c = from, n = 0; c < x1 - y0; c += HATCH_STEP, n += 1) {
        const xa = Math.max(x0, y0 + c);
        const xb = Math.min(x1, y1 + c);
        if (xb - xa < 1e-6) continue;
        const a = at(xa, xa - c, z);
        const b = at(xb, xb - c, z);
        out.push(<line key={`${key}h${n}`} className="lq-rack2__hatch" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
      }
      return out;
    };

    for (let j = 0; j < sy; j += 1) {
      for (let i = 0; i < sx; i += 1) {
        const slot = contents[j * sx + i];
        if (!slot) continue;
        const x0 = areaX + i * slotW;
        const y0 = areaY + j * slotD;
        if (slot === "interdit") {
          const key = `${tag}x${i}-${j}`;
          barred.push(
            <polygon
              key={key}
              className="lq-rack2__blocked"
              points={ring([at(x0, y0, floorZ), at(x0 + slotW, y0, floorZ), at(x0 + slotW, y0 + slotD, floorZ), at(x0, y0 + slotD, floorZ)])}
            />
          );
          barred.push(...hatch(x0, x0 + slotW, y0, y0 + slotD, floorZ, key));
          continue;
        }
        const fit = fitRackItem(slot, { x: x0, y: y0, width: slotW, depth: slotD }, floorZ, clearance);
        pieces.push({
          x: fit.cx - fit.half,
          y: fit.cy - fit.half,
          width: fit.half * 2,
          height: fit.half * 2,
          render: () => rackItemIso(slot, fit, at, `${tag}i${i}-${j}`),
        });
      }
    }

    // Where one portion ends and the next begins, scored on the deck it divides.
    const dividers: ReactNode[] = [];
    for (let i = 1; i < sx; i += 1) {
      const x = areaX + i * slotW;
      const a = at(x, areaY, floorZ);
      const b = at(x, areaY + slotD * sy, floorZ);
      dividers.push(<line key={`${tag}dx${i}`} className="lq-rack2__divider" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
    for (let j = 1; j < sy; j += 1) {
      const y = areaY + j * slotD;
      const a = at(areaX, y, floorZ);
      const b = at(areaX + slotW * sx, y, floorZ);
      dividers.push(<line key={`${tag}dy${j}`} className="lq-rack2__divider" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }

    // Les pieds : seulement sous les étagères qui touchent vraiment le sol. Une étagère empilée
    // repose sur celle du dessous, elle n'a rien à décoller. Dessinés avant le plateau du bas, qui
    // est au-dessus d'eux et opaque : il recouvre ce qui est engagé dessous, et ne laisse voir que
    // ce qui dépasse — ce qui est exactement ce qu'on veut voir.
    const footNodes: ReactNode[] = [];
    if (feet && oz === 0) {
      const rise = side * FOOT_RISE;
      const stand: Piece[] = foot.map(([cx, cy], i) => {
        const x0 = cx > ox ? cx - side : cx;
        const x1 = cx > ox ? cx : cx + side;
        const y0 = cy > oy ? cy - side : cy;
        const y1 = cy > oy ? cy : cy + side;
        return {
          x: posts ? x0 : cx,
          y: posts ? y0 : cy,
          width: posts ? x1 - x0 : 0,
          height: posts ? y1 - y0 : 0,
          render: () =>
            posts ? (
              solidVolume("post", `${tag}f${i}`, boxFaces(at, x0, x1, y0, y1, -rise, oz))
            ) : (
              <line
                key={`${tag}f${i}`}
                className="lq-rack2__edge"
                x1={at(cx, cy, -rise).x}
                y1={at(cx, cy, -rise).y}
                x2={at(cx, cy, oz).x}
                y2={at(cx, cy, oz).y}
              />
            ),
        };
      });
      paintOrder(stand).forEach((piece) => footNodes.push(piece.render()));
    }

    const deck = (material: string, key: string, z0: number, z1: number, extra?: ReactNode) =>
      solidVolume(material, `${tag}${key}`, boxFaces(at, ox, ox + width, oy, oy + depth, z0, z1), slabZ === 0, extra);

    return [
      ...footNodes,
      deck("steel-shaded", "lower", oz, floorZ, dividers.length + barred.length > 0 ? <>{dividers}{barred}</> : undefined),
      ...paintOrder(pieces).map((piece) => piece.render()),
      ...(roofed ? [deck("steel", "upper", ceilZ, oz + height)] : []),
    ];
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
          render: () => <g key={`${ix}-${iy}-${iz}`}>{rack(ox, oy, iz * height, iz === nz - 1, `${ix}-${iy}-${iz}-`)}</g>,
        });
      }
    }
    paintOrder(floor).forEach((piece) => drawn.push(piece.render()));
  }

  const spanX = nx * width;
  const spanY = ny * depth;
  const spanZ = nz * height;
  const under = feet ? -side * FOOT_RISE : 0;
  const corners = [
    at(0, 0, 0),
    at(spanX, 0, under),
    at(spanX, spanY, under),
    at(0, spanY, under),
    at(0, 0, spanZ),
    at(spanX, spanY, spanZ),
  ];
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
      aria-label={nx * ny * nz > 1 ? `${nx * ny * nz} étagères` : "Étagère"}
    >
      {drawn}
    </svg>
  );
}
