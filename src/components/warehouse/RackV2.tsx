import type { ReactNode } from "react";
import {
  ISO_POST_SIZE,
  boxFaces,
  castShadow,
  frameCorners,
  fitRackItem,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import "./RackV2.css";
import { IsoCanvas } from "./isoCanvas";
import { useIsoCamera } from "./isoCamera";

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
 *     post's own section and, by default, a height taken from it; `footHeight` says otherwise;
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
 * `aisle` ouvre une allée entre les rangées, et `aisleEvery` dit tous les combien — deux par
 * défaut, parce que des palettiers se posent **dos à dos** : ce qu'une allée dessert, c'est une
 * paire de rangées et non une rangée. `crossAisle` fait la même chose en travers. À zéro, les
 * rangées se touchent, ce qui reste ce qu'un bloc compact veut dire.
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
 * `rotation` turns the whole block on the floor, about its own centre — one rotation for the block
 * and not one per rack, since racks turned individually inside a block would cut into each other.
 * The camera does not move: turning the shelving is something you do to the shelving.
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
  /** Largeur d'une allée entre deux rangées, en cases. Zéro : les rangées se touchent. */
  aisle?: number;
  /** Une allée toutes les combien de rangées. Deux par défaut, parce que des palettiers se posent
   *  dos à dos : ce qu'on dessert par une allée, c'est une paire de rangées et non une rangée. */
  aisleEvery?: number;
  /** Largeur d'une allée transversale, en cases, sur l'axe X. */
  crossAisle?: number;
  /** Une allée transversale toutes les combien d'étagères en enfilade. */
  crossEvery?: number;
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
  /** Hauteur dont les pieds dépassent sous le plateau, en cases. Par défaut, les trois quarts de
   *  la section d'un montant — un pied étant ce montant qui continue, sa taille par défaut suit la
   *  sienne plutôt que d'être un nombre de plus à tenir en accord avec elle. */
  footHeight?: number;
  /** Rotation du bloc sur le sol, en degrés — 0, 45 et 90 étant les orientations utiles. */
  rotation?: number;
  /** Poser l'ombre du bloc au sol. La direction de la lumière est celle du reste du kit : deux
   *  ombres qui tomberaient de deux côtés différents dans la même image sont pires que pas
   *  d'ombre du tout. */
  shadows?: boolean;
  /** Où poser le bloc sur le sol, en cases. Sert à le composer avec d'autres modules — un rail, un
   *  tapis, un picker — dans une même scène. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Donné, il remplace le cadrage sur le
   *  bloc lui-même : plusieurs modules qui partagent un cadre partagent exactement le même repère à
   *  l'écran, et se superposent sans rien avoir à aligner. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le bloc seul. L'ombre se sépare parce qu'elle est au
   *  sol et doit passer sous *tous* les modules d'une scène, pas seulement sous le sien — sans quoi
   *  l'ombre d'une étagère proche se poserait par-dessus le tapis lointain qu'elle traverse. */
  parts?: "all" | "shadow" | "machine";
  /**
   * Ne dessiner que ce qui **recouvre** une chose engagée dans l'étagère à cette hauteur, en cases :
   * les fourches d'un picker dans une alvéole, par exemple.
   *
   * Une fourche entrée dans une alvéole a devant elle le plateau qui la couvre et le montant du côté
   * de la caméra, alors que le reste de la machine est devant toute l'étagère : aucun ordre de
   * peinture ne satisfait les deux. On peint donc l'étagère, puis la machine, puis cette couche-ci
   * par-dessus — **masquée à la silhouette de ce qui est engagé** (`mask` sur l'élément, voir
   * `reachMask` sur `Picker`) : elle cache ce qui est entré, et ne touche à rien d'autre.
   *
   * Ce qui recouvre : tout niveau entièrement au-dessus de cette hauteur, et, pour le niveau où elle
   * tombe, son plafond et les montants et l'écharpe du bout que la caméra voit. Les montants de
   * l'autre bout sont derrière. La chose engagée est supposée entrer par une face longue — celle
   * qu'un rail longe.
   */
  cover?: number;
  /** L'`id` d'un `<mask>` SVG à appliquer au dessin — celui que publie `Picker` par `reachMask`. */
  mask?: string;
  /** Pixels par case. Le même défaut que le plan d'entrepôt, pour que les deux s'accordent. */
  cellSize?: number;
  className?: string;
}

/** Room for half a stroke on each side, so the silhouette is not shaved by the viewBox. */
const PAD = 2;

/** La section d'un montant de palettier, partagée avec le tapis roulant : c'est le même profilé,
 *  donc la même constante et non deux qui se ressemblent. */
const DEFAULT_POST_SIZE = ISO_POST_SIZE;

/** La hauteur d'une lisse de palettier, à l'échelle du plan. Mesuré : à 0,12 il ne restait que
 *  deux pixels de tranche entre les deux traits qui la bordent, et une tranche plus mince que son
 *  propre contour n'est pas une épaisseur, c'est un trait plus gras. */
const DEFAULT_DECK_THICKNESS = 0.2;

/** Ce qu'un pied dépasse sous le plateau **par défaut**, en fraction de la section d'un montant.
 *  Un pied est le montant qui continue jusqu'au sol, pas une pièce de plus : sa taille suit donc
 *  celle du montant au lieu d'être un nombre de plus à tenir en accord avec elle, et il ne dépasse
 *  que de quoi décoller le plateau — assez pour qu'on voie le jour dessous, pas assez pour que
 *  l'étagère ait l'air montée sur pilotis. `footHeight` passe outre quand on veut des pieds. */
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
  aisle = 0,
  aisleEvery = 2,
  crossAisle = 0,
  crossEvery = 4,
  slotsX = 1,
  slotsY = 1,
  contents = ["carton"],
  deckThickness = DEFAULT_DECK_THICKNESS,
  posts = false,
  postSize = DEFAULT_POST_SIZE,
  braces = false,
  feet = false,
  footHeight,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cover,
  mask,
  cellSize = 22,
  className,
}: RackV2Props) {
  const cam = useIsoCamera();
  const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  /** L'écart cumulé avant l'index `i`, quand une allée s'ouvre toutes les `every` unités. Le
   *  `Math.floor` est ce qui fait les paires : les rangées 0 et 1 se touchent, l'allée vient avant
   *  la 2. */
  const aisleBefore = (i: number, width: number, every: number) =>
    width > 0 && every >= 1 ? Math.floor(i / Math.max(1, Math.floor(every))) * width : 0;

  const nx = count(countX);
  const ny = count(countY);
  const nz = count(countZ);
  const sx = count(slotsX);
  const sy = count(slotsY);

  // The block turns on the floor, about its own centre — one rotation for the whole block, not one
  // per rack: racks turned individually inside a block would cut into each other, and "turn the
  // shelving" is a thing you do to the shelving, not to each shelf.
  const spanX = nx * width + aisleBefore(nx - 1, crossAisle, crossEvery);
  const spanY = ny * depth + aisleBefore(ny - 1, aisle, aisleEvery);
  const spanZ = nz * height;
  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };

  /** Un point du monde vers l'écran, sans passer par le bloc : le cadre partagé et le soleil sont
   *  tous deux en coordonnées du monde. */
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return world(p.x + origin.x, p.y + origin.y, z);
  };
  /** Une emprise du bloc, ramenée au monde. */
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };

  // Quelles faces de chaque volume la caméra voit, une fois le sol tourné. Sans ça, tourner le bloc
  // faisait peindre à chaque boîte une face passée derrière et en oublier une visible.
  const facing = cam.facing(rotation);

  /**
   * Depth is decided in the **turned** frame, because that is the frame the camera sees. A piece is
   * handed to `paintOrder` as the box its footprint occupies once turned: at a right angle that is
   * the footprint itself, and at 45° it is the smallest upright box around a diamond — wider than
   * the shape, so the rule orders fewer pairs outright and more of them fall through to its
   * tie-break. That is the safe direction to err in, since the tie-break is x + y, which *is* the
   * depth.
   */
  const sorted = (list: Piece[]) =>
    cam.order(
      list.map((piece) => {
        if (!rotation) return piece;
        const pts = [
          spin(piece.x, piece.y),
          spin(piece.x + piece.width, piece.y),
          spin(piece.x + piece.width, piece.y + piece.height),
          spin(piece.x, piece.y + piece.height),
        ];
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, render: piece.render };
      })
    );

  // Two slabs can never eat the whole rack: a third of the height each is already more deck than
  // rack, and past that there would be nowhere for the posts to run.
  const slabZ = Math.max(0, Math.min(deckThickness, height / 3));
  const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));
  const footZ = Math.max(0, footHeight ?? side * FOOT_RISE);

  /** One rack, standing with its far-left-bottom corner at (ox, oy, oz). `roofed` is false when
   *  another rack is stacked on this one: the deck above then belongs to *that* rack, and this one
   *  carries its uprights right up to it. */
  const rack = (ox: number, oy: number, oz: number, roofed: boolean, tag: string): ReactNode[] => {
    const floorZ = oz + slabZ;
    const ceilZ = oz + height - (roofed ? slabZ : 0);
    const clearance = ceilZ - floorZ;
    // Le recouvrement : rien de ce qui est tout entier sous la hauteur engagée ne peut la couvrir.
    const covering = cover !== undefined;
    if (covering && oz + height <= cover) return [];
    /** Le niveau où tombe la chose engagée : on n'en garde que ce qui est devant elle. */
    const engaged = covering && floorZ <= cover + 1e-6;
    /** Le bout que la caméra voit. */
    const nearX = facing.xFace > 0 ? ox + width : ox;
    const foot: Cell[] = [
      [ox, oy],
      [ox + width, oy],
      [ox + width, oy + depth],
      [ox, oy + depth],
    ];

    const pieces: Piece[] = [];

    foot.forEach(([cx, cy], i) => {
      if (engaged && cx !== nearX) return;
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
            solidVolume("post", `${tag}p${i}`, boxFaces(at, x0, x1, y0, y1, floorZ, ceilZ, facing))
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
        if (engaged && (i === 0) !== (nearX === ox)) return;
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
        if (!slot || engaged) continue;
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
          render: () => rackItemIso(slot, fit, at, facing, `${tag}i${i}-${j}`),
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
    if (feet && footZ > 0 && oz === 0 && !covering) {
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
              solidVolume("post", `${tag}f${i}`, boxFaces(at, x0, x1, y0, y1, -footZ, oz, facing))
            ) : (
              <line
                key={`${tag}f${i}`}
                className="lq-rack2__edge"
                x1={at(cx, cy, -footZ).x}
                y1={at(cx, cy, -footZ).y}
                x2={at(cx, cy, oz).x}
                y2={at(cx, cy, oz).y}
              />
            ),
        };
      });
      sorted(stand).forEach((piece) => footNodes.push(piece.render()));
    }

    const deck = (material: string, key: string, z0: number, z1: number, extra?: ReactNode) =>
      solidVolume(material, `${tag}${key}`, boxFaces(at, ox, ox + width, oy, oy + depth, z0, z1, facing), slabZ === 0, extra);

    if (engaged) {
      return [...sorted(pieces).map((piece) => piece.render()), ...(roofed ? [deck("steel", "upper", ceilZ, oz + height)] : [])];
    }

    return [
      ...footNodes,
      deck("steel-shaded", "lower", oz, floorZ, dividers.length + barred.length > 0 ? <>{dividers}{barred}</> : undefined),
      ...sorted(pieces).map((piece) => piece.render()),
      ...(roofed ? [deck("steel", "upper", ceilZ, oz + height)] : []),
    ];
  };

  // L'ombre du bloc entier, au sol : elle passe avant tout, rien ne pouvant se glisser dessous.
  const shade = shadows
    ? [
        castShadow(
          // Le projecteur du **monde**, sans la rotation du bloc : le soleil est une direction du
          // monde, et un décalage posé dans le repère du bloc tournerait avec lui.
          world,
          // Les coins du bloc tournés, puis ramenés au monde par `origin`.
          [
            onGround(0, 0),
            onGround(nx * width, 0),
            onGround(nx * width, ny * depth),
            onGround(0, ny * depth),
          ],
          nz * height,
          "shadow", cam.sun),
      ]
    : [];

  // Floor by floor from the ground up, and inside each floor the racks sorted back to front.
  const drawn: ReactNode[] = [];
  for (let iz = 0; iz < nz; iz += 1) {
    const floor: Piece[] = [];
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const ox = ix * width + aisleBefore(ix, crossAisle, crossEvery);
        const oy = iy * depth + aisleBefore(iy, aisle, aisleEvery);
        floor.push({
          x: ox,
          y: oy,
          width,
          height: depth,
          render: () => <g key={`${ix}-${iy}-${iz}`}>{rack(ox, oy, iz * height, iz === nz - 1, `${ix}-${iy}-${iz}-`)}</g>,
        });
      }
    }
    sorted(floor).forEach((piece) => drawn.push(piece.render()));
  }

  // All eight corners of the block, not the four that happen to be extreme when it is square to
  // the camera: turn it and the extremes change hands.
  const under = feet ? -footZ : 0;
  const ground: Cell[] = [
    [0, 0],
    [spanX, 0],
    [spanX, spanY],
    [0, spanY],
  ];
  const corners = frame
    ? frameCorners(frame, world, cam.sun)
    : [...ground.map(([x, y]) => at(x, y, under)), ...ground.map(([x, y]) => at(x, y, spanZ))];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <IsoCanvas
      className={["lq-rack2", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={[minX, minY, boxWidth, boxHeight]}
      ariaLabel={nx * ny * nz > 1 ? `${nx * ny * nz} étagères` : "Étagère"}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (mask ? <g mask={`url(#${mask})`}>{drawn}</g> : drawn)}
    </IsoCanvas>
  );
}
