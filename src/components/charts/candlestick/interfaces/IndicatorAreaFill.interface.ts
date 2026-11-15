import type { StyleRuleOperand } from "./IndicatorStyleRule.interface";

/**
 * Une zone remplie d'un indicateur (paramètres du panneau, onglet de l'indicateur, rubrique Style, « Zones
 * remplies »), comme un « fill between » : l'espace entre une ligne de l'indicateur et un autre bord — la base 0 du
 * panneau, un niveau, ou une autre courbe du même panneau (la SMA 50 face à la SMA 14, le volume…) — peint d'une
 * couleur quand la ligne est au-dessus de ce bord, d'une autre quand elle est en dessous, découpé au point exact des
 * croisements. Les zones se dessinent derrière les lignes, dans l'ordre de la liste.
 *
 * Les couleurs portent leur opacité (`#rrggbbaa`, le curseur d'opacité du sélecteur de couleur).
 */
export interface IndicatorAreaFill {
  id: string;
  /** Faux : la zone est gardée mais ne peint rien (case décochée). Défaut vrai. */
  enabled?: boolean;
  /** La ligne de l'indicateur qui borde la zone : « macd », « signal », « upper », la clé d'une série d'un script…
   *  Absente : sa ligne principale. */
  field?: string;
  /** L'autre bord : `{ source: "value", value: 0 }` pour la base du panneau (ou un niveau), sinon une courbe du
   *  panneau (`indicatorId` absent : cet indicateur lui-même, une autre de ses lignes). */
  to: StyleRuleOperand;
  /** Couleur (avec opacité) quand la ligne est au-dessus de l'autre bord ; absente ou null : rien de ce côté. */
  aboveColor?: string | null;
  /** Couleur (avec opacité) quand la ligne est en dessous de l'autre bord ; absente ou null : rien de ce côté. */
  belowColor?: string | null;
}
