import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Builder, type Built, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimClock, useSimFrame } from "./three/time";
import { GOOD_SIZE, addGood } from "./three/goods";
import { RobotArm } from "./RobotArm";
import type { RackItemKind } from "./rackItems";

/**
 * Les cellules robotisées qui **agissent sur les produits** — là où un robot ne fait pas que
 * déplacer, mais prépare.
 *
 * - `"gantry"` : le **regroupement de commande**. Un portique cartésien au-dessus d'un tapis et
 *   d'une rangée de bacs : les articles arrivent un par un au bout du tapis, le préhenseur descend,
 *   saisit l'article, le porte au-dessus du bac de sa commande et l'y dépose. Les bacs sont la
 *   **zone tampon** : chacun accumule les articles d'une commande jusqu'à ce qu'elle soit complète ;
 *   un bac complet est fermé de son couvercle, puis vidé quand la commande suivante l'occupe.
 * - `"delta"` : le **robot delta**, trois bras parallèles suspendus dans un portique, qui prend les
 *   articles d'un tapis et les pose, alignés, sur un second tapis — le tri à la volée.
 * - `"palletizer"` : le **palettiseur**, un bras qui prend les cartons au bout du tapis et les
 *   empile en couches croisées sur une palette, jusqu'à la hauteur voulue.
 *
 * Tout est **calculé à partir du temps** de la simulation : à tout instant on sait quel article est
 * sur le tapis, lequel est dans la pince, et ce que contient chaque bac. Un arrêt sur image montre
 * exactement ce qui se passe.
 */

export type RobotCellKind = "gantry" | "delta" | "palletizer";

export interface RobotCellProps {
  kind?: RobotCellKind;
  /** Regroupement : nombre de bacs de commande (la zone tampon). */
  slots?: number;
  /** Regroupement : nombre d'articles par commande. */
  orderSize?: number;
  /** La durée d'un cycle de prise et de dépose, en secondes de simulation. */
  cycle?: number;
  running?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export const ROBOT_CELL_LABEL: Record<RobotCellKind, string> = {
  gantry: "Regroupement de commande",
  delta: "Robot delta",
  palletizer: "Palettiseur",
};

const KINDS: RackItemKind[] = ["boite", "carton", "bidon", "boite", "bouteille", "carton"];
const ease = (x: number) => x * x * (3 - 2 * x);
/** L'interpolation d'un point de passage à l'autre, sur des temps donnés. */
function track(u: number, times: number[], values: number[]) {
  let i = 0;
  while (i < times.length - 2 && u >= times[i + 1]) i += 1;
  const k = Math.max(0, Math.min(1, (u - times[i]) / Math.max(1e-6, times[i + 1] - times[i])));
  return values[i] + (values[i + 1] - values[i]) * ease(k);
}

/** L'emprise d'une cellule, avant rotation. */
export function robotCellSize(p: RobotCellProps): { length: number; width: number } {
  if (p.kind === "delta") return { length: 5, width: 2.8 };
  if (p.kind === "palletizer") return { length: 4.5, width: 3.2 };
  const slots = Math.max(2, Math.round(p.slots ?? 6));
  return { length: Math.max(5, Math.ceil(slots / 2) * 1 + 2.5), width: 3.6 };
}

/** Un modèle par sorte d'article, posé à l'origine, réemployé. */
function useGoods(scale = 0.9) {
  const models = useMemo(() => {
    const m = new Map<RackItemKind, Built>();
    for (const k of new Set(KINDS)) {
      const b = new Builder();
      const g = GOOD_SIZE[k];
      addGood(b, k, 0, 0, 0, g.half * scale, g.height * scale);
      m.set(k, b.build());
    }
    return m;
  }, [scale]);
  useEffect(
    () => () => {
      for (const bt of models.values()) for (const g of [...bt.solids.values(), ...bt.decals.values(), ...bt.strokes.values(), bt.edges]) g?.dispose();
    },
    [models]
  );
  return models;
}

/** Un article affichable dans un emplacement : une sorte par groupe, une seule visible. `hang` :
 *  l'article pend sous le point d'accroche — son dessus y touche — au lieu d'y être posé. */
function GoodSlot({ models, refFn, hang }: { models: Map<RackItemKind, Built>; refFn: (el: Group | null, kind: RackItemKind) => void; hang?: number }) {
  return (
    <>
      {[...models.entries()].map(([k, bt]) => (
        <group key={k} ref={(el) => refFn(el, k)} visible={false} position={[0, 0, hang ? -GOOD_SIZE[k].height * hang : 0]}>
          <Parts built={bt} />
        </group>
      ))}
    </>
  );
}

export function RobotCell(props: RobotCellProps) {
  const { kind = "gantry", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const { length: L, width: W } = robotCellSize(props);
  const { bounds } = placed(origin, rotation, { x0: -0.2, x1: L + 0.2, y0: -0.2, y1: W + 0.2, z0: 0, z1: 2.8 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel={ROBOT_CELL_LABEL[kind]}>
      {kind === "gantry" ? <GantryBody {...props} /> : kind === "delta" ? <DeltaBody {...props} /> : <PalletizerBody {...props} />}
    </Solo>
  );
}

// --- Le regroupement de commande ----------------------------------------------------------------

const BELT_Z = 0.55;
const TRAY_Z = 0.62;
const TOP = 2.3;

function GantryBody(props: RobotCellProps) {
  const { slots: slotsProp = 6, orderSize = 3, cycle = 3.2, running = true, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const slots = Math.max(2, Math.round(slotsProp));
  const K = Math.max(1, Math.min(4, Math.round(orderSize)));
  const { length: L, width: W } = robotCellSize(props);
  // Le tapis le long de y = 0.6 ; le point de prise au bout ; les bacs sur deux rangées.
  const beltY = 0.6;
  const pickX = L - 1.2;
  const cols = Math.ceil(slots / 2);
  const tray = (j: number) => ({ x: 0.9 + (j % cols) * 1.0 + 0.45, y: 1.9 + Math.floor(j / cols) * 0.95 + 0.4 });
  const frameBuilt = useBuilt(() => {
    const b = new Builder();
    // Le tapis d'amenée.
    b.box("steel", 0, L - 0.6, beltY - 0.4, beltY + 0.4, BELT_Z - 0.1, BELT_Z - 0.03);
    b.box("paint-dark", 0, L - 0.6, beltY - 0.32, beltY + 0.32, BELT_Z - 0.03, BELT_Z);
    for (const x of [0.2, L - 0.9]) for (const y of [beltY - 0.35, beltY + 0.29]) b.box("steel", x, x + 0.06, y, y + 0.06, 0, BELT_Z - 0.1);
    b.box("paint-dark", L - 0.65, L - 0.6, beltY - 0.4, beltY + 0.4, BELT_Z, BELT_Z + 0.15);
    const rollers: [P3, P3][] = [];
    for (let x = 0.1; x < L - 0.6; x += 0.12) rollers.push([[x, beltY - 0.32, BELT_Z + 0.002], [x, beltY + 0.32, BELT_Z + 0.002]]);
    b.lines("lq-trailer__line", rollers);
    // La table des bacs, et les bacs ouverts.
    b.box("steel", 0.8, 0.8 + cols * 1.0 + 0.1, 1.75, 1.75 + 2 * 0.95 + 0.1, TRAY_Z - 0.2, TRAY_Z - 0.16);
    for (const [x, y] of [
      [0.85, 1.8],
      [0.8 + cols + 0.02, 1.8],
      [0.85, 3.65],
      [0.8 + cols + 0.02, 3.65],
    ])
      b.box("steel", x, x + 0.06, y - 0.03, y + 0.03, 0, TRAY_Z - 0.16);
    for (let j = 0; j < slots; j += 1) {
      const { x, y } = tray(j);
      const hw = 0.4;
      const hd = 0.36;
      b.box("pod", x - hw, x + hw, y - hd, y + hd, TRAY_Z - 0.16, TRAY_Z - 0.13);
      for (const [a, c, d, e] of [
        [x - hw, x + hw, y - hd, y - hd + 0.03],
        [x - hw, x + hw, y + hd - 0.03, y + hd],
        [x - hw, x - hw + 0.03, y - hd, y + hd],
        [x + hw - 0.03, x + hw, y - hd, y + hd],
      ])
        b.box("pod", a, c, d, e, TRAY_Z - 0.13, TRAY_Z + 0.08, false);
      b.faceY("lq-pack__label", y - hd - 0.003, x - 0.15, x + 0.15, TRAY_Z - 0.1, TRAY_Z + 0.02, true);
    }
    // Le portique : quatre poteaux, deux poutres de roulement le long des x.
    for (const x of [0.1, L - 0.25]) for (const y of [0, W - 0.15]) b.box("paint-light", x, x + 0.15, y, y + 0.15, 0, TOP + 0.15);
    for (const y of [0, W - 0.15]) b.box("safety", 0.1, L - 0.1, y, y + 0.15, TOP, TOP + 0.18);
    return b.build();
  }, [L, W, slots, cols]);
  // Le pont (mobile en x), le chariot (en y), l'axe vertical et la ventouse.
  const bridgeBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("safety", -0.08, 0.08, 0.05, W - 0.05, TOP + 0.18, TOP + 0.32);
    return b.build();
  }, [W]);
  const trolleyBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("paint-dark", -0.14, 0.14, -0.14, 0.14, TOP + 0.08, TOP + 0.42);
    return b.build();
  }, []);
  const zBuilt = useBuilt(() => {
    const b = new Builder();
    // L'axe vertical, sa ventouse, dans le repère où `z = 0` est le bout de la ventouse.
    b.box("steel", -0.04, 0.04, -0.04, 0.04, 0.12, 1.9);
    b.box("paint-dark", -0.1, 0.1, -0.1, 0.1, 0.04, 0.12);
    b.cylinder("rubber", 0, 0, 0.02, 0.06, 0.04, "z", 12);
    return b.build();
  }, []);
  const models = useGoods(0.95);
  const bridge = useRef<Group>(null);
  const trolley = useRef<Group>(null);
  const zAxis = useRef<Group>(null);
  const held = useRef(new Map<RackItemKind, Group>());
  const belt = useRef<Map<RackItemKind, Group>[]>([new Map(), new Map(), new Map()]);
  const trays = useRef<Map<RackItemKind, Group>[][]>(Array.from({ length: slots }, () => Array.from({ length: K }, () => new Map())));
  const lids = useRef<(Group | null)[]>([]);
  const clock = useSimClock();
  const invalidate = useThree((s) => s.invalidate);
  const T = Math.max(1.5, cycle);
  const DROP = 0.64;
  const GRAB = 0.24;
  const kindOf = (n: number) => KINDS[((n % KINDS.length) + KINDS.length) % KINDS.length];
  const show = (m: Map<RackItemKind, Group>, kind: RackItemKind | null) => {
    for (const [k, g] of m) g.visible = k === kind;
  };
  const place = (t: number) => {
    const time = running ? t : 0;
    const n = Math.floor(time / T);
    const u = time / T - n;
    // Le trajet du préhenseur : au-dessus de la prise, descendre, saisir, remonter, aller au bac,
    // descendre, lâcher, remonter, revenir.
    const target = tray(Math.floor(n / K) % slots);
    const times = [0, 0.1, 0.2, 0.3, 0.5, 0.58, 0.68, 0.76, 1];
    const gx = track(u, times, [pickX, pickX, pickX, pickX, target.x, target.x, target.x, target.x, pickX]);
    const gy = track(u, times, [beltY, beltY, beltY, beltY, target.y, target.y, target.y, target.y, beltY]);
    const zUp = 1.25;
    const itemH = GOOD_SIZE[kindOf(n)].height * 0.95;
    const gz = track(u, times, [zUp, zUp, BELT_Z + itemH, zUp, zUp, TRAY_Z - 0.13 + itemH, zUp, zUp, zUp]);
    if (bridge.current) bridge.current.position.x = gx;
    if (trolley.current) trolley.current.position.y = gy;
    if (zAxis.current) zAxis.current.position.z = gz;
    // L'article dans la pince, de la saisie au lâcher.
    show(held.current, u >= GRAB && u < DROP ? kindOf(n) : null);
    // Les articles sur le tapis : celui du cycle, qui attend au point de prise jusqu'à la saisie, et
    // les deux suivants qui approchent.
    for (let k = 0; k < 3; k += 1) {
      const m = belt.current[k];
      const idx = n + k;
      const slot = m.values().next().value?.parent;
      if (!slot) continue;
      if (k === 0 && u >= GRAB) {
        show(m, null);
        continue;
      }
      // L'article `idx` atteint la prise au début de son cycle ; il arrive à vitesse constante.
      const arrive = idx * T;
      const x = pickX - Math.max(0, (arrive - time) / T) * 1.6;
      show(m, x > 0.1 ? kindOf(idx) : null);
      slot.position.set(x, beltY, BELT_Z);
    }
    // Les bacs : chacun montre les articles de la commande qu'il porte, fermé quand elle est
    // complète.
    const drops = n + (u >= DROP ? 1 : 0);
    const lastBlock = Math.floor((drops - 1) / K);
    for (let j = 0; j < slots; j += 1) {
      let count = 0;
      let block = -1;
      if (drops > 0) {
        block = lastBlock - (((lastBlock - j) % slots) + slots) % slots;
        if (block >= 0) count = Math.max(0, Math.min(K, drops - block * K));
      }
      for (let i = 0; i < K; i += 1) show(trays.current[j][i], i < count ? kindOf(block * K + i) : null);
      const lid = lids.current[j];
      if (lid) lid.visible = count === K;
    }
  };
  useSimFrame(place, running);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });
  const lidBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("pod", -0.42, 0.42, -0.38, 0.38, TRAY_Z + 0.08, TRAY_Z + 0.11);
    b.faceZ("lq-pack__label", TRAY_Z + 0.112, -0.15, 0.15, -0.1, 0.1, true);
    return b.build();
  }, []);
  const register = (m: Map<RackItemKind, Group>) => (el: Group | null, k: RackItemKind) => {
    if (el) m.set(k, el);
  };
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={frameBuilt} />
      <group ref={bridge}>
        <Parts built={bridgeBuilt} />
        <group ref={trolley}>
          <Parts built={trolleyBuilt} />
          <group ref={zAxis}>
            <Parts built={zBuilt} />
            <GoodSlot models={models} refFn={register(held.current)} hang={0.95} />
          </group>
        </group>
      </group>
      {belt.current.map((m, k) => (
        <group key={`b${k}`}>
          <GoodSlot models={models} refFn={register(m)} />
        </group>
      ))}
      {Array.from({ length: slots }, (_, j) => {
        const { x, y } = tray(j);
        return (
          <group key={`t${j}`} position={[x, y, 0]}>
            {Array.from({ length: K }, (_, i) => (
              <group key={i} position={[((i % 2) - 0.5) * 0.36, (Math.floor(i / 2) - 0.5) * 0.3 * (K > 2 ? 1 : 0), TRAY_Z - 0.13]}>
                <GoodSlot models={models} refFn={register(trays.current[j][i])} />
              </group>
            ))}
            <group ref={(el) => (lids.current[j] = el)} visible={false}>
              <Parts built={lidBuilt} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

// --- Le robot delta -----------------------------------------------------------------------------

function DeltaBody(props: RobotCellProps) {
  const { cycle = 1.6, running = true, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { length: L, width: W } = robotCellSize(props);
  const yA = 0.7;
  const yB = W - 0.7;
  const cx = L / 2;
  const frameBuilt = useBuilt(() => {
    const b = new Builder();
    for (const y of [yA, yB]) {
      b.box("steel", 0, L, y - 0.4, y + 0.4, BELT_Z - 0.1, BELT_Z - 0.03);
      b.box("paint-dark", 0, L, y - 0.32, y + 0.32, BELT_Z - 0.03, BELT_Z);
      for (const x of [0.2, L - 0.3]) for (const yy of [y - 0.35, y + 0.29]) b.box("steel", x, x + 0.06, yy, yy + 0.06, 0, BELT_Z - 0.1);
    }
    // Le portique qui porte le robot, et la plaque du haut où s'ancrent ses trois moteurs.
    for (const x of [cx - 1, cx + 0.85]) for (const y of [0.05, W - 0.2]) b.box("paint-light", x, x + 0.15, y, y + 0.15, 0, 2.2);
    for (const y of [0.05, W - 0.2]) b.box("paint-light", cx - 1, cx + 1, y, y + 0.15, 2.05, 2.2);
    b.box("paint-light", cx - 1, cx + 1, W / 2 - 0.3, W / 2 + 0.3, 2.05, 2.2);
    b.cylinder("paint-dark", cx, W / 2, 2.0, 0.35, 0.14, "z", 24);
    return b.build();
  }, [L, W]);
  const models = useGoods(0.9);
  const eff = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const held = useRef(new Map<RackItemKind, Group>());
  const clock = useSimClock();
  const invalidate = useThree((s) => s.invalidate);
  const armBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("iron", 0, 0.5, -0.03, 0.03, -0.03, 0.03);
    return b.build();
  }, []);
  const effBuilt = useBuilt(() => {
    const b = new Builder();
    b.cylinder("paint-dark", 0, 0, 0.03, 0.12, 0.05, "z", 16);
    b.cylinder("rubber", 0, 0, -0.01, 0.05, 0.04, "z", 10);
    return b.build();
  }, []);
  const anchors = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 0.3, y: W / 2 + Math.sin(a) * 0.3, a };
  });
  const place = (t: number) => {
    const time = running ? t : 0;
    const u = (time / Math.max(0.6, cycle)) % 1;
    const n = Math.floor(time / Math.max(0.6, cycle));
    const times = [0, 0.15, 0.3, 0.55, 0.7, 1];
    const y = track(u, times, [yA, yA, yA, yB, yB, yA]);
    const z = track(u, times, [1.1, BELT_Z + 0.2, 1.1, 1.1, BELT_Z + 0.2, 1.1]);
    const x = cx + Math.sin(u * Math.PI * 2) * 0.15;
    if (eff.current) eff.current.position.set(x, y, z);
    for (const [k, g] of held.current) g.visible = u >= 0.15 && u < 0.7 && k === KINDS[n % KINDS.length];
    // Les bras : de chaque ancrage au porte-outil, deux segments — on les oriente à chaque image.
    anchors.forEach((p, i) => {
      const g = arms.current[i];
      if (!g) return;
      const dx = x - p.x;
      const dy = y - p.y;
      const dz = z + 0.05 - 2.0;
      const len = Math.hypot(dx, dy, dz);
      g.position.set(p.x, p.y, 2.0);
      g.scale.set(len / 0.5, 1, 1);
      g.rotation.set(0, Math.atan2(-dz, Math.hypot(dx, dy)), Math.atan2(dy, dx), "ZYX");
    });
  };
  useSimFrame(place, running);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={frameBuilt} />
      {anchors.map((_, i) => (
        <group key={i} ref={(el) => (arms.current[i] = el)}>
          <Parts built={armBuilt} />
        </group>
      ))}
      <group ref={eff}>
        <Parts built={effBuilt} />
        <GoodSlot models={models} refFn={(el, k) => el && held.current.set(k, el)} hang={0.9} />
      </group>
    </group>
  );
}

// --- Le palettiseur -----------------------------------------------------------------------------

function PalletizerBody(props: RobotCellProps) {
  const { cycle = 4, running = true, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { length: L, width: W } = robotCellSize(props);
  const layers = 4;
  const perLayer = 4;
  const frameBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("steel", 0, 2, 0.3, 1.1, BELT_Z - 0.1, BELT_Z - 0.03);
    b.box("paint-dark", 0, 2, 0.38, 1.02, BELT_Z - 0.03, BELT_Z);
    for (const x of [0.2, 1.7]) for (const y of [0.35, 0.99]) b.box("steel", x, x + 0.06, y, y + 0.06, 0, BELT_Z - 0.1);
    addGood(b, "palette", L - 1.2, W - 1.1, 0, 0.55, GOOD_SIZE.palette.height * (0.55 / GOOD_SIZE.palette.half));
    // Le grillage de sécurité autour de la cellule.
    const mesh: [P3, P3][] = [];
    for (const [x0, y0, x1, y1] of [
      [0, W, L, W],
      [L, 0, L, W],
    ]) {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.1);
      for (let i = 0; i <= n; i += 1) mesh.push([[x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 0], [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1.1]]);
      b.box("safety", Math.min(x0, x1) - 0.03, Math.max(x0, x1) + 0.03, Math.min(y0, y1) - 0.03, Math.max(y0, y1) + 0.03, 1.1, 1.14, false);
    }
    b.lines("lq-fence__wire", mesh);
    return b.build();
  }, [L, W]);
  const box = useBuilt(() => {
    const b = new Builder();
    addGood(b, "carton", 0, 0, 0, 0.25, 0.22);
    return b.build();
  }, []);
  const stack = useRef<(Group | null)[]>([]);
  const clock = useSimClock();
  const invalidate = useThree((s) => s.invalidate);
  const px = L - 1.2;
  const py = W - 1.1;
  const pz = GOOD_SIZE.palette.height * (0.55 / GOOD_SIZE.palette.half);
  const cells = Array.from({ length: layers * perLayer }, (_, i) => {
    const layer = Math.floor(i / perLayer);
    const k = i % perLayer;
    // Des couches croisées : les cartons d'une couche sur deux sont tournés d'un quart.
    const dx = (k % 2 === 0 ? -1 : 1) * 0.26;
    const dy = (k < 2 ? -1 : 1) * 0.26;
    return { x: px + (layer % 2 ? dy : dx), y: py + (layer % 2 ? dx : dy), z: pz + layer * 0.22 };
  });
  const place = (t: number) => {
    const done = running ? Math.floor(t / Math.max(1, cycle)) % (cells.length + 2) : 0;
    stack.current.forEach((g, i) => {
      if (g) g.visible = i < done;
    });
  };
  useSimFrame(place, running);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={frameBuilt} />
      {cells.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} ref={(el) => (stack.current[i] = el)} visible={false}>
          <Parts built={box} />
        </group>
      ))}
      <RobotArm origin={{ x: 2.6, y: 1.6 }} rotation={180} reach={1.5} running={running} cycle={cycle} swing={100} />
    </group>
  );
}
