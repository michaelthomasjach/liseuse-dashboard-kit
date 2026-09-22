import type { ReactNode } from "react";
import {
  convexHull,
  fitRackItem,
  frameCorners,
  prismVolume,
  rackItemIso,
  roundedRing,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./Amr.css";

/**
 * Robot autonome (AMR) — le plateau roulant qui porte une palette d'un bout à l'autre du bâtiment.
 *
 * ## Ce qu'il est, et ce qu'il n'est pas
 *
 * Ce n'est ni un chariot ni un picker : personne ne le conduit et il ne lève rien. Il se glisse
 * sous une charge, la porte et la pose. Tout son dessin en découle — **il est bas et il est plat**,
 * parce que ce qu'il transporte doit pouvoir être pris et laissé par une machine qui, elle, lève :
 * sa hauteur est celle d'un socle, pas celle d'un engin.
 *
 * Il n'a donc ni cabine, ni mât, ni contrepoids. Ce qui le distingue d'une simple caisse, c'est :
 *
 * - son **bandeau lumineux**, qui fait le tour et dit son état — c'est ce qu'on regarde quand on
 *   croise un robot, et c'est le seul endroit d'où il parle ;
 * - ses **capteurs** aux angles avant, qui balayent le sol devant lui ;
 * - ses **roues**, enfoncées sous le plateau et visibles seulement par leur ombre de flanc.
 *
 * ## Le dessin
 *
 * Une caisse aux angles abattus (`prismVolume`, `roundedRing`) : un robot de manutention n'a pas
 * d'arête vive, parce qu'une arête vive accroche les palettes et les mollets. Le bandeau est une
 * couche mince prise entre deux autres, plutôt qu'un trait posé sur la face : sur un volume tourné
 * dans tous les caps, un trait doit être replacé à chaque fois, une couche non.
 */

export interface AmrProps {
  /** Ce qu'il porte : une palette, chargée ou non. `null` : plateau nu. */
  load?: RackItemKind | null;
  /** Rotation sur le sol, en degrés. À 0, il avance vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le robot sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le robot seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;
/** L'emprise d'un AMR : à peine plus qu'une palette, puisque c'est ce qu'il porte. */
const LENGTH = 1.6;
const WIDTH = 1.15;
const DECK = 0.34;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function Amr({
  load = "palette",
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: AmrProps) {
  const cam = useIsoCamera();
  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - LENGTH / 2;
    const dy = y - WIDTH / 2;
    return { x: LENGTH / 2 + dx * cosT - dy * sinT, y: WIDTH / 2 + dx * sinT + dy * cosT };
  };
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };
  const at: Project = (x, y, z) => {
    const p = onGround(x, y);
    return world(p.x, p.y, z);
  };
  const facing = cam.facing(rotation);
  const localView = { x: cam.view.x * cosT + cam.view.y * sinT, y: -cam.view.x * sinT + cam.view.y * cosT };
  const prism = (material: string, key: string, ground: Point[], z0: number, z1: number, extra?: ReactNode) =>
    prismVolume(material, key, at, ground, z0, z1, facing, localView, extra);

  const body = (inset: number) => roundedRing(inset, LENGTH - inset, inset, WIDTH - inset, 0.26 - inset, 4);

  const machine = (
    <g key="amr">
      {/* Le soubassement, rentré : c'est le retrait qui met le robot sur ses roues au lieu de le
          poser à plat sur le sol comme une caisse. */}
      {prism("robot-dark", "skirt", body(0.09), 0.03, 0.12)}
      {prism("robot", "hull", body(0), 0.12, 0.2)}
      {/* Le bandeau lumineux : une couche à part, et non un trait sur la face, pour qu'il fasse le
          tour du robot à tous les caps sans être replacé. */}
      {prism("robot-led", "led", body(-0.012), 0.19, 0.25)}
      {prism("robot", "deck", body(0), 0.25, DECK)}
      {/* Les capteurs, aux angles avant. */}
      {prism("robot-dark", "sensor0", roundedRing(LENGTH - 0.26, LENGTH - 0.06, 0.06, 0.26, 0.07), 0.14, 0.24)}
      {prism("robot-dark", "sensor1", roundedRing(LENGTH - 0.26, LENGTH - 0.06, WIDTH - 0.26, WIDTH - 0.06, 0.07), 0.14, 0.24)}
    </g>
  );

  const carried = (() => {
    if (!load) return null;
    const slot = { x: 0.12, y: 0.04, width: LENGTH - 0.24, depth: WIDTH - 0.08 };
    const pallet = fitRackItem("palette", slot, DECK, Infinity);
    const nodes: ReactNode[] = [rackItemIso("palette", pallet, at, facing, "pallet")];
    if (load !== "palette") {
      const goods = fitRackItem(load, { ...slot, x: slot.x + 0.05, width: slot.width - 0.1 }, DECK + pallet.height, Infinity);
      nodes.push(rackItemIso(load, goods, at, facing, "goods"));
    }
    return nodes;
  })();

  const shade = shadows
    ? (() => {
        const foot = [onGround(0, 0), onGround(LENGTH, 0), onGround(LENGTH, WIDTH), onGround(0, WIDTH)];
        const cast = foot.map((p) => ({ x: p.x + cam.sun.x * DECK, y: p.y + cam.sun.y * DECK }));
        return <polygon className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
      })()
    : null;

  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, DECK + 1].flatMap((z) =>
        [
          [0, 0],
          [LENGTH, 0],
          [LENGTH, WIDTH],
          [0, WIDTH],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-amr", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Robot autonome"
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {machine}
          {carried}
        </>
      )}
    </svg>
  );
}
