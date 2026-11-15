import { formatCompactNumber, formatWithValueFormat, normalizeValueFormat } from "../../formatting";
import type { ValueFormat } from "../../interfaces/ValueFormat.interface";

/**
 * `format.*` dans un script : écrire un nombre comme le graphique l'écrit, pour un label, une cellule de tableau, une
 * alerte ou un `console.log`. Mêmes règles que les axes et les légendes (voir `formatCompactNumber`) :
 * 100 → « 100 », 1000 → « 1000 », 10 000 → « 10k », 1e9 → « 1B », 10.1e9 → « 10.1B ».
 */
export interface FormatApi {
  /** Le nombre tel quel sous 10 000 (avec `decimals` décimales, 2 par défaut), puis k / M / B / T à trois chiffres
   *  significatifs au plus : `format.compact(12345678)` → « 12.3M ». */
  compact(value: number, decimals?: number): string;
  /** Comme `compact`, sans décimales sous 10 000 : `format.integer(1234.56)` → « 1235 ». */
  integer(value: number): string;
  /** Une valeur déjà en pourcentage : `format.percent(21.456)` → « 21.46% ». */
  percent(value: number, decimals?: number): string;
  /** Avec n'importe quel format accepté par `plot.pane(nom, { format })` : `format.number(1.2e9, { prefix: "$" })`
   *  → « $1.2B ». */
  number(value: number, format?: ValueFormat): string;
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const dec = (d: unknown, fallback: number): number => (typeof d === "number" && Number.isFinite(d) ? Math.max(0, Math.min(10, Math.round(d))) : fallback);

export const formatApi: FormatApi = Object.freeze({
  compact: (value: number, decimals?: number) => formatCompactNumber(num(value), (v) => v.toFixed(dec(decimals, 2))),
  integer: (value: number) => formatWithValueFormat(num(value), "integer"),
  percent: (value: number, decimals?: number) => formatWithValueFormat(num(value), { decimals: dec(decimals, 2), compact: false, suffix: "%" }),
  number: (value: number, format?: ValueFormat) => formatWithValueFormat(num(value), normalizeValueFormat(format)),
});
