import type { ReactNode } from "react";
import "./rackItems.css";

/**
 * Ce qu'on pose sur une étagère — et le vocabulaire de dessin que l'étagère partage avec.
 *
 * ## Two views of the same object
 *
 * Every kind is drawn twice, from one description: **isometric**, for the rack's own picture, and
 * **plan**, looking straight down, for a floor plan. They are not two drawings that happen to agree
 * — they are the same footprint and the same material seen from two cameras, so a drum is a circle
 * from above and a cylinder from the side *because it is a drum*, and neither view can drift from
 * the other when a kind is added.
 *
 * ## One light, many materials
 *
 * A closed volume shows three faces: its top, and the two sides the camera can see. They are three
 * lightnesses of one colour, under one light source — the top takes the light, the near side is
 * half-lit, the far side is in shade. A kind supplies its *material* and nothing else; the three
 * lightnesses follow. Three hues per face would read as three unrelated shapes meeting at a corner,
 * and lightness is also the part that survives e-ink, where every accent collapses to the text
 * colour and only the share of it still separates one thing from another.
 *
 * ## Round things
 *
 * A circle lying flat projects to an ellipse under this camera, and — since the camera is
 * `matrix(KX, KY, −KX, KY, 0, 0)` — to an *axis-aligned* one, twice as wide as it is tall. Rather
 * than rely on that and hand SVG an `<ellipse>`, the rim is walked as points through the same
 * projector as everything else: one place decides where a point goes, so a drum cannot end up in a
 * slightly different space from the rack it stands on.
 *
 * A cylinder is then two pieces: the **lid**, the whole top rim, and the **body**, the silhouette —
 * the front half of the top rim, down the right side, back along the front half of the bottom rim,
 * up the left side. The extremes are where the projected ellipse is widest, at θ = 135° and −45°,
 * which is what those two angles are.
 */

/** La section d'un montant, en cases — d'étagère comme de tapis. Une seule valeur parce que c'est
 *  le même profilé : deux constantes égales finissent toujours par cesser de l'être. Assez épaisse
 *  pour se lire comme un volume à une case de large, assez mince pour rester un montant. */
export const ISO_POST_SIZE = 0.13;

export type RackItemKind = "carton" | "boite" | "bidon" | "bouteille" | "palette";

/** Dans l'ordre où on les montre : du plus courant au plus particulier. */
export const RACK_ITEM_KINDS: RackItemKind[] = ["carton", "boite", "palette", "bidon", "bouteille"];

/** Ce que chaque sorte affiche dans une légende. */
export const RACK_ITEM_LABEL: Record<RackItemKind, string> = {
  carton: "Carton",
  boite: "Boîte",
  bidon: "Bidon",
  bouteille: "Bouteille",
  palette: "Palette",
};

export type Point = { x: number; y: number };
/** Une position dans l'espace du plan, en cases, vers l'écran. */
export type Project = (x: number, y: number, z: number) => Point;

export interface Faces {
  top: Point[];
  front: Point[];
  side: Point[];
}

/**
 * Quelles faces d'un volume la caméra voit, une fois le sol tourné de `rotation` degrés.
 *
 * Sans rotation la réponse est toujours la même — la face +x et la face +y — et c'était écrit en
 * dur. Dès que le sol tourne, c'est faux : à 90° la face +y est passée derrière, et chaque volume
 * du dessin peignait une face cachée tout en omettant une face visible. Plateaux, poteaux, pieds,
 * cartons : tout, d'un coup.
 *
 * La règle est un produit scalaire. La caméra regarde depuis +x, +y ; une face est visible quand sa
 * normale, une fois tournée, pointe de ce côté. La face +x a pour normale (1, 0), tournée elle
 * devient (cos, sin), et elle est visible tant que `cos + sin > 0` ; la face +y a pour normale
 * (0, 1), tournée en (−sin, cos), visible tant que `cos − sin > 0`. Sinon c'est la face opposée
 * qu'on voit.
 *
 * Reste à savoir laquelle des deux apparaît à gauche, puisque c'est de là que vient la lumière : la
 * normale d'une face part vers la gauche de l'écran quand sa composante `x − y` est négative. La
 * lumière est ainsi attachée à l'*image* et non au monde — tourner le meuble ne déplace pas le
 * soleil.
 */
export interface IsoFacing {
  /** +1 quand la face x visible est celle de x1, −1 quand c'est celle de x0. */
  xFace: 1 | -1;
  yFace: 1 | -1;
  /** Vrai quand c'est la face x qui apparaît à gauche, donc à demi-éclairée. */
  xOnLeft: boolean;
  /** L'angle où la silhouette d'un cylindre s'arrête, à droite. Son opposé la ferme à gauche. */
  rimRight: number;
}

export function isoFacing(rotation = 0): IsoFacing {
  const t = (rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const xFace = cos + sin >= 0 ? 1 : -1;
  const yFace = cos - sin >= 0 ? 1 : -1;
  return {
    xFace,
    yFace,
    xOnLeft: xFace * (cos - sin) < 0,
    // L'extrême droit de l'ellipse projetée. Sans rotation il tombe à −45°, la valeur qu'il avait
    // quand il était constant.
    rimRight: Math.atan2(-(sin + cos), cos - sin),
  };
}

interface ItemSpec {
  material: string;
  round: boolean;
  /** Côté de l'emprise, en fraction du plus petit côté de la portion. */
  spread: number;
  /** Hauteur, en multiple de ce côté. */
  rise: number;
}

/**
 * Les emprises sont **carrées**, prises sur le plus petit côté de la portion : un carton est un
 * carton, pas une tranche de l'étagère qui le porte. Sans ça, allonger le plateau étirerait tout ce
 * qui est posé dessus, et une étagère de dix mètres porterait un carton de dix mètres.
 */
const ITEMS: Record<RackItemKind, ItemSpec> = {
  carton: { material: "kraft", round: false, spread: 0.74, rise: 0.82 },
  boite: { material: "bin", round: false, spread: 0.5, rise: 0.52 },
  bidon: { material: "drum", round: true, spread: 0.56, rise: 1.5 },
  bouteille: { material: "glass", round: true, spread: 0.24, rise: 2.8 },
  palette: { material: "wood", round: false, spread: 0.92, rise: 0.17 },
};

/** Where a kind actually sits and how big it is, once fitted into a portion of deck. */
export interface RackItemFit {
  cx: number;
  cy: number;
  /** Demi-côté de l'emprise (ou rayon, pour les ronds). */
  half: number;
  z: number;
  height: number;
  spec: ItemSpec;
}

export function fitRackItem(
  kind: RackItemKind,
  slot: { x: number; y: number; width: number; depth: number },
  z: number,
  clearance: number
): RackItemFit {
  const spec = ITEMS[kind];
  const half = (Math.min(slot.width, slot.depth) * spec.spread) / 2;
  return {
    cx: slot.x + slot.width / 2,
    cy: slot.y + slot.depth / 2,
    half,
    z,
    // Rien ne traverse le plateau du dessus : un objet trop grand pour la portion est posé écrasé
    // plutôt que passé au travers, ce qui se voit et se corrige, contrairement à une intersection.
    height: Math.max(half * 0.25, Math.min(clearance, half * 2 * spec.rise)),
    spec,
  };
}

/** The three faces of an axis-aligned box the camera can see, for the given facing. */
export function boxFaces(
  at: Project,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  facing: IsoFacing
): Faces {
  const xs = facing.xFace > 0 ? x1 : x0;
  const ys = facing.yFace > 0 ? y1 : y0;
  const faceX = [at(xs, y0, z0), at(xs, y1, z0), at(xs, y1, z1), at(xs, y0, z1)];
  const faceY = [at(x0, ys, z0), at(x1, ys, z0), at(x1, ys, z1), at(x0, ys, z1)];
  return {
    top: [at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)],
    front: facing.xOnLeft ? faceX : faceY,
    side: facing.xOnLeft ? faceY : faceX,
  };
}

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Un volume fermé : la face lointaine, puis la proche, puis le dessus par-dessus les deux. */
export function solidVolume(material: string, key: string, faces: Faces, flat = false, extra?: ReactNode): ReactNode {
  return (
    <g key={key} className={`lq-iso__solid lq-iso__solid--${material}`}>
      {!flat && <polygon className="lq-iso__face lq-iso__face--side" points={ring(faces.side)} />}
      {!flat && <polygon className="lq-iso__face lq-iso__face--front" points={ring(faces.front)} />}
      <polygon className="lq-iso__face lq-iso__face--top" points={ring(faces.top)} />
      {extra}
    </g>
  );
}

/**
 * Un volume dont le **contour au sol** est quelconque : on l'extrude entre deux hauteurs.
 *
 * La boîte est le vocabulaire de l'entrepôt, et elle suffit pour ce qui est rectangulaire ; mais
 * une cabine de camion ne l'est pas. Tout ce qui est arrondi l'est ici en **coupant les angles** :
 * un contour à seize points au lieu de quatre, et ce sont seize facettes verticales au lieu de
 * deux. Une arête vive devient une suite de facettes qui s'éclairent différemment, et c'est ce qui
 * se lit comme un arrondi.
 *
 * Trois choses s'en déduisent, et aucune n'est réglable à la main :
 *
 * - **quelles facettes se voient** — celle dont la normale regarde la caméra, et elle seule. Un
 *   objet convexe n'en montre jamais plus de la moitié, quel que soit le cap ;
 * - **dans quel ordre les peindre** — de la plus lointaine à la plus proche, par la profondeur du
 *   milieu de chaque facette. Elles ne se recouvrent pas sur un convexe, mais leurs contours se
 *   touchent, et un ordre arbitraire ferait baver un trait sur sa voisine ;
 * - **leur clarté** — la même règle que la boîte : une facette qui regarde surtout selon `x` prend
 *   la clarté de la face `x`, une facette qui regarde surtout selon `y` celle de la face `y`, et
 *   c'est `xOnLeft` qui dit laquelle des deux est la plus sombre. Une facette d'angle penche du
 *   côté dont elle est la plus proche : la transition d'un arrondi se fait donc en deux tons, ceux
 *   que le kit a déjà, sans inventer d'éclairage que le reste de l'entrepôt n'aurait pas.
 *
 * Les facettes sont dessinées **sans trait**, et la silhouette est retracée d'un seul contour
 * par-dessus. Un arrondi n'a pas d'arêtes : bordée chacune, seize facettes donnent seize traits
 * serrés là où le tournant est le plus court, et un angle abattu se lit alors comme une hachure
 * sombre — exactement ce qu'on cherchait à supprimer.
 */
export function prismVolume(
  material: string,
  key: string,
  at: Project,
  /** Le contour au sol, fermé implicitement, dans le repère du module. */
  ground: Point[],
  z0: number,
  z1: number,
  facing: IsoFacing,
  /** D'où regarde la caméra, en direction du sol — `isoCamera().view`. */
  view: Point,
  extra?: ReactNode
): ReactNode {
  return stackedVolume(material, key, at, [{ ring: ground, z0, z1 }], facing, view, extra);
}

/** Une couche d'un volume empilé : son contour au sol, et entre quelles hauteurs on l'extrude. */
export interface VolumeLayer {
  ring: Point[];
  z0: number;
  z1: number;
}

/**
 * Plusieurs prismes empilés, lus comme **un seul volume** : c'est ainsi qu'on arrondit une arête
 * horizontale, que l'extrusion d'un contour ne sait pas faire.
 *
 * Quatre couches minces dont le retrait suit un quart de cercle, et le haut d'une cabine cesse
 * d'être un pavé. Il faut pour cela qu'elles ne se lisent pas comme quatre boîtes empilées : une
 * seule silhouette pour toute la pile, et le dessus de la seule couche du dessus — sinon chaque
 * couche cerne son propre contour, et l'arrondi revient en anneaux concentriques, l'exact contraire
 * de ce qu'on cherchait.
 */
export function stackedVolume(
  material: string,
  key: string,
  at: Project,
  layers: VolumeLayer[],
  facing: IsoFacing,
  view: Point,
  extra?: ReactNode
): ReactNode {
  const faces: { depth: number; quad: Point[]; dark: boolean }[] = [];
  let top: Point[] = [];

  for (const layer of layers) {
    const n = layer.ring.length;
    // Le sens du contour décide du côté où pointe une normale : on le normalise plutôt que de le
    // demander à l'appelant, qui l'écrirait juste une fois sur deux.
    let area = 0;
    for (let i = 0; i < n; i += 1) {
      const a = layer.ring[i];
      const b = layer.ring[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const loop = area < 0 ? [...layer.ring].reverse() : layer.ring;
    top = loop.map((p) => at(p.x, p.y, layer.z1));

    for (let i = 0; i < n; i += 1) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      const normal = { x: b.y - a.y, y: a.x - b.x };
      if (normal.x * view.x + normal.y * view.y <= 0) continue;
      const isX = Math.abs(normal.x) >= Math.abs(normal.y);
      faces.push({
        depth: ((a.x + b.x) / 2) * view.x + ((a.y + b.y) / 2) * view.y,
        quad: [at(a.x, a.y, layer.z0), at(b.x, b.y, layer.z0), at(b.x, b.y, layer.z1), at(a.x, a.y, layer.z1)],
        dark: isX !== facing.xOnLeft,
      });
    }
  }
  faces.sort((p, q) => p.depth - q.depth);
  const silhouette = convexHull([...faces.flatMap((f) => f.quad), ...top]);

  return (
    <g key={key} className={`lq-iso__solid lq-iso__solid--${material}`}>
      {faces.map((f, i) => (
        <polygon
          key={`s${i}`}
          className={`lq-iso__face lq-iso__face--${f.dark ? "front" : "side"} lq-iso__face--seamless`}
          points={ring(f.quad)}
        />
      ))}
      <polygon className="lq-iso__face lq-iso__face--top lq-iso__face--seamless" points={ring(top)} />
      <polygon className="lq-iso__outline" points={ring(silhouette)} />
      {extra}
    </g>
  );
}

/**
 * Un congé : la pile de couches qui arrondit le haut d'un volume, sur un rayon `r`. Chaque couche
 * rentre et monte le long d'un quart de cercle, donc les marches sont serrées là où la pente est
 * forte et larges là où elle s'aplatit — c'est ce qui se lit comme une courbe et non comme un
 * escalier.
 */
export function filletLayers(
  /** Le contour, rentré de `inset` : c'est l'appelant qui sait comment son contour se rétrécit. */
  ringAt: (inset: number) => Point[],
  top: number,
  radius: number,
  steps = 4
): VolumeLayer[] {
  return Array.from({ length: steps }, (_, i) => {
    const a0 = (Math.PI / 2) * (i / steps);
    const a1 = (Math.PI / 2) * ((i + 1) / steps);
    return {
      ring: ringAt(radius * (1 - Math.cos(a0))),
      z0: top + radius * Math.sin(a0),
      z1: top + radius * Math.sin(a1),
    };
  });
}

/**
 * Un rectangle **aux angles abattus**, comme contour d'un `prismVolume`. `radius` est le rayon de
 * l'arrondi, `steps` le nombre de facettes par angle — trois suffisent à ne plus voir une arête.
 */
export function roundedRing(x0: number, x1: number, y0: number, y1: number, radius: number, steps = 3): Point[] {
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r === 0) {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  // Les quatre centres d'arc, et l'angle où chaque quart commence.
  const corners: [number, number, number][] = [
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
    [x1 - r, y0 + r, 270],
  ];
  const points: Point[] = [];
  for (const [cx, cy, start] of corners) {
    for (let k = 0; k <= steps; k += 1) {
      const a = ((start + (90 * k) / steps) * Math.PI) / 180;
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return points;
}

/** Une portion de couronne circulaire : entre deux rayons, deux hauteurs et deux angles. */
export interface ArcRing {
  /** Centre de l'arc, en cases, dans le repère du module. */
  cx: number;
  cy: number;
  /** Rayon intérieur, rayon extérieur. */
  rIn: number;
  rOut: number;
  /** Dessous, dessus. */
  z0: number;
  z1: number;
  /** Début et fin de l'arc, en radians. */
  a0: number;
  a1: number;
}

/**
 * Un anneau **d'un seul tenant** : sa face du dessus, ses deux parois, et ses deux bouts droits
 * quand ils regardent la caméra.
 *
 * Il était d'abord découpé en tronçons, un volume par facette, pour que chacun montre la paroi que
 * la caméra voit de son côté de l'arc — car ce côté change en cours de virage. Mais chaque facette
 * porte son propre trait, et une bordure faite de quatorze petits rectangles cernés se lit comme
 * quatorze petits rectangles. Les deux parois sont donc dessinées entières, d'une seule courbe, et
 * **de la même teinte** : celle qui se trouve derrière est alors recouverte par l'autre sans que
 * rien ne le montre, et la réunion des deux couvre exactement la silhouette vraie. La face du dessus
 * passe en dernier et recouvre la paroi lointaine, qui pend sous elle.
 *
 * Le bâti d'un tapis d'angle, ses barrières et les deux files d'un rail d'angle sont tous faits de
 * ça — un bâti n'est qu'un anneau très épais, une file de rail qu'un anneau très mince, et il ne
 * sert à rien d'en écrire trois fois la géométrie.
 *
 * `spin` est la rotation du module sur le sol : elle ne sert qu'à décider lequel des deux bouts
 * droits regarde la caméra, ce qui est une question de *direction* et non de position — d'où la
 * différence entre deux points tournés plutôt qu'un point tourné.
 */
export function arcRingVolume(
  at: Project,
  spin: (x: number, y: number) => Point,
  arc: ArcRing,
  material: string,
  key: string,
  steps = 48,
  /** D'où regarde la caméra, en direction du sol — `(1, 1)` pour la caméra par défaut. Voir
   *  `isoCamera.tsx`. */
  view: Point = { x: 1, y: 1 }
): ReactNode {
  const point = (r: number, a: number, z: number) => at(arc.cx + r * Math.cos(a), arc.cy + r * Math.sin(a), z);
  const angle = (i: number, n: number) => arc.a0 + ((arc.a1 - arc.a0) * i) / n;
  const band = (r: number, z: number) => Array.from({ length: steps + 1 }, (_, i) => point(r, angle(i, steps), z));
  const outerTop = band(arc.rOut, arc.z1);
  const innerTop = band(arc.rIn, arc.z1);
  const outerLow = band(arc.rOut, arc.z0);
  const innerLow = band(arc.rIn, arc.z0);

  /** Un bout droit se voit quand sa normale part vers la caméra — depuis +x, +y par défaut. */
  const capAt = (a: number, sign: number) => {
    const t = spin(-Math.sin(a) * sign, Math.cos(a) * sign);
    const o = spin(0, 0);
    return (t.x - o.x) * view.x + (t.y - o.y) * view.y > 0;
  };
  const cap = (a: number) => [point(arc.rIn, a, arc.z0), point(arc.rOut, a, arc.z0), point(arc.rOut, a, arc.z1), point(arc.rIn, a, arc.z1)];
  const caps: Point[][] = [];
  if (capAt(arc.a0, -1)) caps.push(cap(arc.a0));
  if (capAt(arc.a1, 1)) caps.push(cap(arc.a1));

  return (
    <g key={key} className={`lq-iso__solid lq-iso__solid--${material}`}>
      <polygon className="lq-iso__face lq-iso__face--front" points={ring([...innerTop, ...[...innerLow].reverse()])} />
      <polygon className="lq-iso__face lq-iso__face--front" points={ring([...outerTop, ...[...outerLow].reverse()])} />
      {caps.map((c, k) => (
        <polygon key={`cap${k}`} className="lq-iso__face lq-iso__face--front" points={ring(c)} />
      ))}
      <polygon className="lq-iso__face lq-iso__face--top" points={ring([...outerTop, ...[...innerTop].reverse()])} />
    </g>
  );
}

/**
 * Un projecteur tourné de `deg` autour d'un point du sol, et les faces qu'il fait voir.
 *
 * Tourner le *projecteur* plutôt que la boîte, c'est dessiner une boîte tournée avec le code qui
 * n'en sait dessiner que des droites — et c'est la seule façon correcte ici, la caméra envoyant un
 * *plan* affinement et non l'espace. Sert à tout ce qui est posé de biais : une charge dans un
 * virage, une traverse radiale sous un rail d'angle.
 */
export function spunProject(at: Project, deg: number, cx: number, cy: number, rotation = 0): { project: Project; facing: IsoFacing } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    project: (x, y, z) => at(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c, z),
    facing: isoFacing(rotation + deg),
  };
}

/**
 * D'où vient la lumière, en cases, pour une hauteur d'une case.
 *
 * Le modèle d'éclairage du kit dit que la face `+y` est à demi-éclairée et la face `+x` dans
 * l'ombre : la lumière vient donc du côté `+y`, un peu en hauteur. Une ombre portée est l'objet
 * poussé dans la direction opposée, à plat sur le sol — ce qui suffit, le sol étant plan et la
 * lumière tenue pour lointaine. Deux nombres, et ils sont ici parce que l'ombre d'une étagère et
 * celle d'un tapis doivent tomber du même côté.
 */
export const SUN_CAST = { x: 0.34, y: -0.62 };

/**
 * Les points que la `viewBox` d'un module doit couvrir quand il partage un **cadre** : les huit
 * coins du pavé, et l'ombre de sa base.
 *
 * L'ombre est là parce qu'elle tombe **hors** de l'emprise — c'est ce qu'est une ombre portée — et
 * qu'un cadre décrit ce que la scène occupe, pas ce qu'elle projette. Sans elle, l'ombre d'une
 * rangée d'étagères se fait couper net au bord du dessin. Elle se voyait d'autant moins que la
 * lumière tombait toujours du même côté : la marge du cadre de ce côté-là suffisait souvent. Le
 * soleil suivant maintenant la caméra, elle part dans toutes les directions à mesure qu'on tourne,
 * et la marge ne suffit plus nulle part.
 */
export function frameCorners(
  frame: { x: number; y: number; width: number; depth: number; height: number },
  world: Project,
  sun: Point = SUN_CAST
): Point[] {
  const ground: [number, number][] = [
    [frame.x, frame.y],
    [frame.x + frame.width, frame.y],
    [frame.x + frame.width, frame.y + frame.depth],
    [frame.x, frame.y + frame.depth],
  ];
  const cast = { x: sun.x * frame.height, y: sun.y * frame.height };
  return [
    ...ground.map(([x, y]) => world(x, y, 0)),
    ...ground.map(([x, y]) => world(x, y, frame.height)),
    ...ground.map(([x, y]) => world(x + cast.x, y + cast.y, 0)),
  ];
}

/**
 * L'ombre d'une emprise : la même forme, poussée au sol.
 *
 * `project` doit être le projecteur du **monde**, et `points` des points du monde — pas ceux du
 * repère d'un module. Le décalage est une direction du monde : appliqué dans le repère local d'un
 * objet, il tourne avec lui, et une scène où chaque pièce est tournée autrement se retrouve avec
 * autant de soleils que de pièces. C'est le genre d'erreur qui ne se voit que sur la deuxième
 * pièce.
 */
export function castShadow(
  project: Project,
  points: { x: number; y: number }[],
  height: number,
  key: string,
  /** D'où vient la lumière — `SUN_CAST` pour la caméra par défaut. Le soleil suit la caméra quand
   *  elle tourne, comme l'éclairage des faces : voir `isoCamera.tsx`. */
  sun: Point = SUN_CAST
) {
  const d = { x: sun.x * height, y: sun.y * height };
  return (
    <polygon
      key={key}
      className="lq-iso__shadow"
      points={points
        .map((p) => {
          const q = project(p.x + d.x, p.y + d.y, 0);
          return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
        })
        .join(" ")}
    />
  );
}

function rim(at: Project, cx: number, cy: number, z: number, r: number, from: number, to: number, steps = 24): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    points.push(at(cx + r * Math.cos(angle), cy + r * Math.sin(angle), z));
  }
  return points;
}

/** Un cylindre : le couvercle, et la silhouette du corps.
 *
 *  Les deux angles où la silhouette s'arrête ne sont pas constants : l'ellipse projetée tourne avec
 *  le sol et ses extrêmes avec elle. Ils sortent de `isoFacing`, comme les faces d'une boîte. */
export function cylinderParts(at: Project, cx: number, cy: number, r: number, z0: number, z1: number, facing: IsoFacing) {
  const right = facing.rimRight;
  const left = right + Math.PI;
  return {
    lid: rim(at, cx, cy, z1, r, left, left + 2 * Math.PI, 40),
    body: [...rim(at, cx, cy, z1, r, left, right), ...rim(at, cx, cy, z0, r, right, left)],
  };
}

/** Le devant d'un cerceau : ce qu'on voit d'une frette de bidon. */
function hoop(at: Project, cx: number, cy: number, z: number, r: number, facing: IsoFacing): string {
  return rim(at, cx, cy, z, r, facing.rimRight + Math.PI, facing.rimRight)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join("");
}

/**
 * Un élément, en isométrique, dessiné dans l'espace du plan.
 *
 * `at` et `key` viennent de l'appelant, de sorte qu'un carton posé sur une étagère est dessiné dans
 * exactement le même espace qu'elle — pas dans un dessin séparé qu'il faudrait ensuite faire
 * coïncider.
 */
export function rackItemIso(kind: RackItemKind, fit: RackItemFit, at: Project, facing: IsoFacing, key: string): ReactNode {
  const { cx, cy, half, z, height, spec } = fit;
  const top = z + height;

  if (kind === "bouteille") {
    // Un corps, un goulot : deux cylindres, ce qui suffit à dire « bouteille » et pas « tube ».
    const neck = z + height * 0.62;
    const body = cylinderParts(at, cx, cy, half, z, neck, facing);
    const cap = cylinderParts(at, cx, cy, half * 0.42, neck, top, facing);
    return (
      <g key={key} className={`lq-iso__solid lq-iso__solid--${spec.material}`}>
        <polygon className="lq-iso__face lq-iso__face--front" points={ring(body.body)} />
        <polygon className="lq-iso__face lq-iso__face--front" points={ring(cap.body)} />
        <polygon className="lq-iso__face lq-iso__face--top" points={ring(cap.lid)} />
      </g>
    );
  }

  if (spec.round) {
    const parts = cylinderParts(at, cx, cy, half, z, top, facing);
    return (
      <g key={key} className={`lq-iso__solid lq-iso__solid--${spec.material}`}>
        <polygon className="lq-iso__face lq-iso__face--front" points={ring(parts.body)} />
        {/* Deux frettes : c'est ce qui distingue un fût d'un simple tube. */}
        <path className="lq-iso__hoop" d={hoop(at, cx, cy, z + height * 0.34, half, facing)} />
        <path className="lq-iso__hoop" d={hoop(at, cx, cy, z + height * 0.68, half, facing)} />
        <polygon className="lq-iso__face lq-iso__face--top" points={ring(parts.lid)} />
      </g>
    );
  }

  const faces = boxFaces(at, cx - half, cx + half, cy - half, cy + half, z, top, facing);

  if (kind === "palette") {
    // Les entretoises, vues de dessus : c'est ce qui fait qu'une palette n'est pas une planche.
    const slats = [0.28, 0.5, 0.72].map((t, i) => {
      const y = cy - half + half * 2 * t;
      const a = at(cx - half, y, top);
      const b = at(cx + half, y, top);
      return <line key={`s${i}`} className="lq-iso__slat" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
    });
    return solidVolume(spec.material, key, faces, false, <>{slats}</>);
  }

  // Le carton porte la jointure de ses rabats ; sans elle, c'est un cube.
  const seam =
    kind === "carton" ? (
      (() => {
        const a = at(cx - half, cy, top);
        const b = at(cx + half, cy, top);
        return <line className="lq-iso__seam" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })()
    ) : undefined;
  return solidVolume(spec.material, key, faces, false, seam);
}

/** Le même élément vu de dessus, dans un espace où une case vaut `scale` pixels. */
export function rackItemPlan(kind: RackItemKind, fit: RackItemFit, scale: number, key: string): ReactNode {
  const { cx, cy, half, spec } = fit;
  const px = (n: number) => n * scale;

  if (spec.round) {
    const r = kind === "bouteille" ? half : half;
    return (
      <g key={key} className={`lq-iso__solid lq-iso__solid--${spec.material}`}>
        <circle className="lq-iso__plan-face" cx={px(cx)} cy={px(cy)} r={px(r)} />
        {/* Ce qu'on voit d'un bidon par-dessus : sa bonde. D'une bouteille : son goulot. */}
        <circle className="lq-iso__plan-detail" cx={px(cx)} cy={px(cy)} r={px(r * (kind === "bouteille" ? 0.42 : 0.28))} />
      </g>
    );
  }

  const x = px(cx - half);
  const y = px(cy - half);
  const size = px(half * 2);
  return (
    <g key={key} className={`lq-iso__solid lq-iso__solid--${spec.material}`}>
      <rect className="lq-iso__plan-face" x={x} y={y} width={size} height={size} />
      {kind === "carton" && <line className="lq-iso__seam" x1={x} y1={y + size / 2} x2={x + size} y2={y + size / 2} />}
      {kind === "palette" &&
        [0.28, 0.5, 0.72].map((t, i) => (
          <line key={`s${i}`} className="lq-iso__slat" x1={x} y1={y + size * t} x2={x + size} y2={y + size * t} />
        ))}
    </g>
  );
}

/** L'enveloppe convexe de points de l'écran — la chaîne monotone d'Andrew. */
export function convexHull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}


/**
 * Une roue : un disque dans le plan vertical `xz`, d'axe `y`, centré en `(x, y, z)`.
 *
 * Sous une caméra affine, un cercle d'un plan devient une ellipse exacte — celle qu'on obtient en
 * projetant ses points un à un. La bande de roulement est l'enveloppe convexe des deux flancs : pas
 * de tangentes à calculer, et c'est juste à toute rotation du sol. Le flanc visible est celui que
 * `yFace` désigne, comme pour la face d'une boîte ; le moyeu et l'axe y sont dessinés, sans quoi un
 * disque sombre se lit comme un trou.
 *
 * Le picker, le chariot élévateur et le camion roulent sur les mêmes.
 */
export function isoWheel(at: Project, x: number, y: number, z: number, r: number, thickness: number, facing: IsoFacing, key: string): ReactNode {
  const disk = (yy: number, rr: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return at(x + rr * Math.cos(a), yy, z + rr * Math.sin(a));
    });
  const near = y + (facing.yFace * thickness) / 2;
  const far = y - (facing.yFace * thickness) / 2;
  return (
    <g key={key} className="lq-iso__solid lq-iso__solid--rubber lq-iso__wheel">
      <polygon className="lq-iso__face lq-iso__face--side" points={ring(convexHull([...disk(far, r, 32), ...disk(near, r, 32)]))} />
      <polygon className="lq-iso__face lq-iso__face--front" points={ring(disk(near, r, 32))} />
      <polygon className="lq-iso__hub" points={ring(disk(near, r * 0.52, 24))} />
      <polygon className="lq-iso__axle" points={ring(disk(near, r * 0.18, 12))} />
    </g>
  );
}
