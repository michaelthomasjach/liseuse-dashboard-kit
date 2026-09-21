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
export const ISO_POST_SIZE = 0.22;

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
