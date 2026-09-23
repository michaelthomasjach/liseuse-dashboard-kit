import type { ReactNode } from "react";
import { IsoCanvas } from "./isoCanvas";
import { boxFaces, castShadow, solidVolume, type Project } from "./rackItems";
import "./StorageZone.css";
import { useIsoCamera } from "./isoCamera";

/**
 * Zone de stockage — des marchandises sur palettes, posées au sol.
 *
 * C'est l'autre façon de stocker, celle qui ne demande aucune machine : des palettes alignées à
 * même le sol, empilées sur quelques hauteurs. Une étagère range en hauteur ce qu'une zone range en
 * surface, et un entrepôt fait les deux — d'où un objet à part plutôt qu'un réglage de l'étagère.
 *
 * Bâtie dans le vocabulaire commun (`rackItems.tsx`) : volumes alignés sur les axes montrant les
 * trois faces que la caméra voit, trois clartés d'une même couleur sous une seule lumière, opaques,
 * et les faces visibles choisies d'après la rotation plutôt que supposées.
 *
 * ## Ce qu'une pile est
 *
 * Une **palette** de bois, et au-dessus des charges empilées, chacune un volume à part. Elles ne
 * sont pas dessinées comme un seul bloc de la bonne hauteur : c'est la ligne entre deux charges qui
 * dit combien il y en a, et un bloc unique dirait seulement « c'est haut ». `stacks` donne la
 * hauteur de chaque emplacement en ordre de lecture, et zéro laisse l'emplacement vide — un magasin
 * plein n'est pas un magasin, c'est un magasin qu'on ne peut plus remplir.
 *
 * ## Le jeu entre les piles
 *
 * `gap` sépare deux emplacements. Il n'est pas décoratif : c'est ce qui permet de distinguer deux
 * piles voisines de même hauteur, qui sans lui formeraient un seul pavé. À zéro, une zone pleine
 * redevient un bloc, et c'est parfois ce qu'on veut dire.
 */

export interface StorageZoneProps {
  /** Emplacements sur l'axe X. */
  columns?: number;
  /** Emplacements sur l'axe Y. */
  rows?: number;
  /** Hauteur de pile de chaque emplacement, en ordre de lecture (une rangée Y après l'autre).
   *  Plus courte que le nombre d'emplacements, elle se complète par `fill`. */
  stacks?: number[];
  /** Hauteur des emplacements que `stacks` ne mentionne pas. */
  fill?: number;
  /** Côté d'une palette, en cases. */
  palletSize?: number;
  /** Jeu entre deux emplacements, en cases. */
  gap?: number;
  /** Hauteur d'une charge, en fraction du côté de la palette. */
  unitHeight?: number;
  /** Rotation de la zone sur le sol, en degrés. */
  rotation?: number;
  /** Poser les ombres au sol. */
  shadows?: boolean;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** Épaisseur d'une palette, en fraction de son côté. Assez pour qu'on voie qu'il y en a une. */
const PALLET_THICK = 0.14;

/** Par axe, pour la même raison que partout ailleurs ici : au-delà ce n'est plus un dessin mais une
 *  scène, et c'est un autre travail que celui-ci. */
const MAX = 40;

type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

const count = (n: number) => Math.max(1, Math.min(MAX, Math.floor(n) || 1));

export function StorageZone({
  columns = 4,
  rows = 3,
  stacks,
  fill = 3,
  palletSize = 1.2,
  gap = 0.35,
  unitHeight = 0.62,
  rotation = 0,
  shadows = false,
  cellSize = 30,
  className,
}: StorageZoneProps) {
  const cam = useIsoCamera();
  const nx = count(columns);
  const ny = count(rows);
  const side = Math.max(0.2, palletSize);
  const step = side + Math.max(0, gap);
  const spanX = nx * step - Math.max(0, gap);
  const spanY = ny * step - Math.max(0, gap);
  const unit = Math.max(0.05, unitHeight) * side;
  const deck = PALLET_THICK * side;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  const ground: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return ground(p.x, p.y, z);
  };
  const facing = cam.facing(rotation);

  const heightOf = (i: number) => {
    const asked = stacks ? stacks[i] : fill;
    return Math.max(0, Math.floor(asked ?? fill));
  };

  const pieces: Piece[] = [];
  const shade: ReactNode[] = [];
  let tallest = deck;

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const n = heightOf(j * nx + i);
      if (n === 0) continue;
      const x0 = i * step;
      const y0 = j * step;
      const top = deck + n * unit;
      tallest = Math.max(tallest, top);
      if (shadows) {
        shade.push(
          castShadow(
            ground,
            // Les coins tournés : le soleil est une direction du monde, pas de la zone.
            [spin(x0, y0), spin(x0 + side, y0), spin(x0 + side, y0 + side), spin(x0, y0 + side)],
            top,
            `sh${i}-${j}`, cam.sun)
        );
      }
      pieces.push({
        x: x0,
        y: y0,
        width: side,
        height: side,
        render: () => (
          <g key={`s${i}-${j}`}>
            {solidVolume("wood", `p${i}-${j}`, boxFaces(at, x0, x0 + side, y0, y0 + side, 0, deck, facing))}
            {/* De bas en haut : plus c'est haut, plus c'est près, et chaque charge est un volume à
                part — c'est la ligne entre deux d'entre elles qui dit combien il y en a. */}
            {Array.from({ length: n }, (_, k) =>
              solidVolume(
                "kraft",
                `u${i}-${j}-${k}`,
                boxFaces(at, x0, x0 + side, y0, y0 + side, deck + k * unit, deck + (k + 1) * unit, facing)
              )
            )}
          </g>
        ),
      });
    }
  }

  const sorted = cam.order(
    pieces.map((piece) => {
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

  const outline: [number, number][] = [
    [0, 0],
    [spanX, 0],
    [spanX, spanY],
    [0, spanY],
  ];
  const corners = [
    ...outline.map(([x, y]) => at(x, y, 0)),
    ...outline.map(([x, y]) => at(x, y, tallest)),
    // Les ombres débordent du côté opposé à la lumière.
    ...outline.map(([x, y]) => at(x + tallest, y - tallest, 0)),
  ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const width = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const height = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  const filled = pieces.length;
  return (
    <IsoCanvas
      className={["lq-storage", className].filter(Boolean).join(" ")}
      width={width}
      height={height}
      viewBox={[minX, minY, width, height]}
      ariaLabel={`Zone de stockage, ${filled} emplacement${filled > 1 ? "s" : ""} occupé${filled > 1 ? "s" : ""} sur ${nx * ny}`}
    >
      {shade}
      {sorted.map((piece) => piece.render())}
    </IsoCanvas>
  );
}
