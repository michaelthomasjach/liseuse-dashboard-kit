import type { ReactNode } from "react";
import {
  convexHull,
  frameCorners,
  prismVolume,
  roundedRing,
  type Point,
  type Project,
} from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./RobotArm.css";

/**
 * Bras robotisé — celui qui prend un colis sur un tapis et le pose sur un autre, ou sur une
 * palette.
 *
 * ## Le segment incliné, et pourquoi il fallait l'inventer
 *
 * Tout le reste de l'entrepôt est fait de volumes **debout** : on extrude un contour au sol entre
 * deux hauteurs. Un bras, non — ses segments partent de travers, et c'est même sa seule raison
 * d'être : un manipulateur dont tout serait vertical ou horizontal serait un portique.
 *
 * Un segment est donc une **poutre d'un point à un autre**, dessinée comme la silhouette de ses
 * huit coins. C'est juste, et pas une approximation : la caméra du kit est affine, donc l'image
 * d'un pavé est l'enveloppe convexe des images de ses sommets, quel que soit son cap dans l'espace.
 * Ce qu'on perd, ce sont les trois clartés — une poutre de travers n'a pas de face « dessus » ni de
 * face « côté », elle a des faces qui ne sont ni l'une ni l'autre. Elle prend donc un ton unique,
 * et c'est le contour qui la détache, ce que le reste du kit fait déjà pour les pièces minces.
 *
 * ## La pose
 *
 * `shoulder` et `elbow` sont les deux angles du bras, en degrés, mesurés depuis l'horizontale : le
 * premier depuis l'épaule, le second **depuis le premier segment**, comme sur une vraie machine, et
 * non depuis l'horizontale — c'est ce qui permet de garder un avant-bras replié en levant l'épaule.
 * `rotation` est le cap de la base, donc la direction dans laquelle le bras travaille.
 *
 * Rien ne bouge tout seul : un bras qui s'agite en permanence dans une story est un bruit, et les
 * poses qui comptent sont celles qu'on veut comparer. Une story qui veut du mouvement fait varier
 * les angles elle-même.
 */

export interface RobotArmProps {
  /** Angle de l'épaule depuis l'horizontale, en degrés. */
  shoulder?: number;
  /** Angle du coude depuis le premier segment, en degrés. Positif : l'avant-bras se replie. */
  elbow?: number;
  /** Longueur du bras, en cases — les deux segments s'en déduisent. */
  reach?: number;
  /** Cap de la base, en degrés : la direction dans laquelle le bras travaille. */
  rotation?: number;
  /** Ce qu'il tient au bout de la pince. `null` : pince vide. */
  holding?: boolean;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où **se tient** le robot, en cases : le centre de sa embase, et non un coin. Un bras tourne
   *  autour de son axe, donc c'est cet axe qu'on place. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le robot seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;
const BASE_R = 0.34;
const BASE_Z = 0.16;
const TURRET_Z = 0.52;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

interface P3 {
  x: number;
  y: number;
  z: number;
}

export function RobotArm({
  shoulder = 52,
  elbow = 74,
  reach = 1.7,
  rotation = 0,
  holding = true,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: RobotArmProps) {
  const cam = useIsoCamera();
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => world(x + origin.x, y + origin.y, z);
  const facing = cam.facing(rotation);
  const localView = { x: cam.view.x, y: cam.view.y };
  const prism = (material: string, key: string, ground: Point[], z0: number, z1: number) =>
    prismVolume(material, key, at, ground, z0, z1, facing, localView);

  // ---- la pose, en trois points ----
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dir = { x: Math.cos(rad(rotation)), y: Math.sin(rad(rotation)) };
  const upper = reach * 0.54;
  const fore = reach * 0.46;
  const shoulderPt: P3 = { x: 0, y: 0, z: TURRET_Z + 0.12 };
  const a1 = rad(shoulder);
  const a2 = a1 - rad(elbow);
  const elbowPt: P3 = {
    x: shoulderPt.x + dir.x * upper * Math.cos(a1),
    y: shoulderPt.y + dir.y * upper * Math.cos(a1),
    z: shoulderPt.z + upper * Math.sin(a1),
  };
  const wristPt: P3 = {
    x: elbowPt.x + dir.x * fore * Math.cos(a2),
    y: elbowPt.y + dir.y * fore * Math.cos(a2),
    z: elbowPt.z + fore * Math.sin(a2),
  };

  /**
   * Une poutre d'un point à l'autre : l'enveloppe convexe des huit coins du pavé. La caméra étant
   * affine, cette enveloppe **est** la silhouette du volume, et non une approximation.
   */
  const beam = (a: P3, b: P3, half: number, material: string, key: string) => {
    const ax = b.x - a.x;
    const ay = b.y - a.y;
    const az = b.z - a.z;
    const len = Math.hypot(ax, ay, az) || 1e-6;
    // Deux directions perpendiculaires à la poutre : l'une à plat, l'autre dans son plan vertical.
    const flat = Math.hypot(ax, ay) || 1e-6;
    const n1 = { x: -ay / flat, y: ax / flat, z: 0 };
    const n2 = {
      x: (-(ax / len) * (az / len)) / Math.max(1e-6, flat / len),
      y: (-(ay / len) * (az / len)) / Math.max(1e-6, flat / len),
      z: flat / len,
    };
    const pts: Point[] = [];
    for (const end of [a, b]) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          pts.push(
            at(
              end.x + n1.x * half * s1 + n2.x * half * s2,
              end.y + n1.y * half * s1 + n2.y * half * s2,
              end.z + n1.z * half * s1 + n2.z * half * s2
            )
          );
        }
      }
    }
    return <polygon key={key} className={`lq-arm__beam lq-arm__beam--${material}`} points={ring(convexHull(pts))} />;
  };

  const joint = (p: P3, r: number, key: string) => {
    const pts: Point[] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(at(p.x + r * Math.cos(a), p.y + r * Math.sin(a), p.z + r * Math.sin(a) * 0.0));
      pts.push(at(p.x + r * Math.cos(a) * 0.2, p.y + r * Math.sin(a) * 0.2, p.z + r * Math.cos(a)));
    }
    return <polygon key={key} className="lq-arm__beam lq-arm__beam--joint" points={ring(convexHull(pts))} />;
  };

  const square = (r: number) => roundedRing(-r, r, -r, r, r * 0.55, 4);

  const machine = (
    <g key="arm">
      {/* L'embase et la tourelle : ce qui tient au sol et ce qui tourne dessus. */}
      {prism("arm-dark", "base", square(BASE_R), 0, BASE_Z)}
      {prism("arm", "turret", square(BASE_R * 0.78), BASE_Z, TURRET_Z)}
      {joint(shoulderPt, 0.13, "j-shoulder")}
      {beam(shoulderPt, elbowPt, 0.1, "arm", "upper")}
      {joint(elbowPt, 0.1, "j-elbow")}
      {beam(elbowPt, wristPt, 0.075, "arm", "fore")}
      {joint(wristPt, 0.075, "j-wrist")}
      {/* La pince : deux doigts sous le poignet. C'est le seul endroit par lequel un bras touche ce
          qu'il déplace, donc le seul qu'on doive voir en entier. */}
      {beam(wristPt, { ...wristPt, z: wristPt.z - 0.2 }, 0.05, "arm-dark", "wrist")}
      {[-1, 1].map((s) => {
        const off = { x: -dir.y * 0.11 * s, y: dir.x * 0.11 * s };
        return beam(
          { x: wristPt.x + off.x, y: wristPt.y + off.y, z: wristPt.z - 0.2 },
          { x: wristPt.x + off.x, y: wristPt.y + off.y, z: wristPt.z - 0.36 },
          0.035,
          "arm-dark",
          `finger${s}`
        );
      })}
      {holding ? prism("kraft", "held", roundedRing(wristPt.x - 0.17, wristPt.x + 0.17, wristPt.y - 0.17, wristPt.y + 0.17, 0.03), wristPt.z - 0.56, wristPt.z - 0.24) : null}
    </g>
  );

  const shade = shadows
    ? (() => {
        const foot: Point[] = [];
        for (const p of [shoulderPt, elbowPt, wristPt]) {
          foot.push({ x: p.x + cam.sun.x * p.z, y: p.y + cam.sun.y * p.z });
        }
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2;
          foot.push({ x: BASE_R * Math.cos(a), y: BASE_R * Math.sin(a) });
        }
        return (
          <polygon
            className="lq-iso__shadow"
            points={ring(convexHull(foot.map((p) => at(p.x, p.y, 0))))}
          />
        );
      })()
    : null;

  const span = reach + BASE_R + 0.4;
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, wristPt.z + 0.4].flatMap((z) =>
        [
          [-span, -span],
          [span, -span],
          [span, span],
          [-span, span],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  const content: ReactNode = (
    <>
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && machine}
    </>
  );

  return (
    <svg
      className={["lq-arm", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Bras robotisé"
    >
      {content}
    </svg>
  );
}
