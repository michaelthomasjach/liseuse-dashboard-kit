import type { RackItemKind } from "../rackItems";
import type { Builder } from "./builder";

/**
 * Les marchandises — **les mêmes objets partout**.
 *
 * Un carton est dessiné par une seule fonction, qu'il soit sur une étagère, sur un tapis, dans les
 * fourches d'un chariot ou dans une remorque. C'est la première condition pour qu'un colis ne
 * « change » pas en passant d'un module à l'autre : s'il était redessiné par chacun, il changerait
 * de taille, de teinte ou de détail à la jonction, et l'œil lirait un saut même là où la position
 * est continue.
 *
 * Chaque sorte a sa silhouette propre, lisible de loin — c'est ce qui compte dans un jeu, où l'on
 * suit des flux et non des objets : le carton a sa bande d'adhésif, le bac son rebord, le fût ses
 * frettes, la bouteille son goulot, la palette ses lattes et ses semelles.
 */

/** La taille d'une marchandise posée seule — sur un tapis, dans des fourches — en cases. */
export const GOOD_SIZE: Record<RackItemKind, { half: number; height: number }> = {
  carton: { half: 0.19, height: 0.3 },
  boite: { half: 0.16, height: 0.17 },
  bidon: { half: 0.14, height: 0.42 },
  bouteille: { half: 0.06, height: 0.3 },
  palette: { half: 0.3, height: 0.075 },
};

/** La matière de chaque sorte, dans le vocabulaire du CSS. */
const MATERIAL: Record<RackItemKind, string> = {
  carton: "kraft",
  boite: "bin",
  bidon: "drum",
  bouteille: "glass",
  palette: "wood",
};

/**
 * Poser une marchandise, centrée en `(cx, cy)`, son pied à `z`.
 *
 *  `half` est sa demi-emprise, `height` sa hauteur. Le dessin se règle sur elles — une bande
 *  d'adhésif fait toujours un cinquième du carton — si bien qu'un carton agrandi reste un carton.
 */
export function addGood(b: Builder, kind: RackItemKind, cx: number, cy: number, z: number, half: number, height: number): void {
  const mat = MATERIAL[kind];
  const top = z + height;
  switch (kind) {
    case "carton": {
      b.box(mat, cx - half, cx + half, cy - half, cy + half, z, top);
      // L'adhésif qui ferme les rabats, sur le dessus et en travers des deux faces : c'est lui qui
      // dit « carton » et non « caisse ».
      const w = half * 0.2;
      b.faceZ("lq-good__tape", top, cx - half, cx + half, cy - w, cy + w);
      b.faceX("lq-good__tape", cx + half, cy - w, cy + w, top - height * 0.28, top);
      b.faceX("lq-good__tape", cx - half, cy - w, cy + w, top - height * 0.28, top);
      // L'étiquette d'expédition, sur une face.
      b.faceY("lq-good__label", cy + half, cx - half * 0.55, cx + half * 0.1, z + height * 0.3, z + height * 0.62, true);
      return;
    }
    case "boite": {
      // Un bac de préparation : un corps un peu évasé et un rebord qui déborde, par où on le saisit.
      const rim = half * 0.08;
      b.box(mat, cx - half, cx + half, cy - half, cy + half, z, top - height * 0.14);
      b.box(mat, cx - half - rim, cx + half + rim, cy - half - rim, cy + half + rim, top - height * 0.14, top);
      b.faceX("lq-good__grip", cx + half + rim, cy - half * 0.35, cy + half * 0.35, top - height * 0.11, top - height * 0.04);
      b.faceX("lq-good__grip", cx - half - rim, cy - half * 0.35, cy + half * 0.35, top - height * 0.11, top - height * 0.04);
      return;
    }
    case "bidon": {
      b.cylinder(mat, cx, cy, z + height / 2, half, height, "z", 18);
      // Deux frettes : ce qui distingue un fût d'un tube.
      for (const f of [0.3, 0.7]) b.cylinder(mat, cx, cy, z + height * f, half * 1.035, height * 0.05, "z", 18, undefined, false);
      b.cylinder("iron", cx + half * 0.45, cy, top + 0.006, half * 0.14, 0.012, "z", 8, undefined, false);
      return;
    }
    case "bouteille": {
      const neck = z + height * 0.62;
      b.cylinder(mat, cx, cy, (z + neck) / 2, half, neck - z, "z", 14);
      b.cylinder(mat, cx, cy, neck + (top - neck) * 0.35, half * 0.4, (top - neck) * 0.7, "z", 10, half, false);
      b.cylinder("iron", cx, cy, top - (top - neck) * 0.1, half * 0.42, (top - neck) * 0.2, "z", 10);
      return;
    }
    case "palette": {
      // Une vraie palette : trois semelles en long, des dés, et cinq lattes de plancher en travers.
      const t = height / 3;
      for (const f of [-1, 0, 1]) b.box(mat, cx - half, cx + half, cy + f * (half - half * 0.09) - half * 0.09, cy + f * (half - half * 0.09) + half * 0.09, z, z + t);
      for (const f of [-1, 0, 1])
        for (const g of [-1, 0, 1]) b.box(mat, cx + g * (half - half * 0.1) - half * 0.1, cx + g * (half - half * 0.1) + half * 0.1, cy + f * (half - half * 0.09) - half * 0.08, cy + f * (half - half * 0.09) + half * 0.08, z + t, z + 2 * t);
      for (let i = 0; i < 5; i += 1) {
        const x = cx - half + (half * 2 * (i + 0.5)) / 5;
        b.box(mat, x - half * 0.15, x + half * 0.15, cy - half, cy + half, z + 2 * t, top);
      }
      return;
    }
  }
}

/** La hauteur totale d'une marchandise posée seule. */
export function goodHeight(kind: RackItemKind): number {
  return GOOD_SIZE[kind].height;
}
