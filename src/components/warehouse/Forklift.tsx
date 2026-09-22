import { useId, type CSSProperties, type ReactNode } from "react";
import {
  boxFaces,
  castShadow,
  prismVolume,
  roundedRing,
  spunProject,
  frameCorners,
  convexHull,
  fitRackItem,
  isoWheel,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./Forklift.css";

/**
 * Chariot élévateur — un contrepoids, un poste de conduite sous son toit de protection, un mât, des
 * fourches.
 *
 * Même vocabulaire que l'étagère et le picker (`rackItems.tsx`) : des volumes alignés sur les axes,
 * trois faces, trois clartés d'une seule lumière, faces visibles choisies d'après la rotation, et les
 * **mêmes roues rondes** (`isoWheel`).
 *
 * ## Les pièces, et pourquoi chacune est là
 *
 * Le **contrepoids** à l'arrière : c'est lui qui fait qu'un chariot porte une palette en porte-à-faux
 * sans basculer, et c'est la masse qui le distingue d'un transpalette à main. Le **toit de
 * protection** sur ses quatre montants : ce qui tombe d'un rayonnage tombe sur lui. Le **mât** à
 * l'avant, deux montants et un vérin entre eux, et devant lui le **tablier** et ses deux fourches, qui
 * montent et descendent — c'est la seule chose que la machine fait sans rouler. Les roues avant sont
 * plus grandes que les arrière : ce sont elles qui portent la charge.
 *
 * ## L'ordre de peinture
 *
 * Le chariot se range en **tranches le long de sa longueur** qui ne se chevauchent jamais — le
 * contrepoids, le poste, le mât, les fourches — et leur ordre est celui où la caméra les voit le long
 * de cet axe, ce que `xFace` dit déjà. Dans une tranche, ce qui est à gauche et à droite se range
 * par `yFace` : la roue du fond avant la caisse, celle de devant après ; les montants du fond du toit
 * avant le siège, ceux de devant après, et le toit par-dessus tout. Lu sur les axes du chariot et non
 * sur des emprises au sol, cet ordre tient à tout cap — un chariot qui tourne n'a pas d'emprises
 * alignées sur les axes du monde.
 *
 * ## La levée
 *
 * Le tablier monte par une **translation**, qui reste une translation à l'écran sous cette caméra
 * affine : un seul `translate()` sur un groupe, et des `@keyframes` qui disent de combien. À
 * l'arrêt, les fourches sont à `lift` ; en marche, elles montent jusque-là et redescendent, avec un
 * palier en haut — le temps de poser ou de prendre.
 */

export interface ForkliftProps {
  /** Hauteur des fourches au-dessus du sol, en cases. En marche, le haut de leur course. */
  lift?: number;
  /** Hauteur du mât, en cases. */
  mastHeight?: number;
  /** Ce qu'il porte : une palette, chargée ou non. `null` : fourches vides. */
  load?: RackItemKind | null;
  /** Les fourches montent et descendent. */
  running?: boolean;
  /** Durée d'un aller-retour des fourches, en secondes. */
  cycle?: number;
  /** Rotation sur le sol, en degrés. À 0, les fourches regardent vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le chariot sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le chariot seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** L'emprise du chariot, en cases : longueur fourches comprises, largeur. */
const LENGTH = 2.7;
const WIDTH = 1;

/** Le bas de la course des fourches : juste au-dessus du sol, pour glisser sous une palette. */
const FLOOR = 0.05;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function Forklift({
  lift = 1.2,
  mastHeight = 2.1,
  load = "carton",
  running = false,
  cycle = 5,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 40,
  className,
}: ForkliftProps) {
  const cam = useIsoCamera();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const mastTop = Math.max(1.2, mastHeight);
  const top = Math.max(FLOOR, Math.min(lift, mastTop - 0.55));

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

  const box = (material: string, key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    solidVolume(material, key, boxFaces(at, x0, x1, y0, y1, z0, z1, facing));
  // La caméra ramenée dans le repère du chariot : c'est là que sont les contours arrondis, et c'est
  // donc là qu'il faut savoir d'où l'on regarde pour dire quelles facettes se voient.
  const localView = { x: cam.view.x * cosT + cam.view.y * sinT, y: -cam.view.x * sinT + cam.view.y * cosT };
  const prism = (material: string, key: string, ground: Point[], z0: number, z1: number) =>
    prismVolume(material, key, at, ground, z0, z1, facing, localView);
  /** Du fond vers l'avant, le long de `y` : c'est `yFace` qui dit lequel des deux bords est devant. */
  const acrossY = (items: { y: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.y - b.y) * facing.yFace).map((it) => it.node);
  /** Et le long de `x`. */
  const alongX = (items: { x: number; node: ReactNode }[]) =>
    [...items].sort((a, b) => (a.x - b.x) * facing.xFace).map((it) => it.node);

  // ---- les cotes ----
  const bodyY0 = 0.08;
  const bodyY1 = WIDTH - 0.08;
  const rearR = 0.17;
  const frontR = 0.22;
  const tyre = 0.14;
  const wheelY = [0.07, WIDTH - 0.07];
  const deck = 0.5;
  const roofZ = 1.55;
  const pillar = 0.06;

  // ---- l'arrière : le contrepoids et ses roues ----
  const rear = (
    <g key="rear">
      {acrossY([
        { y: wheelY[0], node: isoWheel(at, 0.26, wheelY[0], rearR, rearR, tyre, facing, "rw0") },
        {
          y: WIDTH / 2,
          node: (
            <g key="counterweight">
              {/* Le contrepoids : une fonte moulée, pas une caisse. Ses angles abattus sont ce qui
                  le distingue d'un bloc posé à l'arrière. */}
              {prism("safety", "counterweight", roundedRing(0, 0.46, bodyY0, bodyY1, 0.1, 3), 0.1, 0.8)}
              {prism("safety", "counterweight-top", roundedRing(0.03, 0.46, bodyY0 + 0.03, bodyY1 - 0.03, 0.09, 3), 0.8, 0.86)}
            </g>
          ),
        },
        { y: wheelY[1], node: isoWheel(at, 0.26, wheelY[1], rearR, rearR, tyre, facing, "rw1") },
      ])}
    </g>
  );

  // ---- le poste : la caisse, le siège, le tableau de bord, le toit ----
  const pillars = (y0: number) =>
    alongX(
      [0.47, 1.37].map((x0) => ({
        x: x0,
        node: box("iron", `pillar${x0}${y0}`, x0, x0 + pillar, y0, y0 + pillar, deck, roofZ),
      }))
    );
  const seat = alongX([
    {
      x: 0.5,
      node: (
        <g key="seat">
          {/* Un dossier et une assise, aux angles abattus : à cette taille, deux caisses droites se
              lisent comme un carton posé sur le capot. */}
          {prism("iron", "backrest", roundedRing(0.5, 0.6, 0.3, 0.7, 0.05, 2), deck + 0.16, deck + 0.54)}
          {prism("iron", "seat", roundedRing(0.58, 0.9, 0.3, 0.7, 0.07, 2), deck, deck + 0.16)}
        </g>
      ),
    },
    {
      x: 1.2,
      node: (
        <g key="dash">
          {prism("safety", "dash", roundedRing(1.2, 1.45, 0.16, 0.84, 0.09, 3), deck, deck + 0.28)}
          {box("iron", "column", 1.14, 1.2, 0.47, 0.53, deck + 0.26, deck + 0.46)}
          {/* Le volant : un disque **en travers de la marche**, comme sur la machine — on le tient
              de part et d'autre, pas dans l'axe. `spunProject` tourne le projecteur d'un quart de
              tour autour de son centre plutôt que de tourner le disque, qui ne saurait pas l'être. */}
          {(() => {
            const spun = spunProject(at, 90, 1.08, WIDTH / 2, rotation);
            return isoWheel(spun.project, 1.08, WIDTH / 2, deck + 0.5, 0.11, 0.03, spun.facing, "steering");
          })()}
        </g>
      ),
    },
  ]);
  const cab = (
    <g key="cab">
      {acrossY([
        { y: wheelY[0], node: isoWheel(at, 1.18, wheelY[0], frontR, frontR, tyre, facing, "fw0") },
        {
          y: WIDTH / 2,
          node: (
            <g key="cabin">
              {prism("safety", "body", roundedRing(0.45, 1.46, bodyY0, bodyY1, 0.12, 3), 0.12, deck)}
              {acrossY([
                { y: bodyY0, node: <g key="pf">{pillars(bodyY0 + 0.02)}</g> },
                { y: WIDTH / 2, node: <g key="seatdash">{seat}</g> },
                { y: bodyY1, node: <g key="pn">{pillars(bodyY1 - 0.02 - pillar)}</g> },
              ])}
              {/* Le toit de protection est une **grille**, pas une tôle : c'est ce qui laisse voir
                  le poste de conduite au travers, et c'est aussi ce qu'il est — des barreaux assez
                  serrés pour arrêter un colis, assez écartés pour qu'on voie le mât. */}
              <g key="roof">
                {acrossY(
                  [bodyY0, bodyY1 - 0.07].map((y) => ({
                    y,
                    node: box("iron", `rail${y}`, 0.44, 1.48, y, y + 0.07, roofZ, roofZ + 0.05),
                  }))
                )}
                {alongX(
                  [0.52, 0.76, 1.0, 1.24].map((x) => ({
                    x,
                    node: box("iron", `bar${x}`, x, x + 0.05, bodyY0 + 0.07, bodyY1 - 0.07, roofZ + 0.01, roofZ + 0.04),
                  }))
                )}
              </g>
            </g>
          ),
        },
        { y: wheelY[1], node: isoWheel(at, 1.18, wheelY[1], frontR, frontR, tyre, facing, "fw1") },
      ])}
    </g>
  );

  // ---- le mât ----
  const mast = (
    <g key="mast">
      {acrossY([
        { y: 0.19, node: box("iron", "upright0", 1.48, 1.58, 0.14, 0.24, 0.1, mastTop) },
        { y: 0.5, node: box("steel", "cylinder", 1.5, 1.56, 0.46, 0.54, 0.1, mastTop * 0.62) },
        { y: 0.81, node: box("iron", "upright1", 1.48, 1.58, 0.76, 0.86, 0.1, mastTop) },
      ])}
      {box("iron", "crossbar", 1.48, 1.58, 0.14, 0.86, mastTop - 0.08, mastTop)}
    </g>
  );

  // ---- le tablier et les fourches, dessinés à la hauteur la plus basse ----
  const tineTop = FLOOR + 0.05;
  const carried = (() => {
    if (!load) return null;
    const slot = { x: 1.72, y: bodyY0, width: 0.9, depth: bodyY1 - bodyY0 };
    const pallet = fitRackItem("palette", slot, tineTop, Infinity);
    const nodes: ReactNode[] = [rackItemIso("palette", pallet, at, facing, "pallet")];
    if (load !== "palette") {
      const goods = fitRackItem(load, { ...slot, x: slot.x + 0.04, width: slot.width - 0.08 }, tineTop + pallet.height, Infinity);
      nodes.push(rackItemIso(load, goods, at, facing, "goods"));
    }
    return nodes;
  })();

  const zero = at(0, 0, 0);
  const rise = (dz: number) => {
    const p = at(0, 0, dz);
    return `translate(${(p.x - zero.x).toFixed(3)}px,${(p.y - zero.y).toFixed(3)}px)`;
  };
  const forks = (
    <g
      key="forks"
      className={running ? "lq-forklift__lift lq-forklift__lift--running" : "lq-forklift__lift"}
      style={
        {
          transform: rise(top - FLOOR),
          ...(running ? { animationName: `lq-fl-lift-${uid}`, animationDuration: `${Math.max(1, cycle)}s` } : {}),
        } as CSSProperties
      }
    >
      {box("iron", "carriage", 1.6, 1.66, 0.1, 0.9, FLOOR, FLOOR + 0.5)}
      {/* Le dosseret : la grille contre laquelle la charge s'appuie. Sans lui, une palette haute
          bascule sur le conducteur, et un chariot sans dosseret ne se lit pas comme un chariot. */}
      {alongX(
        [0.14, 0.38, 0.62, 0.86].map((y) => ({
          x: y,
          node: box("iron", `back${y}`, 1.6, 1.64, y, y + 0.05, FLOOR + 0.5, FLOOR + 1.05),
        }))
      )}
      {box("iron", "back-top", 1.6, 1.64, 0.1, 0.9, FLOOR + 1.0, FLOOR + 1.05)}
      {acrossY(
        [0.29, 0.71].map((y) => ({
          y,
          node: box("iron", `tine${y}`, 1.66, 2.65, y - 0.05, y + 0.05, FLOOR, tineTop),
        }))
      )}
      {carried}
    </g>
  );

  const slices = alongX([
    { x: 0, node: rear },
    { x: 0.45, node: cab },
    { x: 1.48, node: mast },
    { x: 1.6, node: forks },
  ]);

  // ---- l'ombre ----
  /** Une emprise balayée jusqu'à l'ombre de son sommet : les deux rectangles et ce qui les relie. */
  const sweep = (x0: number, x1: number, y0: number, y1: number, h: number, key: string) => {
    const foot = [onGround(x0, y0), onGround(x1, y0), onGround(x1, y1), onGround(x0, y1)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  const shade = shadows ? (
    <g>
      {sweep(0, 1.45, bodyY0, bodyY1, 0.86, "s-body")}
      {castShadow(world, [onGround(0.44, bodyY0), onGround(1.46, bodyY0), onGround(1.46, bodyY1), onGround(0.44, bodyY1)], roofZ, "s-roof", cam.sun)}
      {sweep(1.48, 1.58, 0.14, 0.86, mastTop, "s-mast")}
    </g>
  ) : null;

  // ---- le cadrage ----
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, mastTop + 0.2].flatMap((z) =>
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

  const keyframes = running
    ? `@keyframes lq-fl-lift-${uid}{0%,100%{transform:${rise(0)}}40%,60%{transform:${rise(top - FLOOR)}}}`
    : "";

  return (
    <svg
      className={["lq-forklift", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label="Chariot élévateur"
    >
      {running && (
        <defs>
          <style>{keyframes}</style>
        </defs>
      )}
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && slices}
    </svg>
  );
}
