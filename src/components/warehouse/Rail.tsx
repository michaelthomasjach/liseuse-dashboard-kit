import { Matrix4 } from "three";
import { Builder, annulus, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { transformTrack } from "./three/transport";
import "./rackItems.css";
import "./Rail.css";

/**
 * Rail — droit, ou à angle droit. La voie sur laquelle roule un picker.
 *
 * Même vocabulaire que l'étagère et le tapis (`rackItems.tsx`) : des volumes alignés sur les axes
 * montrant les trois faces que la caméra voit, à trois clartés d'une seule couleur sous une seule
 * lumière, opaques, les faces visibles **choisies** d'après la rotation plutôt que supposées. Un
 * rail posé à côté d'un tapis doit être fait de la même matière, sans quoi l'image se lit comme deux
 * dessins côte à côte.
 *
 * ## Ce qu'il y a dans un rail
 *
 * Deux files et des traverses, et rien d'autre. Ce n'est pas de la décoration : ce sont les
 * traverses qui disent que les deux files sont **une seule voie** et non deux barres parallèles, et
 * c'est leur pas qui donne au rail son échelle — un rail sans elles n'a aucune longueur lisible,
 * puisque deux traits parallèles ont la même image à toutes les tailles.
 *
 * Les files sont en acier, les traverses dans le gris neutre des montants : une traverse est un
 * support, comme une palette sous un carton, et elle ne doit pas se disputer le regard avec la
 * surface de roulement, qui est la chose dont il est question.
 *
 * ## Un quart de cercle, et son rayon
 *
 * Un angle est **carré**. Sa voie est un quart de cercle centré sur le coin `(0, côté)`, tangent à
 * `+x` où il entre, à `+y` où il sort, et l'entrée est à mi-largeur comme celle d'un droit : un
 * angle et un droit se raccordent donc d'équerre, sans rien à ajuster à l'œil.
 *
 * Le rayon valait d'abord la demi-largeur, comme celui d'un tapis d'angle — l'angle tenait alors
 * dans sa propre largeur. C'est juste pour une bande, qui est pleine ; c'est faux pour une voie, dont
 * la file intérieure se retrouvait à un tiers de case du centre et tournait sur elle-même comme un
 * anneau. Aucune machine ne prend un virage pareil. Le rayon est donc réglable (`curveRadius`), et
 * vaut par défaut la largeur de la voie : le carré en prend une fois et demie.
 *
 * Les deux files d'un angle sont deux **anneaux d'un seul tenant** (`arcRingVolume`), la même pièce
 * que le bâti d'un tapis d'angle en beaucoup plus mince. Leur ordre entre elles est sans objet :
 * tout l'écartement les sépare et elles ne font qu'un dixième de case de haut, donc leurs images ne
 * se recouvrent jamais.
 *
 * Les traverses d'un angle sont **radiales** — c'est ainsi qu'elles portent la voie. Une traverse de
 * biais n'est pas une boîte alignée sur les axes, et ce n'est pas la boîte qu'on tourne mais le
 * **projecteur** (`spunProject`), comme pour une charge dans un virage : on dessine alors une boîte
 * tournée avec le code qui n'en sait dessiner que des droites.
 *
 * ## Composer plusieurs modules
 *
 * `origin` pose le module sur le sol et `frame` fixe le pavé du monde que la `viewBox` couvre —
 * mêmes règles que le tapis. Deux modules qui partagent un cadre ont exactement la même `viewBox` et
 * la même taille : les superposer suffit à les raccorder, puisqu'ils sont déjà dans le même repère.
 * `parts` sépare l'ombre du reste, l'ombre étant au sol et devant donc passer sous *tous* les
 * modules et pas seulement sous le sien.
 */

export type RailKind = "straight" | "corner";

/** L'emprise transversale d'une voie, en cases : la longueur d'une traverse. */
export const RAIL_WIDTH = 1.8;

/** L'écartement des deux files, en cases. */
export const RAIL_GAUGE = 1.1;

/** Épaisseur d'une traverse, en cases. */
export const RAIL_SLEEPER_THICKNESS = 0.09;

/** Ce qu'une file dépasse au-dessus de la traverse, en cases. */
export const RAIL_HEIGHT = 0.13;

/**
 * Hauteur du plan de roulement au-dessus du sol, en cases.
 *
 * C'est la constante que le picker lit pour poser ses galets dessus. Une seule valeur, et non un
 * nombre recopié de chaque côté : deux constantes égales finissent toujours par cesser de l'être, et
 * le jour où elles divergent la machine flotte au-dessus de sa voie ou s'y enfonce.
 */
export const RAIL_TOP = RAIL_SLEEPER_THICKNESS + RAIL_HEIGHT;

export interface RailProps {
  /** Droit, ou à angle droit. */
  kind?: RailKind;
  /** Longueur de la voie, en cases. Un angle est carré : il prend sa largeur. */
  length?: number;
  /** Emprise transversale — la longueur d'une traverse, en cases. */
  width?: number;
  /** Rayon de l'axe d'un angle, en cases. Par défaut, la largeur de la voie : la file intérieure est
   *  alors à une demi-largeur passée du centre, et non collée contre lui. Un angle occupe un carré de
   *  `curveRadius + width / 2` de côté. */
  curveRadius?: number;
  /** Écartement des deux files, en cases. */
  gauge?: number;
  /** Largeur du champignon d'une file, en cases. */
  railSize?: number;
  /** Ce qu'une file dépasse au-dessus de la traverse, en cases. */
  railHeight?: number;
  /** Pas des traverses, en cases. */
  sleeperEvery?: number;
  /** Largeur d'une traverse le long de la voie, en cases. */
  sleeperSize?: number;
  /** Épaisseur d'une traverse, en cases. */
  sleeperThickness?: number;
  /** Poser l'ombre de la voie sur le sol. */
  shadows?: boolean;
  /** Rotation de la voie sur le sol, en degrés. */
  rotation?: number;
  /** Où poser le module sur le sol, en cases. Sert à composer une ligne de plusieurs modules. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Donné, il remplace le cadrage sur le
   *  module lui-même : plusieurs modules qui partagent un cadre partagent exactement le même repère
   *  à l'écran, et se superposent sans rien avoir à aligner. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, ou l'ombre seule. L'ombre se sépare parce qu'elle est au sol et doit
   *  passer sous *tous* les modules d'une scène, pas seulement sous le sien. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}



function railLayout(p: RailProps) {
  const { kind = "straight", length = 8, width = RAIL_WIDTH, curveRadius } = p;
  const W = Math.max(0.6, width);
  const radius = Math.max(W / 2, curveRadius ?? W);
  const spanY = kind === "straight" ? W : radius + W / 2;
  const spanX = kind === "straight" ? Math.max(W, length) : spanY;
  return { kind, W, radius, spanX, spanY };
}

/** La piste d'un rail : son axe, à hauteur du champignon, **en coordonnées monde**. Ce que suit un
 *  picker, ce qu'une scène met bout à bout pour faire un circuit. */
export function railTrack(p: RailProps): P3[] {
  const L = railLayout(p);
  const topZ = Math.max(0.03, p.sleeperThickness ?? RAIL_SLEEPER_THICKNESS) + Math.max(0.03, p.railHeight ?? RAIL_HEIGHT);
  const local: P3[] = [];
  if (L.kind === "straight") local.push([0, L.spanY / 2, topZ], [L.spanX, L.spanY / 2, topZ]);
  else
    for (let i = 0; i <= 24; i += 1) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
      local.push([L.radius * Math.cos(a), L.spanY + L.radius * Math.sin(a), topZ]);
    }
  const { pose } = placed(p.origin ?? { x: 0, y: 0 }, p.rotation ?? 0, { x0: 0, x1: L.spanX, y0: 0, y1: L.spanY, z0: 0, z1: 1 });
  return transformTrack(local, pose);
}

export function Rail(props: RailProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 34, className, kind = "straight" } = props;
  if (parts === "shadow") return null;
  const L = railLayout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L.spanX, y0: 0, y1: L.spanY, z0: 0, z1: RAIL_TOP + 0.05 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-rail", className].filter(Boolean).join(" ")} ariaLabel={kind === "corner" ? "Rail d'angle" : "Rail droit"}>
      <RailBody {...props} />
    </Solo>
  );
}

function RailBody(props: RailProps) {
  const { gauge = RAIL_GAUGE, railSize = 0.16, railHeight = RAIL_HEIGHT, sleeperEvery = 1.1, sleeperSize = 0.34, sleeperThickness = RAIL_SLEEPER_THICKNESS, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const L = railLayout(props);
  const { kind, W, radius, spanX, spanY } = L;
  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  const built = useBuilt(() => {
    const b = new Builder();
    const cy = spanY / 2;
    const tie = Math.max(0.03, sleeperThickness);
    const head = Math.max(0.03, railHeight);
    const top = tie + head;
    const bar = Math.max(0.05, Math.min(railSize, W / 4));
    const half = Math.max(bar, Math.min(gauge, W - bar) / 2);
    const wide = Math.max(0.08, Math.min(sleeperSize, spanX));
    const step = Math.max(0.25, sleeperEvery);
    if (kind === "straight") {
      // Les traverses, puis les deux files — et leur semelle, un profilé en I et non un pavé.
      const count = Math.max(2, Math.round(spanX / step) + 1);
      for (let i = 0; i < count; i += 1) {
        const x = wide / 2 + ((spanX - wide) * i) / (count - 1);
        b.box("post", x - wide / 2, x + wide / 2, 0, spanY, 0, tie);
      }
      for (const side of [-1, 1]) {
        const c = cy + side * half;
        b.box("steel", 0, spanX, c - bar / 2, c + bar / 2, tie, tie + head * 0.25);
        b.box("steel", 0, spanX, c - bar / 5, c + bar / 5, tie + head * 0.25, top - head * 0.3);
        b.box("steel", 0, spanX, c - bar * 0.35, c + bar * 0.35, top - head * 0.3, top);
      }
    } else {
      const count = Math.max(2, Math.round(((Math.PI / 2) * radius) / step) + 1);
      for (let i = 0; i < count; i += 1) {
        const a = -Math.PI / 2 + (Math.PI / 2) * (i / (count - 1));
        // Une traverse dans un virage est un rayon : on la tourne autour de son milieu.
        const m = new Matrix4().makeTranslation(radius * Math.cos(a), spanY + radius * Math.sin(a), 0).multiply(new Matrix4().makeRotationZ(a));
        b.within(m, () => b.box("post", -W / 2, W / 2, -wide / 2, wide / 2, 0, tie));
      }
      for (const side of [-1, 1]) {
        const r = radius + side * half;
        b.prism("steel", annulus(0, spanY, r - bar / 2, r + bar / 2, -Math.PI / 2, 0, 24), tie, tie + head * 0.25);
        b.prism("steel", annulus(0, spanY, r - bar / 5, r + bar / 5, -Math.PI / 2, 0, 24), tie + head * 0.25, top - head * 0.3);
        b.prism("steel", annulus(0, spanY, r - bar * 0.35, r + bar * 0.35, -Math.PI / 2, 0, 24), top - head * 0.3, top);
      }
    }
    return b.build();
  }, [kind, W, radius, spanX, spanY, gauge, railSize, railHeight, sleeperEvery, sleeperSize, sleeperThickness]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
