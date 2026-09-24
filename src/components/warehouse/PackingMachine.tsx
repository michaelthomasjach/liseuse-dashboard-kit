import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Builder, type Built, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimClock, useSimFrame } from "./three/time";
import { transformTrack } from "./three/transport";
import { addGood, GOOD_SIZE } from "./three/goods";

/**
 * La machine d'emballage : les colis y **entrent** bruts par l'entrée A, et en **sortent** par la
 * sortie B, améliorés.
 *
 * C'est le poste qui fait d'un carton un colis prêt à expédier. Un tapis d'entrée, un **carter**
 * vitré sur le flanc où l'on devine le mécanisme, un tunnel dont les deux bouches sont les seuls
 * passages, et un tapis de sortie. Sur le dessus, la bobine de consommable et le pupitre ; au coin,
 * la colonne lumineuse qui dit que la machine tourne.
 *
 * Ce que la machine apporte au colis, c'est `process` :
 * - `"wrap"`  : **filmage** — le carton sort sous un film étirable qui le couvre tout entier ;
 * - `"strap"` : **cerclage** — deux feuillards le ceinturent ;
 * - `"label"` : **étiquetage** — une grande étiquette d'expédition sur le dessus ;
 * - `"box"`   : **mise en carton** — l'article sort dans un carton d'expédition plus grand.
 *
 * Le changement se fait **dans le tunnel**, là où l'on ne voit pas : un colis ne change jamais
 * d'allure sous les yeux, il entre d'une façon et ressort de l'autre. La piste de la machine
 * (`packingMachineTrack`) se raccorde aux tapis d'un circuit comme n'importe quel module.
 *
 * Le repère : la machine court le long des `x`, de l'entrée A en `x = 0` à la sortie B en
 * `x = length`, sur `width` de large.
 */

export type PackingProcess = "wrap" | "strap" | "label" | "box";

export interface PackingMachineProps {
  process?: PackingProcess;
  /** Longueur totale, tapis compris, en cases. */
  length?: number;
  /** Largeur, en cases. */
  width?: number;
  /** La cadence, en cases par seconde de simulation. */
  speed?: number;
  /** La machine tourne. */
  running?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export const PACKING_LABEL: Record<PackingProcess, string> = {
  wrap: "Filmeuse",
  strap: "Cercleuse",
  label: "Étiqueteuse",
  box: "Mise en carton",
};

/** Le plan de pose des colis : le dessus des tapis. */
const BELT = 0.5;

function layout(p: PackingMachineProps) {
  const L = Math.max(3.5, p.length ?? 5.5);
  const W = Math.max(0.8, p.width ?? 1.2);
  const feed = Math.min(1.4, L * 0.26);
  const x0 = feed;
  const x1 = L - feed;
  return { L, W, x0, x1, mid: (x0 + x1) / 2 };
}

/** La piste d'un colis dans la machine, de A à B, en coordonnées monde. */
export function packingMachineTrack(p: PackingMachineProps): P3[] {
  const { L, W } = layout(p);
  const { pose } = placed(p.origin ?? { x: 0, y: 0 }, p.rotation ?? 0, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return transformTrack(
    [
      [0, W / 2, BELT],
      [L, W / 2, BELT],
    ],
    pose
  );
}

function buildMachine(p: PackingMachineProps) {
  const { L, W, x0, x1 } = layout(p);
  const b = new Builder();
  // Les deux tapis, A et B : un bâti, une bande, des rouleaux tracés, des pieds.
  for (const [a, c] of [
    [0, x0],
    [x1, L],
  ]) {
    b.box("steel", a, c, 0.1, W - 0.1, BELT - 0.1, BELT - 0.03);
    b.box("paint-dark", a, c, 0.18, W - 0.18, BELT - 0.03, BELT);
    for (const x of [a + 0.1, c - 0.15]) for (const y of [0.12, W - 0.2]) b.box("steel", x, x + 0.06, y, y + 0.06, 0, BELT - 0.1);
    const rollers: [P3, P3][] = [];
    for (let x = a + 0.1; x < c; x += 0.12) rollers.push([[x, 0.18, BELT + 0.002], [x, W - 0.18, BELT + 0.002]]);
    b.lines("lq-trailer__line", rollers);
    for (const y of [0.08, W - 0.12]) b.box("steel", a, c, y, y + 0.04, BELT, BELT + 0.12);
  }
  // Les plaques A et B, au bout des tapis.
  b.faceX("lq-pack__in", -0.004, W / 2 - 0.15, W / 2 + 0.15, BELT - 0.35, BELT - 0.12, true);
  b.faceX("lq-pack__out", L + 0.004, W / 2 - 0.15, W / 2 + 0.15, BELT - 0.35, BELT - 0.12, true);
  // Le carter : un volume clair, ses deux bouches de tunnel, une vitre sur le flanc.
  const H = 1.6;
  b.box("paint-light", x0, x1, 0, W, 0, H);
  b.box("paint-dark", x0 - 0.02, x1 + 0.02, -0.02, W + 0.02, 0, 0.12, false);
  for (const x of [x0 - 0.004, x1 + 0.004]) b.faceX("lq-pack__mouth", x, 0.2, W - 0.2, BELT - 0.05, BELT + 0.55, true);
  b.faceY("lq-pack__window", -0.004, x0 + 0.2, x1 - 0.2, 0.7, H - 0.2, true);
  b.faceY("lq-pack__window", W + 0.004, x0 + 0.2, x1 - 0.2, 0.7, H - 0.2, true);
  // Sur le dessus : la bobine de consommable, le pupitre, la colonne lumineuse.
  b.cylinder("paint-dark", (x0 + x1) / 2, W / 2, H + 0.18, 0.18, W * 0.6, "y", 18);
  b.cylinder("chrome", (x0 + x1) / 2, W / 2, H + 0.18, 0.06, W * 0.62, "y", 10);
  for (const y of [W * 0.18, W * 0.82]) b.box("steel", (x0 + x1) / 2 - 0.03, (x0 + x1) / 2 + 0.03, y - 0.03, y + 0.03, H, H + 0.2);
  b.box("steel", x1 - 0.1, x1 - 0.04, -0.3, -0.24, 0, 1.1);
  b.box("paint-dark", x1 - 0.3, x1 + 0.1, -0.42, -0.2, 1.1, 1.38);
  b.faceY("lq-screen__face", -0.424, x1 - 0.26, x1 + 0.06, 1.14, 1.34);
  const lx = x0 + 0.12;
  const ly = W - 0.12;
  b.cylinder("steel", lx, ly, H + 0.1, 0.02, 0.2, "z", 8);
  for (const [cls, k] of [
    ["stripe", 0],
    ["safety", 1],
    ["grass", 2],
  ] as const)
    b.cylinder(cls, lx, ly, H + 0.24 + k * 0.1, 0.045, 0.09, "z", 12);
  return b.build();
}

/** Un colis brut, et le même colis au sortir de la machine. */
function buildGood(process: PackingProcess, packed: boolean): Built {
  const b = new Builder();
  const g = GOOD_SIZE.carton;
  const half = g.half * 0.95;
  const h = g.height * 0.95;
  if (!packed) {
    addGood(b, "carton", 0, 0, 0, half, h);
    return b.build();
  }
  if (process === "box") {
    // Mis en carton : un carton d'expédition plus grand, fermé, scotché, étiqueté.
    const H2 = half * 1.3;
    addGood(b, "carton", 0, 0, 0, H2, h * 1.25);
    return b.build();
  }
  addGood(b, "carton", 0, 0, 0, half, h);
  if (process === "wrap") {
    // Le film : une peau translucide un rien plus grande que le carton, et ses plis tracés.
    const f = half + 0.008;
    b.box("film", -f, f, -f, f, -0.001, h + 0.008, false);
    b.lines("lq-pack__fold", [
      [[-f, -f - 0.001, h * 0.3], [f, -f - 0.001, h * 0.35]],
      [[-f, -f - 0.001, h * 0.7], [f, -f - 0.001, h * 0.66]],
    ]);
  } else if (process === "strap") {
    for (const x of [-half * 0.5, half * 0.5]) {
      b.box("paint-dark", x - 0.012, x + 0.012, -half - 0.004, half + 0.004, h, h + 0.006, false);
      b.box("paint-dark", x - 0.012, x + 0.012, -half - 0.006, -half - 0.002, 0, h, false);
      b.box("paint-dark", x - 0.012, x + 0.012, half + 0.002, half + 0.006, 0, h, false);
    }
  } else {
    b.faceZ("lq-pack__label", h + 0.004, -half * 0.8, half * 0.5, -half * 0.7, half * 0.7, true);
    b.lines("lq-pack__fold", [0.2, 0.35, 0.5].map((u): [P3, P3] => [[-half * 0.7, -half * 0.5 + u * half, h + 0.006], [half * 0.3, -half * 0.5 + u * half, h + 0.006]]));
  }
  return b.build();
}

export function PackingMachine(props: PackingMachineProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 34, className, process = "wrap" } = props;
  const { L, W } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: -0.1, x1: L + 0.1, y0: -0.5, y1: W + 0.1, z0: 0, z1: 2.3 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel={PACKING_LABEL[process]}>
      <PackingMachineBody {...props} />
    </Solo>
  );
}

function PackingMachineBody(props: PackingMachineProps) {
  const { process = "wrap", speed = 0.6, running = true, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { L, W, mid } = layout(props);
  const machine = useBuilt(() => buildMachine(props), [props.length, props.width]);
  const raw = useMemo(() => buildGood(process, false), [process]);
  const done = useMemo(() => buildGood(process, true), [process]);
  useEffect(
    () => () => {
      for (const bt of [raw, done]) for (const g of [...bt.solids.values(), ...bt.decals.values(), ...bt.strokes.values(), bt.edges]) g?.dispose();
    },
    [raw, done]
  );
  const pitch = 0.9;
  const slots = Math.floor(L / pitch) + 1;
  const holders = useRef<(Group | null)[]>([]);
  const before = useRef<(Group | null)[]>([]);
  const after = useRef<(Group | null)[]>([]);
  const clock = useSimClock();
  const invalidate = useThree((s) => s.invalidate);
  const place = (t: number) => {
    const base = running ? t * speed : 0;
    for (let k = 0; k < slots; k += 1) {
      const x = (((base + k * pitch) % (slots * pitch)) + slots * pitch) % (slots * pitch);
      const g = holders.current[k];
      if (!g) continue;
      g.visible = x <= L;
      g.position.set(x, W / 2, BELT);
      // Le colis change d'allure au milieu du tunnel, là où personne ne le voit.
      const inside = x >= mid;
      if (before.current[k]) before.current[k]!.visible = !inside;
      if (after.current[k]) after.current[k]!.visible = inside;
    }
  };
  useSimFrame(place, running);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={machine} />
      {Array.from({ length: slots }, (_, k) => (
        <group key={k} ref={(el) => (holders.current[k] = el)}>
          <group ref={(el) => (before.current[k] = el)}>
            <Parts built={raw} />
          </group>
          <group ref={(el) => (after.current[k] = el)} visible={false}>
            <Parts built={done} />
          </group>
        </group>
      ))}
    </group>
  );
}
