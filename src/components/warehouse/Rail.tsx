import type { ReactNode } from "react";
import { frameCorners, arcRingVolume, boxFaces, castShadow, solidVolume, spunProject, type Point, type Project } from "./rackItems";
import "./Rail.css";
import { useIsoCamera } from "./isoCamera";

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

const PAD = 2;

type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

export function Rail({
  kind = "straight",
  length = 8,
  width = RAIL_WIDTH,
  gauge = RAIL_GAUGE,
  curveRadius,
  railSize = 0.16,
  railHeight = RAIL_HEIGHT,
  sleeperEvery = 1.1,
  sleeperSize = 0.34,
  sleeperThickness = RAIL_SLEEPER_THICKNESS,
  shadows = false,
  rotation = 0,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 34,
  className,
}: RailProps) {
  const cam = useIsoCamera();
  // Un angle est carré : il tient dans sa propre largeur, et une longueur n'aurait aucun sens à lui
  // donner.
  const W = Math.max(0.6, width);
  // Le rayon de l'axe de la voie. Jamais sous la demi-largeur : en dessous, la file intérieure
  // passerait de l'autre côté du centre.
  const radius = Math.max(W / 2, curveRadius ?? W);
  // Un angle tient dans un carré : le rayon, plus la demi-largeur qui dépasse à l'extérieur.
  const spanY = kind === "straight" ? W : radius + W / 2;
  const spanX = kind === "straight" ? Math.max(W, length) : spanY;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  /** Un point du monde vers l'écran, sans passer par le module : l'ombre se calcule là, le soleil
   *  étant une direction du monde et non du module. */
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return world(p.x + origin.x, p.y + origin.y, z);
  };
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };
  const facing = cam.facing(rotation);

  const cy = spanY / 2;
  const tie = Math.max(0.03, sleeperThickness);
  const head = Math.max(0.03, railHeight);
  const top = tie + head;
  const bar = Math.max(0.05, Math.min(railSize, W / 4));
  const half = Math.max(bar, Math.min(gauge, W - bar) / 2);
  const wide = Math.max(0.08, Math.min(sleeperSize, spanX));
  const step = Math.max(0.25, sleeperEvery);

  // ---- les traverses ----
  // Elles sont au sol : rien ne peut se glisser dessous, donc elles passent avant les files, qui
  // reposent dessus. Entre elles, l'ordre est celui de la profondeur.
  const ties: Piece[] = [];
  if (kind === "straight") {
    const count = Math.max(2, Math.round(spanX / step) + 1);
    for (let i = 0; i < count; i += 1) {
      const x = wide / 2 + ((spanX - wide) * i) / (count - 1);
      ties.push({
        x: x - wide / 2,
        y: 0,
        width: wide,
        height: spanY,
        render: () => solidVolume("post", `t${i}`, boxFaces(at, x - wide / 2, x + wide / 2, 0, spanY, 0, tie, facing)),
      });
    }
  } else {
    const count = Math.max(2, Math.round(((Math.PI / 2) * radius) / step) + 1);
    for (let i = 0; i < count; i += 1) {
      // De −90° à 0° : l'entrée est à l'ouest, la sortie au sud, comme pour un tapis d'angle.
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / (count - 1));
      const px = radius * Math.cos(a);
      const py = spanY + radius * Math.sin(a);
      const deg = (a * 180) / Math.PI;
      const view = spunProject(at, deg, px, py, rotation + cam.yaw);
      // L'emprise d'une boîte tournée : sa plus petite boîte droite. `paintOrder` ordonne alors
      // moins de paires d'office et en laisse davantage tomber sur son départage — qui est x + y,
      // c'est-à-dire la profondeur elle-même, donc c'est le bon sens de l'erreur.
      const hw = (W / 2) * Math.abs(Math.cos(a)) + (wide / 2) * Math.abs(Math.sin(a));
      const hh = (W / 2) * Math.abs(Math.sin(a)) + (wide / 2) * Math.abs(Math.cos(a));
      ties.push({
        x: px - hw,
        y: py - hh,
        width: hw * 2,
        height: hh * 2,
        render: () =>
          solidVolume(
            "post",
            `t${i}`,
            boxFaces(view.project, px - W / 2, px + W / 2, py - wide / 2, py + wide / 2, 0, tie, view.facing)
          ),
      });
    }
  }

  // ---- les deux files ----
  const files: Piece[] = [];
  for (const side of [-1, 1] as const) {
    const key = side < 0 ? "rail-in" : "rail-out";
    if (kind === "straight") {
      const c = cy + side * half;
      files.push({
        x: 0,
        y: c - bar / 2,
        width: spanX,
        height: bar,
        render: () => solidVolume("steel", key, boxFaces(at, 0, spanX, c - bar / 2, c + bar / 2, tie, top, facing)),
      });
    } else {
      const r = radius + side * half;
      files.push({
        x: -r - bar,
        y: spanY - r - bar,
        width: (r + bar) * 2,
        height: (r + bar) * 2,
        render: () =>
          arcRingVolume(
            at,
            spin,
            { cx: 0, cy: spanY, rIn: r - bar / 2, rOut: r + bar / 2, z0: tie, z1: top, a0: -Math.PI / 2, a1: 0 },
            "steel",
            key, undefined, cam.view),
      });
    }
  }

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

  // ---- l'ombre ----
  // Celle des **files**, et non celle de la voie entière : une traverse fait un dixième de case de
  // haut et ne projette rien, alors qu'une bande pleine d'un bout à l'autre prétendrait que la voie
  // est un plancher. Ce qui décolle du sol, ce sont les deux files, et ce sont donc les deux seules
  // choses qui portent une ombre.
  const shade: ReactNode[] = [];
  if (shadows) {
    for (const side of [-1, 1] as const) {
      if (kind === "straight") {
        const c = cy + side * half;
        shade.push(
          castShadow(
            world,
            [onGround(0, c - bar / 2), onGround(spanX, c - bar / 2), onGround(spanX, c + bar / 2), onGround(0, c + bar / 2)],
            top,
            `sh${side}`, cam.sun)
        );
      } else {
        const r = radius + side * half;
        const band = (rr: number) =>
          Array.from({ length: 25 }, (_, i) => {
            const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
            return onGround(rr * Math.cos(a), spanY + rr * Math.sin(a));
          });
        shade.push(castShadow(world, [...band(r + bar / 2), ...band(r - bar / 2).reverse()], top, `sh${side}`, cam.sun));
      }
    }
  }

  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [
        at(0, 0, 0),
        at(spanX, 0, 0),
        at(spanX, spanY, 0),
        at(0, spanY, 0),
        at(0, 0, top),
        at(spanX, 0, top),
        at(spanX, spanY, top),
        at(0, spanY, top),
      ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-rail", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label={kind === "corner" ? "Rail d'angle" : "Rail droit"}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {sorted(ties).map((piece) => piece.render())}
          {sorted(files).map((piece) => piece.render())}
        </>
      )}
    </svg>
  );
}
