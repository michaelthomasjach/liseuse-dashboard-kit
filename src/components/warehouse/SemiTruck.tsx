import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Builder, annulus, placeAt, roundedRect, type P2 } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { addGood } from "./three/goods";
import type { RackItemKind } from "./rackItems";
import "./SemiTruck.css";

/**
 * Semi-remorque — un tracteur à **cabine avancée** et sa remorque fourgon, ce qui arrive à un quai.
 *
 * ## En volumes, et non plus en facettes
 *
 * Le dessin isométrique montait ce camion en prismes à contour abattu, en empilements pour le congé
 * du toit, en marches pour la pente du pare-brise, et passait plus de la moitié de son code à
 * décider **dans quel ordre** peindre les pièces — la roue avant ou le pare-chocs, le rétroviseur ou
 * la cabine — à chaque cap. En 3D, tout cela tombe. La cabine est **une silhouette de côté extrudée
 * sur sa largeur** : un seul geste donne le pare-brise incliné, le pavillon, l'arrière droit, et un
 * léger arrondi sur toutes les arêtes. Les garde-boue sont de vraies demi-couronnes. Et ce qui
 * n'était dessiné que du côté qu'on voyait — les vitres latérales, la portière, les marchepieds — est
 * posé des deux côtés : c'est la profondeur qui choisit.
 *
 * ## Les pièces
 *
 * La **remorque** : une caisse sur un longeron, un tridem à l'arrière — c'est là qu'elle porte —,
 * deux béquilles sous l'avant, des jupes latérales, une barre anti-encastrement et ses feux. Ses
 * **portes arrière s'ouvrent** (`doorsOpen`) : rabattues le long des flancs, elles découvrent la
 * charge, qui est posée dans la caisse (`load`) — c'est par là qu'un quai la décharge.
 *
 * Le **tracteur** : une cabine avancée posée sur l'essieu directeur, deux essieux derrière elle,
 * le pare-chocs au nu du nez, le bas de caisse, le réservoir, la sellette et sa gorge, le
 * pare-soleil et ses feux de gabarit, les trompes, les antennes, les rétroviseurs sur leur bras.
 *
 * Les **roues tournent** quand le camion roule (`rolling`), à la vitesse que donnerait sa vitesse
 * au sol : un pneu de 1 050 mm fait un tour tous les 3,3 m.
 */

export interface SemiTruckProps {
  /** Longueur de la remorque, en cases. Par défaut, la cote de la planche : 13 620 mm. */
  trailerLength?: number;
  /** Rotation sur le sol, en degrés. À 0, la cabine regarde vers les `x` croissants. */
  rotation?: number;
  /** Conservé pour compatibilité : les ombres viennent désormais de la lumière de la scène. */
  shadows?: boolean;
  /** Où poser le camion sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde à cadrer quand le camion est seul, en cases. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** `"shadow"` ne dessine rien : les ombres viennent de la lumière. */
  parts?: "all" | "shadow" | "machine";
  /** Quel véhicule : l'attelage complet, le tracteur seul, ou la remorque seule.
   *
   *  Un semi est **deux véhicules** — on dételle, on change de remorque, on repart — et c'est la
   *  raison d'être de la sellette. Chacun se tient debout tout seul : le tracteur sur ses deux
   *  essieux, la remorque sur son tridem et ses béquilles. */
  vehicle?: "semi" | "tractor" | "trailer";
  /** Les portes arrière ouvertes, rabattues le long des flancs. */
  doorsOpen?: boolean;
  /** Ce que la remorque contient, rangé depuis le fond de la caisse. */
  load?: RackItemKind[];
  /** Vitesse au sol, en cases par seconde de simulation : les roues tournent d'autant. */
  rolling?: number;
  /**
   * La motorisation. `"diesel"` (défaut) : un réservoir sous le châssis et une cheminée
   * d'échappement derrière la cabine. `"electric"` : pas d'échappement, des batteries à la place
   * du réservoir, un liseré vert d'eau sur la cabine et la remorque, et la trappe de recharge.
   */
  variant?: "diesel" | "electric";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/**
 * Les cotes du camion, en millimètres, relevées sur la planche.
 *
 * Elles sont ici en toutes lettres plutôt que converties, et c'est délibéré : un nombre comme
 * `1.46` ne se vérifie contre rien, alors que `2 920 mm` se lit sur le plan. Tant que les cotes
 * étaient choisies à l'œil, chaque correction en déplaçait une autre ; une fois qu'elles viennent
 * toutes de la même planche, elles sont d'équerre entre elles par construction.
 *
 * L'échelle est le seul choix libre : une case du sol vaut deux mètres, ce qui met la largeur
 * réglementaire de 2 550 mm à un peu plus d'une case et le semi complet à un peu plus de huit.
 */
const MM = 1 / 2000;

const WIDTH_MM = 2550;
/** La remorque : 13 620 de long, 4 000 de haut — **plus haute que la cabine**, ce qui est le fait
 *  que le dessin ratait le plus : à hauteur égale les deux se lisent comme un seul bloc. */
const TRAILER_LEN_MM = 13620;
const TRAILER_H_MM = 4000;
/** La cabine : 2 920 de long, 3 700 de haut. Soit 18 % de la longueur totale — c'est cette
 *  proportion qui fait un semi, et non la taille de la cabine prise isolément. */
const CAB_LEN_MM = 2920;
const CAB_H_MM = 3700;
/** Le jeu entre le dos de la cabine et le nez de la remorque.
 *
 *  Il n'est pas décoratif : c'est lui qui permet au semi de tourner. En virage serré la remorque
 *  pivote autour de la sellette et son angle avant vient balayer l'arrière de la cabine ; sans jeu,
 *  elle la touche. Aucun attelage ne se dessine collé, et collés les deux volumes se lisent comme
 *  une seule caisse coupée en deux plutôt que comme deux véhicules attelés. */
const CAB_GAP_MM = 980;
/** Porte-à-faux avant, puis empattement du tracteur : 1 400 et 3 700. C'est ce qui place l'essieu
 *  directeur *sous* la cabine et l'essieu moteur loin derrière elle. */
const FRONT_OVERHANG_MM = 1400;
const CAB_WHEELBASE_MM = 3700;
/** Porte-à-faux arrière de la remorque, et le pas du tridem.
 *
 *  Le tridem d'un semi est **très en avant du cul de la remorque** : il se place là où la charge
 *  s'équilibre entre lui et la sellette, pas au bout de la caisse. Serré contre l'arrière, la
 *  remorque prend l'air d'une benne posée sur ses roues ; reculé de ce qu'il faut, le porte-à-faux
 *  arrière devient lisible et c'est lui qui donne la longueur. */
const REAR_OVERHANG_MM = 2300;
const TRIDEM_PITCH_MM = 1310;
/** Plancher de remorque : la hauteur hors-tout moins la hauteur utile (2 720) et l'épaisseur du
 *  pavillon. */
const TRAILER_FLOOR_MM = 1180;
/** Bas de la cabine, ceinture de caisse (bas du pare-brise), et le pneu — un 315/70 R22.5 fait
 *  1 050 mm de diamètre. */
const CAB_FLOOR_MM = 1150;
const BELT_MM = 2320;
const WHEEL_R_MM = 525;
const TYRE_W_MM = 385;

const WIDTH = WIDTH_MM * MM;

/** Le tracteur et la remorque, leurs cotes dérivées : tout ce que les autres modules — un quai, un
 *  parc — ont besoin de savoir d'un camion pour s'y raccorder. */
export function semiTruckGeometry(trailerLength = TRAILER_LEN_MM * MM) {
  const T = Math.max(3, trailerLength);
  const cab0 = T + CAB_GAP_MM * MM;
  const cab1 = cab0 + CAB_LEN_MM * MM;
  const steerX = cab1 - FRONT_OVERHANG_MM * MM;
  const driveX = steerX - CAB_WHEELBASE_MM * MM;
  return {
    length: cab1,
    width: WIDTH,
    trailer: T,
    cab0,
    cab1,
    steerX,
    driveX,
    kingpin: driveX + 0.1,
    tractor0: driveX - 0.55,
    trailerFloor: TRAILER_FLOOR_MM * MM,
    trailerTop: TRAILER_H_MM * MM,
    cabTop: CAB_H_MM * MM,
  };
}

const R = WHEEL_R_MM * MM;
const TYRE = TYRE_W_MM * MM;

/** Une roue : le pneu, la jante qui déborde un peu de chaque flanc, le moyeu. Couchée sur `y`. */
function wheel(b: Builder, x: number, y: number) {
  b.cylinder("rubber", x, y, R, R, TYRE, "y", 22);
  b.cylinder("chrome", x, y, R, R * 0.55, TYRE + 0.012, "y", 16);
  b.cylinder("iron", x, y, R, R * 0.2, TYRE + 0.024, "y", 8);
}

/**
 * Le camion : **une enveloppe et un corps**.
 *
 *  L'enveloppe ne fait que cadrer — l'emprise du véhicule, tournée et posée — et ouvre une scène si
 *  le camion est seul. Le corps dessine, et il le fait **dans** la scène : c'est là que vivent la
 *  palette, l'horloge, la lumière. C'est le patron de tous les modules 3D.
 */
export function SemiTruck(props: SemiTruckProps) {
  const { trailerLength = TRAILER_LEN_MM * MM, rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", vehicle = "semi", cellSize = 30, className } = props;
  if (parts === "shadow") return null;
  const g = semiTruckGeometry(trailerLength);
  const hasTractor = vehicle !== "trailer";
  const hasTrailer = vehicle !== "tractor";
  // Le pavé à cadrer quand le camion est seul : l'emprise du véhicule dessiné, tournée et posée.
  const bx0 = hasTrailer ? 0 : g.tractor0 - 0.1;
  const bx1 = hasTractor ? g.length : g.trailer;
  const pose = placeAt(origin.x, origin.y, rotation, { x: g.length / 2, y: WIDTH / 2 });
  const e = pose.elements;
  const corners = [
    [bx0, 0],
    [bx1, 0],
    [bx1, WIDTH],
    [bx0, WIDTH],
  ].map(([x, y]) => ({ x: e[0] * x + e[4] * y + e[12], y: e[1] * x + e[5] * y + e[13] }));
  const bounds = frame
    ? frameBounds(frame)
    : {
        x0: Math.min(...corners.map((c) => c.x)),
        x1: Math.max(...corners.map((c) => c.x)),
        y0: Math.min(...corners.map((c) => c.y)),
        y1: Math.max(...corners.map((c) => c.y)),
        z0: 0,
        z1: (hasTrailer ? g.trailerTop : g.cabTop + 0.35) + 0.05,
      };
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-truck", className].filter(Boolean).join(" ")} ariaLabel="Semi-remorque">
      <SemiTruckBody {...props} />
    </Solo>
  );
}

function SemiTruckBody({
  trailerLength = TRAILER_LEN_MM * MM,
  rotation = 0,
  origin = { x: 0, y: 0 },
  vehicle = "semi",
  doorsOpen = false,
  load = [],
  rolling = 0,
  variant = "diesel",
}: SemiTruckProps) {
  const electric = variant === "electric";
  const g = semiTruckGeometry(trailerLength);
  const { trailer: T, cab0, cab1, steerX, driveX, kingpin, tractor0 } = g;
  const LENGTH = cab1;
  const hasTractor = vehicle !== "trailer";
  const hasTrailer = vehicle !== "tractor";

  const trailerZ0 = TRAILER_FLOOR_MM * MM;
  const trailerZ1 = TRAILER_H_MM * MM;
  const cabZ0 = CAB_FLOOR_MM * MM;
  const beltZ = BELT_MM * MM;
  const roofZ = CAB_H_MM * MM - 0.13;
  const deflectorZ = CAB_H_MM * MM;
  const WINDSHIELD = 0.2;
  const tridem = [0, 1, 2].map((i) => (REAR_OVERHANG_MM + i * TRIDEM_PITCH_MM) * MM);
  const sideY = [TYRE / 2 + 0.01, WIDTH - TYRE / 2 - 0.01];
  /** Le dégagement de part et d'autre de la roue directrice : le rayon extérieur du garde-boue, et
   *  un jeu — le pare-chocs ne doit jamais entrer dans son emprise. */
  const FENDER_RI = R + 0.03;
  const FENDER_RO = FENDER_RI + 0.075;
  const archGap = FENDER_RO + 0.025;

  // ---- Le corps : tout ce qui ne bouge pas, fondu en quelques maillages ----
  const built = useBuilt(() => {
    const b = new Builder();

    /** Un garde-boue : une demi-couronne à distance du pneu, épaissie sur la largeur de la roue. */
    const fender = (xc: number, yW: number) =>
      b.profile("iron", annulus(xc, R, FENDER_RI, FENDER_RO, 0, Math.PI, 12), yW - TYRE / 2 - 0.045, yW + TYRE / 2 + 0.045, { edges: true });

    if (hasTrailer) {
      // La caisse : un pavé à angles vifs — une semi-remorque *est* une boîte. Ses montants d'angle
      // et ses lisses haute et basse, en léger relief, lui donnent l'échelle.
      b.box("trailer", 0, T, 0, WIDTH, trailerZ0, trailerZ1);
      for (const y of [-0.012, WIDTH - 0.012]) {
        b.box("trailer", 0.02, T - 0.02, y, y + 0.024, trailerZ0, trailerZ0 + 0.06);
        b.box("trailer", 0.02, T - 0.02, y, y + 0.024, trailerZ1 - 0.05, trailerZ1);
      }
      // Les nervures des flancs, tous les 1,2 m : ce qui fait lire une tôle d'aluminium.
      const ribs: [[number, number, number], [number, number, number]][] = [];
      for (let x = 0.6; x < T - 0.3; x += 0.6)
        for (const y of [-0.001, WIDTH + 0.001]) ribs.push([[x, y, trailerZ0 + 0.06], [x, y, trailerZ1 - 0.05]]);
      b.lines("lq-trailer__line", ribs);
      // Le longeron, les jupes latérales entre les béquilles et le tridem.
      b.box("iron", 0, T, 0.38, WIDTH - 0.38, trailerZ0 - 0.12, trailerZ0);
      const sk0 = tridem[2] + 0.5;
      const sk1 = kingpin - 1.85;
      if (sk1 > sk0) for (const y of [0.05, WIDTH - 0.12]) b.prism("trailer", roundedRect(sk0, sk1, y, y + 0.07, 0.03), 600 * MM, trailerZ0);
      // Les béquilles, repliées, et leurs patins.
      for (const y of [0.12, WIDTH - 0.22]) {
        b.box("iron", kingpin - 1.6, kingpin - 1.5, y, y + 0.1, 0.18, trailerZ0);
        b.box("iron", kingpin - 1.64, kingpin - 1.46, y - 0.03, y + 0.13, 0.12, 0.18);
      }
      // La barre anti-encastrement et ses deux jambes, sous le cul de la caisse, et les feux.
      b.box("iron", 0.02, 0.1, 0.1, WIDTH - 0.1, 0.24, 0.32);
      for (const y of [0.4, WIDTH - 0.46]) b.box("iron", 0.06, 0.12, y, y + 0.06, 0.32, trailerZ0);
      for (const y of [0.05, WIDTH - 0.33]) b.faceX("lq-car__lamp--rear", -0.004, y, y + 0.28, trailerZ0 + 0.04, trailerZ0 + 0.14, true);
      // Le tridem : trois roues de chaque côté, sous un garde-boue chacune.
      for (const x of tridem)
        for (const y of sideY) {
          fender(x, y);
        }
    }

    if (hasTractor) {
      // Le châssis : une dalle pleine largeur, de l'arrière du tracteur jusque derrière la roue
      // directrice. Les roues motrices pendent dessous, la sellette s'y pose.
      b.box("iron", tractor0, steerX - archGap, 0.1, WIDTH - 0.1, 0.42, cabZ0);
      // La sellette, et sa gorge en fer à cheval.
      b.prism("steel", roundedRect(kingpin - 0.42, kingpin + 0.46, 0.3, WIDTH - 0.3, 0.12, 3), cabZ0, trailerZ0 - 0.005);
      b.faceZ("lq-truck__panel", trailerZ0 - 0.004, kingpin - 0.26, kingpin + 0.5, WIDTH / 2 - 0.075, WIDTH / 2 + 0.075);
      if (electric) {
        // Les batteries, de chaque côté, sous le châssis — des caissons plats, un liseré vert d'eau.
        for (const y0 of [-0.01, WIDTH - 0.19]) {
          b.box("paint-dark", driveX + 0.4, cab0 - 0.04, y0, y0 + 0.2, 0.25, 0.5);
          b.faceY("lq-truck__ev", y0 < 0.1 ? y0 - 0.002 : y0 + 0.202, driveX + 0.42, cab0 - 0.06, 0.4, 0.44);
        }
      } else {
        // Le réservoir, de chaque côté, sous le châssis, et la cheminée d'échappement dressée
        // derrière la cabine.
        for (const y0 of [-0.01, WIDTH - 0.19]) b.prism("steel", roundedRect(driveX + 0.42, cab0 - 0.06, y0, y0 + 0.2, 0.06, 3), 0.27, 0.47);
        b.cylinder("chrome", cab0 - 0.1, WIDTH - 0.16, (cabZ0 + CAB_H_MM * MM + 0.2) / 2, 0.045, CAB_H_MM * MM + 0.2 - cabZ0, "z", 12);
        b.cylinder("iron", cab0 - 0.1, WIDTH - 0.16, CAB_H_MM * MM + 0.21, 0.05, 0.03, "z", 12);
      }
      // Les feux arrière du tracteur, dans la traverse de queue.
      for (const y of [0.14, WIDTH - 0.3]) {
        b.box("cab", tractor0 - 0.03, tractor0 + 0.02, y, y + 0.16, 0.44, 0.56);
        b.faceX("lq-truck__lamp", tractor0 - 0.032, y + 0.025, y + 0.135, 0.468, 0.536);
      }
      // Le pare-chocs, au nu du nez, et ses marchepieds creusés dans les deux flancs.
      b.prism("cab", roundedRect(steerX + archGap, cab1, 0.03, WIDTH - 0.03, 0.07, 3), 0.26, cabZ0 + 0.01);
      for (const y of [0.028, WIDTH - 0.028]) {
        b.faceY("lq-truck__panel", y, cab1 - 0.31, cab1 - 0.13, 0.29, 0.36);
        b.faceY("lq-truck__panel", y, cab1 - 0.29, cab1 - 0.15, 0.45, 0.52);
      }
      // Les garde-boue du tracteur.
      for (const x of [driveX, steerX]) for (const y of sideY) fender(x, y);

      // La cabine : **sa silhouette de côté, extrudée sur sa largeur**. Plancher, nez droit
      // jusqu'à la ceinture, pare-brise incliné, pavillon, dos droit — et un arrondi léger sur
      // toutes les arêtes, qui fait lire une tôle emboutie et non une caisse.
      const cab: P2[] = [
        { x: cab0, y: cabZ0 },
        { x: cab1, y: cabZ0 },
        { x: cab1, y: beltZ },
        { x: cab1 - WINDSHIELD, y: roofZ - 0.02 },
        { x: cab1 - WINDSHIELD - 0.08, y: roofZ },
        { x: cab0, y: roofZ },
      ];
      b.profile("cab", cab, 0.02, WIDTH - 0.02, { bevel: 0.07 });
      // Le déflecteur de toit : une carène qui monte en pente douce jusqu'à la hauteur de la
      // remorque, pour que l'air passe par-dessus la caisse au lieu de la frapper.
      b.profile(
        "cab",
        [
          { x: cab0 + 0.03, y: roofZ - 0.01 },
          { x: cab1 - WINDSHIELD - 0.1, y: roofZ - 0.01 },
          { x: cab1 - WINDSHIELD - 0.42, y: deflectorZ },
          { x: cab0 + 0.03, y: deflectorZ },
        ],
        0.07,
        WIDTH - 0.07,
        { bevel: 0.05 }
      );
      // Le pare-brise, dans le plan de la pente, et ses deux montants.
      const inset = 0.16;
      b.decal("lq-truck__glass", [
        [cab1 + 0.002, inset, beltZ + 0.02],
        [cab1 + 0.002, WIDTH - inset, beltZ + 0.02],
        [cab1 - WINDSHIELD + 0.004, WIDTH - inset, roofZ - 0.05],
        [cab1 - WINDSHIELD + 0.004, inset, roofZ - 0.05],
      ], true);
      // Le nez : la calandre et ses barres, les deux feux dans le bas.
      b.faceX("lq-truck__panel", cab1 + 0.003, inset + 0.03, WIDTH - inset - 0.03, beltZ - 0.46, beltZ - 0.04, true);
      b.lines(
        "lq-truck__grille",
        [0, 1, 2].map((i) => {
          const z = beltZ - 0.38 + i * 0.11;
          return [
            [cab1 + 0.006, inset + 0.07, z],
            [cab1 + 0.006, WIDTH - inset - 0.07, z],
          ] as [[number, number, number], [number, number, number]];
        })
      );
      for (const [y0, y1] of [
        [inset, inset + 0.26],
        [WIDTH - inset - 0.26, WIDTH - inset],
      ])
        b.faceX("lq-truck__lamp", cab1 + 0.003, y0, y1, 0.34, 0.5, true);
      // Les flancs, **des deux côtés** : la vitre de coin, la vitre de portière, la portière et sa
      // poignée, le passage de roue.
      const wx = cab1 - WINDSHIELD;
      for (const y of [0.018, WIDTH - 0.018]) {
        b.faceY("lq-truck__glass", y, wx - 0.15, wx - 0.02, beltZ + 0.06, roofZ - 0.06, true);
        b.faceY("lq-truck__glass", y, wx - 0.82, wx - 0.22, beltZ + 0.1, roofZ - 0.06, true);
        b.lines("lq-truck__door", [
          [[wx - 0.9, y, cabZ0 + 0.06], [wx - 0.9, y, roofZ - 0.05]],
          [[wx - 0.18, y, cabZ0 + 0.06], [wx - 0.18, y, roofZ - 0.05]],
          [[wx - 0.86, y, beltZ - 0.06], [wx - 0.62, y, beltZ - 0.06]],
        ]);
      }
      // Le pare-soleil et ses cinq feux de gabarit.
      b.prism("cab", roundedRect(wx - 0.05, wx + 0.12, 0.04, WIDTH - 0.04, 0.05, 3), roofZ - 0.1, roofZ - 0.02);
      for (let i = 0; i < 5; i += 1) {
        const y = 0.22 + (i * (WIDTH - 0.44)) / 4;
        b.faceX("lq-truck__lamp", wx + 0.123, y, y + 0.09, roofZ - 0.085, roofZ - 0.04);
      }
      // Les trompes et les antennes, sur le déflecteur.
      for (const y of [WIDTH / 2 - 0.19, WIDTH / 2 + 0.06]) {
        b.cylinder("chrome", cab0 + 0.7, y + 0.045, deflectorZ + 0.03, 0.022, 0.42, "x", 10);
        b.cylinder("chrome", cab0 + 0.98, y + 0.045, deflectorZ + 0.045, 0.028, 0.14, "x", 12, 0.06);
      }
      for (const y of [0.13, WIDTH - 0.19]) {
        b.box("iron", cab0 + 0.115, cab0 + 0.165, y + 0.005, y + 0.055, deflectorZ, deflectorZ + 0.025);
        b.cylinder("iron", cab0 + 0.14, y + 0.03, deflectorZ + 0.18, 0.008, 0.32, "z", 6);
      }
      // Les rétroviseurs, sur leur bras, de chaque côté du pare-brise.
      for (const [y, a0, a1] of [
        [-0.07, -0.04, 0.05],
        [WIDTH - 0.01, WIDTH - 0.05, WIDTH + 0.04],
      ]) {
        b.prism("cab", roundedRect(wx - 0.13, wx - 0.09, a0, a1, 0.015, 2), roofZ - 0.3, roofZ - 0.25);
        b.prism("cab", roundedRect(wx - 0.16, wx - 0.09, y, y + 0.1, 0.025, 2), roofZ - 0.72, roofZ - 0.28);
      }
    }
    if (electric) {
      // L'électrique se reconnaît à son liseré, sur la cabine et le long de la remorque, et à la
      // trappe de recharge derrière la portière.
      if (hasTractor)
        for (const y of [0.016, WIDTH - 0.016]) {
          b.faceY("lq-truck__ev", y, cab0 + 0.06, cab1 - 0.04, cabZ0 + 0.1, cabZ0 + 0.18);
          b.faceY("lq-truck__ev-port", y, cab0 + 0.12, cab0 + 0.34, cabZ0 + 0.3, cabZ0 + 0.48, true);
        }
      if (hasTrailer) for (const y of [-0.015, WIDTH + 0.015]) b.faceY("lq-truck__ev", y, 0.35, T - 0.35, trailerZ0 + 0.3, trailerZ0 + 0.38);
    }
    return b.build();
  }, [T, hasTractor, hasTrailer, electric]);

  // ---- Les roues : un maillage à part, parce qu'elles tournent ----
  const axles = useMemo(() => [...(hasTrailer ? tridem : []), ...(hasTractor ? [driveX, steerX] : [])], [hasTrailer, hasTractor, T]); // eslint-disable-line react-hooks/exhaustive-deps
  const wheelParts = useBuilt(() => {
    const b = new Builder();
    // Chaque roue est construite autour de sa propre origine : on la fait tourner sur place.
    wheel(b, 0, 0);
    b.box("chrome", -R * 0.62, R * 0.62, -TYRE / 2 - 0.013, -TYRE / 2 - 0.012, R - 0.02, R + 0.02, false);
    b.box("chrome", -R * 0.62, R * 0.62, TYRE / 2 + 0.012, TYRE / 2 + 0.013, R - 0.02, R + 0.02, false);
    return b.build();
  }, []);
  const spinners = useRef<(Group | null)[]>([]);
  useSimFrame((t) => {
    // Un tour de roue pour 2πR de chemin : les rayons de la jante avancent au rythme du sol.
    const a = -((t * rolling) / R);
    for (const w of spinners.current) if (w) w.rotation.y = a;
  }, rolling !== 0);

  // ---- La charge et les portes ----
  const cargo = useBuilt(() => {
    const b = new Builder();
    if (hasTrailer) {
      // Les portes arrière : deux vantaux sur leurs charnières d'angle, fermés dans le plan du
      // cul de la caisse, ou rabattus à plat contre les flancs.
      const h0 = trailerZ0 + 0.02;
      const h1 = trailerZ1 - 0.02;
      const leaf = WIDTH / 2 - 0.01;
      if (doorsOpen) {
        b.box("trailer", 0, leaf, -0.05, -0.02, h0, h1);
        b.box("trailer", 0, leaf, WIDTH + 0.02, WIDTH + 0.05, h0, h1);
        // L'intérieur de la caisse, vu par l'ouverture : un plancher et un fond plus sombres.
        b.faceX("lq-truck__panel", 0.012, 0.04, WIDTH - 0.04, trailerZ0 + 0.01, trailerZ1 - 0.04);
      } else {
        b.box("trailer", -0.03, 0.005, 0.01, WIDTH / 2 - 0.005, h0, h1);
        b.box("trailer", -0.03, 0.005, WIDTH / 2 + 0.005, WIDTH - 0.01, h0, h1);
        b.lines("lq-truck__door", [
          [[-0.032, WIDTH / 2 - 0.2, (h0 + h1) / 2 - 0.3], [-0.032, WIDTH / 2 - 0.2, (h0 + h1) / 2 + 0.3]],
          [[-0.032, WIDTH / 2 + 0.2, (h0 + h1) / 2 - 0.3], [-0.032, WIDTH / 2 + 0.2, (h0 + h1) / 2 + 0.3]],
        ]);
      }
      // La charge : rangée depuis le fond de la caisse (le nez), en deux files, sur le plancher.
      const kinds = load.slice(0, 40);
      kinds.forEach((kind, i) => {
        const col = Math.floor(i / 2);
        const row = i % 2;
        const x = T - 0.35 - col * 0.62;
        if (x < 0.3) return;
        const y = row === 0 ? WIDTH * 0.28 : WIDTH * 0.72;
        const half = kind === "palette" ? 0.28 : 0.24;
        addGood(b, kind, x, y, trailerZ0, half, kind === "palette" ? 0.08 : kind === "bidon" ? 0.42 : 0.4);
      });
    }
    return b.build();
  }, [T, hasTrailer, doorsOpen, load.join(",")]);

  const pose = placeAt(origin.x, origin.y, rotation, { x: LENGTH / 2, y: WIDTH / 2 });

  return (
    <>
      <group matrixAutoUpdate={false} matrix={pose}>
        <Parts built={built} />
        <Parts built={cargo} />
        {axles.flatMap((x, i) =>
          sideY.map((y, k) => (
            <group key={`${i}-${k}`} position={[x, y, 0]}>
              <group ref={(el) => (spinners.current[i * 2 + k] = el)} position={[0, 0, R]}>
                <group position={[0, 0, -R]}>
                  <Parts built={wheelParts} />
                </group>
              </group>
            </group>
          ))
        )}
      </group>
    </>
  );
}
