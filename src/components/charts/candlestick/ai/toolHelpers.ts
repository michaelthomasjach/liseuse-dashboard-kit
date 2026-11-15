import type { Candle } from "../interfaces/Candle.interface";
import type { AiToolOutcome } from "./aiTools";

/** Petits lecteurs d'arguments communs aux outils de contrôle du graphique. */

export const str = (input: Record<string, unknown>, key: string): string | undefined => {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
};
export const num = (input: Record<string, unknown>, key: string): number | undefined => {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value.replace(",", ".")))) return Number(value.replace(",", "."));
  return undefined;
};
export const bool = (input: Record<string, unknown>, key: string): boolean | undefined => {
  const value = input[key];
  return typeof value === "boolean" ? value : undefined;
};

export const fail = (content: string): AiToolOutcome => ({ content, isError: true });
export const ok = (content: string): AiToolOutcome => ({ content });

export const DATE_DOC = "Date au format AAAA-MM-JJ (ou JJ/MM/AAAA), éventuellement suivie de l'heure (AAAA-MM-JJTHH:MM) en intraday.";

/** Une date écrite par le modèle : ISO, ou JJ/MM/AAAA. */
export function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  const date = french ? new Date(Number(french[3]), Number(french[2]) - 1, Number(french[1])) : new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export const isoDay = (d: Date | undefined): string => (d ? d.toISOString().slice(0, 10) : "?");

/** La position (fractionnaire) d'une date parmi les bougies : celle de la bougie la plus proche, prolongée au-delà des
 *  bords au rythme moyen des bougies (même règle que le graphique pour un dessin dans la zone future). */
export function barIndexOf(data: Candle[], date: Date): number {
  const n = data.length;
  if (n === 0) return 0;
  const t = date.getTime();
  const first = data[0].date.getTime();
  const last = data[n - 1].date.getTime();
  if (n > 1 && (t < first || t > last)) {
    const spacing = (last - first) / (n - 1);
    if (spacing > 0) return t < first ? (t - first) / spacing : n - 1 + (t - last) / spacing;
  }
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].date.getTime() < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].date.getTime() - t) <= Math.abs(data[lo].date.getTime() - t)) return lo - 1;
  return lo;
}

/** La bougie à une position, bornée au jeu de données. */
export const candleAt = (data: Candle[], index: number): Candle | undefined => data[Math.max(0, Math.min(data.length - 1, Math.floor(index)))];

/** Écrit un nombre sans décimales inutiles. */
export const fmtNum = (v: number): string => {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  return abs >= 1000 ? v.toFixed(0) : abs >= 10 ? v.toFixed(2) : abs >= 1 ? v.toFixed(3) : v.toPrecision(4);
};

/** Le premier élément d'un texte de description d'outil, pour un catalogue en une ligne. */
export function firstSentence(description: string): string {
  const cut = description.search(/[.!?](\s|$)/);
  return (cut === -1 ? description : description.slice(0, cut + 1)).trim();
}
