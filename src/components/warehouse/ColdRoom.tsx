import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { addCondenser } from "./Roof";

/**
 * Chambre froide — une boîte de **panneaux sandwich** blancs posée dans l'entrepôt, qui garde le
 * froid.
 *
 * Ce qui la distingue d'une pièce ordinaire, ce sont les signes du froid, qu'on repère de loin :
 * des panneaux épais et lisses, joints marqués, sans poteau ni bardage ; une **porte à lanières**
 * sur un grand côté — des bandes de plastique translucide qu'un chariot traverse sans qu'on ouvre
 * rien ; un **sol givré**, bleuté, qu'on voit par la porte et, toit ôté, d'en haut ; un **voyant**
 * bleu au-dessus de la porte, qui dit que le groupe tourne. La **chambre négative** (surgelés) se
 * reconnaît à son bandeau bleu sombre et au givre qui gagne le bas des parois.
 *
 * Le repère : l'emprise va de `(0, 0)` à `(length, width)`, la porte est sur le grand côté
 * `y = 0` — le côté `−y` local. `ceiling` coiffe la boîte de son plafond blanc et du groupe
 * frigorifique qui le surmonte ; sans lui, on voit dedans.
 */

export type ColdRoomKind = "positive" | "negative";

export interface ColdRoomProps {
  kind?: ColdRoomKind;
  length?: number;
  width?: number;
  /** La hauteur des parois, en cases. */
  height?: number;
  /** Le plafond et son groupe froid. Sans lui, la chambre s'ouvre par le haut. */
  ceiling?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** L'épaisseur d'un panneau sandwich, et la largeur de la porte à lanières. */
const PANEL = 0.12;
const DOOR = 1.3;

function buildColdRoom({ kind = "positive", length = 6, width = 4, height = 1.6, ceiling = true }: ColdRoomProps) {
  const b = new Builder();
  const L = Math.max(2, length);
  const W = Math.max(2, width);
  const H = Math.max(1, height);
  const negative = kind === "negative";
  const t = PANEL;
  const doorH = Math.min(H - 0.25, 1.25);
  const d0 = L / 2 - DOOR / 2;
  const d1 = L / 2 + DOOR / 2;

  // La dalle isolée, un rien surélevée : c'est elle qui porte le sol givré.
  b.box("paint-light", 0, L, 0, W, 0, 0.05);
  b.faceZ("lq-cold__floor", 0.052, t, L - t, t, W - t);
  // Le givre du sol, en plaques plus claires : plus il fait froid, plus il y en a.
  const frost: [number, number, number, number][] = negative
    ? [
        [0.3, 0.3, 1.6, 1.0],
        [0.5, 0.55, 0.9, 1.2],
        [0.72, 0.25, 1.3, 0.8],
        [0.2, 0.75, 1.1, 0.7],
      ]
    : [
        [0.3, 0.35, 1.0, 0.6],
        [0.7, 0.7, 0.8, 0.5],
      ];
  for (const [fx, fy, fl, fw] of frost) {
    const cx = t + fx * (L - 2 * t);
    const cy = t + fy * (W - 2 * t);
    b.faceZ("lq-cold__frost", 0.054, Math.max(t, cx - fl / 2), Math.min(L - t, cx + fl / 2), Math.max(t, cy - fw / 2), Math.min(W - t, cy + fw / 2));
  }

  // Les parois : le fond, les deux pignons, et la façade percée de sa porte.
  b.box("paint-light", 0, L, W - t, W, 0.05, H);
  b.box("paint-light", 0, t, t, W - t, 0.05, H);
  b.box("paint-light", L - t, L, t, W - t, 0.05, H);
  b.box("paint-light", 0, d0, 0, t, 0.05, H);
  b.box("paint-light", d1, L, 0, t, 0.05, H);
  b.box("paint-light", d0, d1, 0, t, doorH, H);
  // Le dormant de la porte, en inox, et ses lanières translucides qui se chevauchent.
  b.box("steel", d0 - 0.05, d0, -0.03, t + 0.03, 0.05, doorH + 0.05);
  b.box("steel", d1, d1 + 0.05, -0.03, t + 0.03, 0.05, doorH + 0.05);
  b.box("steel", d0 - 0.05, d1 + 0.05, -0.03, t + 0.03, doorH, doorH + 0.06);
  const strips = 7;
  for (let i = 0; i < strips; i += 1) {
    const x0 = d0 + (DOOR * i) / strips - 0.01;
    const x1 = d0 + (DOOR * (i + 1)) / strips + 0.01;
    b.faceY("lq-cold__curtain", t / 2 + (i % 2 === 0 ? -0.01 : 0.01), x0, x1, 0.06, doorH - 0.01);
  }
  // Les joints des panneaux, un tous les mètres et demi, sur les faces qu'on voit.
  const joints: [P3, P3][] = [];
  for (let x = 0.75; x < L - 0.1; x += 0.75) {
    if (x < d0 - 0.05 || x > d1 + 0.05) joints.push([[x, -0.002, 0.06], [x, -0.002, H - 0.01]]);
    joints.push([[x, W + 0.002, 0.06], [x, W + 0.002, H - 0.01]]);
  }
  for (let y = 0.75; y < W - 0.1; y += 0.75) {
    joints.push([[-0.002, y, 0.06], [-0.002, y, H - 0.01]]);
    joints.push([[L + 0.002, y, 0.06], [L + 0.002, y, H - 0.01]]);
  }
  b.lines("lq-trailer__line", joints);

  // Le bandeau du haut : blanc sur une chambre positive, bleu sombre sur une négative ; et le givre
  // qui gagne le pied des parois d'une chambre négative.
  const band = negative ? "cold-band" : "paint-light";
  const bz0 = H - 0.12;
  b.box(band, -0.015, L + 0.015, -0.015, t, bz0, H, false);
  b.box(band, -0.015, L + 0.015, W - t, W + 0.015, bz0, H, false);
  b.box(band, -0.015, t, t, W - t, bz0, H, false);
  b.box(band, L - t, L + 0.015, t, W - t, bz0, H, false);
  if (negative) {
    b.faceY("lq-cold__frost", -0.018, 0.05, d0 - 0.08, 0.06, 0.26);
    b.faceY("lq-cold__frost", -0.018, d1 + 0.08, L - 0.05, 0.06, 0.22);
  }
  // Le voyant au-dessus de la porte, et le panneau qui dit la température.
  b.box("cold-lamp", L / 2 - 0.06, L / 2 + 0.06, -0.06, 0, doorH + 0.1, doorH + 0.2);
  b.faceY("lq-cold__sign", -0.004, d1 + 0.12, d1 + 0.5, doorH - 0.35, doorH - 0.1, true);

  if (ceiling) {
    // Le plafond isolé, blanc, et sur lui le groupe frigorifique qui fait le froid.
    b.box("paint-light", -0.02, L + 0.02, -0.02, W + 0.02, H, H + 0.08);
    const joints2: [P3, P3][] = [];
    for (let x = 0.75; x < L - 0.1; x += 0.75) joints2.push([[x, 0, H + 0.082], [x, W, H + 0.082]]);
    b.lines("lq-trailer__line", joints2);
    const n = negative ? 2 : 1;
    for (let i = 0; i < n; i += 1) addCondenser(b, L - 1.2 - i * 1.05, W - 0.8, H + 0.08, 0.9, 0.45, 0.35);
  }
  return b.build();
}

export function ColdRoom(props: ColdRoomProps) {
  const { length = 6, width = 4, height = 1.6, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: height + 0.6 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Chambre froide">
      <ColdRoomBody {...props} />
    </Solo>
  );
}

function ColdRoomBody(props: ColdRoomProps) {
  const { length = 6, width = 4, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const built = useBuilt(() => buildColdRoom(props), [props.kind, props.length, props.width, props.height, props.ceiling]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
