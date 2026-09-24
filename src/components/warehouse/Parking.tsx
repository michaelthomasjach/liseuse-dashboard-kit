import { Matrix4 } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { addCar, type CarKind, type CarTone } from "./Car";
import "./Parking.css";

/**
 * Le parking : des **places tracées** et les voitures garées dessus.
 *
 * ## Pourquoi les places comptent autant que les voitures
 *
 * Un parking vide reste un parking : ce sont les traces au sol qui le disent, pas ce qui est
 * dessus. Elles donnent aussi l'échelle de tout le reste — une place fait la même chose partout, et
 * un entrepôt se mesure en places de parking aussi sûrement qu'en palettes. Le composant dessine
 * donc d'abord le marquage, et les voitures ensuite, par-dessus.
 *
 * ## Les voitures
 *
 * Trois volumes aux angles abattus — bas de caisse, caisse, pavillon — et quatre roues qu'on ne
 * dessine pas : à cette échelle, une voiture fait quarante pixels de long, et ses roues y seraient
 * quatre taches de trois pixels que l'œil lirait comme du bruit. Ce qui la fait lire comme une
 * voiture, c'est sa **silhouette en trois marches** et le retrait du bas de caisse, qui la met sur
 * ses roues sans en dessiner.
 *
 * Elles ne sont pas toutes pareilles : `seed` tire leur longueur, leur teinte et les places
 * occupées. Un rang de voitures identiques se lit comme un motif, pas comme un parking — et comme
 * un tirage, il doit être **stable** : deux rendus du même parking donnent la même image, sans quoi
 * aucune comparaison n'est possible.
 */

export interface ParkingProps {
  /** Nombre de places dans le rang. */
  bays?: number;
  /** Nombre de rangs, adossés deux à deux. */
  rows?: number;
  /** Largeur d'une place, en cases. */
  bayWidth?: number;
  /** Profondeur d'une place, en cases. */
  bayDepth?: number;
  /** Part des places occupées, de 0 à 1. */
  fill?: number;
  /** La graine du tirage : mêmes voitures aux mêmes places, à chaque rendu. */
  seed?: number;
  /** Rotation sur le sol, en degrés. À 0, les rangs courent le long des `x`. */
  rotation?: number;
  /** Poser les ombres des voitures au sol. */
  shadows?: boolean;
  /** Où poser le coin du parking, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, les ombres seules, ou le parking seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/** L'allée entre deux rangs adossés : de quoi manœuvrer, sans quoi le parking se lit comme un mur
 *  de voitures. */
const AISLE = 2.2;


/** Un tirage stable : la même graine donne le même parking, aujourd'hui et demain. */
function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Parking(props: ParkingProps) {
  const { bays = 6, rows = 2, bayWidth = 1.1, bayDepth = 2.2, rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 30, className } = props;
  if (parts === "shadow") return null;
  const n = Math.max(1, Math.round(bays));
  const rowCount = Math.max(1, Math.round(rows));
  const LENGTH = n * bayWidth;
  const DEPTH = rowCount > 1 ? bayDepth * 2 + AISLE : bayDepth;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: DEPTH, z0: 0, z1: 0.8 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-parking", className].filter(Boolean).join(" ")} ariaLabel={`Parking de ${n * rowCount} places`}>
      <ParkingBody {...props} />
    </Solo>
  );
}

function ParkingBody({ bays = 6, rows = 2, bayWidth = 1.1, bayDepth = 2.2, fill = 0.7, seed = 3, rotation = 0, origin = { x: 0, y: 0 } }: ParkingProps) {
  const n = Math.max(1, Math.round(bays));
  const rowCount = Math.max(1, Math.round(rows));
  const LENGTH = n * bayWidth;
  const DEPTH = rowCount > 1 ? bayDepth * 2 + AISLE : bayDepth;
  const { pose } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: DEPTH, z0: 0, z1: 1 });
  const built = useBuilt(() => {
    const b = new Builder();
    const rowY = (r: number) => (r === 0 ? 0 : DEPTH - bayDepth);
    const w = 0.035;
    // L'enrobé : sans lui, le marquage blanc se perd sur la page et les voitures flottent.
    b.box("asphalt", -0.15, LENGTH + 0.15, -0.15, DEPTH + 0.15, -0.04, 0, false);
    // Le marquage : un trait entre chaque place et une ligne de fond, en peinture sur l'enrobé.
    for (let r = 0; r < rowCount; r += 1) {
      const y0 = rowY(r);
      const y1 = y0 + bayDepth;
      for (let i = 0; i <= n; i += 1) b.faceZ("lq-road__mark", 0.004, i * bayWidth - w, i * bayWidth + w, y0, y1);
      const back = r === 0 ? y0 : y1;
      b.faceZ("lq-road__mark", 0.004, 0, LENGTH, back - w, back + w);
    }
    // Les voitures : garées nez vers l'allée, de gabarits et de teintes variés, comme un vrai parc.
    const next = rng(seed);
    const kinds: CarKind[] = ["sedan", "sedan", "hatch", "van"];
    const tones: CarTone[] = ["light", "light", "dark", "cool", "warm", "light"];
    for (let r = 0; r < rowCount; r += 1) {
      const y0 = rowY(r);
      for (let i = 0; i < n; i += 1) {
        const take = next();
        const kind = kinds[Math.floor(next() * kinds.length)];
        const tone = tones[Math.floor(next() * tones.length)];
        if (take > fill) continue;
        const len = Math.min(bayDepth * 0.9, kind === "van" ? 2.1 : kind === "hatch" ? 1.6 : 1.8);
        const wide = Math.min(bayWidth * 0.8, kind === "van" ? 0.86 : 0.78);
        const x = i * bayWidth + (bayWidth - wide) / 2;
        // Rangée du bas nez vers l'allée (vers les y croissants), rangée du haut l'inverse.
        const nose = r === 0 ? 1 : -1;
        const y = r === 0 ? y0 + (bayDepth - len) * 0.75 : y0 + (bayDepth - len) * 0.25;
        const m = nose > 0 ? new Matrix4().makeTranslation(x + wide, y, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)) : new Matrix4().makeTranslation(x, y + len, 0).multiply(new Matrix4().makeRotationZ(-Math.PI / 2));
        b.within(m, () => addCar(b, kind, tone, { wheels: true, length: len, width: wide }));
      }
    }
    return b.build();
  }, [n, rowCount, bayWidth, bayDepth, fill, seed, LENGTH, DEPTH]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
