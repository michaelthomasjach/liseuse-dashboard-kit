import type { ReactNode } from "react";
import { frameCorners, boxFaces, castShadow, solidVolume, type Project } from "./rackItems";
import "./CatchBin.css";
import { useIsoCamera } from "./isoCamera";

/**
 * Bac récupérateur — une caisse ouverte, et ce qui tombe dedans en vrac.
 *
 * C'est le bout d'une ligne : ce qui n'est pas rangé y arrive par le haut et s'y entasse sans
 * ordre. L'objet est donc l'inverse d'une zone de stockage — là-bas tout est aligné parce que tout
 * a été posé, ici rien ne l'est parce que rien ne l'a été.
 *
 * ## Pourquoi on voit dedans
 *
 * Les quatre parois sont dessinées comme quatre volumes ordinaires, et le tri par profondeur fait
 * le reste : les deux parois lointaines passent avant le contenu, les deux proches après. Il n'y a
 * pas de « face intérieure » à dessiner à part — une paroi mince montre celle de ses deux faces qui
 * regarde la caméra, et pour une paroi lointaine c'est justement l'intérieure. Le même calcul de
 * faces visibles qui sert à tout le reste du kit donne donc une caisse ouverte sans qu'on ait à le
 * lui demander.
 *
 * ## Le vrac
 *
 * Les colis sont posés par un tirage **déterministe** : un générateur à graine, et non
 * `Math.random`. Un dessin qui change à chaque rendu n'est pas un dessin, c'est une animation
 * involontaire, et il rend toute comparaison d'images impossible. `seed` donne donc un vrac stable,
 * et en changer donne un autre vrac, tout aussi stable.
 *
 * Chaque colis a sa taille, son cap et sa place. Le cap se fait en tournant le **projecteur** autour
 * du colis plutôt qu'en tournant la boîte, comme partout ailleurs ici : c'est ce qui permet de
 * dessiner une boîte de travers avec le code qui n'en sait dessiner que des droites. Les couches se
 * tassent d'un peu moins que la hauteur d'un colis, parce qu'un tas n'est pas un empilement.
 */

export interface CatchBinProps {
  /** Longueur du bac, en cases. */
  width?: number;
  /** Profondeur du bac, en cases. */
  depth?: number;
  /** Hauteur des parois, en cases. */
  height?: number;
  /** Épaisseur d'une paroi, en cases. */
  wall?: number;
  /** Nombre de colis dans le bac. */
  count?: number;
  /** Côté d'un colis, en cases. */
  itemSize?: number;
  /** La graine du vrac. La changer rebrasse le tas ; la garder le fige. */
  seed?: number;
  /** Rotation du bac sur le sol, en degrés. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le bac sur le sol, en cases. Sert à le composer avec d'autres modules — le bout d'un
   *  tapis — dans une même scène. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le bac seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** Ce qu'une couche gagne en hauteur, en fraction d'un colis. Moins d'un colis entier : un tas se
 *  tasse, les colis se calent les uns dans les autres, et une pile parfaite ne serait plus du vrac. */
const LAYER_RISE = 0.72;

type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };

/** Un générateur à graine. Le tirage doit être le même à chaque rendu : un dessin qui change tout
 *  seul n'est pas un dessin. */
function sequence(seed: number) {
  let state = (Math.floor(seed) || 1) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function CatchBin({
  width = 3,
  depth = 2.4,
  height = 1.1,
  wall = 0.12,
  count = 9,
  itemSize = 0.7,
  seed = 7,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 40,
  className,
}: CatchBinProps) {
  const cam = useIsoCamera();
  const spanX = Math.max(0.6, width);
  const spanY = Math.max(0.6, depth);
  const wallThick = Math.max(0.03, Math.min(wall, Math.min(spanX, spanY) / 4));
  const walls = Math.max(0.1, height);

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  const flat: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return flat(p.x + origin.x, p.y + origin.y, z);
  };
  const facing = cam.facing(rotation);

  const floorZ = wallThick;
  const inner = { x0: wallThick, x1: spanX - wallThick, y0: wallThick, y1: spanY - wallThick };
  const pieces: Piece[] = [];

  // Les quatre parois. Chacune est un volume comme un autre : le tri par profondeur met les deux
  // lointaines avant le contenu et les deux proches après, et une paroi mince montre celle de ses
  // deux faces qui regarde la caméra — pour une lointaine, c'est l'intérieure. La caisse est donc
  // ouverte sans qu'on ait eu à dessiner d'intérieur.
  const rails: [number, number, number, number][] = [
    [0, spanX, 0, wallThick],
    [0, spanX, spanY - wallThick, spanY],
    [0, wallThick, wallThick, spanY - wallThick],
    [spanX - wallThick, spanX, wallThick, spanY - wallThick],
  ];
  rails.forEach(([x0, x1, y0, y1], i) =>
    pieces.push({
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
      render: () => solidVolume("bin", `w${i}`, boxFaces(at, x0, x1, y0, y1, 0, walls, facing)),
    })
  );

  // Le vrac. Une couche se remplit avant la suivante, et chaque colis prend sa taille, son cap et
  // sa place du même tirage — donc le même tas à chaque rendu.
  const next = sequence(seed);
  const unit = Math.max(0.15, itemSize);
  const perRow = Math.max(1, Math.floor((inner.x1 - inner.x0) / unit));
  const perCol = Math.max(1, Math.floor((inner.y1 - inner.y0) / unit));
  const perLayer = perRow * perCol;
  let tallest = walls;

  for (let n = 0; n < Math.max(0, Math.floor(count)); n += 1) {
    const layer = Math.floor(n / perLayer);
    const slot = n % perLayer;
    const cx = inner.x0 + ((slot % perRow) + 0.5) * ((inner.x1 - inner.x0) / perRow);
    const cy = inner.y0 + (Math.floor(slot / perRow) + 0.5) * ((inner.y1 - inner.y0) / perCol);
    // Le désordre : un peu de jeu dans les deux sens, une taille qui varie, un cap quelconque.
    const x = cx + (next() - 0.5) * unit * 0.34;
    const y = cy + (next() - 0.5) * unit * 0.34;
    const size = unit * (0.78 + next() * 0.34);
    const yaw = (next() - 0.5) * 90;
    const z0 = floorZ + layer * unit * LAYER_RISE + (next() - 0.5) * unit * 0.12;
    tallest = Math.max(tallest, z0 + size);

    const r = (yaw * Math.PI) / 180;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    // Tourner le projecteur plutôt que la boîte : c'est ce qui permet de dessiner une boîte de
    // travers avec le code qui n'en sait dessiner que des droites.
    const turned: Project = (px, py, pz) => {
      const dx = px - x;
      const dy = py - y;
      return at(x + dx * c - dy * sn, y + dx * sn + dy * c, pz);
    };
    const view = cam.facing(rotation + yaw);
    pieces.push({
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size,
      render: () =>
        solidVolume("kraft", `i${n}`, boxFaces(turned, x - size / 2, x + size / 2, y - size / 2, y + size / 2, z0, z0 + size, view)),
    });
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
  const shade = shadows ? [castShadow(
          flat,
          outline.map(([x, y]) => {
            const p = spin(x, y);
            return { x: p.x + origin.x, y: p.y + origin.y };
          }),
          walls,
          "shadow", cam.sun)] : [];

  const corners = frame
    ? frameCorners(frame, flat, cam.sun)
    : [
        ...outline.map(([x, y]) => at(x, y, 0)),
        ...outline.map(([x, y]) => at(x, y, tallest)),
        ...outline.map(([x, y]) => at(x + walls, y - walls, 0)),
      ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  const floorPoints = [
    at(inner.x0, inner.y0, floorZ),
    at(inner.x1, inner.y0, floorZ),
    at(inner.x1, inner.y1, floorZ),
    at(inner.x0, inner.y1, floorZ),
  ];

  return (
    <svg
      className={["lq-bin", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label={`Bac récupérateur, ${Math.max(0, Math.floor(count))} colis`}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {/* Le fond, sous tout le reste : rien ne peut passer dessous. */}
          <polygon className="lq-bin__floor" points={floorPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")} />
          {sorted.map((piece) => piece.render())}
        </>
      )}
    </svg>
  );
}
