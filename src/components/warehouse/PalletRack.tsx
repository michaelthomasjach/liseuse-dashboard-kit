import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt, useSceneQuality } from "./three/scene";
import { GOOD_SIZE, addGood } from "./three/goods";
import { rng } from "./three/random";
import type { RackItemKind } from "./rackItems";
import { STORAGE_GOODS, addStorageFloor, addStoragePlate, storageAt, type StorageClass } from "./storageClass";

/**
 * Le rack à palettes — le rayonnage lourd d'un centre de distribution.
 *
 * Ce n'est pas l'étagère (`RackV2`), où l'on pose des cartons à la main : c'est le rayonnage où un
 * chariot vient poser des **palettes entières**, sur quatre à six niveaux. Son dessin est celui
 * qu'on voit partout :
 *
 * - des **échelles** bleues, deux montants reliés par un treillis de diagonales — les côtés du
 *   rack, qui en portent tout le poids ;
 * - des **lisses** orange, deux par niveau, accrochées d'une échelle à l'autre — ce sur quoi
 *   reposent les palettes ;
 * - trois palettes par travée, chargées de cartons filmés.
 *
 * Le rez-de-chaussée est au sol : la première paire de lisses est au premier niveau. Le rack court
 * le long des `x` (ses travées), sa profondeur le long des `y`, et on le sert depuis `y = 0`.
 *
 * `fill` dit la part des emplacements occupés, `seed` lesquels : un tirage stable, qui ne change
 * pas d'un rendu à l'autre. `palletRackSlot` rend la position d'un emplacement — de quoi y envoyer
 * un chariot.
 */

export interface PalletRackProps {
  /** Nombre de travées. */
  bays?: number;
  /** Nombre de niveaux de stockage, le sol compris. */
  levels?: number;
  /** Largeur d'une travée, entre deux échelles, en cases. 1,35 : les 2,70 m d'une lisse à trois
   *  palettes. */
  bayWidth?: number;
  /** Profondeur du rack, en cases. */
  depth?: number;
  /** Hauteur d'un niveau, en cases. */
  levelHeight?: number;
  /** Palettes par travée. */
  perBay?: number;
  /** Part des emplacements occupés, de 0 à 1. */
  fill?: number;
  /** Ce que portent les palettes — une sorte, ou une liste tirée au sort. */
  goods?: RackItemKind | RackItemKind[];
  /** Graine du tirage. */
  seed?: number;
  /** Adosser un second rack derrière le premier : un rack double, servi des deux côtés. */
  double?: boolean;
  /**
   * Un **passage sous le rack** : les travées `from` à `to` (exclu) n'ont pas de niveaux sous
   * `clearance` — un pont que les chariots et les camions franchissent. Les montants du passage
   * sont gainés de protections jaunes, et la lisse du premier niveau est zébrée : c'est elle que
   * l'on risque de toucher.
   */
  passage?: { from: number; to: number; clearance?: number };
  /**
   * Ce que chaque emplacement peut recevoir (voir `storageClass.ts`) : une classe pour tout le rack,
   * une par niveau (du bas vers le haut), ou une par travée et par niveau. Chaque emplacement porte
   * alors sa plaque, et reçoit des marchandises de sa classe.
   */
  storage?: StorageClass | StorageClass[] | StorageClass[][];
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const POST = 0.05;
const FLUE = 0.1;

function layout(p: PalletRackProps) {
  const bays = Math.max(1, Math.round(p.bays ?? 4));
  const levels = Math.max(1, Math.round(p.levels ?? 4));
  const bayW = Math.max(0.6, p.bayWidth ?? 1.35);
  const D = Math.max(0.3, p.depth ?? 0.55);
  const lh = Math.max(0.4, p.levelHeight ?? 0.85);
  const perBay = Math.max(1, Math.round(p.perBay ?? 3));
  const rows = p.double ? 2 : 1;
  const L = bays * bayW + POST * 2;
  const Dt = rows * D + (rows - 1) * FLUE;
  const H = levels * lh + 0.1;
  return { bays, levels, bayW, D, lh, perBay, rows, L, Dt, H };
}

/** Une palette chargée : la palette, puis des cartons en couches, sous film. */
export function addPalletLoad(b: Builder, cx: number, cy: number, z: number, half: number, height: number, kind: RackItemKind = "carton", lite = false): void {
  const ph = GOOD_SIZE.palette.height * (half / GOOD_SIZE.palette.half);
  addGood(b, "palette", cx, cy, z, half, ph, lite);
  if (kind === "palette") return;
  // Une grille de 2×2 colis, sur autant de couches que la hauteur en permet.
  const g = GOOD_SIZE[kind];
  const cell = (half * 2) / 2;
  const k = (cell * 0.48) / g.half;
  const gh = g.height * k;
  const layers = Math.max(1, Math.floor((height - ph) / gh));
  for (let l = 0; l < layers; l += 1)
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) addGood(b, kind, cx + (dx * cell) / 2, cy + (dy * cell) / 2, z + ph + l * gh, g.half * k, gh, lite);
}

/** Où est un emplacement : le centre du dessus de sa lisse, en coordonnées monde. */
export function palletRackSlot(p: PalletRackProps, bay: number, level: number, position = 0, row = 0): P3 {
  const { bayW, D, lh, perBay, L, Dt } = layout(p);
  const x = POST + bay * bayW + ((position + 0.5) * bayW) / perBay;
  const y = row * (D + FLUE) + D / 2;
  const z = level === 0 ? 0 : level * lh;
  const { pose } = placed(p.origin ?? { x: 0, y: 0 }, p.rotation ?? 0, { x0: 0, x1: L, y0: 0, y1: Dt, z0: 0, z1: 1 });
  const e = pose.elements;
  return [e[0] * x + e[4] * y + e[12], e[1] * x + e[5] * y + e[13], z];
}

export function PalletRack(props: PalletRackProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 26, className } = props;
  const { L, Dt, H } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: Dt, z0: 0, z1: H });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Rack à palettes">
      <PalletRackBody {...props} />
    </Solo>
  );
}

function PalletRackBody(props: PalletRackProps) {
  const { fill = 0.75, goods = ["carton", "carton", "boite", "bidon"], seed = 3, rotation = 0, origin = { x: 0, y: 0 }, passage, storage } = props;
  const { bays, levels, bayW, D, lh, perBay, rows, L, Dt, H } = layout(props);
  const kinds = Array.isArray(goods) ? goods : [goods];
  // En qualité basse, les marchandises en peu de facettes : ce sont elles qui font les triangles.
  const lite = useSceneQuality() === "low";
  const built = useBuilt(() => {
    const b = new Builder();
    const r = rng(seed);
    for (let row = 0; row < rows; row += 1) {
      const y0 = row * (D + FLUE);
      const y1 = y0 + D;
      // Les échelles : deux montants, et un treillis en zigzag sur le côté.
      for (let i = 0; i <= bays; i += 1) {
        const x = i * bayW;
        for (const y of [y0, y1 - POST]) b.box("paint-cool", x, x + POST, y, y + POST, 0, H);
        const brace: number[] = [];
        for (let z = 0.15; z < H - 0.2; z += 0.55) brace.push(z);
        for (let k = 0; k + 1 < brace.length; k += 1) {
          const a: P3 = [x + POST / 2, k % 2 ? y0 + POST : y1 - POST, brace[k]];
          const c: P3 = [x + POST / 2, k % 2 ? y1 - POST : y0 + POST, brace[k + 1]];
          b.beam("paint-cool", a, c, 0.012, false);
        }
        b.box("paint-cool", x, x + POST, y0, y1, 0.12, 0.15, false);
        // Les platines au sol.
        for (const y of [y0 - 0.02, y1 - POST - 0.02]) b.box("steel", x - 0.02, x + POST + 0.02, y, y + POST + 0.04, 0, 0.012, false);
      }
      for (let bay = 0; bay < bays; bay += 1) {
        const x0 = bay * bayW + POST;
        const x1 = (bay + 1) * bayW;
        const bridged = !!passage && bay >= passage.from && bay < passage.to;
        // Sous un pont, les niveaux qui gêneraient le passage disparaissent.
        const firstLevel = bridged ? Math.max(1, Math.ceil((passage?.clearance ?? 2.2) / lh)) : 0;
        for (let lv = firstLevel; lv < levels; lv += 1) {
          const z = lv * lh;
          // Les lisses, avant et arrière — le sol n'en a pas.
          if (lv > 0) {
            b.box("safety", x0, x1, y0, y0 + 0.04, z - 0.09, z);
            b.box("safety", x0, x1, y1 - 0.04, y1, z - 0.09, z);
          }
          if (bridged && lv === firstLevel)
            // La lisse du pont, zébrée de noir, des deux côtés.
            for (let x = x0 + 0.05; x < x1 - 0.1; x += 0.3)
              for (const [ya, yb] of [
                [y0 - 0.001, y0 + 0.041],
                [y1 - 0.041, y1 + 0.001],
              ])
                b.box("paint-dark", x, x + 0.15, ya, yb, z - 0.091, z + 0.001, false);
          const cls = storageAt(storage, bay, lv);
          const pool = cls ? STORAGE_GOODS[cls] : kinds;
          for (let k = 0; k < perBay; k += 1) {
            if (r() > fill) continue;
            const cx = x0 + ((k + 0.5) * (x1 - x0)) / perBay;
            const half = Math.min((x1 - x0) / perBay / 2 - 0.03, D / 2 - 0.01);
            addPalletLoad(b, cx, (y0 + y1) / 2, z, half, lh - 0.18 - r() * 0.15, pool[Math.floor(r() * pool.length)], lite);
          }
          if (cls) {
            // La plaque de l'emplacement, sur le nez de la lisse — ou au sol pour le niveau bas.
            const pz = lv === 0 ? 0.16 : z - 0.045;
            addStoragePlate(b, cls, (x0 + x1) / 2, row === 0 ? y0 - 0.002 : y1 + 0.002, pz, 0.34, 0.2, row === 0 ? -1 : 1);
            if (lv === 0) addStorageFloor(b, cls, x0, x1, y0, y1);
          }
        }
        if (bridged) {
          // Les protections de montants, jaunes, au pied du passage.
          for (const x of [bay * bayW, (bay + 1) * bayW])
            for (const y of [y0 - 0.05, y1 - POST - 0.01]) b.box("safety", x - 0.04, x + POST + 0.04, y, y + POST + 0.06, 0, 0.5);
        }
      }
      // Les entretoises de dos-à-dos, qui tiennent deux racks adossés.
      if (row === 1)
        for (let i = 0; i <= bays; i += 1)
          for (const z of [lh * 0.5, H - 0.3]) b.box("paint-cool", i * bayW, i * bayW + POST, y0 - FLUE, y0, z, z + 0.04, false);
    }
    return b.build();
  }, [lite, bays, levels, bayW, D, lh, perBay, rows, fill, seed, kinds.join(","), JSON.stringify(passage ?? null), JSON.stringify(storage ?? null)]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: Dt, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
