import { Builder, placeAt } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
import { addGood } from "./three/goods";
import { ISO_POST_SIZE, fitRackItem, type RackItemKind } from "./rackItems";
import "./rackItems.css";
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


const count = (n: number) => Math.max(1, Math.min(MAX_COUNT, Math.floor(n) || 1));

/** Les cotes dérivées d'une étagère : nombres, emprises, épaisseurs. */
function rackLayout(p: RackV2Props) {
  const { width = 8, depth = 2, height = 2.4, countX = 1, countY = 1, countZ = 1, aisle = 0, aisleEvery = 2, crossAisle = 0, crossEvery = 4 } = p;
  const aisleBefore = (i: number, w: number, every: number) => (w > 0 && every >= 1 ? Math.floor(i / Math.max(1, Math.floor(every))) * w : 0);
  const nx = count(countX);
  const ny = count(countY);
  const nz = count(countZ);
  const spanX = nx * width + aisleBefore(nx - 1, crossAisle, crossEvery);
  const spanY = ny * depth + aisleBefore(ny - 1, aisle, aisleEvery);
  return { width, depth, height, nx, ny, nz, spanX, spanY, spanZ: nz * height, aisleBefore };
}

export function RackV2(props: RackV2Props) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cover, cellSize = 22, className, feet = false, postSize = DEFAULT_POST_SIZE, footHeight } = props;
  // En 3D, la passe de recouvrement n'a plus d'objet : la profondeur fait passer les fourches dans
  // l'alvéole d'elle-même. Dessinée, elle doublerait l'étagère au même endroit.
  if (parts === "shadow" || cover !== undefined) return null;
  const L = rackLayout(props);
  const side = Math.max(0.02, Math.min(postSize, Math.min(L.width, L.depth) / 2));
  const under = feet ? -Math.max(0, footHeight ?? side * FOOT_RISE) : 0;
  const pose = placeAt(origin.x, origin.y, rotation, { x: L.spanX / 2, y: L.spanY / 2 });
  const e = pose.elements;
  const pts = [
    [0, 0],
    [L.spanX, 0],
    [L.spanX, L.spanY],
    [0, L.spanY],
  ].map(([x, y]) => ({ x: e[0] * x + e[4] * y + e[12], y: e[1] * x + e[5] * y + e[13] }));
  const bounds = frame
    ? frameBounds(frame)
    : { x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), y0: Math.min(...pts.map((q) => q.y)), y1: Math.max(...pts.map((q) => q.y)), z0: under, z1: L.spanZ };
  const n = L.nx * L.ny * L.nz;
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-rack2", className].filter(Boolean).join(" ")} ariaLabel={n > 1 ? `${n} étagères` : "Étagère"}>
      <RackV2Body {...props} />
    </Solo>
  );
}

function RackV2Body(props: RackV2Props) {
  const {
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
    origin = { x: 0, y: 0 },
  } = props;
  const L = rackLayout(props);
  const key = JSON.stringify([L, slotsX, slotsY, contents, deckThickness, posts, postSize, braces, feet, footHeight]);
  const built = useBuilt(() => {
    const b = new Builder();
    const { width, depth, height } = L;
    const sx = count(slotsX);
    const sy = count(slotsY);
    const slabZ = Math.max(0, Math.min(deckThickness, height / 3));
    const side = Math.max(0.02, Math.min(postSize, Math.min(width, depth) / 2));
    const footZ = Math.max(0, footHeight ?? side * FOOT_RISE);
    const edge: [[number, number, number], [number, number, number]][] = [];

    const bay = (ox: number, oy: number, oz: number, roofed: boolean) => {
      const floorZ = oz + slabZ;
      const ceilZ = oz + height - (roofed ? slabZ : 0);
      const clearance = ceilZ - floorZ;
      const corners: [number, number][] = [
        [ox, oy],
        [ox + width, oy],
        [ox + width, oy + depth],
        [ox, oy + depth],
      ];
      // Les montants : des profilés à section carrée, ou de simples arêtes quand on les veut fins.
      for (const [cx, cy] of corners) {
        const x0 = cx > ox ? cx - side : cx;
        const y0 = cy > oy ? cy - side : cy;
        if (posts) {
          b.box("post", x0, x0 + side, y0, y0 + side, floorZ, ceilZ);
          if (feet && oz === 0 && footZ > 0) b.box("post", x0, x0 + side, y0, y0 + side, -footZ, oz);
        } else {
          edge.push([[cx, cy, floorZ], [cx, cy, ceilZ]]);
          if (feet && oz === 0 && footZ > 0) edge.push([[cx, cy, -footZ], [cx, cy, oz]]);
        }
      }
      // Les écharpes de contreventement, dans les deux pignons : un feuillard en diagonale.
      if (braces) {
        const inset = posts ? side / 2 : 0;
        const yNear = oy + depth - inset;
        const yFar = oy + inset;
        for (const planeX of [ox + inset, ox + width - inset]) {
          if (posts) {
            const t = side * 0.25;
            const s = side * 0.5;
            b.hexa("post", [
              [planeX - t, yNear, floorZ],
              [planeX + t, yNear, floorZ],
              [planeX + t, yNear, floorZ + s],
              [planeX - t, yNear, floorZ + s],
              [planeX - t, yFar, ceilZ - s],
              [planeX + t, yFar, ceilZ - s],
              [planeX + t, yFar, ceilZ],
              [planeX - t, yFar, ceilZ],
            ]);
          } else edge.push([[planeX, yNear, floorZ], [planeX, yFar, ceilZ]]);
        }
      }
      // Les plateaux : celui du bas porte la charge, celui du haut ferme le niveau.
      if (slabZ > 0) b.box("steel-shaded", ox, ox + width, oy, oy + depth, oz, floorZ);
      else b.faceZ("lq-rack2__blocked", oz + 0.002, ox, ox + width, oy, oy + depth);
      if (roofed && slabZ > 0) b.box("steel", ox, ox + width, oy, oy + depth, ceilZ, oz + height);
      // Les alvéoles et leur contenu.
      const areaX = ox + side;
      const areaY = oy + side;
      const slotW = (width - 2 * side) / sx;
      const slotD = (depth - 2 * side) / sy;
      const div: [[number, number, number], [number, number, number]][] = [];
      for (let i = 1; i < sx; i += 1) div.push([[areaX + i * slotW, areaY, floorZ + 0.002], [areaX + i * slotW, areaY + slotD * sy, floorZ + 0.002]]);
      for (let j = 1; j < sy; j += 1) div.push([[areaX, areaY + j * slotD, floorZ + 0.002], [areaX + slotW * sx, areaY + j * slotD, floorZ + 0.002]]);
      if (div.length) b.lines("lq-rack2__divider", div);
      for (let j = 0; j < sy; j += 1)
        for (let i = 0; i < sx; i += 1) {
          const slot = contents[j * sx + i];
          if (!slot) continue;
          const x0 = areaX + i * slotW;
          const y0 = areaY + j * slotD;
          if (slot === "interdit") {
            // Une alvéole condamnée : un fond sombre et des hachures, posés sur le plateau.
            b.faceZ("lq-rack2__blocked", floorZ + 0.003, x0, x0 + slotW, y0, y0 + slotD);
            const hatch: [[number, number, number], [number, number, number]][] = [];
            const from = Math.ceil((x0 - (y0 + slotD)) / HATCH_STEP) * HATCH_STEP;
            for (let c = from; c < x0 + slotW - y0; c += HATCH_STEP) {
              const xa = Math.max(x0, y0 + c);
              const xb = Math.min(x0 + slotW, y0 + slotD + c);
              if (xb - xa > 1e-6) hatch.push([[xa, xa - c, floorZ + 0.004], [xb, xb - c, floorZ + 0.004]]);
            }
            b.lines("lq-rack2__hatch", hatch);
            continue;
          }
          const fit = fitRackItem(slot as RackItemKind, { x: x0, y: y0, width: slotW, depth: slotD }, floorZ, clearance);
          addGood(b, slot as RackItemKind, fit.cx, fit.cy, fit.z, fit.half, fit.height);
        }
    };

    for (let iz = 0; iz < L.nz; iz += 1)
      for (let iy = 0; iy < L.ny; iy += 1)
        for (let ix = 0; ix < L.nx; ix += 1)
          bay(ix * width + L.aisleBefore(ix, props.crossAisle ?? 0, props.crossEvery ?? 4), iy * depth + L.aisleBefore(iy, props.aisle ?? 0, props.aisleEvery ?? 2), iz * height, iz === L.nz - 1);
    if (edge.length) b.lines("lq-rack2__edge", edge);
    return b.build();
  }, [key]);
  const pose = placeAt(origin.x, origin.y, rotation, { x: L.spanX / 2, y: L.spanY / 2 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
