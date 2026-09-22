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
  /** Longueur de la remorque, en cases. */
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
const WIDTH = 1.3;
/** Le congé du toit de la cabine : son rayon, et en combien de couches on le monte. */
const ROOF_R = 0.16;
const ROOF_STEPS = 4;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function SemiTruck({
  trailerLength = 7.6,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: SemiTruckProps) {
  const cam = useIsoCamera();
  // ---- les cotes, en cases, le long du camion ----
  const T = Math.max(3, trailerLength);
  const kingpin = T - 0.9; // où la remorque repose sur le tracteur
  const tractor0 = kingpin - 0.9; // l'arrière du tracteur
  const cab0 = T + 0.22; // l'arrière de la cabine, juste devant la remorque
  const cab1 = cab0 + 1.5; // le nez du camion
  const LENGTH = cab1 + 0.1; // le pare-chocs

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

  const r = 0.26;
  const tyre = 0.2;
  const sideY = [tyre / 2 + 0.01, WIDTH - tyre / 2 - 0.01];
  // L'essieu directeur est **sous la cabine** — c'est ce qui fait une cabine avancée — et les deux
  // essieux moteurs sont derrière elle, sous le nez de la remorque.
  const axles = [0.9, 1.5, 2.1, tractor0 + 0.35, tractor0 + 0.95, cab1 - 0.45];
  const beamY0 = 0.38;
  const beamY1 = WIDTH - 0.38;
  const trailerZ0 = 0.78;
  const trailerZ1 = 2.35;
  const cabZ0 = 0.5;
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
  const beltZ = 1.28;
  const cabZ1 = 1.98;
  const roofZ = cabZ1 + ROOF_R;
  /** Le déflecteur monte à hauteur de caisse : c'est à ça qu'il sert, coucher le filet d'air
   *  par-dessus la remorque au lieu de le laisser taper dedans. */
  const deflectorZ = trailerZ1 - 0.02;
  /** De combien le haut de la cabine est en retrait du nez : la pente du pare-brise. */
  const WINDSHIELD = 0.26;

  const wheelRow = (y: number) => (
    <g key={`wheels${y}`}>
      {alongX(axles.map((x, i) => ({ x, node: isoWheel(at, x, y, r, r, tyre, facing, `w${i}${y}`) })))}
    </g>
  );

  // ---- sous la caisse ----
  const under = (
    <g key="under">
      {acrossY([
        { y: sideY[0], node: wheelRow(sideY[0]) },
        {
          y: WIDTH / 2,
          node: (
            <g key="frame">
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

  /**
   * Le pare-brise : un pan **incliné**, du haut du capot au haut du pavillon. C'est la seule
   * surface oblique de la cabine, et c'est elle qui donne au camion son nez — un vitrage vertical,
   * si grand soit-il, laisse une armoire.
   */
  const windshield = front ? (
    <polygon
      className="lq-truck__glass"
      points={ring([
        at(cab1 - WINDSHIELD, 0.13, cabZ1 - 0.06),
        at(cab1 - WINDSHIELD, WIDTH - 0.13, cabZ1 - 0.06),
        at(cab1 - 0.01, WIDTH - 0.13, beltZ + 0.04),
        at(cab1 - 0.01, 0.13, beltZ + 0.04),
      ])}
    />
  ) : null;

  /** Le bas de la face avant : la calandre, deux feux, et rien d'autre. Sur un camion clair, la
   *  calandre est une bande sombre au milieu d'une tôle claire, pas un panneau plein. */
  const nose = front ? (
    <g>
      <polygon className="lq-truck__panel" points={frontFace(cab1 + 0.01, 0.26, WIDTH - 0.26, 0.86, 1.14)} />
      <g className="lq-truck__grille">
        {[0.94, 1.06].map((z) => {
          const a = at(cab1 + 0.02, 0.3, z);
          const b = at(cab1 + 0.02, WIDTH - 0.3, z);
          return <line key={z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, 0.1, 0.26, 0.62, 0.78)} />
      <polygon className="lq-truck__lamp" points={frontFace(cab1 + 0.01, WIDTH - 0.26, WIDTH - 0.1, 0.62, 0.78)} />
    </g>
  ) : null;

  /** La joue : la vitre de portière, et la portière elle-même. */
  const flank = (
    <g className="lq-truck__glass-side">
      <polygon
        className="lq-truck__glass"
        points={ring([
          at(cab1 - WINDSHIELD - 0.5, sideY1, beltZ + 0.1),
          at(cab1 - WINDSHIELD - 0.06, sideY1, beltZ + 0.1),
          at(cab1 - WINDSHIELD - 0.06, sideY1, cabZ1 - 0.12),
          at(cab1 - WINDSHIELD - 0.5, sideY1, cabZ1 - 0.12),
        ])}
      />
      <g className="lq-truck__door">
        {[cab1 - WINDSHIELD - 0.58, cab0 + 0.2].map((x) => {
          const a = at(x, sideY1, cabZ0 + 0.04);
          const b = at(x, sideY1, cabZ1 - 0.08);
          return <line key={x} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
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
        ],
        (
          <>
            {flank}
            {nose}
            {windshield}
          </>
        )
      )}
      {/* Le déflecteur : il part du toit et monte à hauteur de caisse, rentré de tous les côtés
          pour rester un accessoire posé dessus et non une rehausse de la cabine. */}
      {stack("cab", "deflector", [
        { ring: roundedRing(cab0 + 0.04, cab1 - WINDSHIELD - 0.03, 0.05, WIDTH - 0.05, 0.2, 3), z0: roofZ - 0.06, z1: deflectorZ - 0.05 },
        ...filletLayers(
          (d) => roundedRing(cab0 + 0.04 + d, cab1 - WINDSHIELD - 0.03 - d, 0.05 + d, WIDTH - 0.05 - d, 0.2, 3),
          deflectorZ - 0.05,
          0.05,
          2
        ),
      ])}
    </g>
  );

  /** Les rétroviseurs : une glace et le bras court qui la tient, de chaque côté du pare-brise. */
  const mirrors = (
    <g key="mirrors">
      {acrossY(
        [
          { y: -0.1, arm: [-0.06, 0.06] as const },
          { y: WIDTH + 0.02, arm: [WIDTH - 0.06, WIDTH + 0.06] as const },
        ].map((m) => ({
          y: m.y,
          node: (
            <g key={`mirror${m.y}`}>
              {prism("cab", `arm${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.1, cab1 - WINDSHIELD - 0.07, m.arm[0], m.arm[1], 0.014), cabZ1 - 0.16, cabZ1 - 0.12)}
              {prism("cab", `mirror${m.y}`, roundedRing(cab1 - WINDSHIELD - 0.11, cab1 - WINDSHIELD - 0.07, m.y, m.y + 0.08, 0.02), beltZ + 0.12, cabZ1 - 0.14)}
            </g>
          ),
        }))
      )}
    </g>
  );

  /** Le pare-chocs, et le bas de caisse entre les roues : ce qui pose la cabine sur le sol au lieu
   *  de la laisser flotter au-dessus. */
  const bumper = prism("cab", "bumper", roundedRing(cab1 - 0.02, cab1 + 0.1, 0.03, WIDTH - 0.03, 0.1), 0.26, 0.64);
  const skirt = prism("cab", "skirt", roundedRing(cab0 + 0.04, cab1 - 0.72, 0.08, WIDTH - 0.08, 0.1), 0.28, cabZ0 + 0.02);

  const above = alongX([
    { x: 0, node: trailer },
    { x: cab0, node: <g key="skirt">{skirt}</g> },
    { x: cab0 + 0.01, node: cab },
    { x: cab1 - WINDSHIELD - 0.11, node: mirrors },
    { x: cab1, node: <g key="bumper">{bumper}</g> },
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
