import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimClock, useSimFrame } from "./three/time";
import { GOOD_SIZE, addGood } from "./three/goods";
import { fitRackItem, type RackItemKind } from "./rackItems";
import { RAIL_GAUGE, RAIL_TOP, RAIL_WIDTH } from "./Rail";
import { MONORAIL_FLANGE, MONORAIL_TOP, MONORAIL_WIDTH } from "./Monorail";
import { useFollow, type Follow } from "./three/follow";
import "./rackItems.css";
import "./Picker.css";

/**
 * Picker — la machine qui roule sur un rail, prend un colis dans une étagère et le dépose sur un
 * tapis. Un transstockeur, en plus petit.
 *
 * ## Les pièces, et ce que chacune fait
 *
 * La machine est celle des préparateurs automatisés qu'on voit contre les racks d'un centre de
 * distribution. Une **base mobile** blanche aux angles ronds, cerclée d'un bandeau lumineux, un
 * télémètre laser au coin avant et son numéro sur les flancs. À l'arrière, un **mât** : deux
 * montants sombres, un étage télescopique plus clair entre eux, une tête blanche et un feu à éclats.
 * Contre le mât, le **boîtier de commande** — l'écran de l'opérateur, le scanner au-dessus. Devant
 * le mât, le **chariot de levage** glisse de haut en bas ; il porte un **bras télescopique** à deux
 * étages, qui sort d'un côté ou de l'autre, et au bout le **bac de prélèvement**. À l'avant de la
 * base, la **plateforme de transport**, où attendent les bacs.
 *
 * Trois mouvements sur trois axes indépendants — la travée (`x`), le niveau (`z`), l'entrée dans
 * l'alvéole (`y`) —, qui sont trois groupes emboîtés : `travel` porte `lift`, qui porte les deux
 * étages du bras. En 3D, un bras qui entre dans une alvéole y est vraiment : c'est le tampon de
 * profondeur qui le cache derrière les lisses, et non un masque repeint par-dessus.
 *
 * La base roule sur deux files (`track="twin"`, le `Rail` du kit) ou de part et d'autre d'une poutre
 * unique (`track="mono"`, le `Monorail`), et peut suivre un circuit (`follow`).
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
  /**
   * La voie : `"twin"`, deux files sur lesquelles roulent les quatre roues (le `Rail` du kit) ; ou
   * `"mono"`, **une seule poutre** qui ne porte rien et guide seulement (le `Monorail`) — les quatre
   * roues roulent alors au sol, deux à gauche et deux à droite de la poutre, et des galets sous le
   * châssis pincent sa semelle haute.
   */
  track?: "twin" | "mono";
  /**
   * Rouler le long d'un circuit — les pistes de `monorailTrack` ou de `railTrack` mises bout à
   * bout — au lieu d'aller et venir sur un tronçon droit. La machine suit alors les virages ; elle
   * garde son tablier et sa charge, fourches rentrées.
   */
  follow?: Follow;
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
  const mono = p.track === "mono";
  const {
    travel = 10,
    width = mono ? MONORAIL_WIDTH : RAIL_WIDTH,
    gauge = RAIL_GAUGE,
    railTop = RAIL_TOP,
    chassisLength = 1.5,
    chassisHeight = 0.3,
    mastHeight = 3.2,
    mastSize = 0.2,
    wheelRadius = mono ? 0.13 : 0.2,
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
  // Sur deux files, les roues roulent sur le champignon, sous les jupes de la base. Sur une poutre,
  // elles roulent au sol de part et d'autre, et la base passe par-dessus la poutre, avec un jeu.
  const axleZ = mono ? wheelR : railTop + wheelR;
  const deckZ0 = mono ? MONORAIL_TOP + 0.05 : axleZ - wheelR * 0.25;
  const deckZ1 = deckZ0 + Math.max(0.1, chassisHeight);
  const deckHalfY = mono ? Math.max(0.2, Math.min(spanY / 2 - 0.04, 0.47)) : gauge / 2 + wheelT / 2 + 0.05;
  /** L'écart d'une roue à l'axe de la voie : sur sa file, ou juste à côté des plots de la poutre. */
  const wheelY = mono ? 0.13 + wheelT / 2 + 0.03 : gauge / 2;
  const floorZ = mono ? MONORAIL_TOP : railTop;

  // Le bras et son bac sont centrés sur `x = 0` : c'est ce point qui s'arrête devant l'alvéole. Le
  // mât est juste derrière, la base s'étend de part et d'autre.
  const armL = 0.46;
  const mastD = Math.max(0.1, Math.min(mastSize, 0.22));
  const mastX1 = -armL / 2 - 0.03;
  const mastX0 = mastX1 - mastD;
  const mastSpan = Math.min(deckHalfY * 2 - 0.12, 0.62);
  const upright = 0.07;
  const baseX0 = mastX0 - 0.3;
  const baseX1 = baseX0 + half * 2;
  const baseXc = (baseX0 + baseX1) / 2;
  const mastZ1 = deckZ1 + Math.max(0.8, mastHeight);
  const headThick = 0.12;

  const carriageHalfX = armL / 2 + 0.03;
  const carriageDepth = mastSpan;
  const carriageThick = 0.12;
  const midThick = 0.05;
  const midHalfX = armL / 2 - 0.03;
  const tineThick = 0.05;
  const trayW = Math.min(0.56, deckHalfY * 2 - 0.1);
  const berth = Math.min(armL - 0.08, trayW - 0.08);
  const stack = carriageThick + midThick + tineThick;
  const lowest = deckZ1 + PLAY + stack;

  const clampX = (v: number) => Math.max(-baseX0, Math.min(spanX - baseX1, v));
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
    mono, wheelY, floorZ, armL, mastX0, mastX1, mastSpan, upright, baseX0, baseX1, baseXc, trayW,
    spanX, spanY, cy, half, wheelR, wheelT, axleZ, deckZ0, deckZ1, deckHalfY, mastZ1, headThick,
    carriageHalfX, carriageDepth, carriageThick, midThick, midHalfX, tineThick, berth, stack,
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
  const { load = "carton", running = true, phase = 0, rotation = 0, origin = { x: 0, y: 0 }, onPick, onDrop, follow } = props;
  const L = pickerLayout(props);
  const { spanX, spanY, cy, half, wheelR, wheelT, axleZ, deckZ0, deckZ1, deckHalfY, mastZ1, headThick } = L;
  const { carriageHalfX, carriageDepth, carriageThick, midThick, midHalfX, tineThick, berth, stack, stageLen } = L;
  const { mono, wheelY, floorZ, armL, mastX0, mastX1, mastSpan, upright, baseX0, baseX1, baseXc, trayW } = L;
  const key = JSON.stringify([mono, spanX, spanY, half, wheelR, deckZ1, deckHalfY, mastZ1, carriageDepth, stageLen, berth]);

  // Tout est construit autour de l'axe du tablier, `x = 0`, au plan des fourches `z = 0` pour ce
  // qui monte : chaque groupe n'a plus qu'à se déplacer.
  const frameBuilt = useBuilt(() => {
    const b = new Builder();
    const r = Math.min(0.12, deckHalfY * 0.4);
    const body = (grow: number) => roundedRect(baseX0 - grow, baseX1 + grow, cy - deckHalfY - grow, cy + deckHalfY + grow, r + grow, 3);
    // La base mobile : une caisse blanche aux angles ronds sur une jupe sombre, cerclée d'un bandeau
    // lumineux — ce qu'on lit d'abord d'un robot, et ce qui dit son état.
    b.prism("paint-dark", body(-0.03), deckZ0, deckZ0 + 0.07);
    b.prism("paint-light", body(0), deckZ0 + 0.07, deckZ1);
    b.prism("robot-led", body(0.006), deckZ1 - 0.07, deckZ1 - 0.045, false);
    // Le télémètre laser au coin avant, et le numéro de la machine sur ses deux flancs.
    b.cylinder("paint-dark", baseX1 - 0.12, cy + deckHalfY - 0.12, deckZ1 + 0.025, 0.055, 0.05, "z", 14);
    for (const side of [-1, 1]) {
      const y = cy + side * (deckHalfY + 0.004);
      b.faceY("lq-picker__plate", y, baseX1 - 0.34, baseX1 - 0.14, deckZ0 + 0.12, deckZ1 - 0.1, true);
    }
    // Le mât : deux montants sombres, l'étage télescopique plus clair entre eux, une traverse en tête
    // et une en pied.
    const uy = mastSpan / 2 - upright / 2;
    for (const side of [-1, 1]) {
      const y = cy + side * uy;
      b.box("iron", mastX0, mastX1, y - upright / 2, y + upright / 2, deckZ1, mastZ1);
      const iy = cy + side * (uy - upright / 2 - 0.035);
      b.box("steel", mastX0 + 0.03, mastX1 - 0.03, iy - 0.025, iy + 0.025, deckZ1, mastZ1 - headThick);
    }
    b.box("paint-light", mastX0 - 0.02, mastX1 + 0.02, cy - mastSpan / 2 - 0.02, cy + mastSpan / 2 + 0.02, mastZ1 - headThick, mastZ1);
    b.box("iron", mastX0, mastX1, cy - mastSpan / 2, cy + mastSpan / 2, deckZ1, deckZ1 + 0.08, false);
    // Un feu à éclats sur la tête du mât : ce qu'on repère d'abord d'une machine qui bouge en hauteur.
    b.cylinder("safety", (mastX0 + mastX1) / 2, cy, mastZ1 + 0.04, 0.045, 0.08, "z", 12);
    // Le boîtier de commande, contre le mât : l'écran de l'opérateur, le scanner au-dessus.
    const hx0 = baseX0 + 0.06;
    const hx1 = mastX0 - 0.02;
    if (hx1 - hx0 > 0.08) {
      const hz0 = deckZ1;
      const hz1 = deckZ1 + 0.95;
      b.box("paint-light", hx0, hx1, cy - 0.2, cy + 0.2, hz0, hz1);
      b.faceX("lq-screen__face", hx0 - 0.004, cy - 0.13, cy + 0.13, hz1 - 0.42, hz1 - 0.12, true);
      b.box("paint-dark", hx0 + 0.02, hx1 - 0.02, cy - 0.08, cy + 0.08, hz1, hz1 + 0.07);
    }
    // La plateforme de transport, à l'avant : un plateau à rebord, et deux bacs qui attendent.
    const px0 = carriageHalfX + 0.05;
    const px1 = baseX1 - 0.05;
    if (px1 - px0 > 0.2) {
      const w = Math.min(deckHalfY - 0.06, 0.34);
      b.box("steel", px0, px1, cy - w, cy + w, deckZ1, deckZ1 + 0.025);
      b.box("steel", px0, px1, cy - w, cy - w + 0.02, deckZ1 + 0.025, deckZ1 + 0.07, false);
      b.box("steel", px0, px1, cy + w - 0.02, cy + w, deckZ1 + 0.025, deckZ1 + 0.07, false);
      const g = GOOD_SIZE.boite;
      const k = Math.min((px1 - px0) / 2 - 0.03, w - 0.04) / g.half;
      addGood(b, "boite", (px0 + px1) / 2, cy - w / 2, deckZ1 + 0.025, g.half * k * 0.9, g.height * k * 0.9);
      addGood(b, "carton", (px0 + px1) / 2, cy + w / 2, deckZ1 + 0.025, g.half * k * 0.9, g.height * k * 0.9);
    }
    if (mono) {
      // Sur une poutre : les chapes qui descendent de la base jusqu'aux roues, et les galets de
      // guidage qui pincent la semelle haute — deux à l'avant, deux à l'arrière.
      for (const dx of [-1, 1]) {
        const x = baseXc + dx * (half - wheelR * 1.3);
        for (const dy of [-1, 1]) {
          const y = cy + dy * (wheelY + wheelT / 2 + 0.02);
          b.box("iron", x - 0.03, x + 0.03, y - 0.015, y + 0.015, axleZ, deckZ0);
        }
        const gx = baseXc + dx * (half - 0.32);
        for (const dy of [-1, 1]) {
          const gy = cy + dy * (MONORAIL_FLANGE / 2 + 0.036);
          b.box("iron", gx - 0.04, gx + 0.04, gy - 0.012 + dy * 0.02, gy + 0.012 + dy * 0.02, MONORAIL_TOP - 0.02, deckZ0);
          b.cylinder("rubber", gx, gy, MONORAIL_TOP - 0.035, 0.034, 0.05, "z", 12);
        }
      }
    }
    return b.build();
  }, [key]);
  const wheel = useBuilt(() => {
    const b = new Builder();
    b.cylinder("rubber", 0, 0, 0, wheelR, wheelT, "y", 16);
    b.cylinder("steel", 0, 0, 0, wheelR * 0.45, wheelT + 0.01, "y", 10);
    b.box("steel", -wheelR * 0.7, wheelR * 0.7, -wheelT / 2 - 0.006, wheelT / 2 + 0.006, -0.015, 0.015, false);
    return b.build();
  }, [key]);
  // Le chariot de levage : une plaque qui glisse devant le mât, et le plateau d'où part le bras.
  const carriageBuilt = useBuilt(() => {
    const b = new Builder();
    const z0 = -stack;
    const z1 = z0 + carriageThick;
    b.box("paint-dark", mastX1, mastX1 + 0.05, cy - carriageDepth / 2, cy + carriageDepth / 2, z0, z1 + 0.42);
    b.box("paint-light", mastX1, carriageHalfX, cy - carriageDepth / 2, cy + carriageDepth / 2, z0, z1);
    // Le capteur de présence, sur la plaque : une lucarne sombre.
    b.faceX("lq-screen__face", mastX1 + 0.054, cy - 0.08, cy + 0.08, z1 + 0.22, z1 + 0.34);
    return b.build();
  }, [key]);
  // Le bras télescopique : un premier étage, qui sort à mi-course.
  const midBuilt = useBuilt(() => {
    const b = new Builder();
    const z0 = -stack + carriageThick;
    b.box("steel", -midHalfX, midHalfX, cy - stageLen / 2, cy + stageLen / 2, z0, z0 + midThick);
    return b.build();
  }, [key]);
  // Le second étage, et le bac de prélèvement qu'il porte : un fond, quatre rebords bas.
  const tineBuilt = useBuilt(() => {
    const b = new Builder();
    b.box("iron", -midHalfX + 0.04, midHalfX - 0.04, cy - stageLen / 2, cy + stageLen / 2, -tineThick, -tineThick + 0.02);
    const x0 = -armL / 2;
    const x1 = armL / 2;
    const y0 = cy - trayW / 2;
    const y1 = cy + trayW / 2;
    const rim = 0.07;
    const t = 0.018;
    b.box("paint-light", x0, x1, y0, y1, -tineThick + 0.02, 0);
    b.box("paint-light", x0, x0 + t, y0, y1, 0, rim, false);
    b.box("paint-light", x1 - t, x1, y0, y1, 0, rim, false);
    b.box("paint-light", x0, x1, y0, y0 + t, 0, rim * 0.5, false);
    b.box("paint-light", x0, x1, y1 - t, y1, 0, rim * 0.5, false);
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

  const ride = useFollow(follow);
  const place = (t: number) => {
    const u = running ? t / L.cycle + phase : phase;
    const p = L.poseAt(u);
    // Sur un circuit, c'est l'itinéraire qui la déplace : fourches rentrées, pas de va-et-vient.
    const reach = follow ? 0 : p.reach;
    if (travel.current) travel.current.position.x = follow ? 0 : p.x;
    if (lift.current) lift.current.position.z = p.z;
    if (mid.current) mid.current.position.y = reach / 2;
    if (tines.current) tines.current.position.y = reach / 2;
    if (held.current) held.current.visible = !!load && (follow ? true : p.aboard);
    // Les roues tournent de ce que la machine a parcouru, et non d'un angle tiré du temps.
    const r = roll.current;
    const run = follow ? t * (follow.speed ?? 1) : p.x;
    r.spin += (run - r.x) / wheelR;
    r.x = run;
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
  useSimFrame(place, running || !!follow);
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });

  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  const wheelSpots: [number, number][] = [];
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) wheelSpots.push([baseXc + dx * (half - wheelR * 1.3), cy + dy * wheelY]);
  const machine = (
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
  );
  if (follow)
    // L'itinéraire passe sur le dessus de la voie ; la machine, elle, a son sol à `z = 0` et son axe
    // en `y = cy` : on la recale sous lui.
    return (
      <group ref={ride}>
        <group position={[0, -cy, -floorZ]}>{machine}</group>
      </group>
    );
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      {machine}
    </group>
  );
}
