import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimClock, useSimFrame } from "./three/time";
import { addGood } from "./three/goods";
import { fitRackItem, type RackItemKind } from "./rackItems";
import { RAIL_GAUGE, RAIL_TOP, RAIL_WIDTH } from "./Rail";
import "./rackItems.css";
import "./Picker.css";

/**
 * Picker — la machine qui roule sur un rail, prend un colis dans une étagère et le dépose sur un
 * tapis. Un transstockeur, en plus petit.
 *
 * ## Les pièces, et ce que chacune fait
 *
 * Un **châssis** sur quatre roues, qui roule le long du rail : il tient entre les deux files, les
 * roues sont dessus, comme les galets d'un bogie. Deux **montants**, un à chaque bout, reliés en tête
 * par une **traverse** : un portique, et non un poteau — un seul mât ne tient pas une charge en
 * porte-à-faux. Entre les montants, le **tablier** qui monte et descend, guidé par deux **patins** ;
 * sur le tablier, deux étages **télescopiques** et les fourches, qui sortent d'un côté ou de
 * l'autre. Au pied d'un montant, l'**armoire** électrique.
 *
 * Trois mouvements sur trois axes indépendants — la travée (`x`), le niveau (`z`), l'entrée dans
 * l'alvéole (`y`) —, qui sont trois groupes emboîtés : `travel` porte `lift`, qui porte les deux
 * étages. En 3D, une fourche qui entre dans une alvéole y est vraiment : c'est le tampon de
 * profondeur qui la cache derrière les lisses, et non un masque repeint par-dessus.
 *
 * ## Le cycle
 *
 * Dix temps qui bouclent, sans retour à vide :
 *
 *   approche → arrêt → engagement → prise → dégagement →
 *   transfert → arrêt → présentation → dépose → dégagement
 *
 * La translation et la levée sont **simultanées** : deux moteurs distincts sur une vraie machine. La
 * durée d'un déplacement est donc le plus long des deux, pas leur somme. `level` est la hauteur du
 * plan des fourches quand elles s'engagent ; la machine lève ensuite de quoi décoller la charge
 * (`BITE`), et c'est ce petit mouvement qui est la prise.
 *
 * Le cycle est **calculé** : la pose de la machine est une fonction du temps de la simulation, si
 * bien qu'un arrêt sur image (`running={false}` et un `phase`) montre exactement ce qui passe. La
 * charge est à bord de la prise à la dépose — elle ne naît ni ne s'efface en l'air : elle apparaît
 * quand les fourches la soulèvent dans l'alvéole, et quitte la machine posée sur le tapis
 * (`onPick`, `onDrop`), là où le module suivant la reprend.
 *
 * ## Les vitesses
 *
 * Une seule prop, trois vitesses : un transstockeur roule vite, lève plus lentement, sort ses
 * fourches plus lentement encore. La vitesse est en **cases par seconde** de simulation.
 */

export type PickerSide = "left" | "right";

export interface PickerStop {
  /** Où, le long du rail, en cases — l'abscisse du tablier à l'arrêt. */
  at: number;
  /** De quel côté les fourches sortent, vu depuis la machine qui avance vers les `x` croissants. */
  side?: PickerSide;
  /** La hauteur du plan des fourches quand elles s'engagent, en cases : le dessous de l'alvéole, ou
   *  le brin du tapis. La machine lève ensuite de quoi décoller la charge. */
  level?: number;
  /** De combien les fourches sortent, en cases, comptées depuis l'axe du rail. Par défaut, la
   *  demi-largeur du module plus une case — de quoi entrer dans l'alvéole d'à côté. */
  reach?: number;
}

export interface PickerProps {
  /** Longueur du rail parcouru, en cases. À donner égale à celle du `Rail` sous la machine : les
   *  deux modules ont alors la même emprise, donc le même repère, et se superposent sans rien avoir
   *  à aligner. */
  travel?: number;
  /** Emprise transversale — la même que celle du rail. */
  width?: number;
  /** Écartement des roues — le même que celui du rail. */
  gauge?: number;
  /** Hauteur du plan de roulement, en cases. Par défaut celle du rail du kit : c'est la même voie,
   *  donc la même constante et non deux qui se ressemblent. */
  railTop?: number;
  /** Longueur du châssis le long du rail, en cases. Les montants sont à ses deux bouts. */
  chassisLength?: number;
  /** Hauteur du châssis, en cases. */
  chassisHeight?: number;
  /** Hauteur des montants au-dessus du châssis, en cases. */
  mastHeight?: number;
  /** Section d'un montant le long du rail, en cases. */
  mastSize?: number;
  /** Rayon d'une roue, en cases. */
  wheelRadius?: number;
  /** Où elle prend. */
  pick?: PickerStop;
  /** Où elle dépose. */
  drop?: PickerStop;
  /** Ce qu'elle transporte. `null` : la machine tourne à vide. */
  load?: RackItemKind | null;
  /** Vitesse de translation, en cases par seconde. La levée et la sortie des fourches s'en déduisent. */
  speed?: number;
  /** Temps d'arrêt à chaque poste, en secondes. */
  dwell?: number;
  /** La machine travaille. */
  running?: boolean;
  /**
   * Où en est la machine dans son cycle, en fraction de tour.
   *
   * En marche, c'est l'avance au premier rendu — deux machines sur deux rails voisins n'ont aucune
   * raison d'être au même temps de leur cycle. À l'arrêt, c'est la **pose** : la machine s'y fige,
   * au poste, au niveau et au débattement de fourches qu'elle y a. C'est aussi ce que voit un
   * lecteur qui refuse le mouvement, une capture d'écran ou une impression.
   */
  phase?: number;
  /** Obsolète : la machine porte ses ombres d'elle-même. */
  shadows?: boolean;
  /** Rotation sur le sol, en degrés — la même que celle du rail. */
  rotation?: number;
  /** Où poser le module sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou la machine seule. */
  parts?: "all" | "shadow" | "machine";
  /** Obsolète : en 3D, le tampon de profondeur cache ce qui entre dans une alvéole. Ignoré. */
  reachMask?: string;
  /** La machine prend sa charge — le numéro du cycle. De quoi, pour un jeu, vider l'alvéole. */
  onPick?: (cycle: number) => void;
  /** La machine pose sa charge — de quoi la confier au module suivant. */
  onDrop?: (cycle: number) => void;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/** Ce que le tablier lève pour décoller la charge de son appui, en cases. */
const BITE = 0.2;

/** Le jeu entre deux pièces qui glissent l'une contre l'autre, en cases. */
const PLAY = 0.03;

/** Les cotes et le cycle d'une machine, tirés de ses props. */
function pickerLayout(p: PickerProps) {
  const {
    travel = 10,
    width = RAIL_WIDTH,
    gauge = RAIL_GAUGE,
    railTop = RAIL_TOP,
    chassisLength = 1.8,
    chassisHeight = 0.26,
    mastHeight = 3.2,
    mastSize = 0.2,
    wheelRadius = 0.2,
    pick,
    drop,
    speed = 1.6,
    dwell = 0.5,
  } = p;
  const spanY = Math.max(0.6, width);
  const half = Math.max(0.5, chassisLength) / 2;
  const spanX = Math.max(half * 2, travel);
  const cy = spanY / 2;

  const wheelR = Math.max(0.06, wheelRadius);
  const wheelT = wheelR * 0.5;
  const axleZ = railTop + wheelR;
  const deckZ0 = axleZ - wheelR * 0.25;
  const deckZ1 = deckZ0 + Math.max(0.1, chassisHeight);
  const deckHalfY = Math.max(0.15, gauge / 2 - wheelT / 2 - PLAY);

  const mastX = Math.max(0.08, Math.min(mastSize, half / 3));
  const mastY = Math.min(spanY * 0.4, mastX * 1.7);
  const inset = 0.06;
  const gap = half - inset - mastX;
  const mastZ1 = deckZ1 + Math.max(0.8, mastHeight);
  const headThick = 0.16;

  const shoe = 0.1;
  const carriageHalfX = gap - PLAY;
  const carriageDepth = Math.min(spanY * 0.6, deckHalfY * 2);
  const carriageThick = 0.16;
  const midThick = 0.08;
  const midHalfX = (carriageHalfX - shoe) * 0.86;
  const tineThick = 0.07;
  const tineWide = 0.13;
  const tineGap = (carriageHalfX - shoe) * 1.1;
  const berth = Math.min(2 * (carriageHalfX - shoe) - PLAY, tineGap + spanY * 0.2);
  const stack = carriageThick + midThick + tineThick;
  const lowest = deckZ1 + PLAY + stack;

  const clampX = (v: number) => Math.max(half, Math.min(spanX - half, v));
  const stopOf = (s: PickerStop | undefined, side: PickerSide, level: number, at0: number) => ({
    x: clampX(s?.at ?? at0),
    side: s?.side ?? side,
    level: Math.min(mastZ1 - headThick - carriageThick - 0.4, Math.max(lowest, s?.level ?? level)),
    reach: Math.max(0.1, s?.reach ?? spanY / 2 + 0.9),
  });
  const P = stopOf(pick, "left", 2.2, spanX * 0.2);
  const D = stopOf(drop, "right", 1.4, spanX * 0.8);

  /** Chaque étage recouvre encore celui du dessous en bout de course, d'au moins `GRIP`. */
  const GRIP = 0.22;
  const stroke = Math.max(P.reach, D.reach);
  const stageLen = Math.max(carriageDepth, stroke / 2 + GRIP, stroke - carriageDepth + 2 * GRIP);

  const sign = (s: PickerSide) => (s === "right" ? 1 : -1);
  const vT = Math.max(0.05, speed);
  const vZ = vT / 2.4;
  const vF = vT / 4;
  const hold = Math.max(0, dwell);
  const ride = (dx: number, dz: number) => Math.max(Math.abs(dx) / vT, Math.abs(dz) / vZ, 0.001);
  const legs = [
    ride(P.x - D.x, P.level - D.level), // approche
    hold, // arrêt
    P.reach / vF, // engagement
    BITE / vZ, // prise
    P.reach / vF, // dégagement
    ride(D.x - P.x, D.level - P.level), // transfert
    hold, // arrêt
    D.reach / vF, // présentation
    BITE / vZ, // dépose
    D.reach / vF, // dégagement
  ];
  const cycle = legs.reduce((a, b) => a + b, 0) || 1;
  const states = [
    { x: D.x, z: D.level, reach: 0 },
    { x: P.x, z: P.level, reach: 0 },
    { x: P.x, z: P.level, reach: 0 },
    { x: P.x, z: P.level, reach: sign(P.side) * P.reach },
    { x: P.x, z: P.level + BITE, reach: sign(P.side) * P.reach },
    { x: P.x, z: P.level + BITE, reach: 0 },
    { x: D.x, z: D.level + BITE, reach: 0 },
    { x: D.x, z: D.level + BITE, reach: 0 },
    { x: D.x, z: D.level + BITE, reach: sign(D.side) * D.reach },
    { x: D.x, z: D.level, reach: sign(D.side) * D.reach },
    { x: D.x, z: D.level, reach: 0 },
  ];
  const times = [0];
  for (const d of legs) times.push(times[times.length - 1] + d / cycle);
  times[times.length - 1] = 1;
  /** La charge monte à bord au milieu de la prise, et en descend au milieu de la dépose. */
  const pickAt = (times[3] + times[4]) / 2;
  const dropAt = (times[8] + times[9]) / 2;

  /** La pose de la machine à une fraction du cycle. Les déplacements sont adoucis aux deux bouts :
   *  une machine qui démarre et s'arrête d'un coup se lit comme un curseur, pas comme un engin. */
  const poseAt = (t: number) => {
    const u = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < times.length - 2 && times[i + 1] <= u) i += 1;
    const a = states[i];
    const b = states[i + 1];
    const span = times[i + 1] - times[i];
    const k0 = span > 0 ? Math.min(1, Math.max(0, (u - times[i]) / span)) : 0;
    const k = k0 * k0 * (3 - 2 * k0);
    const mix = (from: number, to: number) => from + (to - from) * k;
    return { x: mix(a.x, b.x), z: mix(a.z, b.z), reach: mix(a.reach, b.reach), aboard: u >= pickAt && u < dropAt, moving: Math.abs(b.x - a.x) > 1e-3 ? (b.x - a.x) / (span * cycle) : 0 };
  };

  return {
    spanX, spanY, cy, half, wheelR, wheelT, axleZ, deckZ0, deckZ1, deckHalfY, mastX, mastY, inset, gap, mastZ1, headThick,
    shoe, carriageHalfX, carriageDepth, carriageThick, midThick, midHalfX, tineThick, tineWide, tineGap, berth, stack,
    P, D, stageLen, cycle, poseAt,
  };
}

export function Picker(props: PickerProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 34, className } = props;
  if (parts === "shadow") return null;
  const L = pickerLayout(props);
  const out = Math.max(L.P.reach, L.D.reach) + L.berth / 2;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L.spanX, y0: Math.min(0, L.cy - out), y1: Math.max(L.spanY, L.cy + out), z0: 0, z1: L.mastZ1 }, { x: L.spanX / 2, y: L.spanY / 2 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-picker", className].filter(Boolean).join(" ")} ariaLabel="Picker sur rail">
      <PickerBody {...props} />
    </Solo>
  );
}

function PickerBody(props: PickerProps) {
  const { load = "carton", running = true, phase = 0, rotation = 0, origin = { x: 0, y: 0 }, onPick, onDrop } = props;
  const L = pickerLayout(props);
  const { spanX, spanY, cy, half, wheelR, wheelT, axleZ, deckZ0, deckZ1, deckHalfY, mastX, mastY, inset, gap, mastZ1, headThick } = L;
  const { shoe, carriageHalfX, carriageDepth, carriageThick, midThick, midHalfX, tineThick, tineWide, tineGap, berth, stack, stageLen } = L;
  const key = JSON.stringify([spanX, spanY, half, wheelR, deckZ1, mastZ1, carriageDepth, stageLen, berth]);

  // Tout est construit autour de l'axe du tablier, `x = 0`, au plan des fourches `z = 0` pour ce
  // qui monte : chaque groupe n'a plus qu'à se déplacer.
  const frameBuilt = useBuilt(() => {
    const b = new Builder();
    b.prism("safety", roundedRect(-half, half, cy - deckHalfY, cy + deckHalfY, Math.min(0.12, deckHalfY * 0.5), 3), deckZ0, deckZ1);
    for (const k of [-1, 1]) {
      const x0 = k < 0 ? -half - 0.09 : half;
      b.box("safety", x0, x0 + 0.09, cy - deckHalfY * 0.45, cy + deckHalfY * 0.45, deckZ0 + 0.04, deckZ1 - 0.04);
      const m0 = k < 0 ? -half + inset : gap;
      b.box("iron", m0, m0 + mastX, cy - mastY / 2, cy + mastY / 2, deckZ1, mastZ1 - headThick);
    }
    b.box("iron", -half + inset, half - inset, cy - mastY / 2, cy + mastY / 2, mastZ1 - headThick, mastZ1);
    // Un feu à éclats sur la traverse : ce qu'on repère d'abord d'une machine qui bouge en hauteur.
    b.cylinder("safety", 0, cy, mastZ1, 0.07, 0.1, "z", 12);
    const c0 = -half + PLAY;
    const c1 = -gap - PLAY;
    if (c1 - c0 > 0.08) b.box("cabinet", c0, c1, cy + mastY / 2 + PLAY, cy + deckHalfY - PLAY, deckZ1, deckZ1 + 0.7);
    // Les flasques des roues, sur leur file.
    return b.build();
  }, [key]);
  const wheel = useBuilt(() => {
    const b = new Builder();
    b.cylinder("rubber", 0, 0, 0, wheelR, wheelT, "y", 16);
    b.cylinder("steel", 0, 0, 0, wheelR * 0.45, wheelT + 0.01, "y", 10);
    b.box("steel", -wheelR * 0.7, wheelR * 0.7, -wheelT / 2 - 0.006, wheelT / 2 + 0.006, -0.015, 0.015, false);
    return b.build();
  }, [key]);
  const carriageBuilt = useBuilt(() => {
    const b = new Builder();
    const z0 = -stack;
    const z1 = z0 + carriageThick;
    b.box("post", -carriageHalfX, carriageHalfX, cy - carriageDepth / 2, cy + carriageDepth / 2, z0, z1);
    for (const k of [-1, 1]) {
      const x0 = k < 0 ? -carriageHalfX : carriageHalfX - shoe;
      b.box("post", x0, x0 + shoe, cy - mastY * 0.62, cy + mastY * 0.62, z0, z1 + midThick + 0.3);
    }
    return b.build();
  }, [key]);
  const midBuilt = useBuilt(() => {
    const b = new Builder();
    const z0 = -stack + carriageThick;
    b.box("post", -midHalfX, midHalfX, cy - stageLen / 2, cy + stageLen / 2, z0, z0 + midThick);
    return b.build();
  }, [key]);
  const tineBuilt = useBuilt(() => {
    const b = new Builder();
    for (const k of [-1, 1]) {
      const tx = (k * tineGap) / 2;
      b.box("safety", tx - tineWide / 2, tx + tineWide / 2, cy - stageLen / 2, cy + stageLen / 2, -tineThick, 0);
    }
    return b.build();
  }, [key]);
  const loadBuilt = useBuilt(() => {
    const b = new Builder();
    if (load) {
      const fit = fitRackItem(load, { x: -berth / 2, y: cy - berth / 2, width: berth, depth: berth }, 0, Infinity);
      addGood(b, load, fit.cx, fit.cy, fit.z, fit.half, fit.height);
    }
    return b.build();
  }, [key, load]);

  const travel = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const mid = useRef<Group>(null);
  const tines = useRef<Group>(null);
  const held = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const roll = useRef({ x: 0, spin: 0, lap: null as number | null, aboard: null as boolean | null });
  const clock = useSimClock();
  const invalidate = useThree((st) => st.invalidate);

  const place = (t: number) => {
    const u = running ? t / L.cycle + phase : phase;
    const p = L.poseAt(u);
    if (travel.current) travel.current.position.x = p.x;
    if (lift.current) lift.current.position.z = p.z;
    if (mid.current) mid.current.position.y = p.reach / 2;
    if (tines.current) tines.current.position.y = p.reach / 2;
    if (held.current) held.current.visible = !!load && p.aboard;
    // Les roues tournent de ce que la machine a parcouru, et non d'un angle tiré du temps.
    const r = roll.current;
    r.spin += (p.x - r.x) / wheelR;
    r.x = p.x;
    for (const w of wheels.current) if (w) w.rotation.y = r.spin;
    // Prise et dépose : les franchissements des deux instants, d'une image à l'autre.
    const lap = Math.floor(u);
    if (running && r.aboard !== null && r.aboard !== p.aboard) {
      if (p.aboard) onPick?.(lap);
      else onDrop?.(lap);
    }
    r.aboard = p.aboard;
    r.lap = lap;
  };
  useSimFrame(place, running);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });

  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  const wheelSpots: [number, number][] = [];
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) wheelSpots.push([dx * (half - wheelR * 1.3), cy + (dy * (deckHalfY + wheelT / 2 + PLAY))]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <group ref={travel}>
        <Parts built={frameBuilt} />
        {wheelSpots.map(([x, y], i) => (
          <group key={i} position={[x, y, axleZ]} ref={(el) => (wheels.current[i] = el)}>
            <Parts built={wheel} />
          </group>
        ))}
        <group ref={lift}>
          <Parts built={carriageBuilt} />
          <group ref={mid}>
            <Parts built={midBuilt} />
            <group ref={tines}>
              <Parts built={tineBuilt} />
              <group ref={held} visible={false}>
                <Parts built={loadBuilt} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
