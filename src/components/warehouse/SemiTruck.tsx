import type { ReactNode } from "react";
import {
  boxFaces,
  convexHull,
  isoWheel,
  solidVolume,
  type Point,
  type Project,
} from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./SemiTruck.css";

/**
 * Semi-remorque — un tracteur à capot et sa remorque fourgon, ce qui arrive à un quai.
 *
 * Même vocabulaire que le reste de l'entrepôt (`rackItems.tsx`) : volumes alignés sur les axes,
 * trois faces, trois clartés d'une seule lumière, faces visibles choisies d'après la rotation, et
 * les mêmes roues rondes (`isoWheel`).
 *
 * ## Les pièces
 *
 * La **remorque** : une caisse sur un longeron, trois essieux groupés à l'arrière — c'est là qu'elle
 * porte, l'avant reposant sur le tracteur — et deux **béquilles** repliées sous l'avant, qui la
 * tiennent quand on la dételle au quai. Ses **portes** sont à l'arrière, deux vantaux, parce que
 * c'est par là qu'on la charge. Le **tracteur** : un longeron, deux essieux moteurs sous l'avant de la
 * remorque, un essieu directeur sous le capot, la **cabine**, le **capot**, le **pare-chocs**, les
 * réservoirs sous la cabine, et les deux **cheminées** d'échappement derrière elle.
 *
 * ## L'ordre de peinture
 *
 * Tout ce qui est **sous la caisse** — roues, longerons, béquilles, réservoirs — passe avant elle :
 * la caisse est au-dessus et ne peut rien recouvrir d'autre. Là-dedans, la file de roues du fond
 * passe avant les longerons, et celle de devant après ; c'est `yFace` qui dit laquelle est laquelle.
 * Au-dessus, le camion se range ensuite **le long de sa longueur** en tranches qui ne se chevauchent
 * pas — remorque, cheminées, cabine, capot, pare-chocs — dans l'ordre où la caméra les voit, ce que
 * `xFace` dit. Lu sur les axes du camion plutôt que sur des emprises au sol, cet ordre tient à tout
 * cap.
 */

export interface SemiTruckProps {
  /** Longueur de la remorque, en cases. */
  trailerLength?: number;
  /** Rotation sur le sol, en degrés. À 0, la cabine regarde vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le camion sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le camion seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;
const WIDTH = 1.3;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function SemiTruck({
  trailerLength = 7.6,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: SemiTruckProps) {
  const cam = useIsoCamera();
  // ---- les cotes, en cases, le long du camion ----
  const T = Math.max(3, trailerLength);
  const kingpin = T - 0.9; // où la remorque repose sur le tracteur
  const tractor0 = kingpin - 0.9; // l'arrière du tracteur
  const cab0 = T + 0.3; // l'arrière de la cabine, juste devant la remorque
  const cab1 = cab0 + 1.2;
  const hood1 = cab1 + 0.9;
  const LENGTH = hood1 + 0.15;

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

  const box = (material: string, key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, extra?: ReactNode) =>
    solidVolume(material, key, boxFaces(at, x0, x1, y0, y1, z0, z1, facing), false, extra);
  const acrossY = (items: { y: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.y - b.y) * facing.yFace).map((it) => it.node);
  const alongX = (items: { x: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.x - b.x) * facing.xFace).map((it) => it.node);

  const r = 0.26;
  const tyre = 0.2;
  const sideY = [tyre / 2 + 0.01, WIDTH - tyre / 2 - 0.01];
  const axles = [0.9, 1.5, 2.1, tractor0 + 0.35, tractor0 + 0.95, hood1 - 0.45];
  const beamY0 = 0.38;
  const beamY1 = WIDTH - 0.38;
  const trailerZ0 = 0.78;
  const trailerZ1 = 2.35;
  const cabZ0 = 0.6;
  const cabZ1 = 2.15;

  const wheelRow = (y: number) => (
    <g key={`wheels${y}`}>
      {alongX(axles.map((x, i) => ({ x, node: isoWheel(at, x, y, r, r, tyre, facing, `w${i}${y}`) })))}
    </g>
  );

  // ---- sous la caisse ----
  const under = (
    <g key="under">
      {acrossY([
        { y: sideY[0], node: wheelRow(sideY[0]) },
        {
          y: WIDTH / 2,
          node: (
            <g key="frame">
              {box("iron", "tractor-beam", tractor0, hood1, beamY0, beamY1, 0.42, cabZ0)}
              {box("iron", "trailer-beam", 0, T, beamY0, beamY1, trailerZ0 - 0.12, trailerZ0)}
              {acrossY(
                [0.12, WIDTH - 0.22].map((y) => ({
                  y,
                  node: (
                    <g key={`gear${y}`}>
                      {box("iron", `leg${y}`, kingpin - 1.6, kingpin - 1.5, y, y + 0.1, 0.18, trailerZ0)}
                      {box("iron", `pad${y}`, kingpin - 1.64, kingpin - 1.46, y - 0.03, y + 0.13, 0.12, 0.18)}
                    </g>
                  ),
                }))
              )}
              {acrossY(
                [0.02, WIDTH - 0.26].map((y) => ({
                  y,
                  node: box("steel", `tank${y}`, cab0 + 0.05, cab0 + 0.75, y, y + 0.24, 0.34, 0.66),
                }))
              )}
            </g>
          ),
        },
        { y: sideY[1], node: wheelRow(sideY[1]) },
      ])}
    </g>
  );

  // ---- au-dessus ----
  /** Les portes arrière : deux vantaux tracés sur la face du fond, quand elle regarde la caméra. */
  const doors =
    facing.xFace < 0 ? (
      <g className="lq-truck__doors">
        {[0.04, WIDTH / 2, WIDTH - 0.04].map((y) => {
          const a = at(0, y, trailerZ0 + 0.05);
          const b = at(0, y, trailerZ1 - 0.05);
          return <line key={y} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
    ) : null;
  const trailer = box("trailer", "trailer", 0, T, 0, WIDTH, trailerZ0, trailerZ1, doors);

  const stacks = (
    <g key="stacks">
      {acrossY(
        [0.08, WIDTH - 0.16].map((y) => ({
          y,
          node: box("steel", `stack${y}`, cab0 - 0.12, cab0 - 0.04, y, y + 0.08, cabZ0, cabZ1 + 0.45),
        }))
      )}
    </g>
  );

  /** Les vitres latérales, sur la face de la cabine qui regarde la caméra. */
  const sideY1 = facing.yFace > 0 ? WIDTH + 0.005 : -0.005;
  const sideWindow = (
    <polygon
      className="lq-truck__glass"
      points={ring([at(cab1 - 0.55, sideY1, 1.45), at(cab1 - 0.08, sideY1, 1.45), at(cab1 - 0.08, sideY1, 1.95), at(cab1 - 0.55, sideY1, 1.95)])}
    />
  );
  const cab = box("cab", "cab", cab0, cab1, 0.04, WIDTH - 0.04, cabZ0, cabZ1, sideWindow);
  const hood = box("cab", "hood", cab1, hood1, 0.16, WIDTH - 0.16, cabZ0, 1.4, (
    <g className="lq-truck__grille">
      {facing.xFace > 0 &&
        [0.35, 0.55, 0.75, 0.95, 1.15].map((z) => {
          const a = at(hood1, 0.28, z);
          const b = at(hood1, WIDTH - 0.28, z);
          return <line key={z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
    </g>
  ));
  const windshield = box("glass-dark", "windshield", cab1, cab1 + 0.03, 0.12, WIDTH - 0.12, 1.48, 2.02);
  const bumper = box("steel", "bumper", hood1, hood1 + 0.15, 0.02, WIDTH - 0.02, 0.36, 0.64);

  const above = alongX([
    { x: 0, node: <g key="trailer">{trailer}</g> },
    { x: cab0 - 0.12, node: stacks },
    { x: cab0, node: <g key="cab">{cab}</g> },
    { x: cab1, node: <g key="front">{alongX([{ x: cab1, node: <g key="h">{hood}</g> }, { x: cab1 + 0.01, node: <g key="ws">{windshield}</g> }, { x: hood1, node: <g key="b">{bumper}</g> }])}</g> },
  ]);

  // ---- l'ombre ----
  const sweep = (x0: number, x1: number, y0: number, y1: number, h: number, key: string) => {
    const foot = [onGround(x0, y0), onGround(x1, y0), onGround(x1, y1), onGround(x0, y1)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  const shade = shadows ? (
    <g>
      {sweep(0, T, 0, WIDTH, trailerZ1, "s-trailer")}
      {sweep(cab0, hood1 + 0.15, 0.04, WIDTH - 0.04, cabZ1, "s-cab")}
    </g>
  ) : null;

  // ---- le cadrage ----
  const corners: Point[] = frame
    ? [0, 1].flatMap((k) =>
        [
          [frame.x, frame.y],
          [frame.x + frame.width, frame.y],
          [frame.x + frame.width, frame.y + frame.depth],
          [frame.x, frame.y + frame.depth],
        ].map(([x, y]) => world(x, y, k === 0 ? 0 : frame.height))
      )
    : [0, cabZ1 + 0.5].flatMap((z) =>
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
      className={["lq-truck", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Semi-remorque"
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {under}
          {above}
        </>
      )}
    </svg>
  );
}
