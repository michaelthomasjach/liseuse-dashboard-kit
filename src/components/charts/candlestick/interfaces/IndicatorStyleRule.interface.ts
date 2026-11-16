/** Une courbe du panneau d'un indicateur, citée par une règle de couleur. */
export interface StyleRuleSeriesRef {
  /** « indicator » : une ligne d'un indicateur du panneau ; « close » : le cours de clôture (panneau principal) ;
   *  « volume » : le volume de chaque bougie (panneau Volume). */
  source: "indicator" | "close" | "volume";
  /** L'indicateur dont on lit la ligne. Absent : celui qui porte la règle (la règle survit ainsi à un changement
   *  d'id, une copie, un modèle). */
  indicatorId?: string;
  /** La ligne de cet indicateur : « upper » / « middle » / « lower » d'une bande, « macd » / « signal » /
   *  « histogram », « adx » / « plusDI » / « minusDI », la clé d'une série d'un script… Absent : sa ligne principale
   *  (voir `mainValue`). */
  field?: string;
}

/** Ce à quoi la courbe A est comparée : une autre courbe, ou une valeur fixe (sur l'échelle du panneau). */
export type StyleRuleOperand = StyleRuleSeriesRef | { source: "value"; value: number } | StyleRuleLevelRef;

/** Une ligne de niveau d'un indicateur (RSI : seuil de surachat, de survente, ligne médiane 50 ; CHOP : seuils haut et
 *  bas, médiane). Lue dans les réglages de l'indicateur à chaque dessin : la règle suit un seuil déplacé. */
export interface StyleRuleLevelRef {
  source: "level";
  level: "upper" | "lower" | "middle";
  /** L'indicateur dont on lit le niveau. Absent : celui qui porte la règle. */
  indicatorId?: string;
}

/** « au-dessus de », « en dessous de », « ≥ », « ≤ », « croise à la hausse », « croise à la baisse », « entre », « hors
 *  de ». Les deux derniers lisent deux bornes (`b` et `c`, dans n'importe quel ordre). */
export type StyleRuleCondition = "above" | "below" | "gte" | "lte" | "crossUp" | "crossDown" | "between" | "outside";

/** Ce que la règle peint :
 *  - « fill » : remplit l'espace entre la courbe A et la référence (entre les deux bornes pour « entre » / « hors
 *    de ») là où la condition est vraie, découpé au point exact des croisements ;
 *  - « line » : colore les segments de la courbe A où la condition est vraie ;
 *  - « background » : colore le fond du panneau sur ces bougies (pour un croisement : une bande fine sur la bougie
 *    du croisement) ;
 *  - « icon » : une icône (voir `RuleIcon`) sur la courbe A, sur chaque bougie où la condition est vraie, ou à
 *    l'endroit exact du croisement pour « croise » ;
 *  - « marker » : ancien effet « marquer d'un point », retiré du menu ; une règle enregistrée avec lui est lue comme
 *    « icon » avec l'icône « Point » posée sur la courbe (voir `indicatorStyleRules`), sans changer son dessin. */
export type StyleRuleEffect = "fill" | "line" | "background" | "icon" | "marker";

/** Où se pose l'icône : au-dessus du point de la courbe (de la bougie), en dessous, ou centrée dessus (courbes
 *  seulement). */
export type RuleIconPosition = "above" | "below" | "on";

/** L'icône d'une règle (« Ajouter une icône ») : son nom dans le catalogue du kit (`MARKER_ICONS` : `"arrow-up"`,
 *  `"triangle-down"`, `"rocket"`, `"circle-filled"`…), sa taille et sa position. */
export interface RuleIcon {
  /** Identifiant d'une icône de `MARKER_ICONS` ; inconnu : le point. */
  name: string;
  /** Taille en pixels CSS, de 8 à 40. Défaut 14. */
  size?: number;
  /** Défaut « above » (« on » pour une courbe migrée depuis « marquer d'un point »). */
  position?: RuleIconPosition;
  /** Couleur de l'icône (règles des bougies seulement ; une règle d'indicateur peint son icône en `color`).
   *  Absente : la couleur de la règle. */
  color?: string;
}

/**
 * Une règle de couleur d'un indicateur (onglet Style, « Style conditionnel ») ; se lit comme une phrase :
 * « Quand [a] est [condition] [b] (et [c]) → [effet] en [color] (sinon en [elseColor]), opacité [opacity] ».
 * Remplace les anciennes zones colorées (`IndicatorFill`), converties à la lecture par `indicatorStyleRules`.
 */
export interface IndicatorStyleRule {
  id: string;
  /** Faux : la règle est gardée mais ne peint rien (case décochée). Défaut vrai. */
  enabled?: boolean;
  a: StyleRuleSeriesRef;
  condition: StyleRuleCondition;
  b: StyleRuleOperand;
  /** Deuxième borne de « entre » / « hors de ». */
  c?: StyleRuleOperand;
  effect: StyleRuleEffect;
  /** Couleur quand la condition est vraie. */
  color: string;
  /** Couleur quand elle est fausse (« sinon ») ; absente : rien de ce côté. Ignorée pour un croisement. */
  elseColor?: string | null;
  /** Opacité en %, de 0 à 100. Défaut selon l'effet (voir `defaultRuleOpacity`). */
  opacity?: number;
  /** L'icône de l'effet « icon ». Absente : le point, au-dessus. */
  icon?: RuleIcon;
}
