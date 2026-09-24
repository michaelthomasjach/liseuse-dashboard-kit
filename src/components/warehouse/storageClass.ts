import type { Builder, P3 } from "./three/builder";
import type { RackItemKind } from "./rackItems";

/**
 * Les classes de stockage : **ce qu'un emplacement a le droit de recevoir**.
 *
 * Un entrepôt ne range pas n'importe quoi n'importe où. Les liquides vont en bas, sur bac de
 * rétention ; les solvants et les inflammables dans une zone à part, signalée ; le froid là où il
 * fait froid. On décrit donc, sur une étagère ou un rack, la classe de chaque niveau — ou de chaque
 * travée et de chaque niveau —, et chacun porte sa **plaque** : un pictogramme sur le nez de la
 * lisse, qu'on lit de l'allée. Les marchandises posées suivent la classe : des fûts sur un niveau
 * « liquides », des cartons sur un niveau « secs ».
 *
 * Les pictogrammes restent lisibles en niveaux de gris : ce sont leurs **formes** qui les
 * distinguent — un losange de danger, une goutte, un flocon, un verre —, la couleur ne fait que
 * s'ajouter en palette couleur.
 */

export type StorageClass = "all" | "dry" | "liquid" | "solvent" | "flammable" | "corrosive" | "cold" | "fragile" | "heavy";

export const STORAGE_CLASSES: StorageClass[] = ["all", "dry", "liquid", "solvent", "flammable", "corrosive", "cold", "fragile", "heavy"];

export const STORAGE_LABEL: Record<StorageClass, string> = {
  all: "Tout produit",
  dry: "Produits secs",
  liquid: "Liquides",
  solvent: "Solvants",
  flammable: "Inflammables",
  corrosive: "Corrosifs",
  cold: "Froid",
  fragile: "Fragile",
  heavy: "Lourd",
};

/** Ce qu'on range, par classe : les marchandises qu'un emplacement de cette classe reçoit. */
export const STORAGE_GOODS: Record<StorageClass, RackItemKind[]> = {
  all: ["carton", "boite", "bidon", "bouteille"],
  dry: ["carton", "boite"],
  liquid: ["bidon", "bouteille"],
  solvent: ["bidon"],
  flammable: ["bidon", "bouteille"],
  corrosive: ["bidon"],
  cold: ["boite", "carton"],
  fragile: ["bouteille", "boite"],
  heavy: ["palette", "carton"],
};

/**
 * La classe d'un emplacement, d'après ce que l'étagère déclare : une classe pour tout, une par
 * niveau (du bas vers le haut), ou une par travée et par niveau.
 */
export function storageAt(storage: StorageClass | StorageClass[] | StorageClass[][] | undefined, bay: number, level: number): StorageClass | undefined {
  if (storage === undefined) return undefined;
  if (typeof storage === "string") return storage;
  const first = storage[0];
  if (Array.isArray(first)) {
    const row = (storage as StorageClass[][])[bay % storage.length];
    return row?.[level % Math.max(1, row.length)];
  }
  const list = storage as StorageClass[];
  return list[level % Math.max(1, list.length)];
}

/**
 * Poser la plaque d'une classe dans un constructeur : un panneau blanc cerné, centré en
 * `(x, y, z)`, et son pictogramme, tourné vers les `y` négatifs (`side = -1`) ou positifs.
 */
export function addStoragePlate(b: Builder, cls: StorageClass, x: number, y: number, z: number, w = 0.34, h = 0.2, side: 1 | -1 = -1): void {
  // Le pictogramme, un rien devant le panneau, du côté où l'on regarde.
  const y0 = y + side * 0.004;
  b.faceY("lq-storage__plate", y, x - w / 2, x + w / 2, z - h / 2, z + h / 2, true);
  const s = Math.min(w, h) * 0.36;
  const at = (dx: number, dz: number): P3 => [x + dx, y0, z + dz];
  const icon = `lq-storage__${cls}`;
  if (cls === "flammable" || cls === "solvent" || cls === "corrosive") {
    // Le losange de danger ; une flamme, une goutte ou une main rongée tracées dedans.
    b.decal(icon, [at(0, -s), at(s, 0), at(0, s), at(-s, 0)], true);
    if (cls === "flammable") b.lines("lq-storage__mark", [[at(-s * 0.3, -s * 0.4), at(0, s * 0.5)], [at(0, s * 0.5), at(s * 0.3, -s * 0.4)], [at(-s * 0.3, -s * 0.4), at(s * 0.3, -s * 0.4)]]);
    else if (cls === "solvent") b.lines("lq-storage__mark", [[at(-s * 0.4, 0), at(s * 0.4, 0)], [at(0, -s * 0.4), at(0, s * 0.4)]]);
    else b.lines("lq-storage__mark", [[at(-s * 0.4, s * 0.3), at(s * 0.4, -s * 0.3)], [at(-s * 0.4, -s * 0.3), at(s * 0.4, s * 0.3)]]);
    return;
  }
  if (cls === "liquid") {
    // La goutte : une pointe et un fond rond.
    const pts: P3[] = [at(0, s)];
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI / 6 - ((4 * Math.PI) / 3) * (i / 10);
      pts.push(at(Math.cos(a) * s * 0.55, -s * 0.25 + Math.sin(a) * s * 0.55));
    }
    b.decal(icon, pts, true);
    return;
  }
  if (cls === "cold") {
    // Le flocon : trois traits croisés.
    const segs: [P3, P3][] = [];
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI;
      segs.push([at(Math.cos(a) * s, Math.sin(a) * s), at(-Math.cos(a) * s, -Math.sin(a) * s)]);
    }
    b.lines("lq-storage__mark", segs);
    b.decal(icon, [at(-s * 0.2, -s * 0.2), at(s * 0.2, -s * 0.2), at(s * 0.2, s * 0.2), at(-s * 0.2, s * 0.2)]);
    return;
  }
  if (cls === "fragile") {
    // Le verre : une coupe sur un pied.
    b.decal(icon, [at(-s * 0.5, s), at(s * 0.5, s), at(s * 0.15, 0), at(-s * 0.15, 0)], true);
    b.lines("lq-storage__mark", [[at(0, 0), at(0, -s * 0.7)], [at(-s * 0.35, -s * 0.7), at(s * 0.35, -s * 0.7)]]);
    return;
  }
  if (cls === "heavy") {
    // Le poids : un trapèze et son anneau.
    b.decal(icon, [at(-s * 0.7, -s * 0.8), at(s * 0.7, -s * 0.8), at(s * 0.45, s * 0.4), at(-s * 0.45, s * 0.4)], true);
    b.lines("lq-storage__mark", [[at(-s * 0.15, s * 0.4), at(-s * 0.15, s * 0.8)], [at(s * 0.15, s * 0.4), at(s * 0.15, s * 0.8)], [at(-s * 0.15, s * 0.8), at(s * 0.15, s * 0.8)]]);
    return;
  }
  if (cls === "dry") {
    // Le carton : un carré et son rabat.
    b.decal(icon, [at(-s * 0.7, -s * 0.7), at(s * 0.7, -s * 0.7), at(s * 0.7, s * 0.5), at(-s * 0.7, s * 0.5)], true);
    b.lines("lq-storage__mark", [[at(-s * 0.7, s * 0.1), at(s * 0.7, s * 0.1)]]);
    return;
  }
  // Tout produit : une simple bande.
  b.decal(icon, [at(-s, -s * 0.25), at(s, -s * 0.25), at(s, s * 0.25), at(-s, s * 0.25)]);
}

/** Une bande au sol, à la couleur de la classe, sous un emplacement : la zone se lit d'en haut. */
export function addStorageFloor(b: Builder, cls: StorageClass, x0: number, x1: number, y0: number, y1: number): void {
  if (cls === "all") return;
  b.faceZ(`lq-storage__${cls}`, 0.006, x0, x1, y0, y0 + 0.06);
  b.faceZ(`lq-storage__${cls}`, 0.006, x0, x1, y1 - 0.06, y1);
}
