import type { RsiZoneLevels } from "../rsiZones";
import type { MacdZoneLevels } from "../macdZones";
import type { Divergence } from "./Divergence.interface";

/** Ce qu'un indicateur de panneau trace en plus de sa série, relevé sur tout l'historique (pas sur la partie affichée) :
 *  les lignes de zones d'un RSI, les lignes des pics et des creux d'un MACD, les divergences avec le prix. */
export interface IndicatorPaneExtras {
  /** Lignes d'un « rsiZones » ou d'un RSI avec l'option (voir rsiZones.ts). */
  rsiZoneLevels?: RsiZoneLevels | null;
  /** Lignes des pics et des creux d'un MACD (voir macdZones.ts). */
  macdZoneLevels?: MacdZoneLevels | null;
  /** Divergences d'un RSI ou d'un MACD avec le prix (voir divergences.ts). */
  divergences?: Divergence[] | null;
}
