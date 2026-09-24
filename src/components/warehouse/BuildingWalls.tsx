import { Wall, type WallOpening } from "./Wall";
import { Floor } from "./Floor";
import { Solo, frameBounds, placed } from "./three/scene";

/**
 * Les deux murs dont on assemble un bâtiment : le **mur de quai**, percé de ses portes et bordé de
 * sa cour, et le **mur standard**, plein, avec sa bande de sol.
 *
 * ## Un mur apporte son sol
 *
 * Un `Wall` seul est un voile de béton ; ce qui en fait une façade, c'est le sol qui le borde. Ces
 * deux composants portent donc chacun **la dalle sous le mur et le sol qui est devant lui** : la
 * bande de cour pour un mur standard, les deux retours et la cour pour un mur de quai. Poser quatre
 * murs, c'est poser le tour du bâtiment, sol compris — il ne reste que le plancher intérieur à
 * ajouter, une `Floor` entre les murs.
 *
 * ## Le repère
 *
 * Les deux se décrivent de la même façon : le mur est couché le long des `x`, de `0` à `length`, son
 * épaisseur de `y = 0` à `y = thickness`, et **l'extérieur est du côté des `y` négatifs** — c'est là
 * que vont la cour, les portes de quai et la bande de sol. `origin` pose le coin du mur, et
 * `rotation` le fait tourner **autour du centre du mur** (et non de son sol), comme tous les modules
 * du kit. Pour fermer un rectangle, il suffit donc de tourner l'extérieur vers le dehors :
 * `0` pour la façade du bas, `180` pour celle du haut, `-90` à gauche, `90` à droite.
 *
 * Les deux sont assis à la même hauteur, `level` : celle du plancher de l'entrepôt, qui est celle
 * d'un plancher de remorque. C'est ce qui permet de les mettre bout à bout — leurs dalles se
 * raccordent sans marche.
 */

type Frame = { x: number; y: number; width: number; depth: number; height: number };

interface CommonProps {
  /** Longueur du mur, en cases (une case vaut deux mètres). */
  length?: number;
  /** Hauteur du mur au-dessus du plancher, en cases. */
  height?: number;
  /** Épaisseur du mur, en cases. */
  thickness?: number;
  /** La hauteur du plancher, et donc de la dalle sur laquelle le mur est assis, en cases. */
  level?: number;
  /** Poser le sol avec le mur. Sans lui, le mur seul, assis à `level`. */
  slab?: boolean;
  /** Les poteaux : espacés sur toute la longueur, aux deux bouts seulement, ou aucun. */
  piers?: "spaced" | "ends" | "none";
  /** Couper le mur à cette hauteur, pour voir dedans. */
  cut?: number;
  /** Un bardage de panneaux métalliques sur les deux faces, au lieu du béton nu. */
  cladding?: boolean;
  /** Où poser le coin du mur, en cases. */
  origin?: { x: number; y: number };
  /** Rotation autour du centre du mur, en degrés. */
  rotation?: number;
  /** Le pavé du monde partagé par une scène composée. */
  frame?: Frame;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

export interface DockWallProps extends CommonProps {
  /** Les portes : un nombre — réparties au milieu du mur, `doorSpacing` de centre à centre —, ou
   *  la liste des abscisses de leurs centres, en cases. */
  doors?: number | number[];
  /** L'entraxe des portes quand on en donne le nombre, en cases. */
  doorSpacing?: number;
  /** Largeur d'une porte, en cases. */
  doorWidth?: number;
  /** Hauteur d'une porte au-dessus du seuil, en cases. */
  doorHeight?: number;
  /** Ouverture des portes, de `0` (fermées) à `1` — une valeur pour toutes, ou une par porte. */
  open?: number | number[];
  /** La profondeur de la cour devant le quai, en cases. */
  yard?: number;
  /** La largeur des deux retours de plateforme qui bordent la cour, en cases. `0` : pas de retours. */
  returns?: number;
}

export interface StandardWallProps extends CommonProps {
  /** Des baies dans le mur — une porte de service, une fenêtre. */
  openings?: WallOpening[];
  /** La largeur de la bande de sol devant le mur, en cases. */
  skirt?: number;
  /** Prolonger la bande au-delà d'un bout, pour couvrir l'angle du bâtiment : les deux, le début
   *  (`x = 0`), la fin (`x = length`), ou aucun. */
  corners?: boolean | "start" | "end";
}

const DEFAULTS = { length: 18, height: 3, thickness: 0.3, level: 0.6 };

/** Les centres de `n` portes, `spacing` de centre à centre, groupées au milieu d'un mur. */
export function dockDoorCenters(length: number, n: number, spacing: number, width: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return [];
  const step = Math.min(spacing, (length - width) / Math.max(1, count - 1 || 1));
  const first = length / 2 - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, i) => first + i * step);
}

function dockLayout(p: DockWallProps) {
  const L = Math.max(1, p.length ?? DEFAULTS.length);
  const D = Math.max(0.04, p.thickness ?? DEFAULTS.thickness);
  const H = Math.max(0.5, p.height ?? DEFAULTS.height);
  const level = Math.max(0, p.level ?? DEFAULTS.level);
  const width = Math.max(0.4, p.doorWidth ?? 1.75);
  const centers = Array.isArray(p.doors) ? p.doors : dockDoorCenters(L, p.doors ?? 5, p.doorSpacing ?? 3, width);
  const yard = Math.max(0, p.yard ?? 4.8);
  const returns = Math.max(0, p.returns ?? 1.2);
  return { L, D, H, level, width, centers, yard, returns };
}

/**
 * Le mur de quai : une façade percée de portes sectionnelles, chacune avec son niveleur, ses
 * butoirs et ses bornes, et **la cour à plat devant elle**.
 *
 * La plateforme s'arrête au nu du mur, sauf à ses deux bouts où elle avance border la cour — les
 * deux retours. Entre eux, la cour est **de niveau**, au sol du site : `level` plus bas que le
 * seuil des portes, la hauteur d'un plancher de remorque, que les niveleurs rattrapent.
 */
export function DockWall(props: DockWallProps) {
  const { origin = { x: 0, y: 0 }, rotation = 0, frame, cellSize = 20, className, slab = true } = props;
  const { L, D, H, level, yard, returns } = dockLayout(props);
  const { bounds } = placed(
    origin,
    rotation,
    { x0: slab ? -returns : 0, x1: slab ? L + returns : L, y0: slab ? -yard : -0.6, y1: D + 0.1, z0: -0.2, z1: level + H + 0.3 },
    { x: L / 2, y: D / 2 }
  );
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Mur de quai">
      <DockWallBody {...props} />
    </Solo>
  );
}

function DockWallBody(props: DockWallProps) {
  const { origin = { x: 0, y: 0 }, rotation = 0, slab = true, piers, cut, open, doorHeight = 1.8, cladding } = props;
  const { L, D, H, level, width, centers, yard, returns } = dockLayout(props);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: D, z0: 0, z1: 1 }, { x: L / 2, y: D / 2 });
  const openings: WallOpening[] = centers.map((c, i) => ({
    at: c - width / 2,
    width,
    height: doorHeight,
    dock: true,
    open: Array.isArray(open) ? open[i] ?? 0 : open ?? 0,
  }));
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      {slab && (
        <>
          {/* La dalle sous le mur, à hauteur de plancher. */}
          <Floor origin={{ x: 0, y: 0 }} width={L} depth={D} level={level} />
          {returns > 0 && yard > 0 && (
            <>
              {/* Les retours s'arrêtent au nu du mur : l'angle, au-delà, est au mur voisin. */}
              <Floor origin={{ x: -returns, y: -yard }} width={returns} depth={yard} level={level} />
              <Floor origin={{ x: L, y: -yard }} width={returns} depth={yard} level={level} />
            </>
          )}
          {/* La cour, à plat, au niveau du site : `level` plus bas que le seuil des portes. */}
          {yard > 0 && <Floor origin={{ x: 0, y: -yard }} width={L} depth={yard} level={0} />}
        </>
      )}
      <Wall length={L} height={H} thickness={D} base={level} dockHeight={level} dockSide="y0" openings={openings} piers={piers} cut={cut} cladding={cladding} shadows />
    </group>
  );
}

function standardLayout(p: StandardWallProps) {
  const L = Math.max(0.5, p.length ?? DEFAULTS.length);
  const D = Math.max(0.04, p.thickness ?? DEFAULTS.thickness);
  const H = Math.max(0.5, p.height ?? DEFAULTS.height);
  const level = Math.max(0, p.level ?? DEFAULTS.level);
  const skirt = Math.max(0, p.skirt ?? 1.2);
  const c = p.corners ?? false;
  const before = c === true || c === "start" ? skirt : 0;
  const after = c === true || c === "end" ? skirt : 0;
  return { L, D, H, level, skirt, before, after };
}

/**
 * Le mur standard : un long pan plein, rythmé de ses poteaux, posé sur la dalle et bordé à
 * l'extérieur d'une **bande de sol** au niveau du plancher — ce qui donne un pied au bâtiment.
 *
 * Aux angles, la bande peut se prolonger d'autant (`corners`) : de deux murs qui se rencontrent,
 * c'est à l'un des deux de couvrir le carré d'angle, et c'est à la scène de dire lequel.
 */
export function StandardWall(props: StandardWallProps) {
  const { origin = { x: 0, y: 0 }, rotation = 0, frame, cellSize = 20, className, slab = true } = props;
  const { L, D, H, level, skirt, before, after } = standardLayout(props);
  const { bounds } = placed(
    origin,
    rotation,
    { x0: slab ? -before : 0, x1: slab ? L + after : L, y0: slab ? -skirt : -0.1, y1: D + 0.1, z0: -0.2, z1: level + H + 0.3 },
    { x: L / 2, y: D / 2 }
  );
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Mur">
      <StandardWallBody {...props} />
    </Solo>
  );
}

function StandardWallBody(props: StandardWallProps) {
  const { origin = { x: 0, y: 0 }, rotation = 0, slab = true, piers, cut, openings, cladding } = props;
  const { L, D, H, level, skirt, before, after } = standardLayout(props);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: D, z0: 0, z1: 1 }, { x: L / 2, y: D / 2 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      {slab && (
        <>
          <Floor origin={{ x: 0, y: 0 }} width={L} depth={D} level={level} />
          {skirt > 0 && <Floor origin={{ x: -before, y: -skirt }} width={L + before + after} depth={skirt} level={level} />}
        </>
      )}
      <Wall length={L} height={H} thickness={D} base={level} openings={openings} piers={piers} cut={cut} cladding={cladding} shadows />
    </group>
  );
}

/**
 * Où poser un mur pour qu'il occupe une emprise donnée, l'extérieur tourné vers le dehors.
 *
 *  `side` dit quelle façade d'un rectangle `[x0, x0 + width] × [y0, y0 + depth]` il est : le mur
 *  tient **dans** le rectangle, sur son bord, et son sol déborde à l'extérieur. De quoi fermer un
 *  bâtiment sans calculer une seule origine tournée.
 */
export function wallPlacement(
  side: "front" | "back" | "left" | "right",
  rect: { x: number; y: number; width: number; depth: number },
  thickness = DEFAULTS.thickness
): { origin: { x: number; y: number }; rotation: number; length: number } {
  const D = thickness;
  if (side === "front") return { origin: { x: rect.x, y: rect.y }, rotation: 0, length: rect.width };
  if (side === "back") return { origin: { x: rect.x, y: rect.y + rect.depth - D }, rotation: 180, length: rect.width };
  // Un mur couché le long des `y` tourne autour de son centre : son coin se décale d'autant.
  const L = rect.depth;
  const x = side === "left" ? rect.x : rect.x + rect.width - D;
  return { origin: { x: x + (D - L) / 2, y: rect.y + (L - D) / 2 }, rotation: side === "left" ? -90 : 90, length: L };
}
