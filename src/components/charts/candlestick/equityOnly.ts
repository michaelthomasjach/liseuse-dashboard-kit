import type { Indicator } from "./interfaces/Indicator.interface";
import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "./interfaces/CustomIndicatorDef.interface";
import { isFundamentalKind } from "./indicatorCatalog";

/** Mention d'un indicateur réservé aux actions dans le catalogue, quand le symbole n'en est pas une. */
export const EQUITY_ONLY_NOTE = "Réservé aux actions";
/** Légende d'un indicateur réservé aux actions resté sur le graphique d'un symbole qui n'en est pas une (layout ou
 *  modèle chargé sur un indice). */
export const UNAVAILABLE_FOR_SYMBOL = "Indisponible pour ce symbole";

/** Un indicateur qui n'a de sens que pour une action (une entreprise) : les fondamentaux du catalogue, et les
 *  indicateurs de l'application marqués `CustomIndicatorDef.equityOnly` (une zone de gap des résultats…). */
export function isEquityOnly(target: Indicator | IndicatorKind | CustomIndicatorDef): boolean {
  if (typeof target === "string") return isFundamentalKind(target);
  if ("section" in target) return target.equityOnly === true;
  if (target.customData) return target.customData.equityOnly === true;
  return isFundamentalKind(target.kind);
}

/** Réservé aux actions sur un symbole qui n'en est pas une (`symbolIsEquity === false`) : grisé dans le catalogue, rien
 *  de tracé, « Indisponible pour ce symbole » en légende. `symbolIsEquity` non fourni : rien n'est bloqué. */
export function unavailableForSymbol(target: Indicator | IndicatorKind | CustomIndicatorDef, symbolIsEquity: boolean | undefined): boolean {
  return symbolIsEquity === false && isEquityOnly(target);
}
