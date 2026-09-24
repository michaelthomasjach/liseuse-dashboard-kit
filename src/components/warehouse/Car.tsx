import { useRef } from "react";
import type { Group } from "three";
import { Builder, placeAt, type P2, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { useFollow, type Follow } from "./three/follow";

/**
 * Une voiture — de tourisme ou de livraison — pour le parking, les rues et la cour d'un site.
 *
 * ## Ce qui fait une voiture
 *
 * Deux volumes, et non un : la **caisse**, jusqu'à la ligne de ceinture, dans la teinte de la
 * carrosserie ; et le **pavillon vitré** au-dessus, sombre comme un vitrage vu de jour, que tiennent
 * des montants et que coiffe le toit. C'est cette séparation — la bande sombre des vitres tout
 * autour — qui fait lire une voiture et non un galet. Puis les détails qui la rendent crédible :
 * les **passages de roue**, les pare-chocs, la calandre, les phares et les feux, les rétroviseurs,
 * les plaques, les joints des portières, et des roues à jante claire.
 *
 * Cinq gabarits, ceux qu'on croise autour d'un entrepôt :
 * - `"sedan"`  : la berline, 4,5 m, trois volumes ;
 * - `"hatch"`  : la citadine, 3,9 m, un hayon droit ;
 * - `"suv"`    : le SUV, 4,7 m, haut sur roues ;
 * - `"pickup"` : le pick-up, 5,2 m, une benne ouverte ;
 * - `"van"`    : l'utilitaire du dernier kilomètre, 5,4 m, un grand volume de caisse.
 *
 * Les cotes sont en cases (une case vaut deux mètres), la voiture allongée sur les `x`, le nez vers
 * les `x` croissants.
 */

export type CarKind = "sedan" | "hatch" | "suv" | "pickup" | "van";
/** La teinte d'une carrosserie, dans la palette du kit. */
export type CarTone = "light" | "dark" | "warm" | "cool" | "accent";

export const CAR_KINDS: CarKind[] = ["sedan", "hatch", "suv", "pickup", "van"];

export const CAR_DIMENSIONS: Record<CarKind, { length: number; width: number; height: number }> = {
  sedan: { length: 2.25, width: 0.9, height: 0.73 },
  hatch: { length: 1.95, width: 0.87, height: 0.76 },
  suv: { length: 2.35, width: 0.95, height: 0.86 },
  pickup: { length: 2.6, width: 0.98, height: 0.9 },
  van: { length: 2.7, width: 1.0, height: 1.25 },
};

/**
 * La silhouette d'un gabarit, en fractions de sa longueur pour les `x` et en cases pour les `z` :
 * la ligne de ceinture, le capot, la base du pare-brise, l'avant et l'arrière du toit, la base de
 * la lunette, le dessus du coffre, le rayon des roues.
 */
const SHAPE: Record<CarKind, { belt: number; hood: number; ws: number; roofF: number; roofB: number; rw: number; deck: number; wheel: number }> = {
  sedan: { belt: 0.47, hood: 0.43, ws: 0.65, roofF: 0.53, roofB: 0.28, rw: 0.18, deck: 0.46, wheel: 0.165 },
  hatch: { belt: 0.47, hood: 0.42, ws: 0.67, roofF: 0.54, roofB: 0.08, rw: 0.03, deck: 0.47, wheel: 0.16 },
  suv: { belt: 0.55, hood: 0.53, ws: 0.69, roofF: 0.58, roofB: 0.07, rw: 0.03, deck: 0.55, wheel: 0.19 },
  pickup: { belt: 0.56, hood: 0.55, ws: 0.75, roofF: 0.65, roofB: 0.42, rw: 0.38, deck: 0.56, wheel: 0.19 },
  van: { belt: 0.6, hood: 0.55, ws: 0.87, roofF: 0.81, roofB: 0.66, rw: 0.66, deck: 0.6, wheel: 0.18 },
};

const TONE: Record<CarTone, string> = {
  light: "paint-light",
  dark: "paint-dark",
  warm: "paint-warm",
  cool: "paint-cool",
  accent: "paint",
};

/** Le rayon des roues d'un gabarit. */
export const carWheelRadius = (kind: CarKind) => SHAPE[kind].wheel;

/**
 * Poser une voiture dans un constructeur, allongée sur les `x`, son arrière en `x = 0`.
 *
 *  La carrosserie seulement : les roues sont posées à part, pour pouvoir tourner — voir `Car`. Un
 *  parc de voitures immobiles les construit dans le même geste (`wheels: true`).
 */
export function addCar(b: Builder, kind: CarKind, tone: CarTone, opts: { wheels?: boolean; length?: number; width?: number } = {}): void {
  const dim = CAR_DIMENSIONS[kind];
  const L = opts.length ?? dim.length;
  const W = opts.width ?? dim.width;
  const H = dim.height;
  const s = SHAPE[kind];
  const paint = TONE[tone];
  const X = (u: number) => u * L;
  const sill = 0.13;
  const wsX = X(s.ws);
  const roofF = X(s.roofF);
  const roofB = X(s.roofB);
  const rwX = X(s.rw);

  // --- La caisse, jusqu'à la ligne de ceinture ---------------------------------------------------
  let lower: P2[];
  if (kind === "van") {
    // L'utilitaire : la caisse de chargement monte jusqu'au toit, derrière la cabine.
    lower = [
      { x: 0, y: sill },
      { x: L, y: sill },
      { x: L, y: s.hood - 0.08 },
      { x: L - 0.08, y: s.hood },
      { x: wsX, y: s.belt },
      { x: roofB, y: s.belt },
      { x: roofB, y: H },
      { x: 0.02, y: H },
      { x: 0, y: H - 0.03 },
    ];
  } else {
    lower = [
      { x: 0, y: sill },
      { x: L, y: sill },
      { x: L, y: s.hood - 0.09 },
      { x: L - 0.1, y: s.hood },
      { x: wsX, y: s.belt },
      { x: rwX, y: s.belt },
      { x: 0.06, y: s.deck },
      { x: 0, y: s.deck - 0.08 },
    ];
  }
  b.profile(paint, lower, 0, W, { bevel: 0.035 });

  // --- Le pavillon vitré, ses montants, son toit -------------------------------------------------
  const inset = 0.05;
  const gy0 = inset;
  const gy1 = W - inset;
  if (kind === "van") {
    b.profile("window", [
      { x: roofB, y: s.belt },
      { x: wsX, y: s.belt },
      { x: roofF, y: H - 0.02 },
      { x: roofB, y: H - 0.02 },
    ], gy0, gy1);
  } else {
    b.profile("window", [
      { x: rwX, y: s.belt },
      { x: wsX, y: s.belt },
      { x: roofF, y: H - 0.02 },
      { x: roofB, y: H - 0.02 },
    ], gy0, gy1);
    // Les montants : le pare-brise, la lunette, et le milieu des portières.
    for (const y of [gy0 - 0.004, gy1 - 0.02]) {
      b.beam(paint, [wsX, y + 0.012, s.belt], [roofF, y + 0.012, H - 0.02], 0.014, false);
      b.beam(paint, [rwX, y + 0.012, s.belt], [roofB, y + 0.012, H - 0.02], 0.016, false);
      const mid = (roofF + roofB) / 2;
      b.box(paint, mid - 0.025, mid + 0.025, y, y + 0.024, s.belt, H - 0.02, false);
    }
  }
  // Le toit, un rien plus étroit que la caisse.
  const r0 = kind === "van" ? 0.02 : roofB;
  b.box(paint, r0, roofF, gy0 - 0.01, gy1 + 0.01, H - 0.025, H, true);
  if (kind === "suv" || kind === "van") for (const y of [gy0 + 0.05, gy1 - 0.07]) b.box("chrome", r0 + 0.1, roofF - 0.06, y, y + 0.02, H, H + 0.03, false);

  // --- La benne du pick-up -----------------------------------------------------------------------
  if (kind === "pickup") {
    b.faceZ("lq-car__bed", s.belt + 0.002, 0.04, rwX - 0.02, 0.05, W - 0.05);
    b.box(paint, rwX - 0.03, rwX, 0.02, W - 0.02, s.belt, s.belt + 0.14);
    for (const y of [0.02, W - 0.05]) b.box(paint, 0.02, rwX, y, y + 0.03, s.belt, s.belt + 0.1, false);
    b.box(paint, 0, 0.04, 0.02, W - 0.02, s.belt - 0.02, s.belt + 0.1, false);
  }

  // --- Pare-chocs, calandre, phares, feux, plaques -----------------------------------------------
  b.box("paint-dark", L - 0.05, L + 0.02, 0.03, W - 0.03, sill - 0.02, sill + 0.08, false);
  b.box("paint-dark", -0.02, 0.05, 0.03, W - 0.03, sill - 0.02, sill + 0.08, false);
  b.faceX("lq-car__grille", L + 0.004, W * 0.3, W * 0.7, s.hood - 0.2, s.hood - 0.1);
  for (const [y0, y1] of [
    [0.06, 0.24],
    [W - 0.24, W - 0.06],
  ]) {
    b.faceX("lq-car__lamp", L + 0.005, y0, y1, s.hood - 0.13, s.hood - 0.06, true);
    b.faceX("lq-car__lamp--rear", -0.005, y0, y1, (kind === "van" ? 0.5 : s.deck) - 0.14, (kind === "van" ? 0.5 : s.deck) - 0.07, true);
  }
  b.faceX("lq-car__plate", L + 0.025, W / 2 - 0.1, W / 2 + 0.1, sill + 0.01, sill + 0.06, true);
  b.faceX("lq-car__plate", -0.025, W / 2 - 0.1, W / 2 + 0.1, sill + 0.1, sill + 0.15, true);

  // --- Rétroviseurs ---------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const y = side < 0 ? -0.06 : W;
    b.box("paint-dark", wsX - 0.06, wsX, y, y + 0.06, s.belt + 0.02, s.belt + 0.07, false);
  }

  // --- Passages de roue, joints de portières -----------------------------------------------------
  const spots = carWheelSpots(kind, L, W);
  const R = s.wheel + 0.025;
  for (const y of [-0.004, W + 0.004]) {
    for (const x of [spots[0][0], spots[2][0]]) {
      // Le passage de roue : un demi-disque sombre au-dessus de l'axe, qui descend jusqu'au bas de
      // caisse — la roue, qui affleure le flanc, vient se poser devant.
      const arch: P3[] = [[x + R, y, sill - 0.03]];
      for (let i = 0; i <= 12; i += 1) {
        const a = (Math.PI * i) / 12;
        arch.push([x + Math.cos(a) * R, y, s.wheel + Math.sin(a) * R]);
      }
      arch.push([x - R, y, sill - 0.03]);
      b.decal("lq-car__arch", arch);
    }
    const doors = kind === "van" ? [wsX - 0.02, L * 0.62, L * 0.3] : [wsX - 0.02, (roofF + roofB) / 2, rwX + 0.03];
    b.lines("lq-truck__door", doors.map((x): [P3, P3] => [[x, y, sill + 0.03], [x, y, s.belt - 0.01]]));
  }
  if (opts.wheels) for (const [x, y] of spots) addCarWheel(b, x, y, s.wheel);
}

/** Une roue : le pneu, la jante claire, son moyeu. Centrée en `(x, y, r)`. */
function addCarWheel(b: Builder, x: number, y: number, r: number) {
  b.cylinder("rubber", x, y, r, r, 0.11, "y", 18);
  b.cylinder("chrome", x, y, r, r * 0.62, 0.115, "y", 14);
  b.cylinder("paint-dark", x, y, r, r * 0.2, 0.12, "y", 8);
}

/** Où sont les quatre roues d'une voiture. */
export function carWheelSpots(kind: CarKind, L = CAR_DIMENSIONS[kind].length, W = CAR_DIMENSIONS[kind].width): [number, number][] {
  const front = L * (kind === "van" ? 0.82 : kind === "pickup" ? 0.8 : 0.79);
  const rear = L * (kind === "van" ? 0.17 : kind === "pickup" ? 0.2 : 0.21);
  // Les roues affleurent le flanc, un rien en dehors : c'est ainsi qu'on les voit entières.
  return [
    [front, 0.045],
    [front, W - 0.045],
    [rear, 0.045],
    [rear, W - 0.045],
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
  const R = SHAPE[kind].wheel;
  const body = useBuilt(() => {
    const b = new Builder();
    addCar(b, kind, tone);
    return b.build();
  }, [kind, tone]);
  const wheel = useBuilt(() => {
    const b = new Builder();
    addCarWheel(b, 0, 0, 0);
    // Un rayon de jante, pour qu'on voie la roue tourner.
    b.box("paint-dark", -R * 0.55, R * 0.55, -0.06, 0.06, -0.01, 0.01, false);
    return b.build();
  }, [R]);
  const spin = useRef<(Group | null)[]>([]);
  useSimFrame((t) => {
    for (const w of spin.current) if (w) w.rotation.y = -(t * rolling) / R;
  }, rolling !== 0);
  const pose = placeAt(origin.x, origin.y, rotation, { x: d.length / 2, y: d.width / 2 });
  const car = (
    <>
      <Parts built={body} />
      {carWheelSpots(kind).map(([x, y], i) => (
        <group key={i} position={[x, y, R]} ref={(el) => (spin.current[i] = el)}>
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
