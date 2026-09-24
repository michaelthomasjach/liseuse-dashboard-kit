import { useRef } from "react";
import type { Group } from "three";
import { Builder, placeAt, type P2 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useFollow, type Follow } from "./three/follow";
import { useSimFrame } from "./three/time";

/**
 * Une voiture — de tourisme ou de livraison — pour le parking, les rues et la cour d'un site.
 *
 * ## Une silhouette, pas une boîte
 *
 * Une voiture se reconnaît de profil : capot, pare-brise, pavillon, lunette, coffre. C'est donc un
 * **profil extrudé sur la largeur**, arrondi sur ses arêtes, et non un empilement de pavés — un
 * pavé sur un pavé se lit comme un jouet en bois. Le vitrage est posé dans les pentes du profil, si
 * bien que la voiture dit de quel côté elle regarde sous tous les angles.
 *
 * Trois gabarits, qui sont ceux qu'on croise autour d'un entrepôt :
 * - `"sedan"` : la berline des salariés, 4,5 m ;
 * - `"hatch"` : la citadine, 3,9 m, un hayon droit ;
 * - `"van"`   : l'utilitaire du dernier kilomètre, 5,4 m, un grand volume de caisse et une porte
 *   latérale coulissante — celui qui repart chargé des colis triés.
 *
 * Les cotes sont en cases (une case vaut deux mètres), la voiture allongée sur les `x`, le nez vers
 * les `x` croissants.
 */

export type CarKind = "sedan" | "hatch" | "van";
/** La teinte d'une carrosserie, dans la palette du kit. */
export type CarTone = "light" | "dark" | "warm" | "cool" | "accent";

export const CAR_DIMENSIONS: Record<CarKind, { length: number; width: number; height: number }> = {
  sedan: { length: 2.25, width: 0.9, height: 0.73 },
  hatch: { length: 1.95, width: 0.87, height: 0.76 },
  van: { length: 2.7, width: 1.0, height: 1.25 },
};

const TONE: Record<CarTone, string> = {
  light: "paint-light",
  dark: "paint-dark",
  warm: "paint-warm",
  cool: "paint-cool",
  accent: "paint",
};

/** Le rayon d'une roue de voiture : 330 mm. */
const WHEEL_R = 0.165;

/** Le profil d'une carrosserie, dans `(x, z)`, de l'arrière au nez puis retour par le pavillon. */
function profileOf(kind: CarKind, L: number): P2[] {
  const H = CAR_DIMENSIONS[kind].height;
  const sill = 0.12;
  if (kind === "van") {
    return [
      { x: 0, y: sill },
      { x: L, y: sill },
      { x: L, y: 0.42 },
      { x: L * 0.94, y: 0.52 },
      { x: L * 0.8, y: 0.6 },
      { x: L * 0.72, y: H - 0.04 },
      { x: L * 0.68, y: H },
      { x: 0.02, y: H },
      { x: 0, y: H - 0.03 },
    ];
  }
  if (kind === "hatch") {
    return [
      { x: 0, y: sill },
      { x: L, y: sill },
      { x: L, y: 0.3 },
      { x: L * 0.8, y: 0.4 },
      { x: L * 0.6, y: H },
      { x: L * 0.12, y: H },
      { x: 0.02, y: H - 0.08 },
      { x: 0, y: 0.34 },
    ];
  }
  return [
    { x: 0, y: sill },
    { x: L, y: sill },
    { x: L, y: 0.29 },
    { x: L * 0.97, y: 0.33 },
    { x: L * 0.72, y: 0.37 },
    { x: L * 0.56, y: H },
    { x: L * 0.27, y: H },
    { x: L * 0.12, y: 0.4 },
    { x: 0, y: 0.36 },
  ];
}

/**
 * Poser une voiture dans un constructeur, allongée sur les `x`, son arrière en `x = 0`.
 *
 *  La carrosserie seulement : les roues sont posées à part, pour pouvoir tourner — voir
 *  `carWheels`. Un parc de voitures immobiles les construit dans le même geste (`wheels: true`).
 */
export function addCar(b: Builder, kind: CarKind, tone: CarTone, opts: { wheels?: boolean; length?: number; width?: number } = {}): void {
  const dim = CAR_DIMENSIONS[kind];
  const L = opts.length ?? dim.length;
  const W = opts.width ?? dim.width;
  const H = dim.height;
  const mat = TONE[tone];
  const p = profileOf(kind, L);
  // La carrosserie, arrondie sur toutes ses arêtes.
  b.profile(mat, p, 0, W, { bevel: 0.05 });
  // Le bas de caisse sombre, entre les roues.
  b.box("paint-dark", 0.1, L - 0.1, 0.03, W - 0.03, 0.06, 0.13, false);
  // Le vitrage : dans les pentes du profil pour le pare-brise et la lunette, à plat sur les flancs
  // pour les vitres latérales.
  const along = (a: P2, c: P2, t: number): P2 => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
  const inset = 0.09;
  const shield = (a: P2, c: P2, from = 0.12, to = 0.9) => {
    const s0 = along(a, c, from);
    const s1 = along(a, c, to);
    // Un rien en dehors de la tôle, pour ne pas s'y noyer.
    const n = { x: -(c.y - a.y), y: c.x - a.x };
    const l = Math.hypot(n.x, n.y) || 1;
    const o = { x: (n.x / l) * -0.004, y: (n.y / l) * -0.004 };
    b.decal("lq-car__glass", [
      [s0.x + o.x, inset, s0.y + o.y],
      [s0.x + o.x, W - inset, s0.y + o.y],
      [s1.x + o.x, W - inset, s1.y + o.y],
      [s1.x + o.x, inset, s1.y + o.y],
    ]);
  };
  if (kind === "van") {
    shield(p[4], p[5]);
    // Deux vitres de cabine, et la porte coulissante de la caisse, tracée.
    for (const y of [-0.003, W + 0.003]) {
      b.faceY("lq-car__glass", y, L * 0.73, L * 0.78, 0.66, H - 0.12);
      b.lines("lq-truck__door", [
        [[L * 0.36, y, 0.16], [L * 0.36, y, H - 0.1]],
        [[L * 0.66, y, 0.16], [L * 0.66, y, H - 0.1]],
      ]);
    }
    b.lines("lq-truck__door", [[[-0.003, W / 2, 0.16], [-0.003, W / 2, H - 0.08]]]);
  } else {
    const shieldAt = kind === "hatch" ? 3 : 4;
    shield(p[shieldAt], p[shieldAt + 1]);
    const rear = kind === "hatch" ? [p[6], p[5]] : [p[7], p[6]];
    shield(rear[0], rear[1], 0.1, 0.85);
    const roofFront = kind === "hatch" ? p[4].x : p[5].x;
    const roofBack = kind === "hatch" ? p[5].x : p[6].x;
    for (const y of [-0.003, W + 0.003]) {
      b.decal("lq-car__glass", [
        [roofBack - 0.04, y, H - 0.04],
        [roofFront + 0.02, y, H - 0.04],
        [roofFront + 0.1, y, 0.42],
        [roofBack - 0.12, y, 0.42],
      ]);
      // Le montant entre les deux portes.
      const mid = (roofFront + roofBack) / 2;
      b.lines("lq-truck__door", [[[mid, y, 0.14], [mid, y, H - 0.02]]]);
    }
  }
  // Les phares et les feux.
  for (const [y0, y1] of [
    [0.08, 0.26],
    [W - 0.26, W - 0.08],
  ]) {
    b.faceX("lq-car__lamp", L + 0.003, y0, y1, 0.2, 0.27, true);
    b.faceX("lq-car__lamp--rear", -0.003, y0, y1, 0.22, 0.29, true);
  }
  if (opts.wheels) for (const [x, y] of carWheelSpots(kind, L, W)) b.cylinder("rubber", x, y, WHEEL_R, WHEEL_R, 0.12, "y", 16);
}

/** Où sont les quatre roues d'une voiture. */
export function carWheelSpots(kind: CarKind, L = CAR_DIMENSIONS[kind].length, W = CAR_DIMENSIONS[kind].width): [number, number][] {
  const f = L * (kind === "van" ? 0.8 : 0.78);
  const r = L * (kind === "van" ? 0.17 : 0.2);
  return [
    [f, 0.06],
    [f, W - 0.06],
    [r, 0.06],
    [r, W - 0.06],
  ];
}

export interface CarProps {
  kind?: CarKind;
  tone?: CarTone;
  /** Cap, en degrés. À 0, le nez regarde vers les `x` croissants. */
  rotation?: number;
  /** Où poser la voiture, en cases : le coin arrière gauche de son emprise, avant rotation. */
  origin?: { x: number; y: number };
  /** Vitesse au sol, en cases par seconde de simulation : les roues tournent d'autant. */
  rolling?: number;
  /** Rouler le long d'un itinéraire — une voie de `roadTrack`, par exemple : la position, le cap et
   *  la rotation des roues viennent alors de lui. */
  follow?: Follow;
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export function Car(props: CarProps) {
  const { kind = "sedan", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 40, className } = props;
  const d = CAR_DIMENSIONS[kind];
  const { bounds: own } = placed(origin, rotation, { x0: 0, x1: d.length, y0: 0, y1: d.width, z0: 0, z1: d.height });
  return (
    <Solo bounds={frame ? frameBounds(frame) : own} cellSize={cellSize} className={["lq-car", className].filter(Boolean).join(" ")} ariaLabel={kind === "van" ? "Utilitaire" : "Voiture"}>
      <CarBody {...props} />
    </Solo>
  );
}

function CarBody({ kind = "sedan", tone = "light", rotation = 0, origin = { x: 0, y: 0 }, rolling: roll = 0, follow }: CarProps) {
  const rolling = follow ? follow.speed ?? 1 : roll;
  const ride = useFollow(follow);
  const d = CAR_DIMENSIONS[kind];
  const body = useBuilt(() => {
    const b = new Builder();
    addCar(b, kind, tone);
    return b.build();
  }, [kind, tone]);
  const wheel = useBuilt(() => {
    const b = new Builder();
    b.cylinder("rubber", 0, 0, 0, WHEEL_R, 0.12, "y", 16);
    b.cylinder("chrome", 0, 0, 0, WHEEL_R * 0.55, 0.125, "y", 12);
    b.box("chrome", -WHEEL_R * 0.6, WHEEL_R * 0.6, -0.064, 0.064, -0.012, 0.012, false);
    return b.build();
  }, []);
  const spin = useRef<(Group | null)[]>([]);
  useSimFrame((t) => {
    for (const w of spin.current) if (w) w.rotation.y = -(t * rolling) / WHEEL_R;
  }, rolling !== 0);
  const pose = placeAt(origin.x, origin.y, rotation, { x: d.length / 2, y: d.width / 2 });
  const car = (
    <>
      <Parts built={body} />
      {carWheelSpots(kind).map(([x, y], i) => (
        <group key={i} position={[x, y, WHEEL_R]} ref={(el) => (spin.current[i] = el)}>
          <Parts built={wheel} />
        </group>
      ))}
    </>
  );
  if (follow)
    // Sur un itinéraire, la voiture est centrée sur la voie, le nez vers l'avant.
    return (
      <group ref={ride}>
        <group position={[-d.length / 2, -d.width / 2, 0]}>{car}</group>
      </group>
    );
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      {car}
    </group>
  );
}
