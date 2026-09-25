import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { SolarArray, solarArraySize } from "./SolarPanel";
import { addCondenser } from "./Roof";

/**
 * Ce qu'on installe **sur un toit** : un champ de panneaux, des groupes de climatisation.
 *
 * Un toit équipé ne se lit pas comme un objet posé en l'air : il faut qu'on y voie **un morceau de
 * toiture**. Chaque équipement repose donc sur une **dalle** mince, un rien plus grande que lui,
 * du gris clair d'un bac acier — c'est elle qui dit « ceci est sur le toit », même quand le toit
 * lui-même est masqué ou qu'il n'a pas encore été tracé. Le repère est celui de tous les modules :
 * l'emprise va de `(0, 0)` à `(length, width)`, et `height` est la hauteur du toit — celle de
 * l'acrotère, où la dalle est posée.
 */

/** L'épaisseur de la dalle sous un équipement de toiture, et ce qu'elle déborde tout autour. */
const PAD = 0.06;
const MARGIN = 0.12;

/** La dalle : un bac acier clair, ses nervures. */
function addPad(b: Builder, length: number, width: number, z: number) {
  b.box("roof-pad", -MARGIN, length + MARGIN, -MARGIN, width + MARGIN, z, z + PAD);
  const ribs: [[number, number, number], [number, number, number]][] = [];
  for (let x = 0.3; x < length; x += 0.3) ribs.push([[x, -MARGIN + 0.02, z + PAD + 0.002], [x, width + MARGIN - 0.02, z + PAD + 0.002]]);
  b.lines("lq-trailer__line", ribs);
}

/**
 * La charpente d'un équipement **qui n'a pas de toit sous lui** : une plate-forme technique en acier.
 *
 *  Un champ de panneaux ou un groupe froid posé là où il n'y a ni toiture ni chambre froide ne doit
 *  pas flotter. On le hisse donc sur une ossature légère : des poteaux aux quatre coins de la dalle et
 *  tous les trois mètres au plus le long de ses bords, chacun sur sa platine ; une ceinture de
 *  poutrelles sous la dalle ; et des croix de contreventement entre les poteaux, sur les quatre
 *  faces — ce qui se lit, de loin, comme un auvent ou une passerelle technique.
 */
export function addStilts(b: Builder, length: number, width: number, z: number) {
  if (z <= 0.2) return;
  const x0 = -MARGIN + 0.06;
  const x1 = length + MARGIN - 0.06;
  const y0 = -MARGIN + 0.06;
  const y1 = width + MARGIN - 0.06;
  /** Des positions régulières de `a` à `b`, à trois cases d'écart au plus. */
  const spaced = (a: number, c: number) => {
    const n = Math.max(1, Math.ceil((c - a) / 3));
    return Array.from({ length: n + 1 }, (_, i) => a + ((c - a) * i) / n);
  };
  const xs = spaced(x0, x1);
  const ys = spaced(y0, y1);
  const posts: [number, number][] = [];
  for (const x of xs) posts.push([x, y0], [x, y1]);
  for (const y of ys.slice(1, -1)) posts.push([x0, y], [x1, y]);
  const top = z - 0.02;
  for (const [x, y] of posts) {
    b.box("steel", x - 0.045, x + 0.045, y - 0.045, y + 0.045, 0.03, top);
    b.box("slab", x - 0.11, x + 0.11, y - 0.11, y + 0.11, 0, 0.03);
  }
  // La ceinture sous la dalle.
  const beamZ0 = top - 0.1;
  b.box("steel", x0 - 0.04, x1 + 0.04, y0 - 0.04, y0 + 0.04, beamZ0, top, false);
  b.box("steel", x0 - 0.04, x1 + 0.04, y1 - 0.04, y1 + 0.04, beamZ0, top, false);
  b.box("steel", x0 - 0.04, x0 + 0.04, y0, y1, beamZ0, top, false);
  b.box("steel", x1 - 0.04, x1 + 0.04, y0, y1, beamZ0, top, false);
  // Les croix de Saint-André, entre deux poteaux voisins, sur chaque face.
  const lo = Math.min(0.35, z * 0.2);
  const hi = beamZ0 - 0.02;
  const cross = (a: [number, number], c: [number, number]) => {
    b.beam("steel", [a[0], a[1], lo], [c[0], c[1], hi], 0.018, false);
    b.beam("steel", [c[0], c[1], lo], [a[0], a[1], hi], 0.018, false);
  };
  for (let i = 0; i < xs.length - 1; i += 1) {
    cross([xs[i], y0], [xs[i + 1], y0]);
    cross([xs[i], y1], [xs[i + 1], y1]);
  }
  for (let i = 0; i < ys.length - 1; i += 1) {
    cross([x0, ys[i]], [x0, ys[i + 1]]);
    cross([x1, ys[i]], [x1, ys[i + 1]]);
  }
}

export interface RoofSolarProps {
  /** Le nombre de rangées de tables, et de modules par rangée. */
  rows?: number;
  columns?: number;
  /** La hauteur du toit, en cases. */
  height?: number;
  /** Pas de toit dessous : la dalle est portée par une ossature d'acier jusqu'au sol (`addStilts`). */
  legs?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Des panneaux solaires sur un toit : le champ du sol, sans onduleur ni stockage, sur sa dalle. */
export function RoofSolar(props: RoofSolarProps) {
  const { rows = 1, columns = 6, height = 3, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const s = solarArraySize({ rows, columns });
  const { bounds } = placed(origin, rotation, { x0: 0, x1: s.length, y0: 0, y1: s.width, z0: 0, z1: height + 1.2 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Panneaux solaires en toiture">
      <RoofSolarBody {...props} />
    </Solo>
  );
}

function RoofSolarBody({ rows = 1, columns = 6, height = 3, legs = false, rotation = 0, origin = { x: 0, y: 0 } }: RoofSolarProps) {
  const s = solarArraySize({ rows, columns });
  const pad = useBuilt(() => {
    const b = new Builder();
    addPad(b, s.length, s.width, height);
    if (legs) addStilts(b, s.length, s.width, height);
    return b.build();
  }, [s.length, s.width, height, legs]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: s.length, y0: 0, y1: s.width, z0: 0, z1: 1 });
  return (
    <>
      <group matrixAutoUpdate={false} matrix={pose}>
        <Parts built={pad} />
      </group>
      {/* Le champ lui-même, celui du sol, monté sur la dalle : les mêmes tables, les mêmes modules. */}
      <group position={[0, 0, height + PAD]}>
        <SolarArray rows={rows} columns={columns} origin={origin} rotation={rotation} />
      </group>
    </>
  );
}

export interface RoofHvacProps {
  /** Le nombre de condenseurs, alignés sur la longueur. */
  units?: number;
  /** La longueur de l'emprise — par défaut, de quoi loger les condenseurs — et sa largeur. */
  length?: number;
  width?: number;
  /** La hauteur du toit, en cases. */
  height?: number;
  /** Pas de toit dessous : la dalle est portée par une ossature d'acier jusqu'au sol (`addStilts`). */
  legs?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** La longueur qu'il faut à `n` condenseurs : un mètre chacun, et une marge à chaque bout. */
export const roofHvacLength = (units: number) => 0.4 + Math.max(1, Math.round(units));

/**
 * Un climatiseur de toiture : un, deux ou trois condenseurs à ventilateurs sur leur dalle, et la
 * tuyauterie calorifugée qui plonge dans le toit — c'est elle qui dit que la machine sert le
 * bâtiment d'en dessous, et n'est pas simplement posée là.
 */
export function RoofHvac(props: RoofHvacProps) {
  const { units = 1, width = 1, height = 3, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 40, className } = props;
  const length = props.length ?? roofHvacLength(units);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: height + 0.8 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Climatiseur de toiture">
      <RoofHvacBody {...props} />
    </Solo>
  );
}

function RoofHvacBody(props: RoofHvacProps) {
  const { units = 1, width = 1, height = 3, legs = false, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const n = Math.max(1, Math.round(units));
  const length = props.length ?? roofHvacLength(n);
  const built = useBuilt(() => {
    const b = new Builder();
    addPad(b, length, width, height);
    if (legs) addStilts(b, length, width, height);
    const z = height + PAD;
    const l = 0.9;
    const w = 0.45;
    const x0 = (length - n * l - (n - 1) * 0.1) / 2;
    const y0 = 0.08;
    // Le caillebotis commun, puis les condenseurs en rangée dessus.
    b.box("steel", x0 - 0.05, x0 + n * (l + 0.1) - 0.05, y0 - 0.04, y0 + w + 0.04, z, z + 0.03);
    for (let i = 0; i < n; i += 1) addCondenser(b, x0 + i * (l + 0.1), y0, z + 0.03, l, w, 0.4);
    // La tuyauterie : une nourrice calorifugée qui court derrière les groupes, chaque groupe s'y
    // raccorde, et elle plonge dans le toit par une crosse.
    const py = Math.min(width - 0.14, y0 + w + 0.2);
    const pz = z + 0.2;
    const xa = x0 + 0.2;
    const xb = x0 + (n - 1) * (l + 0.1) + l - 0.2;
    b.beam("paint-light", [xa, py, pz], [xb + 0.25, py, pz], 0.045, false);
    for (let i = 0; i < n; i += 1) {
      const cx = x0 + i * (l + 0.1) + l / 2;
      b.beam("paint-light", [cx, y0 + w, pz], [cx, py, pz], 0.03, false);
    }
    b.beam("paint-light", [xb + 0.25, py, pz], [xb + 0.25, py, z - 0.05], 0.045, false);
    // Le fourreau d'étanchéité, là où le tuyau traverse la dalle.
    b.cylinder("steel", xb + 0.25, py, z + 0.04, 0.08, 0.08, "z", 12);
    return b.build();
  }, [n, length, width, height, legs]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
