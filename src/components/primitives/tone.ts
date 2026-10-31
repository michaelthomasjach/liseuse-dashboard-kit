import "./tone.css";

/**
 * Les tons pleins d'une surface : `Card` (`tone`), `LiveTile` et `DotMap` les partagent.
 *
 * `"default"` ne remplit rien — la surface garde le fond du panneau. Les autres la remplissent de la
 * couleur du thème du même nom et passent tout son contenu en contraste ; voir `tone.css` pour la
 * mécanique et les variables qu'un thème peut redéfinir.
 */
export type SurfaceTone = "default" | "accent" | "success" | "info" | "danger" | "warning" | "dark";

/** L'attribut à poser sur la surface, ou `undefined` quand le ton ne remplit rien — pour que le DOM
 *  d'une surface sans ton reste exactement celui d'avant. */
export function toneAttribute(tone: SurfaceTone | undefined): SurfaceTone | undefined {
  return tone && tone !== "default" ? tone : undefined;
}
