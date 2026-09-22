import type { ReactNode } from "react";
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
 * Elle occupe `z` de `−thickness` à `0`, et non de `0` à `thickness` : le zéro du monde est le sol
 * sur lequel tout le reste est déjà posé, et le relever déplacerait toute la scène. La dalle
 * descend donc sous lui, et c'est son dessus qui est le sol.
 *
 * Elle ne porte pas d'ombre — elle *est* ce sur quoi les autres la portent — et elle se peint avant
 * tout le monde : `parts="shadow"` ne dessine donc rien, pour qu'une scène puisse lui demander ses
 * couches comme à n'importe quel autre module.
 *
 * `joints` trace les joints de dalle, tous les n cases. Ce n'est pas un décor : sans eux, une
 * grande dalle est un aplat où l'œil n'a aucune échelle, et deux scènes au même zoom se ressemblent
 * alors qu'elles ne font pas la même taille.
 */

export interface FloorProps {
  /** Longueur, en cases, le long des `x`. */
  width?: number;
  /** Profondeur, en cases, le long des `y`. */
  depth?: number;
  /** Épaisseur visible de la tranche, en cases. */
  thickness?: number;
  /** Pas des joints de dalle, en cases. `0` : aucun. */
  joints?: number;
  /** Où poser le coin de la dalle, en cases. */
  origin?: { x: number; y: number };
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

export function Floor({
  width = 12,
  depth = 8,
  thickness = 0.3,
  joints = 0,
  origin = { x: 0, y: 0 },
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
  const z0 = -Math.max(0.02, thickness);

  const line = (a: Point, b: Point, key: string) => <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  const seams: ReactNode =
    joints > 0 ? (
      <g className="lq-floor__joints">
        {Array.from({ length: Math.max(0, Math.ceil(x1 / joints) - 1) }, (_, i) =>
          line(at((i + 1) * joints, 0, 0), at((i + 1) * joints, y1, 0), `x${i}`)
        )}
        {Array.from({ length: Math.max(0, Math.ceil(y1 / joints) - 1) }, (_, i) =>
          line(at(0, (i + 1) * joints, 0), at(x1, (i + 1) * joints, 0), `y${i}`)
        )}
      </g>
    ) : null;

  const slab = solidVolume("slab", "slab", boxFaces(at, 0, x1, 0, y1, z0, 0, facing), false, seams);

  // Le cadrage. Avec un cadre partagé, la dalle **ajoute** sa tranche aux coins du cadre : elle
  // descend sous le zéro du monde, que le cadre ne connaît pas. Ça ne décale rien — ce qui s'ajoute
  // est en bas de l'image, jamais en haut à gauche, d'où partent toutes les `viewBox` de la scène.
  const under = [
    [0, 0],
    [x1, 0],
    [x1, y1],
    [0, y1],
  ].map(([x, y]) => at(x, y, z0));
  const corners: Point[] = frame
    ? [...frameCorners(frame, world, cam.sun), ...under]
    : [
        ...under,
        ...[
          [0, 0],
          [x1, 0],
          [x1, y1],
          [0, y1],
        ].map(([x, y]) => at(x, y, 0)),
      ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-floor", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Sol"
    >
      {(parts === "all" || parts === "machine") && slab}
    </svg>
  );
}
