/**
 * Format des valeurs d'un indicateur (axe de son panneau, badges de survol, valeur dans sa légende), réglable par
 * indicateur (`Indicator.valueFormat`) ou par un script (`plot.pane(nom, { format })`) :
 * - "auto" (défaut) : le nombre tel quel sous 10 000, puis k / M / B / T (12 345 → « 12.3k », 1e9 → « 1B ») ;
 * - "integer" : pareil, sans décimales sous 10 000 (1234.56 → « 1235 ») ;
 * - "percent" : la valeur est déjà en pourcentage, deux décimales et « % » (21.456 → « 21.46% ») ;
 * - "raw" : le nombre complet, sans abréviation (3562067169.5 → « 3562067169.5 ») ;
 * - un objet : `decimals` (décimales sous 10 000, ou partout si `compact: false`), `compact` (abréviation k / M / B,
 *   oui par défaut), `prefix` / `suffix` (« $ », « € », « % »…).
 */
export type ValueFormat = "auto" | "integer" | "percent" | "raw" | ValueFormatSpec;

export interface ValueFormatSpec {
  /** Décimales des nombres écrits en entier (sous 10 000, ou tous si `compact` vaut false). Défaut 2. */
  decimals?: number;
  /** Abréviation k / M / B / T à partir de 10 000. Défaut true. */
  compact?: boolean;
  /** Texte placé devant le nombre, après le signe : « −$1.2B ». */
  prefix?: string;
  /** Texte placé après le nombre : « 21.5% », « 12k € ». */
  suffix?: string;
}
