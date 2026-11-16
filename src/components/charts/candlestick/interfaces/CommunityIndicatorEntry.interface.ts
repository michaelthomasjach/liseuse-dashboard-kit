import type { IndicatorKind } from "./IndicatorKind.interface";
import type { ScriptFile } from "./ScriptDef.interface";

/** Une ligne de l'onglet « Communauté » du catalogue des indicateurs (`CandlestickChartProps.communityIndicators`) :
 *  un indicateur partagé, fourni par l'application. Deux formes :
 *
 *  - `kind` : un indicateur intégré de la bibliothèque (« Détection de range (précoce) »…), ajouté comme depuis le
 *    catalogue ; c'est ainsi que l'application l'affiche (ou le réserve à certaines offres) ;
 *  - `script` : le script d'un autre membre. Cliqué, il est ajouté au graphique **en lecture seule** — une copie
 *    marquée `ScriptDef.community`, qui tourne comme un script du compte, dont on règle les entrées, mais dont le code
 *    ne s'ouvre pas dans l'éditeur (le code se consulte, et se copie dans ses propres scripts si l'éditeur est là).
 *    Quand l'auteur le modifie, la copie suit : son code est relu dans cette liste à chaque rendu.
 *
 *  Seuls les scripts d'indicateur sont listés (pas les `@strategy`, `@quant` ni `@report`). */
export interface CommunityIndicatorEntry {
  /** Identifiant stable de la ligne (celui que garde la copie d'un script : `ScriptDef.community.entryId`). */
  id: string;
  label: string;
  /** Nom affiché de l'auteur (« par Marie D. ») — jamais une adresse e-mail. */
  author?: string;
  /** Une phrase, en infobulle de la ligne. */
  description?: string;
  kind?: IndicatorKind;
  script?: { code: string; files?: ScriptFile[] };
}
