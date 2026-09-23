import { IsoCanvas } from "./isoCanvas";
import { solidVolume, type Point, type Project } from "./rackItems";
import { frameCorners } from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./Floor.css";

/**
 * Le sol : une **dalle**, et non un fond.
 *
 * Une scène isométrique posée sur rien flotte. Ce qui la pose, ce n'est pas une couleur derrière —
 * un aplat n'a pas de bord — c'est un volume : une dalle dont on **voit l'épaisseur** sur les deux
 * côtés qui regardent la caméra. C'est cette tranche qui dit où le sol s'arrête, et qui donne à
 * tout ce qui est dessus quelque chose sur quoi reposer.
 *
 * Elle occupe `z` de `−0,1` à `0`, et non de `0` à `0,1` : le zéro du monde est le sol sur lequel
 * tout le reste est déjà posé, et le relever déplacerait toute la scène. La dalle descend donc sous
 * lui, et c'est son dessus qui est le sol. Son épaisseur ne se règle pas : une dalle est une dalle,
 * et deux sols d'épaisseurs différentes dans la même image se lisent comme deux niveaux.
 *
 * Elle ne porte pas d'ombre — elle *est* ce sur quoi les autres la portent — et elle se peint avant
 * tout le monde : `parts="shadow"` ne dessine donc rien, pour qu'une scène puisse lui demander ses
 * couches comme à n'importe quel autre module.
 *
 * Elle est **lisse**. Des joints de dalle donneraient l'échelle, mais ils quadrillent le fond de
 * toute la scène : dans une image faite de traits fins, une grille pâle sous chaque objet se lit
 * comme un calque de plus, et ce qui est posé dessus passe au second plan.
 */

export interface FloorProps {
  /** Longueur, en cases, le long des `x`. */
  width?: number;
  /** Profondeur, en cases, le long des `y`. */
  depth?: number;
  /** Où poser le coin de la dalle, en cases. */
  origin?: { x: number; y: number };
  /** La hauteur de son dessus, en cases. `0` : au niveau du sol.
   *
   *  C'est ce qui fait une **plateforme de quai** : le plancher d'un entrepôt de messagerie n'est
   *  pas au niveau de la cour, il est 1 200 mm au-dessus — la hauteur d'un plancher de remorque —
   *  et ce qu'on voit tout autour du bâtiment est la tranche de cette dalle. */
  level?: number;
  /**
   * Le niveau du dessus au bord `y = 0`, quand il n'est pas celui du bord opposé : la dalle
   * **penche**.
   *
   *  Une cour de quai n'est pas plate. Le plancher des remorques est à 1 200 mm, le sol de la cour
   *  est en bas, et entre les deux il faut bien que quelque chose monte : c'est le plan incliné
   *  devant les portes, celui par lequel on rejoint le niveau du quai autrement qu'en sautant.
   *  Sans lui, la plateforme s'arrête sur une falaise et la cour n'est plus reliée à rien.
   *
   *  L'inclinaison est **sur `y` seulement**, et c'est suffisant : une rampe est une voie, elle
   *  monte dans un sens. Une scène qui la veut en travers pose sa dalle tournée d'un quart de tour.
   */
  slope?: number;
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine. La dalle n'ayant pas d'ombre, `"shadow"` ne dessine rien. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;
/** L'épaisseur de la tranche, en cases. Elle ne se règle pas : une dalle est une dalle, et deux
 *  sols d'épaisseurs différentes dans la même image se lisent comme deux niveaux. */
const THICKNESS = 0.1;

export function Floor({
  width = 12,
  depth = 8,
  origin = { x: 0, y: 0 },
  level = 0,
  slope,
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: FloorProps) {
  const cam = useIsoCamera();
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => world(x + origin.x, y + origin.y, z);
  const facing = cam.facing();

  const x1 = Math.max(0.5, width);
  const y1 = Math.max(0.5, depth);
  const z1 = Math.max(0, level);
  /**
   * Une dalle surélevée descend **jusqu'au sol**, elle ne flotte pas à sa hauteur.
   *
   *  Prise à son épaisseur nominale, elle donnait une plaque de six centimètres suspendue à
   *  1 200 mm : le bâtiment n'avait plus de socle, et la marche qu'on voulait montrer n'existait
   *  qu'en l'air. Une plateforme de quai est un massif — ce qu'on voit tout autour est sa tranche
   *  entière, du sol à son dessus.
   */
  /** Le niveau du bord `y = 0`. Égal à celui du reste, la dalle est plate et rien ne change. */
  const zNear = Math.max(0, slope ?? z1);
  const z0 = Math.min(0, z1, zNear) - THICKNESS;

  /**
   * Les trois faces qu'on voit de la dalle — celles de `boxFaces`, avec **une hauteur par bord**.
   *
   *  Une dalle qui penche n'est plus un pavé : son dessus est un plan qui monte, ses deux flancs
   *  sont des trapèzes, et ses deux bouts n'ont pas la même hauteur. Rien d'autre ne bouge — les
   *  mêmes trois faces, la même règle pour savoir lesquelles, la même clarté — donc c'est bien la
   *  boîte qu'on écrit, avec un `z` par bord au lieu d'un seul.
   */
  const faces = () => {
    const xs = facing.xFace > 0 ? x1 : 0;
    const ys = facing.yFace > 0 ? y1 : 0;
    const zTop = ys > 0 ? z1 : zNear;
    const faceX = [at(xs, 0, z0), at(xs, y1, z0), at(xs, y1, z1), at(xs, 0, zNear)];
    const faceY = [at(0, ys, z0), at(x1, ys, z0), at(x1, ys, zTop), at(0, ys, zTop)];
    return {
      top: [at(0, 0, zNear), at(x1, 0, zNear), at(x1, y1, z1), at(0, y1, z1)],
      front: facing.xOnLeft ? faceX : faceY,
      side: facing.xOnLeft ? faceY : faceX,
    };
  };

  const slab = solidVolume("slab", "slab", faces());

  // Le cadrage. Avec un cadre partagé, la dalle **ajoute** sa tranche aux coins du cadre : elle
  // descend sous le zéro du monde, que le cadre ne connaît pas. Ça ne décale rien — ce qui s'ajoute
  // est en bas de l'image, jamais en haut à gauche, d'où partent toutes les `viewBox` de la scène.
  const under = [
    [0, 0],
    [x1, 0],
    [x1, y1],
    [0, y1],
  ].map(([x, y]) => at(x, y, z0));
  const over = [
    [0, 0, zNear],
    [x1, 0, zNear],
    [x1, y1, z1],
    [0, y1, z1],
  ].map(([x, y, z]) => at(x, y, z));
  const corners: Point[] = frame
    ? [...frameCorners(frame, world, cam.sun), ...under, ...over]
    : [...under, ...over];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <IsoCanvas
      className={["lq-floor", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={[minX, minY, boxWidth, boxHeight]}
      ariaLabel="Sol"
    >
      {(parts === "all" || parts === "machine") && slab}
    </IsoCanvas>
  );
}
