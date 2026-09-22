import { useId, type CSSProperties } from "react";
import {
  frameCorners,
  boxFaces,
  convexHull as hull,
  isoWheel,
  fitRackItem,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import { RAIL_GAUGE, RAIL_TOP, RAIL_WIDTH } from "./Rail";
import { useIsoCamera } from "./isoCamera";
import "./Picker.css";

/**
 * Picker — la machine qui roule sur un rail, prend un colis dans une étagère et le dépose sur un
 * tapis. Un transstockeur, en plus petit.
 *
 * Même vocabulaire que l'étagère, le tapis et le rail (`rackItems.tsx`) : des volumes alignés sur
 * les axes, trois faces, trois clartés d'une seule lumière, faces visibles choisies d'après la
 * rotation. Une machine posée sur une voie doit être faite de la même matière que la voie, sans quoi
 * l'image se lit comme deux dessins côte à côte.
 *
 * ## Les pièces, et ce que chacune fait
 *
 * Un **châssis** sur quatre roues, qui roule le long du rail. Le châssis tient entre les deux files
 * et les roues sont à l'extérieur, sur leur file, comme les galets d'un bogie : on les voit donc
 * entières, et c'est leur rondeur qui dit que la machine roule.
 * Deux **montants**, un à chaque bout, reliés en tête par une **traverse** : un portique, et non un
 * poteau — un seul mât ne tient pas une charge en porte-à-faux, et la machine se lisait comme un
 * lampadaire sur un socle. Entre les montants, le **tablier** qui monte et descend, tenu par deux
 * **patins** qui embrassent les montants. Sur le tablier, deux étages **télescopiques** et les
 * fourches, qui sortent d'un côté ou de l'autre. Et au pied d'un montant, l'**armoire** électrique,
 * sans laquelle une machine n'est qu'un meuble.
 *
 * Trois mouvements sur trois axes indépendants, et c'est exactement ce qui fait qu'un picker peut
 * desservir une alvéole : il faut arriver à la bonne travée (`x`), au bon niveau (`z`), puis entrer
 * dans l'alvéole (`y`). Une machine à deux axes ne peut que passer devant.
 *
 * ## Les roues sont rondes, et ce n'est pas un détail de dessin
 *
 * Une roue est un disque dans le plan vertical du rail. Sous cette caméra, un plan passe par une
 * application affine, donc un cercle devient une ellipse — la même qu'on calcule en projetant ses
 * points un à un. La bande de roulement est alors l'enveloppe convexe des deux flancs : pas de
 * calcul de tangentes, et c'est juste à toute rotation du sol.
 *
 * ## Pourquoi tout ici est une translation, et pourquoi c'est la raison d'être du dessin
 *
 * La caméra du kit est **affine** : elle envoie un plan par une matrice 2×2 et une hauteur par un
 * décalage vertical fixe (voir `warehouseIso.ts`). Donc une translation dans le monde devient une
 * translation à l'écran, la même quel que soit l'endroit d'où on part — et c'est vrai des trois
 * axes à la fois.
 *
 * Les trois mouvements de la machine sont **précisément trois translations**. Chacun est donc un
 * `translate()` CSS sur un groupe SVG, et les trois groupes s'emboîtent : `travel` porte `lift`, qui
 * porte `reach`. Rien n'est redessiné image par image : le dessin est fait une fois, à une position
 * de référence, et les trois `@keyframes` disent de combien il s'écarte.
 *
 * C'est aussi ce qui limite la machine sur une voie droite. Dans un virage elle **tourne**, et une
 * rotation d'un volume n'est pas une transformation d'écran sous cette caméra : là, on la redessine
 * à chaque cap (`rotation`), comme une charge dans un virage de tapis. Voir la story du circuit.
 *
 * ## Le cycle
 *
 * Dix temps qui bouclent, et la boucle se referme sur elle-même sans retour à vide :
 *
 *   approche → arrêt → engagement → prise → dégagement →
 *   transfert → arrêt → présentation → dépose → dégagement
 *
 * La translation et la levée sont **simultanées** dans l'approche et le transfert : ce sont deux
 * moteurs distincts sur une vraie machine, et les faire l'un après l'autre doublerait un temps que
 * personne ne perd. La durée du déplacement est donc le plus long des deux, pas leur somme.
 *
 * `level` est la hauteur du **plan des fourches quand elles s'engagent** : le dessous de l'alvéole,
 * ou le brin du tapis. La machine lève ensuite de quoi décoller la charge, et c'est ce petit
 * mouvement qui est la prise — sans lui, le colis et l'alvéole se traverseraient. Le tablier ne
 * descend pas plus bas que le châssis : un niveau trop bas est relevé jusque-là.
 *
 * Le cycle est **calculé, pas animé** : le composant sait dire la pose de la machine à n'importe
 * quelle fraction de tour, et le mouvement n'est que cette pose reprise image par image par le
 * navigateur. C'est ce qui fait qu'un arrêt sur image (`running={false}` et un `phase`) montre
 * exactement ce qui passe, et non une reconstitution.
 *
 * ## Les vitesses
 *
 * Une seule prop, et trois vitesses. Un transstockeur roule vite, lève plus lentement, et sort ses
 * fourches plus lentement encore : ce sont des rapports de la machine, pas des réglages. La vitesse
 * est en **cases par seconde** comme celle du tapis, pas en durée : à la même vitesse, un rail long
 * et un rail court vont à la même allure.
 *
 * ## L'ordre de peinture, et pourquoi il ne dépend plus du côté servi
 *
 * Tout ce qui monte est **entre les deux montants**. Le long de l'axe du rail, la machine se range
 * donc en tranches qui ne se chevauchent jamais — montant, tablier, montant — et leur ordre est
 * celui de la caméra le long de cet axe, quel que soit le côté où sortent les fourches. Dans le
 * tablier, tout est **empilé** : patins et chariot en bas, étages au-dessus, fourches, charge. Ce qui
 * est au-dessus se peint après, et une fourche qui sort vers le fond passe sur le chariot au lieu de
 * s'y couper.
 *
 * La version à un seul mât devait dessiner le tablier deux fois — un exemplaire derrière le mât, un
 * devant — et le chariot, peint entre les deux, recouvrait le pied des fourches qui sortaient vers
 * le fond : on les voyait tronquées. Le portique supprime la question au lieu d'y répondre.
 *
 * L'ordre se lit sur les axes **de la machine** et non sur des emprises au sol : dans un virage, la
 * machine tourne en continu, et les boîtes englobantes de ses pièces se chevaucheraient au premier
 * cap de biais. Le long de son propre axe, elles ne se chevauchent à aucun cap — et le sens où la
 * caméra les voit est exactement ce que `isoFacing` répond déjà pour les faces (`xFace`, `yFace`).
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
  /** Poser l'ombre de la machine sur le sol. */
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
  /**
   * Publie la silhouette des fourches et de leur charge comme un `<mask>` SVG portant cet `id`,
   * qui suit leurs trois mouvements. Sert à `RackV2` et sa prop `cover` : ce qui recouvre une
   * fourche entrée dans une alvéole est repeint par-dessus la machine, mais **seulement là** — le
   * reste de la machine, qui est devant l'étagère, n'est pas touché. Le masque est dans le repère de
   * la `viewBox` : les deux modules doivent partager un `frame`.
   */
  reachMask?: string;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** Ce que le tablier lève pour décoller la charge de son appui, en cases. Petit : c'est un
 *  mouvement de prise, pas une levée. */
const BITE = 0.2;

/** Le jeu entre deux pièces qui glissent l'une contre l'autre, en cases. Sans lui, deux faces
 *  confondues se disputent le même pixel et l'arête scintille. */
const PLAY = 0.03;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function Picker({
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
  load = "carton",
  speed = 1.6,
  dwell = 0.5,
  running = true,
  phase = 0,
  shadows = false,
  rotation = 0,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  reachMask,
  cellSize = 34,
  className,
}: PickerProps) {
  const cam = useIsoCamera();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const spanY = Math.max(0.6, width);
  const half = Math.max(0.5, chassisLength) / 2;
  const spanX = Math.max(half * 2, travel);
  const cy = spanY / 2;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return world(p.x + origin.x, p.y + origin.y, z);
  };
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };
  const facing = cam.facing(rotation);

  // ---- les cotes ----
  const wheelR = Math.max(0.06, wheelRadius);
  const wheelT = wheelR * 0.5;
  const axleZ = railTop + wheelR;
  // Le châssis part de l'axe : il est porté par les roues, qui tournent de part et d'autre.
  const deckZ0 = axleZ - wheelR * 0.25;
  const deckZ1 = deckZ0 + Math.max(0.1, chassisHeight);
  /** Le châssis tient **entre** les roues, qui sont sur les files. */
  const deckHalfY = Math.max(0.15, gauge / 2 - wheelT / 2 - PLAY);

  const mastX = Math.max(0.08, Math.min(mastSize, half / 3));
  const mastY = Math.min(spanY * 0.4, mastX * 1.7);
  const inset = 0.06;
  /** L'intérieur du portique : ce qui monte et descend tient entre ces deux abscisses. */
  const gap = half - inset - mastX;
  const mastZ1 = deckZ1 + Math.max(0.8, mastHeight);
  const headThick = 0.16;

  // Le tablier se dimensionne sur **l'emprise du module** et sur le portique : ce qu'il porte est un
  // colis, et un colis a la taille d'un colis.
  const shoe = 0.1;
  const carriageHalfX = gap - PLAY;
  const carriageDepth = Math.min(spanY * 0.6, deckHalfY * 2);
  const carriageThick = 0.16;
  /** L'étage intermédiaire. Sans lui, les fourches sorties sont deux barres qui flottent à côté de
   *  la machine : c'est la pièce qui les rattache à quelque chose. */
  const midThick = 0.08;
  const midHalfX = (carriageHalfX - shoe) * 0.86;
  const tineThick = 0.07;
  const tineWide = 0.13;
  const tineGap = (carriageHalfX - shoe) * 1.1;
  /** L'emprise de ce qui repose sur les fourches : l'écartement, plus un débord de chaque côté,
   *  sans toucher les patins. */
  const berth = Math.min(2 * (carriageHalfX - shoe) - PLAY, tineGap + spanY * 0.2);
  /** Ce qui se tient sous le plan des fourches : le chariot et l'étage. Le plan ne descend donc pas
   *  sous le châssis plus cette épaisseur. */
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

  /**
   * La longueur des deux étages télescopiques, fixée par la **course** et non par le chariot.
   *
   * Chaque étage parcourt la moitié du débattement par rapport à celui qui le porte. Trop courts,
   * ils se quittent : fourches sorties, il restait un vide entre le chariot et l'étage, puis entre
   * l'étage et les fourches, et on voyait des bras coupés flotter à côté de la machine. Il faut donc
   * que chaque étage recouvre encore celui du dessous en bout de course — d'au moins `GRIP` — ce qui
   * donne deux conditions, et on prend la plus exigeante. Rentrés, les étages débordent un peu du
   * chariot : c'est ce que fait un vrai tablier télescopique, dont les fourches sont plus longues que
   * l'allée n'est large.
   */
  const GRIP = 0.22;
  const stroke = Math.max(P.reach, D.reach);
  const stageLen = Math.max(carriageDepth, stroke / 2 + GRIP, stroke - carriageDepth + 2 * GRIP);
  const tineLen = stageLen;

  // Le dessin est fait une fois, au poste de prélèvement, fourches rentrées. Les `@keyframes` ne
  // disent que l'écart à cette position — ce qui n'est possible que parce que les trois mouvements
  // sont des translations, et que la caméra est affine.
  const xRef = P.x;
  const zRef = P.level;

  const sign = (s: PickerSide) => (s === "right" ? 1 : -1);
  const reachOn = (s: PickerSide) => Math.max(P.side === s ? P.reach : 0, D.side === s ? D.reach : 0);

  // ---- le cycle ----
  const vT = Math.max(0.05, speed);
  const vZ = vT / 2.4;
  const vF = vT / 4;
  const hold = Math.max(0, dwell);
  /** Translation et levée sont deux moteurs distincts : elles vont **ensemble**, donc la durée est
   *  le plus long des deux et non leur somme. */
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

  /** L'état de la machine à chaque temps du cycle. Le dernier rejoint le premier : la boucle se
   *  referme sur elle-même, il n'y a pas de retour à vide à cacher. `reach` est signé : négatif,
   *  les fourches sortent à gauche. */
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

  /** La charge est à bord de la prise au dégagement. Les temps 3 et 9 la laissent à zéro, ce qui
   *  donne les deux fondus : elle apparaît pendant la prise et s'efface pendant la dépose. */
  const aboard = (i: number) => (i >= 4 && i <= 8 ? 1 : 0);

  const zero = at(0, 0, 0);
  const shift = (dx: number, dy: number, dz: number) => {
    const p = at(dx, dy, dz);
    return `translate(${(p.x - zero.x).toFixed(3)}px,${(p.y - zero.y).toFixed(3)}px)`;
  };
  const pct = (t: number) => (t * 100).toFixed(3);

  // Un seul tablier, qui sort des deux côtés : le passage d'un côté à l'autre se fait fourches
  // rentrées, là où « à gauche » et « à droite » valent zéro tous les deux. Deux étages emboîtés
  // parcourent chacun la moitié du débattement, donc une seule piste sert aux deux.
  const frames: string[] = [
    `@keyframes lq-pk-run-${uid}{${times.map((t, i) => `${pct(t)}%{transform:${shift(states[i].x - xRef, 0, 0)}}`).join("")}}`,
    `@keyframes lq-pk-lift-${uid}{${times.map((t, i) => `${pct(t)}%{transform:${shift(0, 0, states[i].z - zRef)}}`).join("")}}`,
    `@keyframes lq-pk-fork-${uid}{${times.map((t, i) => `${pct(t)}%{transform:${shift(0, states[i].reach / 2, 0)}}`).join("")}}`,
    `@keyframes lq-pk-held-${uid}{${times.map((t, i) => `${pct(t)}%{opacity:${aboard(i)}}`).join("")}}`,
  ];

  /**
   * La pose de la machine à une fraction du cycle : les mêmes valeurs que l'animation, interpolées
   * à la main entre deux temps. C'est ce qu'on dessine quand rien ne bouge.
   */
  const poseAt = (t: number) => {
    const u = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < times.length - 2 && times[i + 1] <= u) i += 1;
    const a = states[i];
    const b = states[i + 1];
    const span = times[i + 1] - times[i];
    const k = span > 0 ? Math.min(1, Math.max(0, (u - times[i]) / span)) : 0;
    const mix = (from: number, to: number) => from + (to - from) * k;
    return { x: mix(a.x, b.x), z: mix(a.z, b.z), reach: mix(a.reach, b.reach), aboard: mix(aboard(i), aboard(i + 1)) };
  };
  const pose = poseAt(phase);

  /**
   * L'animation d'un groupe, et la pose où il se fige sans elle. La pose est posée en ligne **même
   * en marche** : une déclaration d'animation l'emporte sur une déclaration en ligne, donc elle ne
   * sert à rien tant que l'animation tourne — et elle est tout ce qui reste quand
   * `prefers-reduced-motion` la coupe.
   */
  const anim = (name: string, still: number, transform?: string): CSSProperties =>
    running
      ? { animationName: `lq-pk-${name}-${uid}`, animationDelay: `${(-cycle * phase).toFixed(3)}s`, opacity: still, transform }
      : { opacity: still, transform };

  // ---- les volumes ----
  const box = (material: string, key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    solidVolume(material, key, boxFaces(at, x0, x1, y0, y1, z0, z1, facing));

  /** Une roue, sur sa file : `isoWheel` la dessine ronde à toute rotation du sol. */
  const wheelAt = (x: number, railY: number, key: string) => isoWheel(at, x, railY, axleZ, wheelR, wheelT, facing, key);

  /** La profondeur d'un point du module vue de la caméra : x + y au sol, une fois tourné. */
  const depthOf = (x: number, y: number) => {
    const p = spin(x, y);
    return p.x + p.y;
  };
  /** Les roues d'une file, la plus lointaine d'abord. Les deux files sont de part et d'autre du
   *  châssis : celle du fond passe avant lui, celle de devant après — c'est `yFace` qui dit
   *  laquelle est laquelle. */
  const wheelRow = (railY: number) =>
    [-1, 1]
      .map((dx) => ({ x: xRef + dx * (half - wheelR * 1.3), y: railY }))
      .sort((a, b) => depthOf(a.x, a.y) - depthOf(b.x, b.y))
      .map((w, i) => wheelAt(w.x, w.y, `w${railY.toFixed(3)}${i}`));
  const farWheels = wheelRow(cy - (facing.yFace * gauge) / 2);
  const nearWheels = wheelRow(cy + (facing.yFace * gauge) / 2);

  const chassis = (
    <g key="chassis">
      {box("steel", "chassis", xRef - half, xRef + half, cy - deckHalfY, cy + deckHalfY, deckZ0, deckZ1)}
      {/* Les tampons, aux deux bouts : ce qui touche en premier en fin de course. */}
      {[-1, 1]
        .sort((a, b) => a * facing.xFace - b * facing.xFace)
        .map((k) => {
          const x0 = k < 0 ? xRef - half - 0.09 : xRef + half;
          return box("safety", `buffer${k}`, x0, x0 + 0.09, cy - deckHalfY * 0.45, cy + deckHalfY * 0.45, deckZ0 + 0.04, deckZ1 - 0.04);
        })}
    </g>
  );

  const mastAt = (k: -1 | 1) => {
    const x0 = k < 0 ? xRef - half + inset : xRef + gap;
    return box("steel", `mast${k}`, x0, x0 + mastX, cy - mastY / 2, cy + mastY / 2, deckZ1, mastZ1 - headThick);
  };
  const head = box("steel", "head", xRef - half + inset, xRef + half - inset, cy - mastY / 2, cy + mastY / 2, mastZ1 - headThick, mastZ1);

  /** L'armoire, contre le montant arrière, côté `+y` : hors du portique, donc hors de la course du
   *  tablier. Elle se range avec son montant — ils sont séparés en `y`, et c'est `yFace` qui dit
   *  lequel est devant. */
  const cabinetX0 = xRef - half + PLAY;
  const cabinetX1 = xRef - gap - PLAY;
  const cabinet =
    cabinetX1 - cabinetX0 > 0.08 ? box("cabinet", "cabinet", cabinetX0, cabinetX1, cy + mastY / 2 + PLAY, cy + deckHalfY - PLAY, deckZ1, deckZ1 + 0.7) : null;
  const rearMast = facing.yFace > 0 ? [mastAt(-1), cabinet] : [cabinet, mastAt(-1)];

  // ---- le tablier, de bas en haut ----
  const zCar0 = zRef - stack;
  const zCar1 = zCar0 + carriageThick;
  const zMid1 = zCar1 + midThick;
  const carriage = box("post", "carriage", xRef - carriageHalfX, xRef + carriageHalfX, cy - carriageDepth / 2, cy + carriageDepth / 2, zCar0, zCar1);
  /** Les patins, qui embrassent les montants et montent plus haut que le chariot : c'est eux qui
   *  disent que le tablier est guidé, et non posé en l'air. */
  const shoeAt = (k: -1 | 1) => {
    const x0 = k < 0 ? xRef - carriageHalfX : xRef + carriageHalfX - shoe;
    return box("post", `shoe${k}`, x0, x0 + shoe, cy - mastY * 0.62, cy + mastY * 0.62, zCar0, zMid1 + 0.3);
  };
  const [shoeFar, shoeNear] = facing.xFace > 0 ? [shoeAt(-1), shoeAt(1)] : [shoeAt(1), shoeAt(-1)];

  const middle = box("post", "mid", xRef - midHalfX, xRef + midHalfX, cy - stageLen / 2, cy + stageLen / 2, zCar1, zMid1);
  const tines = [-1, 1]
    .sort((a, b) => a * facing.xFace - b * facing.xFace)
    .map((k) => {
      const tx = xRef + (k * tineGap) / 2;
      return box("safety", `tine${k}`, tx - tineWide / 2, tx + tineWide / 2, cy - tineLen / 2, cy + tineLen / 2, zMid1, zRef);
    });

  const carried = load ? (
    <g className="lq-picker__held" style={anim("held", pose.aboard)}>
      {rackItemIso(load, fitRackItem(load, { x: xRef - berth / 2, y: cy - berth / 2, width: berth, depth: berth }, zRef, Infinity), at, facing, "load")}
    </g>
  ) : null;

  const reachPose = shift(0, pose.reach / 2, 0);
  const lift = (
    <g key="lift" className="lq-picker__lift" style={anim("lift", 1, shift(0, 0, pose.z - zRef))}>
      {carriage}
      {shoeFar}
      <g className="lq-picker__reach" style={anim("fork", 1, reachPose)}>
        {middle}
        <g className="lq-picker__reach" style={anim("fork", 1, reachPose)}>
          {tines}
          {carried}
        </g>
      </g>
      {shoeNear}
    </g>
  );

  /** La même chaîne de mouvements que la machine, réduite à ce qui entre dans une alvéole, en
   *  blanc : un masque. Mêmes animations, même départ, donc la même position à chaque image. */
  const mask = reachMask ? (
    <mask id={reachMask} maskUnits="userSpaceOnUse" x={-1e5} y={-1e5} width={2e5} height={2e5}>
      <g className="lq-picker__mask">
        <g className="lq-picker__travel" style={anim("run", 1, shift(pose.x - xRef, 0, 0))}>
          <g className="lq-picker__lift" style={anim("lift", 1, shift(0, 0, pose.z - zRef))}>
            <g className="lq-picker__reach" style={anim("fork", 1, reachPose)}>
              {middle}
              <g className="lq-picker__reach" style={anim("fork", 1, reachPose)}>
                {tines}
                {carried}
              </g>
            </g>
          </g>
        </g>
      </g>
    </mask>
  ) : null;

  // Le long de l'axe du rail, trois tranches qui ne se chevauchent jamais : montant arrière (avec
  // son armoire), tablier, montant avant. La caméra les voit dans l'ordre que `xFace` dit.
  const slices = [<g key="rear">{rearMast}</g>, lift, <g key="front">{mastAt(1)}</g>];
  if (facing.xFace < 0) slices.reverse();

  const machine = (
    <g className="lq-picker__travel" style={anim("run", 1, shift(pose.x - xRef, 0, 0))}>
      {farWheels}
      {chassis}
      {nearWheels}
      {slices}
      {head}
    </g>
  );

  /** L'ombre d'un volume posé au sol : son emprise balayée jusqu'à l'ombre de son sommet — les
   *  deux rectangles et tout ce qui les relie, c'est-à-dire leur enveloppe. */
  const sweep = (x0: number, x1: number, y0: number, y1: number, h: number, key: string) => {
    const foot = [onGround(x0, y0), onGround(x1, y0), onGround(x1, y1), onGround(x0, y1)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(hull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  const shade = shadows ? (
    <g className="lq-picker__travel" style={anim("run", 1, shift(pose.x - xRef, 0, 0))}>
      {sweep(xRef - half, xRef + half, cy - deckHalfY, cy + deckHalfY, deckZ1, "s-chassis")}
      {sweep(xRef - half + inset, xRef - gap, cy - mastY / 2, cy + mastY / 2, mastZ1, "s-rear")}
      {sweep(xRef + gap, xRef + half - inset, cy - mastY / 2, cy + mastY / 2, mastZ1, "s-front")}
      {/* La traverse est en l'air : son ombre est son emprise, poussée de toute sa hauteur, et c'est
          elle qui relie les ombres des deux montants en un portique. */}
      <polygon
        className="lq-iso__shadow"
        points={ring(
          [
            onGround(xRef - half + inset, cy - mastY / 2),
            onGround(xRef + half - inset, cy - mastY / 2),
            onGround(xRef + half - inset, cy + mastY / 2),
            onGround(xRef - half + inset, cy + mastY / 2),
          ].map((p) => world(p.x + cam.sun.x * mastZ1, p.y + cam.sun.y * mastZ1, 0))
        )}
      />
    </g>
  ) : null;

  // ---- le cadrage ----
  // L'emprise est celle du **balayage**, pas celle de la machine à l'arrêt : elle parcourt tout le
  // rail, ses fourches sortent des deux côtés et ses montants montent plus haut que tout le reste.
  const yLo = Math.min(0, cy - reachOn("left") - tineLen / 2);
  const yHi = Math.max(spanY, cy + reachOn("right") + tineLen / 2);
  const zHi = Math.max(mastZ1, P.level + BITE, D.level + BITE) + 0.3;
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, zHi].flatMap((z) =>
        [
          [-0.1, yLo],
          [spanX + 0.1, yLo],
          [spanX + 0.1, yHi],
          [-0.1, yHi],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-picker", !running && "lq-picker--stopped", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      style={{ "--lq-picker-cycle": `${cycle.toFixed(3)}s` } as CSSProperties}
      role="img"
      aria-label={`Picker sur rail${running ? ", en service" : ", à l'arrêt"}`}
    >
      {(running || mask) && (
        <defs>
          {running && <style>{frames.join("")}</style>}
          {mask}
        </defs>
      )}
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && machine}
    </svg>
  );
}
