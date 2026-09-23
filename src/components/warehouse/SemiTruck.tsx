import type { ReactNode } from "react";
import {
  frameCorners,
  boxFaces,
  filletLayers,
  prismVolume,
  roundedRing,
  stackedVolume,
  convexHull,
  isoWheel,
  solidVolume,
  type Point,
  type Project,
  type VolumeLayer,
} from "./rackItems";
import { IsoCanvas } from "./isoCanvas";
import { useIsoCamera } from "./isoCamera";
import "./SemiTruck.css";

/**
 * Semi-remorque — un tracteur à **cabine avancée** et sa remorque fourgon, ce qui arrive à un quai.
 *
 * Même vocabulaire que le reste de l'entrepôt (`rackItems.tsx`) : trois faces, trois clartés d'une
 * seule lumière, faces visibles choisies d'après la rotation, et les mêmes roues rondes
 * (`isoWheel`). À une chose près, et c'est ce qui fait ce camion : ses volumes ne sont pas des
 * boîtes.
 *
 * ## Pourquoi il n'est pas fait de boîtes
 *
 * Une boîte se lit comme une boîte, et un camion fait de boîtes se lit comme un tas de boîtes. Ici,
 * les volumes sont des **prismes à contour abattu** (`prismVolume`, `roundedRing`) : seize facettes
 * au lieu de quatre, dessinées sans trait entre elles et cernées d'une seule silhouette — bordée
 * chacune, la suite de facettes d'un angle se lirait comme une hachure sombre, l'exact contraire
 * d'un arrondi. Le haut de la cabine, lui, est un **congé** (`stackedVolume`, `filletLayers`) :
 * quatre couches minces dont le retrait suit un quart de cercle, et qui ne font ensemble qu'un seul
 * volume, avec une seule silhouette et un seul dessus. En volumes séparés, chaque couche cernerait
 * son contour et le toit rond reviendrait en anneaux concentriques.
 *
 * ## Les pièces
 *
 * La **remorque** : une caisse sur un longeron, trois essieux groupés à l'arrière — c'est là qu'elle
 * porte, l'avant reposant sur le tracteur — et deux **béquilles** repliées sous l'avant, qui la
 * tiennent quand on la dételle au quai. Ses **portes** sont à l'arrière, deux vantaux, parce que
 * c'est par là qu'on la charge. Son toit est abattu sur tout le tour : une caisse d'un seul volume
 * est un pavé.
 *
 * Le tracteur est une **cabine avancée** : pas de capot, la cabine est posée sur l'essieu directeur
 * et les deux essieux moteurs sont derrière elle. Elle est **courte et basse** — bien plus basse que
 * le toit de la remorque — et c'est ce qui se voit en premier sur un semi : une petite cabine ronde
 * devant une grande caisse droite. À hauteur égale, les deux se lisent comme un seul bloc et le
 * camion perd sa silhouette. Avec elle : le pare-brise, les vitres et la portière, les rétroviseurs
 * sur leur bras, le pare-chocs, le bas de caisse, et les réservoirs sous les portières.
 *
 * ## L'ordre de peinture
 *
 * Tout ce qui est **sous la caisse** — roues, longerons, béquilles, réservoirs — passe avant elle :
 * la caisse est au-dessus et ne peut rien recouvrir d'autre. Là-dedans, la file de roues du fond
 * passe avant les longerons, et celle de devant après ; c'est `yFace` qui dit laquelle est laquelle.
 * Au-dessus, le camion se range ensuite **le long de sa longueur** en tranches qui ne se chevauchent
 * pas — remorque, bas de caisse, cabine, rétroviseurs, pare-chocs — dans l'ordre où la caméra les
 * voit, ce que `xFace` dit. Lu sur les axes du camion plutôt que sur des emprises au sol, cet ordre
 * tient à tout cap. Dans un prisme, c'est la **normale** de chaque facette qui décide, et le même
 * raisonnement s'applique à l'échelle de la facette.
 */

export interface SemiTruckProps {
  /** Longueur de la remorque, en cases. Par défaut, la cote de la planche : 13 620 mm. */
  trailerLength?: number;
  /** Rotation sur le sol, en degrés. À 0, la cabine regarde vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le camion sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le camion seul. */
  parts?: "all" | "shadow" | "machine";
  /** Quel véhicule : l'attelage complet, le tracteur seul, ou la remorque seule.
   *
   *  Un semi est **deux véhicules** — on dételle, on change de remorque, on repart — et c'est la
   *  raison d'être de la sellette. Les dessiner séparément n'est donc pas un cadrage de la même
   *  image : chacun se tient debout tout seul, le tracteur sur ses deux essieux, la remorque sur son
   *  tridem et ses béquilles, et c'est ce qui se voit ici. */
  vehicle?: "semi" | "tractor" | "trailer";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

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
/**
 * Le congé du toit de la cabine : son rayon, et en combien de couches on le monte.
 *
 * **Une seule couche**, et c'est une correction. Un congé monté en quatre gradins donne, vu de
 * face et de haut — l'angle même sous lequel on regarde un toit de camion en vue isométrique —
 * quatre bandes alternées : dessus clair, devant sombre, dessus clair, devant sombre. Ce n'est pas
 * un arrondi, c'est un escalier, et à cette échelle on ne lit que les rayures. Chaque marche
 * laissait en plus filer, dans les angles, de courts jours entre deux couches là où leurs contours
 * arrondis ne se recouvraient pas tout à fait. Un seul chanfrein n'a ni rayures ni jours : une
 * arête abattue, ce qui est exactement ce qu'on voulait dire.
 */
const ROOF_R = 0.13;
const ROOF_STEPS = 1;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function SemiTruck({
  trailerLength = TRAILER_LEN_MM * MM,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  vehicle = "semi",
  cellSize = 30,
  className,
}: SemiTruckProps) {
  const cam = useIsoCamera();
  const hasTractor = vehicle !== "trailer";
  const hasTrailer = vehicle !== "tractor";
  // ---- les cotes, le long du camion ----
  //
  // L'origine est l'arrière de la remorque et les x montent vers le nez, comme la vue de profil de
  // la planche se lit de droite à gauche. Tout ce qui suit est une cote du plan divisée par
  // l'échelle : rien n'est choisi ici.
  const T = Math.max(3, trailerLength);
  /** Le dos de la cabine : le nez de la remorque, plus le jeu d'attelage. */
  const cab0 = T + CAB_GAP_MM * MM;
  const cab1 = cab0 + CAB_LEN_MM * MM;
  const LENGTH = cab1;
  /** L'axe directeur, à 1 400 du nez, et l'axe moteur 3 700 derrière lui. */
  const steerX = cab1 - FRONT_OVERHANG_MM * MM;
  const driveX = steerX - CAB_WHEELBASE_MM * MM;
  /** La sellette repose au-dessus de l'essieu moteur : c'est là que la remorque s'appuie. */
  const kingpin = driveX + 0.1;
  const tractor0 = driveX - 0.55; // l'arrière du châssis tracteur

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - LENGTH / 2;
    const dy = y - WIDTH / 2;
    return { x: LENGTH / 2 + dx * cosT - dy * sinT, y: WIDTH / 2 + dx * sinT + dy * cosT };
  };
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };
  const at: Project = (x, y, z) => {
    const p = onGround(x, y);
    return world(p.x, p.y, z);
  };
  const facing = cam.facing(rotation);

  const box = (material: string, key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, extra?: ReactNode) =>
    solidVolume(material, key, boxFaces(at, x0, x1, y0, y1, z0, z1, facing), false, extra);
  /** Le nez regarde-t-il la caméra ? C'est ce qui décide de la calandre, du pare-brise, de la
   *  casquette — et de la place du pare-chocs dans l'ordre de peinture. */
  const front = facing.xFace > 0;
  /** Un quadrilatère plaqué sur un flanc d'ordonnée constante. */
  const sideFace = (y: number, x0: number, x1: number, z0: number, z1: number) =>
    ring([at(x0, y, z0), at(x1, y, z0), at(x1, y, z1), at(x0, y, z1)]);
  /** Un quadrilatère plaqué sur une face d'abscisse constante : calandre, feux, plaques. Défini
   *  ici, avec les autres primitives, parce que le châssis s'en sert aussi — et qu'une constante
   *  déclarée plus bas n'existe pas encore quand on la lit. */
  const frontFace = (x: number, y0: number, y1: number, z0: number, z1: number) =>
    ring([at(x, y0, z0), at(x, y1, z0), at(x, y1, z1), at(x, y0, z1)]);
  const acrossY = (items: { y: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.y - b.y) * facing.yFace).map((it) => it.node);
  const alongX = (items: { x: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.x - b.x) * facing.xFace).map((it) => it.node);

  // La caméra, ramenée dans le repère du camion : c'est là que sont les contours, et c'est donc là
  // qu'il faut savoir d'où l'on regarde pour dire quelles facettes se voient.
  const localView = { x: cam.view.x * cosT + cam.view.y * sinT, y: -cam.view.x * sinT + cam.view.y * cosT };
  const prism = (material: string, key: string, ground: Point[], z0: number, z1: number, extra?: ReactNode) =>
    prismVolume(material, key, at, ground, z0, z1, facing, localView, extra);
  const stack = (material: string, key: string, layers: VolumeLayer[], extra?: ReactNode) =>
    stackedVolume(material, key, at, layers, facing, localView, extra);

  const r = WHEEL_R_MM * MM;
  const tyre = TYRE_W_MM * MM;
  const sideY = [tyre / 2 + 0.01, WIDTH - tyre / 2 - 0.01];
  // L'essieu directeur est **sous la cabine** — c'est ce qui fait une cabine avancée — et les deux
  // essieux moteurs sont derrière elle, sous le nez de la remorque.
  // Le tridem se compte depuis l'arrière — porte-à-faux, puis deux fois le pas — et le tracteur
  // depuis le nez. Les six essieux d'un semi ne se placent pas au jugé : ce sont eux qui disent où
  // la charge passe.
  const axles = [
    ...(hasTrailer
      ? [REAR_OVERHANG_MM * MM, (REAR_OVERHANG_MM + TRIDEM_PITCH_MM) * MM, (REAR_OVERHANG_MM + 2 * TRIDEM_PITCH_MM) * MM]
      : []),
    ...(hasTractor ? [driveX, steerX] : []),
  ];
  /** Le premier essieu du tridem, qu'on ait dessiné le tridem ou non : c'est là que s'arrête le
   *  carénage de la remorque, et il le sait même quand les roues ne sont pas là. */
  const tridemFront = (REAR_OVERHANG_MM + 2 * TRIDEM_PITCH_MM) * MM;
  const beamY0 = 0.38;
  const beamY1 = WIDTH - 0.38;
  const trailerZ0 = TRAILER_FLOOR_MM * MM;
  const trailerZ1 = TRAILER_H_MM * MM;
  /**
   * Le plancher de la cabine — au niveau de celui de la remorque, pas à mi-hauteur des roues.
   *
   * C'est la cote qui décidait le plus de l'allure et elle était fausse : posée bas, la cabine
   * devient un cagibi accroché devant une grande caisse, et aucun détail ajouté dessus ne le
   * rattrape. Une cabine avancée est assise *sur* le châssis, ses roues avant sous elle, et son
   * plancher est à la même hauteur que le plancher de la remorque — c'est pour ça qu'on y monte par
   * trois marches.
   */
  const cabZ0 = CAB_FLOOR_MM * MM;
  /**
   * Le rayon des montants d'angle de la cabine, **et la largeur qu'il laisse au nez**.
   *
   *  Un coin arrondi de rayon `R` rétrécit la face avant de `R` de chaque côté : à son extrémité,
   *  le volume ne fait plus que `largeur − 2R`. Le pare-brise et la calandre, eux, étaient tracés
   *  sur la largeur pleine — donc ils débordaient de la cabine des deux côtés, et c'est ce qu'on
   *  voyait dépasser du museau à certains caps. Deux façons de le corriger : rétrécir ce qu'on
   *  pose sur le nez, ou adoucir moins les montants. La première donne un pare-brise en bandeau
   *  étroit, ce qu'aucune cabine n'a ; c'est donc la seconde — et un montant de cabine avancée est
   *  de toute façon presque vif, c'est le pavillon qui est rond.
   *
   *  `CAB_INSET` est la marge que gardent le vitrage et la calandre : le rayon, plus un jeu, donc
   *  ils tiennent dans le nez par construction et non par tâtonnement.
   */
  const CAB_R = 0.1;
  /** La pente du pare-brise : combien de marches, et où en est le nez à une hauteur donnée. */
  const SLOPE_STEPS = 5;
  const noseAt = (z: number) => cab1 - (WINDSHIELD * (z - beltZ)) / (cabZ1 - beltZ);
  const CAB_INSET = 0.02 + CAB_R + 0.02;
  /**
   * Les trois hauteurs d'une cabine, et pourquoi elles sont trois.
   *
   * Un camion moderne n'a pas une face avant plate : il a un **capot bas** jusqu'à la ceinture de
   * caisse, puis un **pare-brise incliné** qui part en arrière, puis le pavillon. C'est cette
   * marche qui le fait lire comme un camion et non comme une armoire roulante, et c'est elle qui
   * manquait tant que la cabine était un seul volume droit.
   *
   * Le volume est donc en deux étages : le bas va jusqu'au nez du camion (`cab1`), le haut s'arrête
   * en retrait (`cab1 − WINDSHIELD`), et le pan qui les relie est le pare-brise.
   */
  const beltZ = BELT_MM * MM;
  /**
   * Le haut de la cabine — presque à hauteur de caisse.
   *
   * L'autre cote qui était fausse. Un tracteur de semi moderne a une cabine couchette dont le toit
   * arrive à quelques centimètres du toit de la remorque : c'est ce qui fait la silhouette d'un
   * semi, un bloc continu que le déflecteur finit de raccorder. Une cabine qui s'arrête bien plus
   * bas est celle d'un porteur de chantier, pas celle qui vient à un quai.
   */
  const cabZ1 = CAB_H_MM * MM - ROOF_R;
  const roofZ = cabZ1 + ROOF_R;
  /** Le déflecteur monte à hauteur de caisse : c'est à ça qu'il sert, coucher le filet d'air
   *  par-dessus la remorque au lieu de le laisser taper dedans. */
  /** La carène s'arrête au toit de la cabine — 3 700 — et **pas** à hauteur de caisse.
   *
   *  La planche est nette là-dessus : la remorque fait 4 000, la cabine 3 700, et les 300 mm
   *  d'écart sont ce qui fait lire deux véhicules attelés plutôt qu'un seul fourgon. Monter la
   *  carène jusqu'au toit de la remorque efface précisément cet écart. */
  const deflectorZ = CAB_H_MM * MM;
  /** De combien le haut de la cabine est en retrait du nez : la pente du pare-brise. */
  const WINDSHIELD = 0.2;

  /**
   * Les gardes-boue, au-dessus de chaque roue.
   *
   *  Ils débordent la roue des deux côtés — c'est leur métier, arrêter ce que le pneu projette — et
   *  c'est ce débord qui les fait lire comme des gardes-boue et non comme une tôle posée à plat.
   *  Le tridem n'en a qu'un, d'un seul tenant par-dessus les trois roues, comme sur une vraie
   *  remorque : trois capots séparés donneraient trois objets là où l'œil en cherche un.
   *
   *  Ils se peignent **après les roues de leur file**, et non rangés avec elles le long du camion :
   *  un garde-boue couvre sa roue en x, donc il n'est pas une tranche de plus dans l'ordre en
   *  longueur — celui-ci suppose des tranches qui ne se chevauchent pas. Au-dessus de tout ce que
   *  sa file contient, le peindre en dernier est juste à tous les caps.
   */
  /**
   * Le garde-boue : **une bande arquée autour du pneu**, pas un capot par-dessus.
   *
   *  Rempli, l'arc mangeait le haut de la roue : à hauteur de moyeu il couvrait déjà toute la
   *  largeur du pneu, et la roue se retrouvait à moitié avalée — la pièce n'était plus un
   *  garde-boue mais une aile pleine. Un garde-boue est une tôle mince **à distance** du pneu, qui
   *  le suit de moyeu à moyeu en passant au-dessus ; entre les deux, on voit le pneu, et c'est
   *  justement ce vide qui dit que la roue tourne là-dedans.
   *
   *  D'où une bande, définie par deux rayons : `ri`, franchement au-delà du pneu, et `ro`, un peu
   *  plus loin. Elle ne recouvre rien par construction, puisque son bord intérieur est déjà hors
   *  du pneu — il n'y a plus de réglage à trouver pour que la roue reste visible.
   *
   *  Trois surfaces suffisent à la faire tenir en volume : le flanc du fond, la **bande de
   *  roulement** qui la coiffe d'un bout à l'autre, et le flanc de devant. Les facettes de la
   *  bande sont sans trait — sinon les douze segments de l'arc se lisent comme des hachures — et
   *  ce sont les deux flancs, cernés de leur contour, qui portent le dessin.
   *
   *  Et **la roue passe entre les deux flancs**, d'où deux morceaux rendus séparément. Peint d'un
   *  bloc après la roue, le garde-boue paraissait transparent : son flanc du fond, qui est derrière
   *  le pneu, se posait devant lui, et son contour — tracé en dernier — traversait la roue et
   *  l'autre flanc. Ce n'était pas une histoire de remplissage mais d'ordre : le fond, la roue,
   *  puis le devant, chaque flanc portant son contour aussitôt après sa matière.
   */
  const FENDER_GAP = 0.03;
  const FENDER_T = 0.075;
  const FENDER_OVER = 0.045;
  const FENDER_SEGS = 14;
  /** Les deux teintes de facette, lues comme les lit un volume : une paroi tournée vers les `x` et
   *  une paroi tournée vers les `y` ne prennent pas le même jour, et c'est `xOnLeft` qui dit
   *  laquelle est à l'ombre. */
  const xClass = facing.xOnLeft ? "side" : "front";
  const yClass = facing.xOnLeft ? "front" : "side";
  const fender = (key: string, xc: number, yW: number): [ReactNode, ReactNode] => {
    const ri = r + FENDER_GAP;
    const ro = ri + FENDER_T;
    const y0 = yW - tyre / 2 - FENDER_OVER;
    const y1 = yW + tyre / 2 + FENDER_OVER;
    const near = facing.yFace > 0 ? y1 : y0;
    const far = facing.yFace > 0 ? y0 : y1;
    const angle = (i: number) => (Math.PI * i) / FENDER_SEGS;
    const on = (R: number, t: number) => ({ x: xc + R * Math.cos(t), z: r + R * Math.sin(t) });
    const outer = Array.from({ length: FENDER_SEGS + 1 }, (_, i) => on(ro, angle(i)));
    const inner = Array.from({ length: FENDER_SEGS + 1 }, (_, i) => on(ri, angle(i)));
    /** Le profil de la bande sur un flanc : l'arc extérieur à l'aller, l'intérieur au retour. */
    const band = (y: number) => ring([...outer.map((p) => at(p.x, y, p.z)), ...[...inner].reverse().map((p) => at(p.x, y, p.z))]);
    // La bande de roulement, segment par segment. On écarte ceux qui tournent le dos à la caméra —
    // le flanc opposé de l'arc, que le flanc de devant cache de toute façon — et on peint les
    // autres dans l'ordre où la caméra les rencontre le long du camion.
    const tread = outer
      .slice(0, -1)
      .map((p, i) => ({ p, q: outer[i + 1], mid: angle(i + 0.5) }))
      .filter((seg) => Math.sin(seg.mid) > 0.35 || Math.cos(seg.mid) * localView.x > 0)
      .sort((a, b) => (Math.cos(a.mid) - Math.cos(b.mid)) * facing.xFace);
    const flank = (k: string, y: number) => (
      <g key={k} className="lq-iso__solid lq-iso__solid--iron">
        <polygon className={`lq-iso__face lq-iso__face--${yClass} lq-iso__face--seamless`} points={band(y)} />
        <polygon className="lq-iso__outline" points={band(y)} />
      </g>
    );
    return [
      flank(`${key}-far`, far),
      <g key={`${key}-front`} className="lq-iso__solid lq-iso__solid--iron">
        {tread.map((seg, i) => (
          <polygon
            key={i}
            className={`lq-iso__face lq-iso__face--${Math.sin(seg.mid) > 0.6 ? "top" : xClass} lq-iso__face--seamless`}
            points={ring([at(seg.p.x, y0, seg.p.z), at(seg.q.x, y0, seg.q.z), at(seg.q.x, y1, seg.q.z), at(seg.p.x, y1, seg.p.z)])}
          />
        ))}
        {flank(`${key}-near`, near)}
      </g>,
    ];
  };
  const wheelRow = (y: number) => (
    <g key={`wheels${y}`}>
      {alongX(
        axles.map((x, i) => ({
          x,
          node: (() => {
            const [back, front] = fender(`f${i}${y}`, x, y);
            return (
              <g key={`ax${i}${y}`}>
                {back}
                {isoWheel(at, x, y, r, r, tyre, facing, `w${i}${y}`)}
                {front}
              </g>
            );
          })(),
        }))
      )}
    </g>
  );

  // ---- sous la caisse ----
  /**
   * Les bas de caisse de la remorque : un panneau le long de chaque flanc, sous la caisse.
   *
   *  Ce sont les carénages latéraux, et ils manquaient. Sans eux, le dessous de la remorque est un
   *  vide traversant entre les béquilles et le tridem, et la remorque flotte sur ses roues — le
   *  même défaut que la cabine sur pilotis, à une autre échelle. Avec eux, la caisse descend
   *  visuellement jusqu'à hauteur d'essieu et la silhouette se ferme.
   *
   *  Ils vont d'un peu derrière les béquilles à un peu devant le premier essieu du tridem : c'est
   *  l'emprise réelle, et c'est aussi ce qui laisse voir les deux, qui sont ce que l'œil cherche
   *  pour comprendre comment la remorque tient debout.
   */
  /** Le bas du carénage : 600 mm du sol, soit plus bas que le moyeu des roues.
   *
   *  À mi-hauteur de roue il laissait encore voir le jour sous la remorque, et un carénage qui ne
   *  ferme pas la silhouette ne sert à rien de ce qu'on lui demande ici. Descendu sous l'axe, il
   *  referme le flanc tout en gardant les roues lisibles — c'est aussi la garde au sol réelle de
   *  ces jupes, qui doivent passer les dos-d'âne. */
  const trailerSkirtZ0 = 600 * MM;
  const trailerSkirt = (y: number) =>
    prism("trailer", `tskirt${y}`, roundedRing(tridemFront + 0.5, kingpin - 1.85, y, y + 0.07, 0.03), trailerSkirtZ0, trailerZ0);

  /**
   * Le bas de caisse du tracteur : **une seule pièce**, du nez jusque sous la cabine.
   *
   *  C'était un petit mur planté devant la cabine, débordant du nez et s'arrêtant là. Deux défauts
   *  dans le même objet. D'abord l'alignement : un pare-chocs de camion est dans le nu de la
   *  cabine, il en prolonge la face vers le bas — c'est la même tôle qui descend — et le faire
   *  saillir donne un museau que rien sur le plan ne montre. Ensuite la continuité : il ne s'arrête
   *  pas au nez, il file sous la cabine jusqu'à l'arrière du tracteur, et c'est ce bandeau bas
   *  continu qui pose le camion au sol au lieu de le laisser sur pilotis.
   *
   *  Il est donc en deux morceaux de **mêmes hauteurs et mêmes flancs**, séparés seulement par le
   *  passage de la roue directrice : devant elle, l'avant du bas de caisse avec le pare-chocs ;
   *  derrière elle, le marchepied et les réservoirs. Deux morceaux, une seule ligne — c'est ainsi
   *  que se lit un camion, et c'est pour ça que la roue avant doit rester visible entre les deux
   *  plutôt qu'être avalée par une jupe d'un seul tenant.
   */
  const VALANCE_Z0 = 0.26;
  const VALANCE_Z1 = cabZ0 + 0.01;
  const VALANCE_Y = 0.03;
  /**
   * Le dégagement laissé de part et d'autre de la roue directrice.
   *
   *  Il valait le rayon du **pneu** plus un jeu — ce qui était juste tant que la roue était nue.
   *  Depuis qu'elle porte un garde-boue, c'est le rayon extérieur de l'arc qui compte : sinon la
   *  pointe avant du garde-boue entre dans l'emprise du pare-chocs, et comme la file de roues du
   *  devant se peint après le châssis, c'est elle qui passe par-dessus. Le désordre ne venait pas
   *  de l'ordre de peinture mais de deux pièces qui se chevauchaient là où elles ne le devraient
   *  pas ; on les sépare, et la question ne se pose plus à aucun cap.
   */
  const archGap = r + FENDER_GAP + FENDER_T + 0.025;
  /**
   * Les marchepieds, **creusés dans le flanc du pare-chocs**.
   *
   *  En petits caissons rapportés ils ne marchaient à aucun cap : vus par la tranche — ce qui
   *  arrive dès qu'on regarde le camion de face — cinq centimètres d'épaisseur ne laissent voir
   *  que le contour, et deux cadres vides flottaient au coin du pare-chocs. Une marche de cabine
   *  avancée n'est de toute façon pas une pièce ajoutée : elle est *creusée* dedans. Deux
   *  panneaux sur le flanc, du côté qu'on voit, disent la même chose sans rien ajouter au volume —
   *  et sans rien à ranger dans l'ordre de peinture.
   */
  const stepY = facing.yFace > 0 ? WIDTH - VALANCE_Y + 0.002 : VALANCE_Y - 0.002;
  const bumperSteps = (
    <>
      <polygon className="lq-truck__panel" points={sideFace(stepY, cab1 - 0.31, cab1 - 0.13, 0.29, 0.36)} />
      <polygon className="lq-truck__panel" points={sideFace(stepY, cab1 - 0.29, cab1 - 0.15, 0.45, 0.52)} />
    </>
  );
  const bumperPart = prism(
    "cab",
    "bumper",
    // Se termine exactement sur `cab1`, le nez de la cabine : au nu, sans saillie.
    roundedRing(steerX + archGap, cab1, VALANCE_Y, WIDTH - VALANCE_Y, 0.07),
    VALANCE_Z0,
    VALANCE_Z1,
    bumperSteps
  );
  /** Le morceau arrière **ne s'arrête plus au dos de la cabine** : il file jusqu'à l'essieu moteur.
   *
   *  Entre les deux essieux du tracteur il n'y avait qu'un longeron haut de quinze centimètres, et
   *  sous lui on voyait le sol d'un bout à l'autre du camion — un trou en plein milieu du véhicule,
   *  d'autant plus visible que la cabine s'est écartée de la remorque. Le combler avec des pièces
   *  rapportées — un tablier, des réservoirs — revenait à poser des caisses les unes à côté des
   *  autres, et on lisait les caisses plutôt que le camion. Une seule pièce, de la même hauteur et
   *  des mêmes flancs que le pare-chocs, ne se lit pas du tout comme un ajout : c'est le bas du
   *  tracteur, continu du nez à l'attelage, avec la roue directrice pour seule interruption. */
  /**
   * Derrière la roue directrice, ce n'est plus une jupe mais **le châssis lui-même**.
   *
   *  Une jupe basse allant jusqu'à l'essieu moteur passait sous les roues arrière et ressortait
   *  derrière le tracteur en langue plate, avec la sellette posée en l'air au-dessus. Or le
   *  dessous d'un tracteur n'est pas une jupe : c'est un plateau, celui sur lequel repose la
   *  sellette et sous lequel pendent les roues motrices. Dessiné à sa vraie hauteur — bas du
   *  plateau au-dessus du moyeu, dessus au niveau du plancher de cabine — il cesse d'être une
   *  pièce ajoutée : les roues s'y logent, les gardes-boue s'y raccrochent, la sellette s'y pose.
   */
  const chassisZ0 = 0.42;
  const chassis = box("iron", "chassis", tractor0, steerX - archGap, 0.1, WIDTH - 0.1, chassisZ0, cabZ0);

  /**
   * Le pare-chocs se range **en longueur**, et il sort donc du groupe du châssis.
   *
   *  Rangé en travers avec lui, il se peignait entre les deux files de roues — et la file de
   *  devant passait après, donc la roue directrice et son garde-boue venaient par-dessus le
   *  pare-chocs, qui est pourtant devant eux. L'ordre en travers ne pouvait pas trancher : le
   *  pare-chocs tient toute la largeur, les roues sont en dehors, aucune n'est « avant » l'autre
   *  en travers.
   *
   *  En longueur, la réponse est nette : le pare-chocs occupe du nez jusqu'au passage de roue, les
   *  essieux sont derrière, et les deux emprises ne se touchent plus depuis que le dégagement
   *  tient compte du garde-boue. Nez vers la caméra il se peint donc en dernier, cul vers la
   *  caméra en premier — deux cas, parce qu'il n'y a que deux positions possibles pour une pièce
   *  qui est à un bout du véhicule.
   */
  const bumper = <g key="bumper">{bumperPart}</g>;

  /**
   * L'équipement du tracteur — celui qu'on reconnaît de loin.
   *
   *  Un tracteur nu se lit comme une maquette : ce qui le rend vrai, ce ne sont pas ses cotes,
   *  qui sont justes depuis longtemps, mais les pièces qu'on s'attend à voir dessus. Elles ont
   *  toutes la même contrainte : **se raccrocher à quelque chose**. Le réservoir pend du châssis
   *  et le chevauche, les marchepieds sortent du bas de caisse, les feux arrière sont dans la
   *  traverse — aucune ne flotte, et c'est ce qui les distingue d'un décor posé à côté.
   */
  const TANK_Z0 = 0.27;
  const TANK_Z1 = 0.47;
  /**
   * Le réservoir : **un seul volume**, sans sangles en relief.
   *
   *  Les feuillards étaient des prismes plus hauts et plus larges que la cuve, d'une matière plus
   *  sombre : ils ne la cerclaient pas, ils en sortaient, et on lisait deux plaques verticales
   *  plantées dedans plutôt qu'un réservoir sanglé. À cette échelle un cerclage ne peut pas être
   *  un volume — il fait deux centimètres sur un objet qui en fait quarante — et un volume qui ne
   *  peut pas être vu comme tel se voit comme autre chose. La cuve seule, aux angles abattus, se
   *  lit déjà comme un réservoir.
   */
  const tank = (y0: number) => (
    <g key={`tank${y0}`}>
      {prism("steel", `tank${y0}`, roundedRing(driveX + 0.42, cab0 - 0.06, y0, y0 + 0.2, 0.06), TANK_Z0, TANK_Z1)}
    </g>
  );

  /** Les feux arrière, dans la traverse de queue. Tracés seulement quand cette face regarde la
   *  caméra : sinon le plateau les cache, et les peindre par-dessus les ferait traverser. */
  const rearLamps =
    facing.xFace < 0 ? (
      <g key="rear-lamps">
        {[0.14, WIDTH - 0.3].map((y) => (
          <g key={y}>
            {box("cab", `rl${y}`, tractor0 - 0.03, tractor0 + 0.02, y, y + 0.16, 0.44, 0.56)}
            <polygon className="lq-truck__lamp" points={frontFace(tractor0 - 0.036, y + 0.025, y + 0.135, 0.468, 0.536)} />
          </g>
        ))}
      </g>
    ) : null;

  const under = (
    <g key="under">
      {hasTractor && !front && bumper}
      {acrossY([
        ...(hasTractor
          ? [
              { y: 0.0, node: <g key="rig-near">{tank(-0.01)}</g> },
              { y: WIDTH, node: <g key="rig-far">{tank(WIDTH - 0.19)}</g> },
            ]
          : []),
        { y: sideY[0], node: wheelRow(sideY[0]) },
        ...(hasTrailer
          ? [
              { y: 0.05, node: <g key="tskirt-near">{trailerSkirt(0.05)}</g> },
              { y: WIDTH - 0.12, node: <g key="tskirt-far">{trailerSkirt(WIDTH - 0.12)}</g> },
            ]
          : []),
        {
          y: WIDTH / 2,
          node: (
            <g key="frame">
              {/* Le bas de caisse du tracteur est **sous** la cabine, donc ici et non dans l'ordre
                  en x au-dessus.
                  
                  Rangé là-haut, il devait se donner une position le long du camion — et il n'en a
                  pas une seule : il court du nez jusque derrière la roue directrice, donc il
                  chevauche la cabine sur toute sa longueur. L'ordre en x suppose des tranches qui
                  ne se chevauchent pas ; avec une pièce qui en couvre une autre, le tri finit par
                  la sortir devant dès que la caméra passe d'un côté à l'autre, et c'est le
                  pare-chocs qui doublait la cabine. Sous elle, la question ne se pose plus : rien
                  de ce qui est sous le plancher ne peut masquer ce qui est dessus. */}
              {hasTractor && chassis}
              {/* La sellette, posée sur le plateau et non suspendue au-dessus : elle part du
                  plancher de cabine, qui est le dessus du châssis, et s'arrête au plancher de la
                  remorque, qu'elle porte — d'un millimètre de plus, elle le traverserait. */}
              {hasTractor &&
                prism(
                  "steel",
                  "fifth-wheel",
                  roundedRing(kingpin - 0.42, kingpin + 0.46, 0.3, WIDTH - 0.3, 0.12),
                  cabZ0,
                  trailerZ0
                )}
              {/* La gorge en fer à cheval : c'est elle qui fait reconnaître une sellette, et non
                  le plateau, qui n'est qu'une plaque. */}
              {hasTractor && (
                <polygon
                  className="lq-truck__panel"
                  points={ring(
                    roundedRing(kingpin - 0.26, kingpin + 0.5, WIDTH / 2 - 0.075, WIDTH / 2 + 0.075, 0.05).map((q) => at(q.x, q.y, trailerZ0 + 0.002))
                  )}
                />
              )}
              {hasTractor && rearLamps}
              {hasTrailer && box("iron", "trailer-beam", 0, T, beamY0, beamY1, trailerZ0 - 0.12, trailerZ0)}
              {hasTrailer &&
                acrossY(
                  [0.12, WIDTH - 0.22].map((y) => ({
                  y,
                    node: (
                      <g key={`gear${y}`}>
                        {box("iron", `leg${y}`, kingpin - 1.6, kingpin - 1.5, y, y + 0.1, 0.18, trailerZ0)}
                        {box("iron", `pad${y}`, kingpin - 1.64, kingpin - 1.46, y - 0.03, y + 0.13, 0.12, 0.18)}
                      </g>
                    ),
                  }))
                )}
            </g>
          ),
        },
        { y: sideY[1], node: wheelRow(sideY[1]) },
      ])}
      {hasTractor && front && bumper}
    </g>
  );

  // ---- au-dessus ----
  /** Les portes arrière : deux vantaux tracés sur la face du fond, quand elle regarde la caméra. */
  const doors =
    facing.xFace < 0 ? (
      <g className="lq-truck__doors">
        {[0.06, WIDTH / 2, WIDTH - 0.06].map((y) => {
          const a = at(0, y, trailerZ0 + 0.05);
          const b = at(0, y, trailerZ1 - 0.14);
          return <line key={y} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
    ) : null;
  /**
   * La caisse : **un pavé à angles vifs**.
   *
   *  Elle avait des montants arrondis et une casquette abattue tout autour du toit, par crainte
   *  qu'un volume nu se lise comme une boîte. C'est l'inverse : une semi-remorque *est* une boîte,
   *  et c'est même ce qui la distingue de la cabine, dont chaque arête est adoucie parce qu'elle
   *  fend l'air. Les arrondis ne faisaient pas une caisse plus fine, ils lui enlevaient ses arêtes —
   *  or ce sont elles qui donnent l'échelle, puisqu'on lit la longueur sur le fil du toit.
   */
  const trailer = <g key="trailer">{box("trailer", "trailer", 0, T, 0, WIDTH, trailerZ0, trailerZ1, doors)}</g>;

  // ---- la cabine ----
  /** Le plan de l'étage bas de la cabine : du dos au nez, pleine largeur. */
  const cabFloorRing = roundedRing(cab0, cab1, 0.02, WIDTH - 0.02, CAB_R, 4);
  const sideY1 = facing.yFace > 0 ? WIDTH - 0.015 : 0.015;

  /** Un arc échantillonné dans un plan du camion, projeté point par point.
   *
   *  Le passage de roue est le seul trait courbe de la cabine et il ne peut pas être un `arc` SVG :
   *  la projection isométrique transforme un cercle du plan (x, z) en ellipse *inclinée*, que les
   *  paramètres d'un arc SVG ne décrivent pas directement. Vingt points suffisent à ne plus voir la
   *  corde, et coûtent moins qu'une matrice. */
  const archPath = (cx: number, cz: number, radius: number, y: number) => {
    const pts: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * (i / 20);
      pts.push(at(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius * 0.92));
    }
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  };

  /**
   * Le pare-brise, et ce qui en fait un pare-brise : **il tourne le coin**.
   *
   *  Un quadrilatère sombre sur la face avant ne se lit pas comme une cabine ; il se lit comme une
   *  porte. Ce qui dit « cabine » à cette taille, c'est le vitrage qui continue sur le flanc après
   *  le montant — le déflecteur d'angle — parce que c'est la seule chose de la silhouette qu'aucun
   *  autre volume de l'entrepôt ne possède. Il occupe donc toute la largeur entre les montants et
   *  tout le tiers haut de la cabine, et il se prolonge en biais sur la joue.
   */
  /** Le vitrage va d'une ceinture à l'autre, sans marge.
   *
   *  Un jeu de quelques centièmes sous la glace paraît inoffensif dans les cotes et se voit comme
   *  un bandeau blanc sous le pare-brise dès qu'on approche : à cette échelle, six centièmes de
   *  case font trois pixels de tôle là où l'œil attend la jonction. La glace touche donc la
   *  ceinture, et c'est le montant qui fait la séparation. */
  /** Le pare-brise va de la ceinture (2 320) à juste sous le pavillon.
   *
   *  Sur la planche il occupe presque toute la moitié haute de la face : c'est la plus grande
   *  surface de la cabine, loin devant la calandre. Réduit à un bandeau, il rendait la face avant
   *  majoritairement tôlée — l'inverse de ce que montre le plan. */
  /** Et il joint la tôle **des deux côtés**.
   *
   *  Il s'arrêtait quatre centièmes sous le pavillon et trois centièmes avant le nez : deux marges
   *  de rien du tout dans les cotes, mais qui laissaient tout autour de la glace un liseré de
   *  carrosserie clair — et, vu de trois quarts, un vide franc entre le haut du pare-brise et le
   *  toit. Une glace de camion est collée bord à bord sur son ouverture ; la marge n'est pas une
   *  sécurité, c'est le défaut. */
  const GLASS_Z0 = beltZ;
  const GLASS_Z1 = cabZ1;
  const windshield = front ? (
    <g>
      <polygon
        className="lq-truck__glass"
        points={ring([
          at(cab1 - WINDSHIELD, CAB_INSET, GLASS_Z1),
          at(cab1 - WINDSHIELD, WIDTH - CAB_INSET, GLASS_Z1),
          at(cab1, WIDTH - CAB_INSET, GLASS_Z0),
          at(cab1, CAB_INSET, GLASS_Z0),
        ])}
      />
      {/* Le montant : un trait, pas un volume. Il sépare le pare-brise de la vitre de coin et c'est
          tout ce qu'il a à faire. */}
      <g className="lq-truck__door">
        {[CAB_INSET, WIDTH - CAB_INSET].map((y) => {
          const a = at(cab1 - WINDSHIELD, y, GLASS_Z1);
          const b = at(cab1, y, GLASS_Z0);
          return <line key={y} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
    </g>
  ) : null;

  /**
   * Le nez : un pare-chocs plein en bas, une calandre étroite au-dessus, deux feux dans le
   * pare-chocs.
   *
   *  L'ancienne version mettait une grande tôle sombre au milieu de la face : sur un camion clair,
   *  ça se lit comme un trou. Une calandre est une bande — large, mais basse — et c'est le
   *  pare-chocs, plus clair et plus haut qu'on ne croit, qui occupe le bas.
   */
  const nose = front ? (
    <g>
      {/* Un panneau, pas des traits perdus au milieu d'une grande tôle claire : trois lignes seules
          flottent, et c'est ce qu'on voyait. La calandre est une pièce, et elle porte ses barres. */}
      <polygon className="lq-truck__panel" points={frontFace(cab1 + 0.01, CAB_INSET + 0.03, WIDTH - CAB_INSET - 0.03, beltZ - 0.46, beltZ - 0.04)} />
      <g className="lq-truck__grille">
        {[0, 1, 2].map((i) => {
          const z = beltZ - 0.38 + i * 0.11;
          const a = at(cab1 + 0.02, CAB_INSET + 0.07, z);
          const b = at(cab1 + 0.02, WIDTH - CAB_INSET - 0.07, z);
          return <line key={z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      {/* Dans le pare-chocs, donc au nu de la face : ils étaient posés douze centièmes devant, sur
          la saillie qui n'existe plus. */}
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, CAB_INSET, CAB_INSET + 0.26, 0.34, 0.5)} />
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, WIDTH - CAB_INSET - 0.26, WIDTH - CAB_INSET, 0.34, 0.5)} />
    </g>
  ) : null;

  /**
   * La joue : la vitre de coin, la vitre de portière, la ligne de portière, la poignée, et le
   * passage de roue.
   *
   *  Le passage de roue est ce qui ancre la cabine sur son essieu. Sans lui, le volume flotte
   *  au-dessus d'une roue qui ne lui appartient pas — et c'est exactement ce qu'on voyait.
   */
  const flank = (
    <g className="lq-truck__glass-side">
      {/* La vitre de coin : le pare-brise qui tourne. Un trapèze, parce que le montant est incliné. */}
      <polygon
        className="lq-truck__glass"
        points={ring([
          at(cab1 - WINDSHIELD - 0.02, sideY1, GLASS_Z1),
          at(cab1 - WINDSHIELD - 0.15, sideY1, GLASS_Z1),
          at(cab1 - WINDSHIELD - 0.15, sideY1, GLASS_Z0 + 0.06),
          at(cab1 - WINDSHIELD - 0.02, sideY1, GLASS_Z0 + 0.02),
        ])}
      />
      <polygon
        className="lq-truck__glass"
        points={ring([
          at(cab1 - WINDSHIELD - 0.22, sideY1, GLASS_Z1),
          at(cab1 - WINDSHIELD - 0.82, sideY1, GLASS_Z1),
          at(cab1 - WINDSHIELD - 0.82, sideY1, GLASS_Z0 + 0.12),
          at(cab1 - WINDSHIELD - 0.22, sideY1, GLASS_Z0 + 0.02),
        ])}
      />
      <g className="lq-truck__door">
        {[cab1 - WINDSHIELD - 0.9, cab1 - WINDSHIELD - 0.18].map((x) => {
          const a = at(x, sideY1, cabZ0 + 0.06);
          const b = at(x, sideY1, GLASS_Z1);
          return <line key={x} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
        {(() => {
          const a = at(cab1 - WINDSHIELD - 0.86, sideY1, GLASS_Z0 - 0.06);
          const b = at(cab1 - WINDSHIELD - 0.62, sideY1, GLASS_Z0 - 0.06);
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })()}
        <path d={archPath(cab1 - 0.45, cabZ0 + 0.02, 0.34, sideY1)} fill="none" />
      </g>
    </g>
  );

  /**
   * Ce qui est **posé sur le pavillon** : la casquette pare-soleil et ses feux, les trompes, les
   * antennes.
   *
   *  Le pare-soleil et ses feux ne se dessinent que nez vers la caméra, comme la calandre et la
   *  glace : une casquette est au-dessus du pare-brise, elle n'existe pas de dos, et le pavillon
   *  la cacherait. Les trompes et les antennes, elles, sont **au-dessus de tout** — rien ne les
   *  masque jamais — donc elles se peignent sans condition, rangées seulement en travers pour
   *  que celle du fond passe avant celle de devant.
   */
  const VISOR_X0 = cab1 - WINDSHIELD - 0.03;
  const VISOR_X1 = cab1 - WINDSHIELD + 0.14;
  const visor = front ? (
    <g key="visor">
      {prism("cab", "visor", roundedRing(VISOR_X0, VISOR_X1, 0.04, WIDTH - 0.04, 0.05), cabZ1 - 0.11, cabZ1 - 0.02)}
      {/* Cinq feux de gabarit sur la casquette : c'est leur alignement qu'on reconnaît, pas leur
          nombre exact, et cinq est ce qui tient dans la largeur sans se toucher. */}
      {Array.from({ length: 5 }, (_, i) => {
        const pitch = (WIDTH - 0.44) / 4;
        const y = 0.22 + i * pitch;
        return <polygon key={i} className="lq-truck__lamp" points={frontFace(VISOR_X1 + 0.004, y, y + 0.09, cabZ1 - 0.092, cabZ1 - 0.048)} />;
      })}
    </g>
  ) : null;

  /** Les trompes : un tube et un pavillon évasé. Le tube seul fait une barre, l'évasement seul
   *  fait une tache ; c'est le couple des deux qui se lit comme un klaxon. */
  const horns = (
    <g key="horns">
      {acrossY(
        [WIDTH / 2 - 0.19, WIDTH / 2 + 0.06].map((y) => ({
          y,
          node: (
            <g key={`horn${y}`}>
              {prism("steel", `horn-tube${y}`, roundedRing(cab0 + 0.5, cab0 + 0.92, y + 0.028, y + 0.062, 0.017), deflectorZ, deflectorZ + 0.038)}
              {prism("steel", `horn-bell${y}`, roundedRing(cab0 + 0.92, cab0 + 1.05, y - 0.02, y + 0.11, 0.04), deflectorZ, deflectorZ + 0.09)}
            </g>
          ),
        }))
      )}
    </g>
  );

  /** Les antennes, à l'arrière du pavillon : un socle, et un brin. Le brin est le plus fin trait
   *  du camion — un tiers de la largeur d'un montant — et c'est ce qui le fait lire comme un fil
   *  plutôt que comme un mât. */
  const antennas = (
    <g key="antennas">
      {acrossY(
        [0.13, WIDTH - 0.19].map((y) => ({
          y,
          node: (
            <g key={`ant${y}`}>
              {box("iron", `ant-base${y}`, cab0 + 0.115, cab0 + 0.165, y + 0.005, y + 0.055, deflectorZ, deflectorZ + 0.025)}
              {box("steel", `ant-whip${y}`, cab0 + 0.133, cab0 + 0.147, y + 0.023, y + 0.037, deflectorZ + 0.025, deflectorZ + 0.32)}
            </g>
          ),
        }))
      )}
    </g>
  );

  const cab = (
    <g key="cab">
      {/* Les deux étages et le congé du toit, en **un seul volume** : une seule silhouette, et le
          dessus de la seule couche du dessus. En volumes séparés, chacun cerne son contour et la
          cabine revient en tranches empilées. */}
      {stack(
        "cab",
        "cab",
        [
          { ring: cabFloorRing, z0: cabZ0, z1: beltZ },
          // Le pare-brise est un **plan incliné**, et il se monte en marches serrées.
          //
          // D'une seule marche, il avait un dessus horizontal large d'une demi-case au ras du nez —
          // et un dessus se voit **par-dessus**, quel que soit le cap. De trois quarts arrière, là
          // où un vrai pare-brise est caché par le pavillon, on voyait donc à la place un grand
          // pan clair posé à plat sur le museau. La glace, elle, ne se dessine que nez vers la
          // caméra : elle n'était pas là pour le recouvrir.
          //
          // Découpé en marches, le pan disparaît de lui-même : à 48° la pente est plus raide que
          // les 35° du regard, donc la contremarche de chaque marche recouvre le dessus de la
          // précédente — le nez redevient une pente, sans qu'aucun test de visibilité n'ait à le
          // décider. Les marches sont inscrites sous la pente, si bien que la glace, qui suit la
          // pente vraie, les recouvre exactement quand elle se dessine.
          ...Array.from({ length: SLOPE_STEPS }, (_, k) => {
            const z0 = beltZ + ((cabZ1 - beltZ) * k) / SLOPE_STEPS;
            const z1 = beltZ + ((cabZ1 - beltZ) * (k + 1)) / SLOPE_STEPS;
            return { ring: roundedRing(cab0, noseAt(z1), 0.02, WIDTH - 0.02, CAB_R, 4), z0, z1 };
          }),
          ...filletLayers(
            (d) => roundedRing(cab0 + d, cab1 - WINDSHIELD - d, 0.02 + d, WIDTH - 0.02 - d, CAB_R, 4),
            cabZ1,
            ROOF_R,
            ROOF_STEPS
          ),
          // La carène de toit, dans le MÊME empilement que la cabine.
          //
          // Dessinée à part, elle revenait en second coussin posé à côté du pavillon : deux volumes
          // arrondis l'un contre l'autre, chacun cerné de sa propre silhouette, et le regard y lit
          // deux objets. Ici elle n'est qu'une couche de plus du volume de la cabine — une seule
          // silhouette, un seul dessus — et c'est ce qui la fait lire comme un toit qui monte
          // plutôt que comme une pièce rapportée.
          // Elle court presque jusqu'au montant : s'arrêtant à mi-pavillon, elle laissait devant
          // elle une bande de toit plate, large et en pleine lumière, qui se lit comme une trappe
          // ouverte au milieu du toit. Un pavillon de couchette est une seule surface qui monte.
          // Et elle monte **d'un seul pan**, au ras du pare-brise.
          //
          // Reculée d'un tiers de case et coiffée de son propre congé, elle laissait devant elle une
          // bande de toit plate, puis deux marches sombres avant son dessus : trois plans parallèles
          // là où il n'y a qu'une carène, et l'œil y lisait des rayures en travers du toit plutôt
          // qu'un pavillon. Une face, un dessus, rien entre les deux.
          { ring: roundedRing(cab0 + 0.03, cab1 - WINDSHIELD - 0.1, 0.05, WIDTH - 0.05, CAB_R, 3), z0: roofZ, z1: deflectorZ },
        ],
        (
          <>
            {flank}
            {nose}
            {windshield}
          </>
        )
      )}
      {visor}
      {horns}
      {antennas}
    </g>
  );

  /**
   * Les rétroviseurs : une glace et le bras court qui la tient, de chaque côté du pare-brise.
   *
   *  Ils ne peuvent pas être **un** groupe dans l'ordre en longueur, et c'est ce qui donnait au
   *  pare-brise l'air d'être transparent : les deux rétroviseurs partagent la même position le long
   *  du camion, donc l'ordre en x les traitait ensemble, tous les deux après la cabine. Celui du
   *  côté opposé se peignait alors par-dessus la glace, et on voyait au travers un rétroviseur qui
   *  est en réalité derrière toute la cabine.
   *
   *  Ce qui les sépare n'est pas leur longueur mais leur **travers** : l'un est devant la cabine,
   *  l'autre derrière, et la cabine passe entre les deux. */
  const mirror = (m: { y: number; arm: readonly [number, number] }) => (
    <g key={`mirror${m.y}`}>
      {prism("cab", `arm${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.13, cab1 - WINDSHIELD - 0.09, m.arm[0], m.arm[1], 0.015), cabZ1 - 0.3, cabZ1 - 0.25)}
      {/* La glace pend sous le bras sur une demi-case — la hauteur d'un vrai rétroviseur de
          camion. Descendue jusqu'à la ceinture, elle cessait d'être un rétroviseur pour
          devenir un poteau planté devant la portière, et c'est ce qu'on voyait. */}
      {prism("cab", `mirror${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.16, cab1 - WINDSHIELD - 0.09, m.y, m.y + 0.1, 0.025), cabZ1 - 0.72, cabZ1 - 0.28)}
    </g>
  );
  const mirrorSides = [
    { y: -0.07, arm: [-0.04, 0.05] as const },
    { y: WIDTH - 0.01, arm: [WIDTH - 0.05, WIDTH + 0.04] as const },
  ].sort((a, b) => (a.y - b.y) * facing.yFace);



  const above = alongX([
    ...(hasTrailer ? [{ x: 0, node: trailer }] : []),
    ...(hasTractor
      ? [
          {
            x: cab0 + 0.01,
            node: (
              <g key="cab-and-mirrors">
                {mirror(mirrorSides[0])}
                {cab}
                {mirror(mirrorSides[1])}
              </g>
            ),
          },
        ]
      : []),
  ]);

  // ---- l'ombre ----
  const sweep = (x0: number, x1: number, y0: number, y1: number, h: number, key: string) => {
    const foot = [onGround(x0, y0), onGround(x1, y0), onGround(x1, y1), onGround(x0, y1)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  const shade = shadows ? (
    <g>
      {hasTrailer && sweep(0, T, 0, WIDTH, trailerZ1, "s-trailer")}
      {hasTractor && sweep(cab0, LENGTH, 0.03, WIDTH - 0.03, deflectorZ, "s-cab")}
    </g>
  ) : null;

  // ---- le cadrage ----
  // Le cadre se serre sur le véhicule dessiné : le tracteur seul n'a pas à réserver la place d'une
  // remorque absente, sans quoi il se retrouverait dans un coin d'une image aux trois quarts vide.
  const boundX0 = hasTrailer ? 0 : tractor0 - 0.1;
  const boundX1 = hasTractor ? LENGTH : T;
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, (hasTrailer ? trailerZ1 : deflectorZ) + 0.2].flatMap((z) =>
        [
          [boundX0, 0],
          [boundX1, 0],
          [boundX1, WIDTH],
          [boundX0, WIDTH],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <IsoCanvas
      className={["lq-truck", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={[minX, minY, boxWidth, boxHeight]}
      ariaLabel="Semi-remorque"
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {under}
          {above}
        </>
      )}
    </IsoCanvas>
  );
}
