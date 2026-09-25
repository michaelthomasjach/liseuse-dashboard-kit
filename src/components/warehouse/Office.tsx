import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import "./Office.css";

/**
 * Des bureaux — **l'intérieur** d'un plateau de bureaux dans l'entrepôt : ce qu'on voit quand on
 * soulève le toit.
 *
 * Pas de murs : un jeu les trace lui-même (`wall`), avec ses fenêtres et sa porte. Le module ne pose
 * que ce qui fait un bureau : un **revêtement de sol** plus chaud que la dalle — une moquette, un
 * lino —, des **îlots de postes de travail** (deux bureaux face à face, deux de front), chacun avec
 * son écran et son fauteuil, des **plantes** dans les coins, une **imprimante** et une **armoire**. Au
 * plus abouti, une **salle de réunion** vitrée ferme un bout du plateau : une cloison de verre sur
 * montants, sa porte, une grande table et ses chaises.
 *
 * Le repère est celui de tous les modules : l'emprise va de `(0, 0)` à `(length, width)`, en
 * cases — un bureau fait 1,60 m sur 0,80 m, soit 0,8 case sur 0,4.
 */

export interface OfficeProps {
  /** Le nombre de postes de travail : 4 ou 8 (par îlots de quatre). */
  workstations?: number;
  /** Une salle de réunion vitrée à un bout du plateau. */
  meetingRoom?: boolean;
  length?: number;
  width?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Hauteurs, en cases : plateau de bureau (74 cm), assise (46 cm), dossier, écran. */
const DESK_Z = 0.37;
const SEAT_Z = 0.23;
const DESK_L = 0.8;
const DESK_W = 0.4;

/** Un fauteuil de bureau, tourné vers `+y` (`dir = 1`) ou `−y`, centré en `(x, y)`. */
function chair(b: Builder, x: number, y: number, dir: 1 | -1) {
  // Le piètement en étoile, réduit à un disque, le vérin, l'assise et le dossier.
  b.cylinder("office-chair", x, y, 0.015, 0.14, 0.03, "z", 10);
  b.cylinder("steel", x, y, SEAT_Z / 2, 0.02, SEAT_Z - 0.03, "z", 6);
  b.box("office-chair", x - 0.13, x + 0.13, y - 0.12, y + 0.12, SEAT_Z - 0.03, SEAT_Z + 0.02);
  const by = y - dir * 0.12;
  b.box("office-chair", x - 0.12, x + 0.12, Math.min(by, by - dir * 0.04), Math.max(by, by - dir * 0.04), SEAT_Z + 0.02, SEAT_Z + 0.3);
}

/** Un bureau et son poste : le plateau sur deux pieds, l'écran et le clavier, le fauteuil. `dir` : le
 *  côté du fauteuil (le poste regarde vers `−dir`). */
function workstation(b: Builder, x: number, y: number, dir: 1 | -1) {
  const x0 = x - DESK_L / 2 + 0.02;
  const x1 = x + DESK_L / 2 - 0.02;
  const y0 = y - DESK_W / 2 + 0.01;
  const y1 = y + DESK_W / 2 - 0.01;
  b.box("office-desk", x0, x1, y0, y1, DESK_Z - 0.025, DESK_Z);
  for (const lx of [x0 + 0.03, x1 - 0.05]) b.box("steel", lx, lx + 0.02, y0 + 0.03, y1 - 0.03, 0, DESK_Z - 0.025, false);
  // L'écran, au fond du bureau, face au fauteuil.
  const sy = y - dir * (DESK_W / 2 - 0.07);
  b.box("paint-dark", x - 0.02, x + 0.02, sy - 0.015, sy + 0.015, DESK_Z, DESK_Z + 0.08, false);
  b.box("paint-dark", x - 0.15, x + 0.15, sy - 0.012, sy + 0.012, DESK_Z + 0.06, DESK_Z + 0.22);
  b.faceY("lq-office__screen", sy + dir * 0.013, x - 0.135, x + 0.135, DESK_Z + 0.075, DESK_Z + 0.205);
  // Le clavier.
  b.box("paint-light", x - 0.1, x + 0.1, y + dir * 0.03 - 0.03, y + dir * 0.03 + 0.03, DESK_Z, DESK_Z + 0.01, false);
  chair(b, x, y + dir * (DESK_W / 2 + 0.16), dir);
}

/** Un îlot de quatre postes : deux bureaux de front, deux face à face, centré en `(cx, cy)`. */
function island(b: Builder, cx: number, cy: number) {
  for (const dx of [-DESK_L / 2, DESK_L / 2])
    for (const dir of [-1, 1] as const) workstation(b, cx + dx, cy + dir * (DESK_W / 2), dir);
  // La cloison basse entre les deux rangées, pour l'acoustique.
  b.box("office-panel", cx - DESK_L + 0.02, cx + DESK_L - 0.02, cy - 0.015, cy + 0.015, DESK_Z, DESK_Z + 0.18);
}

/** Une plante en pot. */
function plant(b: Builder, x: number, y: number, h = 0.5) {
  b.cylinder("office-pot", x, y, 0.1, 0.1, 0.2, "z", 10, 0.08);
  b.blob("foliage", x, y, 0.2 + h * 0.45, h * 0.32, 1, 1.3);
  b.blob("foliage-dark", x + 0.05, y - 0.04, 0.2 + h * 0.75, h * 0.2, 1, 1.2);
}

function buildOffice({ workstations = 4, meetingRoom = false, length = 8, width = 4 }: OfficeProps) {
  const b = new Builder();
  const L = Math.max(3, length);
  const W = Math.max(2, width);
  // Le revêtement de sol, un rien au-dessus de la dalle, et sa bordure.
  b.box("office-floor", 0.02, L - 0.02, 0.02, W - 0.02, 0, 0.015, false);
  const room = meetingRoom ? Math.min(3, L * 0.38) : 0;
  const open = L - room;
  // Les îlots, régulièrement répartis sur la partie ouverte.
  const n = Math.max(1, Math.round(Math.max(1, workstations) / 4));
  const cy = W / 2;
  const span = open - 1.4;
  for (let i = 0; i < n; i += 1) {
    const cx = 0.7 + (span * (i + 0.5)) / n;
    island(b, cx, cy);
  }
  // Le mobilier des bords : une armoire basse et l'imprimante le long du mur du fond, des plantes
  // dans les coins.
  b.box("office-desk", 0.15, 1.05, W - 0.32, W - 0.08, 0, 0.45);
  b.faceY("lq-office__panel", W - 0.321, 0.2, 1.0, 0.05, 0.4);
  const px = open - 0.55;
  b.box("paint-light", px - 0.18, px + 0.18, W - 0.36, W - 0.08, 0, 0.3);
  b.box("paint-dark", px - 0.16, px + 0.16, W - 0.34, W - 0.1, 0.3, 0.33, false);
  b.faceY("lq-office__screen", W - 0.362, px - 0.1, px + 0.02, 0.2, 0.26);
  plant(b, 0.22, 0.22, 0.55);
  plant(b, open - 0.25, 0.22, 0.45);
  if (!meetingRoom) plant(b, L - 0.25, W - 0.25, 0.6);

  if (meetingRoom) {
    // La salle de réunion : une cloison vitrée sur montants, en travers du plateau, percée de sa
    // porte ; une grande table et ses chaises.
    const gx = L - room;
    const H = 1.25;
    const door0 = 0.35;
    const door1 = 0.85;
    const posts = [0.02, door0, door1, W / 2 + 0.4, W - 0.02];
    for (const y of posts) b.box("steel", gx - 0.025, gx + 0.025, y - 0.02, y + 0.02, 0, H);
    b.box("steel", gx - 0.03, gx + 0.03, 0.02, W - 0.02, H - 0.04, H);
    for (let k = 0; k < posts.length - 1; k += 1) {
      if (k === 1) continue;
      b.faceX("lq-office__glass", gx, posts[k] + 0.02, posts[k + 1] - 0.02, 0.02, H - 0.04, true);
    }
    // La porte vitrée, entrouverte.
    b.faceY("lq-office__glass", door0 + 0.02, gx + 0.03, gx + 0.43, 0.02, H - 0.06, true);
    // Une bande dépolie à hauteur d'yeux, qui fait lire le verre.
    b.faceX("lq-office__frost", gx + 0.004, 0.04, W - 0.04, 0.55, 0.62);
    const tx = gx + room / 2;
    const tl = Math.min(1.8, room - 0.9);
    b.box("office-desk", tx - tl / 2, tx + tl / 2, cy - 0.4, cy + 0.4, DESK_Z - 0.03, DESK_Z);
    b.box("steel", tx - 0.05, tx + 0.05, cy - 0.3, cy + 0.3, 0, DESK_Z - 0.03, false);
    const seats = Math.max(2, Math.floor(tl / 0.5));
    for (let i = 0; i < seats; i += 1) {
      const x = tx - tl / 2 + (tl * (i + 0.5)) / seats;
      chair(b, x, cy - 0.62, -1);
      chair(b, x, cy + 0.62, 1);
    }
    // L'écran mural du fond de salle.
    b.box("paint-dark", L - 0.08, L - 0.03, cy - 0.45, cy + 0.45, 0.45, 0.95);
    b.faceX("lq-office__screen", L - 0.082, cy - 0.42, cy + 0.42, 0.48, 0.92);
    plant(b, L - 0.25, 0.25, 0.5);
  }
  // Les joints du revêtement, en grands lés.
  const seams: [P3, P3][] = [];
  for (let x = 1; x < L - 0.1; x += 1) seams.push([[x, 0.02, 0.017], [x, W - 0.02, 0.017]]);
  b.lines("lq-office__seam", seams);
  return b.build();
}

/** Des bureaux : un plateau de postes de travail, et au plus abouti sa salle de réunion vitrée. */
export function Office(props: OfficeProps) {
  const { length = 8, width = 4, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1.4 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Bureaux">
      <OfficeBody {...props} />
    </Solo>
  );
}

function OfficeBody(props: OfficeProps) {
  const { length = 8, width = 4, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const built = useBuilt(() => buildOffice(props), [props.workstations, props.meetingRoom, props.length, props.width]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
