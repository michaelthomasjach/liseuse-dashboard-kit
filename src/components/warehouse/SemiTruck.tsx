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
/** Porte-à-faux avant, puis empattement du tracteur : 1 400 et 3 700. C'est ce qui place l'essieu
 *  directeur *sous* la cabine et l'essieu moteur loin derrière elle. */
const FRONT_OVERHANG_MM = 1400;
const CAB_WHEELBASE_MM = 3700;
/** Porte-à-faux arrière de la remorque, et le pas du tridem. */
const REAR_OVERHANG_MM = 1320;
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
/** Le congé du toit de la cabine : son rayon, et en combien de couches on le monte. */
const ROOF_R = 0.13;
const ROOF_STEPS = 4;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function SemiTruck({
  trailerLength = TRAILER_LEN_MM * MM,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: SemiTruckProps) {
  const cam = useIsoCamera();
  // ---- les cotes, le long du camion ----
  //
  // L'origine est l'arrière de la remorque et les x montent vers le nez, comme la vue de profil de
  // la planche se lit de droite à gauche. Tout ce qui suit est une cote du plan divisée par
  // l'échelle : rien n'est choisi ici.
  const T = Math.max(3, trailerLength);
  /** Le tracteur est ce qui dépasse devant la remorque : la longueur hors-tout moins la remorque.
   *  La cabine occupe exactement cette avancée, et sa face arrière touche celle de la remorque —
   *  c'est ce que montre la vue de profil, et c'est ce qui rend le semi compact. */
  const cab0 = T;
  // La planche donne la même avancée par deux chemins — le hors-tout moins la remorque
  // (16 540 − 13 620 = 2 920) et la longueur de cabine (2 920) — et ils concordent. On prend la
  // seconde, la seule des deux que le plan mesure directement sur la pièce.
  const cab1 = T + CAB_LEN_MM * MM;
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
    REAR_OVERHANG_MM * MM,
    (REAR_OVERHANG_MM + TRIDEM_PITCH_MM) * MM,
    (REAR_OVERHANG_MM + 2 * TRIDEM_PITCH_MM) * MM,
    driveX,
    steerX,
  ];
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

  const wheelRow = (y: number) => (
    <g key={`wheels${y}`}>
      {alongX(axles.map((x, i) => ({ x, node: isoWheel(at, x, y, r, r, tyre, facing, `w${i}${y}`) })))}
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
    prism("trailer", `tskirt${y}`, roundedRing(axles[2] + 0.5, kingpin - 1.85, y, y + 0.07, 0.03), trailerSkirtZ0, trailerZ0);

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
  /** Le dégagement laissé de part et d'autre de la roue directrice : son rayon, plus un jeu. */
  const archGap = r + 0.08;
  const bumperPart = prism(
    "cab",
    "bumper",
    // Se termine exactement sur `cab1`, le nez de la cabine : au nu, sans saillie.
    roundedRing(steerX + archGap, cab1, VALANCE_Y, WIDTH - VALANCE_Y, 0.07),
    VALANCE_Z0,
    VALANCE_Z1
  );
  const skirtPart = prism("cab", "skirt", roundedRing(cab0, steerX - archGap, VALANCE_Y, WIDTH - VALANCE_Y, 0.07), VALANCE_Z0, VALANCE_Z1);

  const valance = (
    <g key="valance">
      {alongX([
        { x: cab0, node: <g key="skirt">{skirtPart}</g> },
        { x: cab1, node: <g key="bumper">{bumperPart}</g> },
      ])}
    </g>
  );

  const under = (
    <g key="under">
      {acrossY([
        { y: sideY[0], node: wheelRow(sideY[0]) },
        { y: 0.05, node: <g key="tskirt-near">{trailerSkirt(0.05)}</g> },
        { y: WIDTH - 0.12, node: <g key="tskirt-far">{trailerSkirt(WIDTH - 0.12)}</g> },
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
              {valance}
              {box("iron", "tractor-beam", tractor0, cab1 - 0.1, beamY0, beamY1, 0.42, cabZ0)}
              {box("iron", "trailer-beam", 0, T, beamY0, beamY1, trailerZ0 - 0.12, trailerZ0)}
              {acrossY(
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
              {acrossY(
                [0.02, WIDTH - 0.26].map((y) => ({
                  y,
                  // Un réservoir est un cylindre couché : à défaut, un volume dont on a abattu les
                  // angles, ce qui suffit à ne plus lire une caisse.
                  node: prism("steel", `tank${y}`, roundedRing(cab0 + 0.05, cab0 + 0.8, y, y + 0.24, 0.11), 0.34, 0.66),
                }))
              )}
            </g>
          ),
        },
        { y: sideY[1], node: wheelRow(sideY[1]) },
      ])}
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
  // La caisse et sa **casquette** : un chapeau rentré de cinq centimètres, donc une arête abattue
  // tout autour du toit. Une caisse d'un seul volume se lit comme un pavé, et c'est ce qu'on
  // reproche à un dessin anguleux.
  const trailer = (
    <g key="trailer">
      {stack(
        "trailer",
        "trailer",
        [
          { ring: roundedRing(0, T, 0, WIDTH, 0.08), z0: trailerZ0, z1: trailerZ1 - 0.16 },
          ...filletLayers((d) => roundedRing(d * 0.5, T - d * 0.5, d, WIDTH - d, 0.08 + d), trailerZ1 - 0.16, 0.16, 3),
        ],
        doors
      )}
    </g>
  );

  // ---- la cabine ----
  const front = facing.xFace > 0;
  const sideY1 = facing.yFace > 0 ? WIDTH - 0.015 : 0.015;
  const frontFace = (x: number, y0: number, y1: number, z0: number, z1: number) =>
    ring([at(x, y0, z0), at(x, y1, z0), at(x, y1, z1), at(x, y0, z1)]);

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
  const GLASS_Z0 = beltZ;
  const GLASS_Z1 = cabZ1 - 0.04;
  const windshield = front ? (
    <g>
      <polygon
        className="lq-truck__glass"
        points={ring([
          at(cab1 - WINDSHIELD, 0.12, GLASS_Z1),
          at(cab1 - WINDSHIELD, WIDTH - 0.12, GLASS_Z1),
          at(cab1 - 0.03, WIDTH - 0.12, GLASS_Z0),
          at(cab1 - 0.03, 0.12, GLASS_Z0),
        ])}
      />
      {/* Le montant : un trait, pas un volume. Il sépare le pare-brise de la vitre de coin et c'est
          tout ce qu'il a à faire. */}
      <g className="lq-truck__door">
        {[0.12, WIDTH - 0.12].map((y) => {
          const a = at(cab1 - WINDSHIELD, y, GLASS_Z1);
          const b = at(cab1 - 0.03, y, GLASS_Z0);
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
      <polygon className="lq-truck__panel" points={frontFace(cab1 + 0.01, 0.15, WIDTH - 0.15, beltZ - 0.46, beltZ - 0.04)} />
      <g className="lq-truck__grille">
        {[0, 1, 2].map((i) => {
          const z = beltZ - 0.38 + i * 0.11;
          const a = at(cab1 + 0.02, 0.19, z);
          const b = at(cab1 + 0.02, WIDTH - 0.19, z);
          return <line key={z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      {/* Dans le pare-chocs, donc au nu de la face : ils étaient posés douze centièmes devant, sur
          la saillie qui n'existe plus. */}
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, 0.09, 0.35, 0.34, 0.5)} />
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, WIDTH - 0.35, WIDTH - 0.09, 0.34, 0.5)} />
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

  const cab = (
    <g key="cab">
      {/* Les deux étages et le congé du toit, en **un seul volume** : une seule silhouette, et le
          dessus de la seule couche du dessus. En volumes séparés, chacun cerne son contour et la
          cabine revient en tranches empilées. */}
      {stack(
        "cab",
        "cab",
        [
          { ring: roundedRing(cab0, cab1, 0.02, WIDTH - 0.02, 0.22, 4), z0: cabZ0, z1: beltZ },
          { ring: roundedRing(cab0, cab1 - WINDSHIELD, 0.02, WIDTH - 0.02, 0.22, 4), z0: beltZ, z1: cabZ1 },
          ...filletLayers(
            (d) => roundedRing(cab0 + d, cab1 - WINDSHIELD - d, 0.02 + d, WIDTH - 0.02 - d, 0.22, 4),
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
          { ring: roundedRing(cab0 + 0.03, cab1 - WINDSHIELD - 0.34, 0.05, WIDTH - 0.05, 0.18, 3), z0: roofZ, z1: deflectorZ - 0.05 },
          ...filletLayers(
            (d) => roundedRing(cab0 + 0.03 + d, cab1 - WINDSHIELD - 0.34 - d, 0.05 + d, WIDTH - 0.05 - d, 0.18, 3),
            deflectorZ - 0.05,
            0.05,
            2
          ),
        ],
        (
          <>
            {flank}
            {nose}
            {windshield}
          </>
        )
      )}
    </g>
  );

  /** Les rétroviseurs : une glace et le bras court qui la tient, de chaque côté du pare-brise. */
  const mirrors = (
    <g key="mirrors">
      {acrossY(
        [
          { y: -0.07, arm: [-0.04, 0.05] as const },
          { y: WIDTH - 0.01, arm: [WIDTH - 0.05, WIDTH + 0.04] as const },
        ].map((m) => ({
          y: m.y,
          node: (
            <g key={`mirror${m.y}`}>
              {prism("cab", `arm${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.13, cab1 - WINDSHIELD - 0.09, m.arm[0], m.arm[1], 0.015), cabZ1 - 0.3, cabZ1 - 0.25)}
              {/* La glace pend sous le bras sur une demi-case — la hauteur d'un vrai rétroviseur de
                  camion. Descendue jusqu'à la ceinture, elle cessait d'être un rétroviseur pour
                  devenir un poteau planté devant la portière, et c'est ce qu'on voyait. */}
              {prism("cab", `mirror${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.16, cab1 - WINDSHIELD - 0.09, m.y, m.y + 0.1, 0.025), cabZ1 - 0.72, cabZ1 - 0.28)}
            </g>
          ),
        }))
      )}
    </g>
  );



  const above = alongX([
    { x: 0, node: trailer },
    { x: cab0 + 0.01, node: cab },
    { x: cab1 - WINDSHIELD - 0.11, node: mirrors },
  ]);

  // ---- l'ombre ----
  const sweep = (x0: number, x1: number, y0: number, y1: number, h: number, key: string) => {
    const foot = [onGround(x0, y0), onGround(x1, y0), onGround(x1, y1), onGround(x0, y1)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  const shade = shadows ? (
    <g>
      {sweep(0, T, 0, WIDTH, trailerZ1, "s-trailer")}
      {sweep(cab0, LENGTH, 0.03, WIDTH - 0.03, deflectorZ, "s-cab")}
    </g>
  ) : null;

  // ---- le cadrage ----
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, trailerZ1 + 0.2].flatMap((z) =>
        [
          [0, 0],
          [LENGTH, 0],
          [LENGTH, WIDTH],
          [0, WIDTH],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-truck", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Semi-remorque"
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {under}
          {above}
        </>
      )}
    </svg>
  );
}
