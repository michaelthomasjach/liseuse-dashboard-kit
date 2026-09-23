import { IsoCanvas } from "./isoCanvas";
import { boxFaces, solidVolume, type Point, type Project } from "./rackItems";
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
  const z0 = z1 - THICKNESS;

  const slab = solidVolume("slab", "slab", boxFaces(at, 0, x1, 0, y1, z0, z1, facing));

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
    [0, 0],
    [x1, 0],
    [x1, y1],
    [0, y1],
  ].map(([x, y]) => at(x, y, z1));
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
