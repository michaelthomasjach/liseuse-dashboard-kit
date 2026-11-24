import type { Candle } from "./interfaces/Candle.interface";
import type { ChartRangeAsk, ChartRangeAskKind, ChartRangeAskRequest } from "./interfaces/ChartRangeAsk.interface";

/** Les trois questions toutes faites de l'infobulle, dans l'ordre affiché. */
export const RANGE_ASK_OPTIONS: { kind: Exclude<ChartRangeAskKind, "custom">; label: string }[] = [
  { kind: "explain", label: "Expliquer ce mouvement de prix" },
  { kind: "events", label: "Trouver les évènements derrière ce mouvement" },
  { kind: "technicals", label: "Analyser la technique de cette zone" },
];

const INSTRUCTIONS: Record<ChartRangeAskKind, string> = {
  explain:
    "Explique ce mouvement de prix : ce qui s'est passé sur cette zone (sens, ampleur, rythme, moments clés) et les raisons les plus probables. Reste factuel et concis.",
  events:
    "Trouve les évènements qui expliquent ce mouvement sur cette période : actualités, publications économiques, résultats d'entreprise, décisions ou discours de banques centrales. Cherche-les avec tes outils, cite la source et la date de chacun, et relie chaque évènement au moment du mouvement qu'il explique.",
  technicals:
    "Analyse techniquement cette zone : tendance, supports et résistances, figures, volumes et ce que disent les indicateurs affichés sur le graphique. Termine par les niveaux à surveiller.",
  custom: "",
};

/** Bornes d'une zone : dates triées (la première sélectionnée peut être la plus récente). */
export function orderedRange(a: Date, b: Date): ChartRangeAsk {
  return a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a };
}

/** Les bougies de la zone, bornes comprises. */
export function candlesInRange(data: Candle[], range: ChartRangeAsk): Candle[] {
  const from = range.from.getTime();
  const to = range.to.getTime();
  return data.filter((c) => {
    const t = c.date.getTime();
    return t >= from && t <= to;
  });
}

/** Les chiffres d'une zone : ouverture, clôture, variation, plus haut et plus bas (avec leur date), volume. Null sans
 *  bougie. */
export function rangeStats(candles: Candle[]) {
  if (candles.length === 0) return null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  let high = first;
  let low = first;
  let volume = 0;
  let hasVolume = false;
  for (const c of candles) {
    if (c.high > high.high) high = c;
    if (c.low < low.low) low = c;
    if (typeof c.volume === "number") {
      volume += c.volume;
      hasVolume = true;
    }
  }
  const change = last.close - first.open;
  return {
    count: candles.length,
    open: first.open,
    close: last.close,
    change,
    changePct: first.open !== 0 ? (change / first.open) * 100 : null,
    high: high.high,
    highAt: high.date,
    low: low.low,
    lowAt: low.date,
    amplitudePct: low.low !== 0 ? ((high.high - low.low) / low.low) * 100 : null,
    volume: hasVolume ? volume : null,
  };
}

/** Au-delà, les bougies sont échantillonnées pour que la demande reste courte (la première et la dernière restent). */
const MAX_PROMPT_CANDLES = 150;

function sample(candles: Candle[]): Candle[] {
  if (candles.length <= MAX_PROMPT_CANDLES) return candles;
  const step = (candles.length - 1) / (MAX_PROMPT_CANDLES - 1);
  return Array.from({ length: MAX_PROMPT_CANDLES }, (_, i) => candles[Math.round(i * step)]);
}

const num = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(2) : Number(v.toPrecision(6)).toString());

/** La demande complète envoyée pour une zone : le contexte (symbole, unité de temps, dates, chiffres, bougies) puis
 *  la question. */
export function buildRangeAskRequest(args: {
  kind: ChartRangeAskKind;
  question?: string;
  range: ChartRangeAsk;
  data: Candle[];
  symbol?: string;
  timeframe?: string;
  formatDate: (d: Date) => string;
}): ChartRangeAskRequest {
  const { kind, range, data, symbol, timeframe, formatDate } = args;
  const candles = candlesInRange(data, range);
  const label = kind === "custom" ? (args.question ?? "").trim() : RANGE_ASK_OPTIONS.find((o) => o.kind === kind)!.label;
  const stats = rangeStats(candles);
  const lines: string[] = [];
  lines.push(
    `Zone sélectionnée sur le graphique${symbol ? ` de ${symbol}` : ""}${timeframe ? ` (unité de temps ${timeframe})` : ""} : du ${formatDate(range.from)} au ${formatDate(range.to)}, ${candles.length} bougie${candles.length > 1 ? "s" : ""}.`
  );
  if (stats) {
    const pct = stats.changePct === null ? "" : ` (${stats.changePct >= 0 ? "+" : ""}${stats.changePct.toFixed(2)} %)`;
    lines.push(
      `Ouverture ${num(stats.open)}, clôture ${num(stats.close)}, variation ${stats.change >= 0 ? "+" : ""}${num(stats.change)}${pct}. Plus haut ${num(stats.high)} (${formatDate(stats.highAt)}), plus bas ${num(stats.low)} (${formatDate(stats.lowAt)})${stats.volume !== null ? `, volume total ${Math.round(stats.volume)}` : ""}.`
    );
    const rows = sample(candles).map(
      (c) => `${c.date.toISOString()};${num(c.open)};${num(c.high)};${num(c.low)};${num(c.close)}${typeof c.volume === "number" ? `;${Math.round(c.volume)}` : ""}`
    );
    lines.push(
      `Bougies de la zone${rows.length < candles.length ? ` (${rows.length} sur ${candles.length}, échantillonnées)` : ""} — date;ouverture;haut;bas;clôture;volume :`,
      ...rows
    );
  }
  lines.push("", kind === "custom" ? `Question : ${label}` : INSTRUCTIONS[kind]);
  const summary = `${label}\n(zone du ${formatDate(range.from)} au ${formatDate(range.to)}, ${candles.length} bougie${candles.length > 1 ? "s" : ""})`;
  return { kind, question: label, from: range.from, to: range.to, candles, symbol, timeframe, prompt: lines.join("\n"), summary };
}
