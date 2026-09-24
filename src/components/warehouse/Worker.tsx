import { useRef } from "react";
import type { Group } from "three";
import { Builder, placeAt } from "./three/builder";
import { Parts, Solo, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";

/**
 * Un opérateur — ce qui donne l'échelle à tout le reste.
 *
 * Un entrepôt sans personne est une maquette : c'est la silhouette d'un homme à côté d'une étagère
 * qui dit qu'elle fait six mètres. On le dessine donc à sa vraie taille — 1,75 m, soit 0,875 case —
 * et dans la tenue du métier : chaussures de sécurité, pantalon de travail, **gilet haute
 * visibilité**, casque. Le gilet et le casque sont clairs : c'est ce qu'on repère d'abord dans une
 * scène chargée, sur une liseuse comme dans un vrai entrepôt.
 *
 * Trois postures : debout, assis — au volant d'un chariot —, et **en marche**, bras et jambes
 * balancés en opposition, au rythme de sa vitesse (`walking`).
 */

export type WorkerPose = "stand" | "sit" | "walk";

const HIP = 0.43;
const SHOULDER = 0.72;
const HEAD_R = 0.055;

/**
 * Poser un opérateur dans un constructeur, pieds à l'origine, regard vers les `x` croissants.
 *
 *  Sans les membres qui bougent : une marche est animée à part (voir `Worker`). Assis, il est posé
 *  sur un siège dont le dessus est à `z = 0` — ses jambes pendent devant lui.
 */
export function addWorker(b: Builder, pose: WorkerPose = "stand", opts: { limbs?: boolean } = {}): void {
  const limbs = opts.limbs ?? true;
  if (pose === "sit") {
    // Assis : les cuisses à plat vers l'avant, les tibias qui descendent, le buste droit.
    b.box("denim", -0.06, 0.2, -0.09, -0.02, 0, 0.07);
    b.box("denim", -0.06, 0.2, 0.02, 0.09, 0, 0.07);
    b.box("denim", 0.16, 0.22, -0.09, -0.02, -0.34, 0.02);
    b.box("denim", 0.16, 0.22, 0.02, 0.09, -0.34, 0.02);
    b.box("vest", -0.08, 0.06, -0.11, 0.11, 0.05, 0.36);
    b.box("vest", 0.02, 0.2, -0.13, -0.08, 0.2, 0.27);
    b.box("vest", 0.02, 0.2, 0.08, 0.13, 0.2, 0.27);
    b.blob("skin", -0.01, 0, 0.36 + HEAD_R + 0.02, HEAD_R, 1);
    b.blob("vest", -0.01, 0, 0.36 + HEAD_R + 0.05, HEAD_R * 1.05, 1, 0.55);
    return;
  }
  // Le tronc : le gilet sur le buste, le bassin, la tête et son casque.
  b.box("denim", -0.05, 0.05, -0.09, 0.09, HIP - 0.06, HIP + 0.02);
  b.box("vest", -0.06, 0.06, -0.11, 0.11, HIP, SHOULDER);
  b.box("skin", -0.025, 0.025, -0.025, 0.025, SHOULDER, SHOULDER + 0.04, false);
  b.blob("skin", 0, 0, SHOULDER + 0.04 + HEAD_R, HEAD_R, 1);
  b.blob("vest", 0, 0, SHOULDER + 0.07 + HEAD_R, HEAD_R * 1.08, 1, 0.55);
  // La visière du casque, un rien en avant.
  b.box("vest", 0.03, 0.08, -0.045, 0.045, SHOULDER + 0.06 + HEAD_R, SHOULDER + 0.075 + HEAD_R, false);
  if (limbs) {
    // Debout : jambes et bras le long du corps.
    for (const y of [-0.05, 0.05]) b.box("denim", -0.035, 0.035, y - 0.035, y + 0.035, 0, HIP - 0.04);
    for (const y of [-0.13, 0.13]) b.box("vest", -0.03, 0.03, y - 0.025, y + 0.025, HIP - 0.02, SHOULDER - 0.02);
  }
}

export interface WorkerProps {
  pose?: WorkerPose;
  /** Cap, en degrés. À 0, il regarde vers les `x` croissants. */
  rotation?: number;
  /** Où il se tient, en cases. */
  origin?: { x: number; y: number };
  /** Sa vitesse de marche, en cases par seconde de simulation : bras et jambes balancent d'autant. */
  walking?: number;
  cellSize?: number;
  className?: string;
}

export function Worker(props: WorkerProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, cellSize = 60, className } = props;
  const { bounds } = placed({ x: origin.x - 0.15, y: origin.y - 0.15 }, rotation, { x0: 0, x1: 0.3, y0: 0, y1: 0.3, z0: 0, z1: 0.95 });
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={className} ariaLabel="Opérateur">
      <WorkerBody {...props} />
    </Solo>
  );
}

function WorkerBody({ pose = "stand", rotation = 0, origin = { x: 0, y: 0 }, walking = 0 }: WorkerProps) {
  const walks = pose === "walk";
  const body = useBuilt(() => {
    const b = new Builder();
    addWorker(b, pose === "walk" ? "stand" : pose, { limbs: !walks });
    return b.build();
  }, [pose]);
  // Une jambe et un bras, construits autour de leur articulation : on les fait pivoter sur place.
  const leg = useBuilt(() => {
    const b = new Builder();
    b.box("denim", -0.035, 0.035, -0.035, 0.035, -(HIP - 0.04), 0);
    return b.build();
  }, []);
  const arm = useBuilt(() => {
    const b = new Builder();
    b.box("vest", -0.03, 0.03, -0.025, 0.025, -(SHOULDER - HIP), 0);
    return b.build();
  }, []);
  const joints = useRef<(Group | null)[]>([]);
  useSimFrame((t) => {
    // Une foulée de 0,35 case : la jambe fait un aller-retour par foulée, le bras à l'opposé.
    const a = Math.sin((t * Math.max(0.05, walking) * Math.PI * 2) / 0.7) * 0.5;
    const [l0, l1, a0, a1] = joints.current;
    if (l0) l0.rotation.y = a;
    if (l1) l1.rotation.y = -a;
    if (a0) a0.rotation.y = -a * 0.8;
    if (a1) a1.rotation.y = a * 0.8;
  }, walks);
  const m = placeAt(origin.x, origin.y, rotation);
  return (
    <group matrixAutoUpdate={false} matrix={m}>
      <Parts built={body} />
      {walks && (
        <>
          {[-0.05, 0.05].map((y, i) => (
            <group key={`l${i}`} position={[0, y, HIP - 0.04]} ref={(el) => (joints.current[i] = el)}>
              <Parts built={leg} />
            </group>
          ))}
          {[-0.13, 0.13].map((y, i) => (
            <group key={`a${i}`} position={[0, y, SHOULDER - 0.02]} ref={(el) => (joints.current[2 + i] = el)}>
              <Parts built={arm} />
            </group>
          ))}
        </>
      )}
    </group>
  );
}
