import { useRef } from "react";
import type { Group } from "three";
import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { addGood } from "./three/goods";
import "./rackItems.css";
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
  /** Enchaîner les prises : la tourelle pivote d'un poste à l'autre, le bras plonge, saisit, remonte,
   *  pivote, dépose. */
  running?: boolean;
  /** Durée d'un aller-retour, en secondes de simulation. */
  cycle?: number;
  /** L'amplitude du pivot de la tourelle entre ses deux postes, en degrés. */
  swing?: number;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const BASE_R = 0.34;
const BASE_Z = 0.16;
const TURRET_Z = 0.52;


export function RobotArm(props: RobotArmProps) {
  const { reach = 1.7, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 30, className } = props;
  if (parts === "shadow") return null;
  const span = reach + BASE_R + 0.4;
  const bounds = frame ? frameBounds(frame) : { x0: origin.x - span, x1: origin.x + span, y0: origin.y - span, y1: origin.y + span, z0: 0, z1: TURRET_Z + reach + 0.4 };
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-arm", className].filter(Boolean).join(" ")} ariaLabel="Bras robotisé">
      <RobotArmBody {...props} />
    </Solo>
  );
}

/** Une courbe douce d'un palier à l'autre. */
const ease = (x: number) => x * x * (3 - 2 * x);

function RobotArmBody({ shoulder = 52, elbow = 74, reach = 1.7, rotation = 0, holding = true, origin = { x: 0, y: 0 }, running = false, cycle = 6, swing = 120 }: RobotArmProps) {
  const upper = reach * 0.54;
  const fore = reach * 0.46;
  const shoulderZ = TURRET_Z + 0.12;
  const square = (r: number) => roundedRect(-r, r, -r, r, r * 0.55, 4);
  const base = useBuilt(() => {
    const b = new Builder();
    b.prism("arm-dark", square(BASE_R), 0, BASE_Z);
    return b.build();
  }, []);
  const turret = useBuilt(() => {
    const b = new Builder();
    b.prism("arm", square(BASE_R * 0.78), BASE_Z, TURRET_Z);
    b.cylinder("arm-dark", 0, 0, shoulderZ, 0.13, 0.3, "y", 16);
    return b.build();
  }, []);
  const upperArm = useBuilt(() => {
    const b = new Builder();
    b.beam("arm", [0, 0, 0], [upper, 0, 0], 0.1);
    b.cylinder("arm-dark", upper, 0, 0, 0.1, 0.24, "y", 16);
    return b.build();
  }, [upper]);
  const foreArm = useBuilt(() => {
    const b = new Builder();
    b.beam("arm", [0, 0, 0], [fore, 0, 0], 0.075);
    b.blob("arm-dark", fore, 0, 0, 0.075, 1);
    return b.build();
  }, [fore]);
  const hand = useBuilt(() => {
    const b = new Builder();
    // Le poignet pend toujours à la verticale : c'est lui qui porte, et la pince regarde le sol.
    b.box("arm-dark", -0.05, 0.05, -0.05, 0.05, -0.2, 0);
    b.box("arm-dark", -0.14, 0.14, -0.05, 0.05, -0.23, -0.2);
    for (const s of [-1, 1]) b.box("arm-dark", s * 0.11 - 0.025, s * 0.11 + 0.025, -0.035, 0.035, -0.36, -0.23);
    if (holding) addGood(b, "carton", 0, 0, -0.56, 0.17, 0.3);
    return b.build();
  }, [holding]);

  const turretRef = useRef<Group>(null);
  const shoulderRef = useRef<Group>(null);
  const elbowRef = useRef<Group>(null);
  const wristRef = useRef<Group>(null);
  const rad = (d: number) => (d * Math.PI) / 180;
  const pose = (yaw: number, s: number, e: number) => {
    const a1 = rad(s);
    const a2 = a1 - rad(e);
    if (turretRef.current) turretRef.current.rotation.z = rad(yaw);
    if (shoulderRef.current) shoulderRef.current.rotation.y = -a1;
    if (elbowRef.current) elbowRef.current.rotation.y = rad(e);
    // Annuler l'inclinaison cumulée : la pince reste verticale.
    if (wristRef.current) wristRef.current.rotation.y = a2;
  };
  useSimFrame((t) => {
    // Un demi-cycle par trajet : plonger et remonter au poste de départ, pivoter bras levé, plonger
    // et remonter au poste d'arrivée. Le suivant fait le chemin inverse.
    const u = (((t / Math.max(1, cycle)) % 1) + 1) % 1;
    const half = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
    const from = u < 0.5 ? rotation - swing / 2 : rotation + swing / 2;
    const to = u < 0.5 ? rotation + swing / 2 : rotation - swing / 2;
    const turn = half < 0.22 ? 0 : half < 0.78 ? ease((half - 0.22) / 0.56) : 1;
    const low =
      half < 0.12 ? ease(half / 0.12) : half < 0.22 ? 1 - ease((half - 0.12) / 0.1) : half < 0.78 ? 0 : half < 0.88 ? ease((half - 0.78) / 0.1) : 1 - ease((half - 0.88) / 0.12);
    pose(from + (to - from) * turn, shoulder - 22 * low, elbow + 18 * low);
  }, running);

  return (
    <group position={[origin.x, origin.y, 0]}>
      <Parts built={base} />
      <group ref={turretRef} rotation={[0, 0, rad(rotation)]}>
        <Parts built={turret} />
        <group position={[0, 0, shoulderZ]}>
          <group ref={shoulderRef} rotation={[0, -rad(shoulder), 0]}>
            <Parts built={upperArm} />
            <group position={[upper, 0, 0]}>
              <group ref={elbowRef} rotation={[0, rad(elbow), 0]}>
                <Parts built={foreArm} />
                <group position={[fore, 0, 0]}>
                  <group ref={wristRef} rotation={[0, rad(shoulder - elbow), 0]}>
                    <Parts built={hand} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
