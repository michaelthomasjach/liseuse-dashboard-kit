import type { AiTool, AiToolOutcome } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiToolDefinition } from "./interfaces/AiMessage.interface";
import type { AiWorkspaceArrangement } from "./interfaces/AiWorkspaceControls.interface";
import type { Candle } from "../interfaces/Candle.interface";
import type { OverlayDataPoint } from "../interfaces/TrendLineDrawing.interface";

/**
 * Outils de comparaison entre symboles : plusieurs symboles côte à côte dans l'espace de travail, leurs performances
 * chiffrées sur une période, et l'indice « A / B » d'un symbole rapporté à un autre.
 *
 * Toutes les bougies viennent de l'application (`AiChartContext.loadCandles`, la série affichée sinon) : ces outils
 * calculent, ils n'inventent rien — un symbole sans données est signalé comme tel.
 */

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const DATE_DOC = "Date au format AAAA-MM-JJ ou JJ/MM/AAAA.";

const str = (input: Record<string, unknown>, key: string): string | undefined => {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
};
const day = (d: Date): string => d.toISOString().slice(0, 10);
const sameSymbol = (a: string | undefined, b: string | undefined): boolean =>
  a !== undefined && b !== undefined && a.trim().toUpperCase() === b.trim().toUpperCase();

/** Comme les autres outils : ISO ou JJ/MM/AAAA. */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  const date = french ? new Date(Number(french[3]), Number(french[2]) - 1, Number(french[1])) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Les symboles demandés : nettoyés, en majuscules (comme changer_de_symbole), sans doublon. */
function symbolList(input: Record<string, unknown>, key: string, max: number): string[] {
  const raw = Array.isArray(input[key]) ? (input[key] as unknown[]) : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const s = item.trim().toUpperCase();
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, max);
}

const pct = (x: number): string => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2)} %`;
/** Un cours lisible : six chiffres significatifs, sans zéros inutiles (un ratio vaut souvent 0,0x). */
const price = (v: number): string => String(Number(v.toPrecision(6)));

/** Une série prête à mesurer : bougies triées, valeurs finies. */
interface Series {
  symbol: string;
  candles: Candle[];
}

function clean(candles: Candle[]): Candle[] {
  return candles
    .filter((c) => c && c.date instanceof Date && Number.isFinite(c.date.getTime()) && [c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Les séries des symboles demandés : celle du graphique pour son propre symbole, celles de l'application sinon. */
async function loadSeries(chart: AiChartContext, symbols: string[]): Promise<{ series: Series[]; missing: string[] }> {
  const results = await Promise.all(
    symbols.map(async (symbol): Promise<Series | string> => {
      if (sameSymbol(symbol, chart.symbol)) {
        const candles = clean(chart.data);
        return candles.length > 0 ? { symbol, candles } : `${symbol} (aucune bougie sur le graphique)`;
      }
      if (!chart.loadCandles) return `${symbol} (l'application ne fournit pas les bougies d'autres symboles)`;
      try {
        const candles = clean(await chart.loadCandles(symbol));
        return candles.length > 0 ? { symbol, candles } : `${symbol} (aucune bougie fournie par l'application)`;
      } catch (err) {
        return `${symbol} (chargement impossible : ${err instanceof Error ? err.message : String(err)})`;
      }
    }),
  );
  return {
    series: results.filter((r): r is Series => typeof r !== "string"),
    missing: results.filter((r): r is string => typeof r === "string"),
  };
}

/** Écart typique entre deux bougies (médiane). */
function medianSpacing(candles: Candle[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < candles.length; i++) gaps.push(candles[i].date.getTime() - candles[i - 1].date.getTime());
  if (gaps.length === 0) return DAY;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** La case de temps qui met en face les bougies de deux symboles (comme le serveur pour ses symboles personnalisés) :
 *  le mois, le lundi de la semaine ou le jour UTC selon l'unité de temps, sinon l'intervalle lui-même — deux sources
 *  ne datent pas leurs bougies journalières à la même heure. */
function bucketer(spacing: number): (d: Date) => number {
  if (spacing >= 27 * DAY) return (d) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  if (spacing >= 6 * DAY) {
    return (d) => {
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return dayStart - ((d.getUTCDay() + 6) % 7) * DAY;
    };
  }
  if (spacing >= 20 * 3_600_000) return (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const step = Math.max(60_000, Math.round(spacing / 60_000) * 60_000);
  return (d) => Math.floor(d.getTime() / step) * step;
}

/** Bougies par an, mesurées sur l'historique lui-même (≈ 252 en journalier, 52 en hebdomadaire, nuits et week-ends
 *  compris en intrajournalier) : ce qui annualise une volatilité sans supposer d'horaires de marché. */
function barsPerYear(candles: Candle[]): number | null {
  if (candles.length < 3) return null;
  const span = candles[candles.length - 1].date.getTime() - candles[0].date.getTime();
  return span > 0 ? (candles.length - 1) / (span / YEAR) : null;
}

interface Performance {
  symbol: string;
  base: number;
  /** Date de la clôture de référence (la dernière avant la période), null : ouverture de la première bougie. */
  baseDate: Date | null;
  first: Candle;
  last: Candle;
  change: number;
  high: { value: number; date: Date };
  low: { value: number; date: Date };
  maxDrawdown: number;
  volatility: number | null;
  count: number;
}

/** Performance d'une série entre deux dates : depuis la dernière clôture avant `start` (l'ouverture de la première
 *  bougie à défaut) jusqu'à la dernière clôture au plus tard `end`. */
function measure(s: Series, start: Date, end: Date): Performance | null {
  const c = s.candles;
  const firstIdx = c.findIndex((k) => k.date >= start);
  if (firstIdx === -1) return null;
  let lastIdx = -1;
  for (let i = c.length - 1; i >= firstIdx; i--) {
    if (c[i].date <= end) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx === -1) return null;
  const inside = c.slice(firstIdx, lastIdx + 1);
  const before = firstIdx > 0 ? c[firstIdx - 1] : null;
  const base = before ? before.close : inside[0].open;
  if (!(base > 0)) return null;
  const last = inside[inside.length - 1];
  let high = inside[0];
  let low = inside[0];
  for (const k of inside) {
    if (k.high > high.high) high = k;
    if (k.low < low.low) low = k;
  }
  const closes = [base, ...inside.map((k) => k.close)];
  let peak = closes[0];
  let maxDrawdown = 0;
  for (const v of closes) {
    if (v > peak) peak = v;
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, v / peak - 1);
  }
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i] > 0 && closes[i - 1] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
  const perYear = barsPerYear(c);
  let volatility: number | null = null;
  if (returns.length >= 2 && perYear !== null) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
    volatility = Math.sqrt(variance) * Math.sqrt(perYear);
  }
  return {
    symbol: s.symbol,
    base,
    baseDate: before ? before.date : null,
    first: inside[0],
    last,
    change: last.close / base - 1,
    high: { value: high.high, date: high.date },
    low: { value: low.low, date: low.date },
    maxDrawdown,
    volatility,
    count: inside.length,
  };
}

/** Corrélation des rendements de deux séries sur leurs cases de temps communes de la période. */
function correlation(a: Series, b: Series, start: Date, end: Date, bucketOf: (d: Date) => number): { value: number; n: number } | null {
  const closesB = new Map<number, number>();
  for (const k of b.candles) if (k.date >= start && k.date <= end) closesB.set(bucketOf(k.date), k.close);
  const pairs: [number, number][] = [];
  for (const k of a.candles) {
    if (k.date < start || k.date > end) continue;
    const other = closesB.get(bucketOf(k.date));
    if (other !== undefined && other > 0 && k.close > 0) pairs.push([k.close, other]);
  }
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < pairs.length; i++) {
    ra.push(Math.log(pairs[i][0] / pairs[i - 1][0]));
    rb.push(Math.log(pairs[i][1] / pairs[i - 1][1]));
  }
  if (ra.length < 10) return null;
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length;
  const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return null;
  return { value: cov / Math.sqrt(va * vb), n: ra.length };
}

/** Bougies « A / B » sur les cases de temps où les deux symboles ont une bougie : chaque prix de A divisé par le même
 *  prix de B, le plus haut et le plus bas ramenés autour de l'ouverture et de la clôture (comme le serveur). */
export function ratioCandles(a: Candle[], b: Candle[]): Candle[] {
  const bucketOf = bucketer(Math.min(medianSpacing(a), medianSpacing(b)));
  const byBucket = new Map<number, Candle>();
  for (const k of b) byBucket.set(bucketOf(k.date), k);
  const out: Candle[] = [];
  for (const k of a) {
    const m = byBucket.get(bucketOf(k.date));
    if (!m || !(m.open > 0 && m.high > 0 && m.low > 0 && m.close > 0)) continue;
    const open = k.open / m.open;
    const close = k.close / m.close;
    const high = k.high / m.high;
    const low = k.low / m.low;
    out.push({ date: k.date, open, high: Math.max(open, high, low, close), low: Math.min(open, high, low, close), close });
  }
  return out;
}

const toOverlay = (candles: Candle[]): OverlayDataPoint[] =>
  candles.map((c) => ({ date: c.date, value: c.close, open: c.open, high: c.high, low: c.low }));

type PeriodKey = "5j" | "1m" | "3m" | "6m" | "ytd" | "1a" | "3a" | "5a" | "10a" | "tout";
const PERIODS: Record<PeriodKey, string> = {
  "5j": "5 derniers jours",
  "1m": "1 mois",
  "3m": "3 mois",
  "6m": "6 mois",
  ytd: "depuis le début de l'année",
  "1a": "1 an",
  "3a": "3 ans",
  "5a": "5 ans",
  "10a": "10 ans",
  tout: "tout l'historique commun",
};
const isPeriod = (v: string | undefined): v is PeriodKey => v !== undefined && v in PERIODS;

function periodStart(key: PeriodKey, end: Date, series: Series[]): Date {
  const d = new Date(end.getTime());
  switch (key) {
    case "5j":
      return new Date(end.getTime() - 5 * DAY);
    case "1m":
    case "3m":
    case "6m":
      d.setUTCMonth(d.getUTCMonth() - Number(key.slice(0, -1)));
      return d;
    case "ytd":
      return new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    case "1a":
    case "3a":
    case "5a":
    case "10a":
      d.setUTCFullYear(d.getUTCFullYear() - Number(key.slice(0, -1)));
      return d;
    case "tout":
      // La même fenêtre pour tous : à partir du symbole à l'historique le plus court.
      return new Date(Math.max(...series.map((s) => s.candles[0].date.getTime())));
  }
}

const MEASURE_TOOL: AiTool = {
  definition: {
    name: "mesurer_la_performance",
    description:
      "Compare la performance de plusieurs symboles sur une même période, à partir des bougies fournies par l'application (unité de temps du graphique) : variation en %, plus haut et plus bas, plus forte baisse depuis un sommet, volatilité annualisée, écart de performance et corrélation des rendements avec le premier symbole (la référence). Période : « debut »/« fin », ou « periode » (ytd = depuis le début de l'année), ou les N dernières bougies. Avec « superposer », les autres symboles sont aussi superposés au graphique affiché (comparaison en %, base commune). Pour les afficher dans des fenêtres séparées, utilisez comparer_cote_a_cote.",
    inputSchema: {
      type: "object",
      properties: {
        symboles: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 8,
          description: "Les symboles à comparer, tickers de l'application (ex. « AAPL », « GC=F », « ^GSPC »). Le premier est la référence des écarts et de la corrélation.",
        },
        periode: {
          type: "string",
          enum: Object.keys(PERIODS),
          description: "5j, 1m, 3m, 6m, ytd (depuis le 1er janvier), 1a, 3a, 5a, 10a, tout (historique commun à tous). 1a par défaut, sans « debut » ni « derniers ».",
        },
        debut: { type: "string", description: `${DATE_DOC} Prioritaire sur « periode » et « derniers ».` },
        fin: { type: "string", description: `${DATE_DOC} Par défaut : la dernière bougie disponible.` },
        derniers: { type: "integer", minimum: 2, description: "Les N dernières bougies de la référence, à défaut de « debut » et de « periode »." },
        avec_le_graphique: {
          type: "boolean",
          description:
            "Ajoute en tête, comme référence, la série du graphique affiché (sous son nom affiché). Par défaut : vrai si un seul symbole est donné, faux sinon. Inutile si son symbole est déjà dans la liste.",
        },
        superposer: { type: "boolean", description: "Superpose aussi les autres symboles au graphique affiché (comparaison de symboles, axe en %). Faux par défaut." },
      },
      required: ["symboles"],
      additionalProperties: false,
    },
  },
  run: async (input, chart): Promise<AiToolOutcome> => {
    const requested = symbolList(input, "symboles", 8);
    if (requested.length === 0) return { content: "Aucun symbole fourni.", isError: true };
    const withChart = typeof input.avec_le_graphique === "boolean" ? input.avec_le_graphique : requested.length === 1;
    const chartSymbol = chart.symbol?.trim();
    const includeChart = withChart && chartSymbol !== undefined && chartSymbol !== "" && !requested.some((s) => sameSymbol(s, chartSymbol)) && chart.data.length > 0;
    const symbols = includeChart ? [chartSymbol as string, ...requested].slice(0, 8) : requested;

    const { series, missing } = await loadSeries(chart, symbols);
    if (series.length === 0) return { content: `Aucune donnée : ${missing.join(" ; ")}.`, isError: true };

    // La fin : la date demandée, sinon la dernière bougie de tous les symboles ; chacun s'arrête à sa dernière
    // bougie au plus tard à cette date.
    const endRaw = str(input, "fin");
    const endDay = parseDate(endRaw);
    if (endRaw && !endDay) return { content: `Date de fin illisible. ${DATE_DOC}`, isError: true };
    // Une date de fin compte la journée entière.
    const end = endDay ? new Date(endDay.getTime() + DAY - 1) : new Date(Math.max(...series.map((s) => s.candles[s.candles.length - 1].date.getTime())));

    const startRaw = str(input, "debut");
    const periodRaw = str(input, "periode");
    const lastN = typeof input.derniers === "number" && Number.isFinite(input.derniers) ? Math.max(2, Math.round(input.derniers)) : undefined;
    let start: Date;
    let periodLabel: string;
    if (startRaw) {
      const parsed = parseDate(startRaw);
      if (!parsed) return { content: `Date de début illisible. ${DATE_DOC}`, isError: true };
      start = parsed;
      periodLabel = `du ${day(parsed)}`;
    } else if (isPeriod(periodRaw)) {
      start = periodStart(periodRaw, end, series);
      periodLabel = PERIODS[periodRaw];
    } else if (lastN !== undefined) {
      const ref = series[0].candles.filter((c) => c.date <= end);
      start = (ref[Math.max(0, ref.length - lastN)] ?? series[0].candles[0]).date;
      periodLabel = `${lastN} dernières bougies de ${series[0].symbol}`;
    } else {
      start = periodStart("1a", end, series);
      periodLabel = PERIODS["1a"];
    }
    if (start > end) return { content: "La date de début est après la date de fin.", isError: true };

    const perfs: Performance[] = [];
    const outside: string[] = [];
    for (const s of series) {
      const p = measure(s, start, end);
      if (p) perfs.push(p);
      else outside.push(`${s.symbol} (aucune bougie sur la période ; historique du ${day(s.candles[0].date)} au ${day(s.candles[s.candles.length - 1].date)})`);
    }
    if (perfs.length === 0) return { content: `Aucune bougie sur la période demandée : ${outside.join(" ; ")}.`, isError: true };

    const lines: string[] = [];
    lines.push(`Performance comparée — ${periodLabel} (${day(start)} → ${day(end)})${chart.timeframe ? `, unité de temps ${chart.timeframe}` : ""}.`);
    lines.push("Symbole | Variation (de → à) | Plus haut | Plus bas | Plus forte baisse | Volatilité annualisée | Bougies");
    for (const p of perfs) {
      lines.push(
        [
          p.symbol,
          `${pct(p.change)} (${price(p.base)}${p.baseDate ? ` le ${day(p.baseDate)}` : ` à l'ouverture du ${day(p.first.date)}`} → ${price(p.last.close)} le ${day(p.last.date)})`,
          `${price(p.high.value)} le ${day(p.high.date)}`,
          `${price(p.low.value)} le ${day(p.low.date)}`,
          pct(p.maxDrawdown),
          p.volatility === null ? "n.d." : `${(p.volatility * 100).toFixed(1)} %`,
          String(p.count),
        ].join(" | "),
      );
    }

    if (perfs.length >= 2) {
      const ref = perfs[0];
      const refSeries = series.find((s) => s.symbol === ref.symbol) as Series;
      const bucketOf = bucketer(medianSpacing(refSeries.candles));
      lines.push("");
      lines.push(`Écarts avec ${ref.symbol} (référence) :`);
      for (const p of perfs.slice(1)) {
        const other = series.find((s) => s.symbol === p.symbol) as Series;
        const corr = correlation(refSeries, other, start, end, bucketOf);
        const relative = (1 + p.change) / (1 + ref.change) - 1;
        lines.push(
          `- ${p.symbol} : ${((p.change - ref.change) * 100 >= 0 ? "+" : "−") + Math.abs((p.change - ref.change) * 100).toFixed(2)} points ; rapport ${p.symbol} / ${ref.symbol} ${pct(relative)} ; corrélation des rendements ${corr ? `${corr.value.toFixed(2).replace(/^-(0.00)$/, "$1").replace("-", "−")} (${corr.n} rendements communs)` : "n.d. (trop peu de bougies communes)"}`,
        );
      }
      const ranked = [...perfs].sort((a, b) => b.change - a.change);
      lines.push(`Classement : ${ranked.map((p) => `${p.symbol} ${pct(p.change)}`).join(" > ")}.`);
    }

    if (input.superposer === true) {
      if (!chart.addComparison) {
        lines.push("", "Superposition impossible : ce graphique ne propose pas la comparaison de symboles.");
      } else {
        const added: string[] = [];
        const already: string[] = [];
        for (const s of series) {
          if (sameSymbol(s.symbol, chart.symbol)) continue;
          (chart.addComparison(s.symbol, s.symbol, toOverlay(s.candles)) ? added : already).push(s.symbol);
        }
        if (added.length) lines.push("", `Superposé au graphique (comparaison en %, base commune) : ${added.join(", ")}.`);
        if (already.length) lines.push(`Déjà superposé : ${already.join(", ")}.`);
      }
    }
    if (missing.length || outside.length) lines.push("", `Sans données : ${[...missing, ...outside].join(" ; ")}.`);
    return { content: lines.join("\n") };
  },
};

const ARRANGEMENTS: AiWorkspaceArrangement[] = ["cote_a_cote", "empilees", "grille"];

const SIDE_BY_SIDE_TOOL: AiTool = {
  definition: {
    name: "comparer_cote_a_cote",
    description:
      "Divise l'espace de travail en plusieurs fenêtres et affiche un symbole par fenêtre, pour comparer des graphiques côte à côte (2 à 8 symboles ; la fenêtre 1 reçoit le premier). Toutes les fenêtres prennent l'unité de temps de la fenêtre 1, et l'application charge les bougies de chacune. Pour garder le graphique affiché, mettez son symbole en premier. Pour chiffrer l'écart ensuite : mesurer_la_performance ; pour un rapport A/B : creer_un_indice_ratio.",
    inputSchema: {
      type: "object",
      properties: {
        symboles: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 8,
          description: "Les symboles, un par fenêtre, dans l'ordre (tickers de l'application, ex. « GC=F », « ^GSPC »).",
        },
        disposition: {
          type: "string",
          enum: ARRANGEMENTS,
          description: "cote_a_cote (une seule ligne), empilees (une seule colonne) ou grille. Par défaut : côte à côte jusqu'à 3 symboles, grille au-delà.",
        },
      },
      required: ["symboles"],
      additionalProperties: false,
    },
  },
  run: (input, chart) => {
    const workspace = chart.workspace;
    if (!workspace) return { content: "Ce graphique n'est pas dans un espace de travail à plusieurs fenêtres.", isError: true };
    let symbols = symbolList(input, "symboles", workspace.maxPanels);
    if (symbols.length < 2) return { content: "Il faut au moins deux symboles différents.", isError: true };
    // Le symbole déjà affiché garde la fenêtre 1 : son graphique n'est pas rechargé.
    const current = symbols.findIndex((s) => sameSymbol(s, chart.symbol));
    if (current > 0) symbols = [symbols[current], ...symbols.filter((_, i) => i !== current)];
    const raw = str(input, "disposition");
    const arrangement: AiWorkspaceArrangement = ARRANGEMENTS.includes(raw as AiWorkspaceArrangement) ? (raw as AiWorkspaceArrangement) : symbols.length <= 3 ? "cote_a_cote" : "grille";
    const { layoutLabel, timeframe } = workspace.showSymbols(symbols, arrangement);
    return {
      content:
        `Espace de travail : ${layoutLabel}. ${symbols.map((s, i) => `Fenêtre ${i + 1} : ${s}`).join(" ; ")}${timeframe ? ` (unité de temps ${timeframe})` : ""}. ` +
        "L'application charge les bougies de chaque fenêtre ; un symbole qu'elle ne connaît pas restera vide. Pour les chiffres, appelez mesurer_la_performance avec ces symboles.",
    };
  },
};

type RatioDisplay = "nouvelle_fenetre" | "graphique" | "superposer";

function ratioDisplays(chart: AiChartContext): RatioDisplay[] {
  const out: RatioDisplay[] = [];
  if (chart.ratioSymbol && chart.workspace) out.push("nouvelle_fenetre");
  if (chart.ratioSymbol && chart.setSymbol) out.push("graphique");
  if (chart.loadCandles && chart.addComparison) out.push("superposer");
  return out;
}

const RATIO_DISPLAY_DOC: Record<RatioDisplay, string> = {
  nouvelle_fenetre: "nouvelle_fenetre : l'indice s'ouvre dans une fenêtre de plus de l'espace de travail (le graphique actuel reste)",
  graphique: "graphique : l'indice remplace le symbole de ce graphique",
  superposer: "superposer : l'indice, calculé ici bougie par bougie, est superposé à ce graphique (comparaison en %)",
};

function ratioDefinition(displays: RatioDisplay[]): AiToolDefinition {
  return {
    name: "creer_un_indice_ratio",
    description:
      "Crée un indice « A / B » : le cours du symbole A divisé par celui du symbole B, bougie par bougie sur les dates communes (par exemple l'or rapporté au S&P 500, GC=F / ^GSPC). Il monte quand A fait mieux que B. Rend aussi, quand l'application fournit les bougies, les chiffres de l'indice (première et dernière valeur, variation, plus haut, plus bas).",
    inputSchema: {
      type: "object",
      properties: {
        numerateur: { type: "string", description: "Le symbole A, au numérateur (ticker de l'application, ex. « GC=F »)." },
        denominateur: { type: "string", description: "Le symbole B, au dénominateur (ex. « ^GSPC »)." },
        affichage: {
          type: "string",
          enum: displays,
          description: `${displays.map((d) => RATIO_DISPLAY_DOC[d]).join(" ; ")}. Par défaut : ${displays[0]}.`,
        },
      },
      required: ["numerateur", "denominateur"],
      additionalProperties: false,
    },
  };
}

const RATIO_TOOL: AiTool = {
  definition: ratioDefinition(["nouvelle_fenetre", "graphique", "superposer"]),
  definitionFor: (chart) => ratioDefinition(ratioDisplays(chart)),
  run: async (input, chart): Promise<AiToolOutcome> => {
    const a = str(input, "numerateur")?.trim().toUpperCase();
    const b = str(input, "denominateur")?.trim().toUpperCase();
    if (!a || !b) return { content: "Il faut un numérateur et un dénominateur.", isError: true };
    if (sameSymbol(a, b)) return { content: "Le numérateur et le dénominateur sont le même symbole : l'indice vaudrait 1.", isError: true };
    const displays = ratioDisplays(chart);
    if (displays.length === 0) return { content: "Ce graphique ne permet pas d'afficher un indice ratio.", isError: true };
    const asked = str(input, "affichage") as RatioDisplay | undefined;
    if (asked !== undefined && !displays.includes(asked)) return { content: `Affichage « ${asked} » indisponible ici. Possibles : ${displays.join(", ")}.`, isError: true };
    const display = asked ?? displays[0];
    const label = `${a} / ${b}`;

    // Les chiffres de l'indice, calculés sur les bougies de l'application (quand elle les fournit).
    let candles: Candle[] = [];
    let missing: string[] = [];
    if (chart.loadCandles || sameSymbol(a, chart.symbol) || sameSymbol(b, chart.symbol)) {
      const loaded = await loadSeries(chart, [a, b]);
      missing = loaded.missing;
      const sa = loaded.series.find((s) => s.symbol === a);
      const sb = loaded.series.find((s) => s.symbol === b);
      if (sa && sb) candles = ratioCandles(sa.candles, sb.candles);
    }

    let shown: string;
    if (display === "superposer") {
      if (candles.length === 0) {
        return {
          content: `Impossible de calculer ${label} : ${missing.length ? missing.join(" ; ") : "aucune date commune entre les deux symboles"}.`,
          isError: true,
        };
      }
      const added = chart.addComparison?.(label, label, toOverlay(candles)) ?? false;
      shown = added ? `Indice ${label} superposé au graphique (comparaison de symboles, axe en % depuis la première bougie visible).` : `L'indice ${label} est déjà superposé au graphique.`;
    } else {
      const hostSymbol = chart.ratioSymbol?.(a, b) ?? null;
      if (!hostSymbol) return { content: `L'application ne sait pas afficher l'indice ${label} comme un symbole. Essayez affichage « superposer ».`, isError: true };
      if (display === "nouvelle_fenetre") {
        const index = chart.workspace?.addPanel(hostSymbol) ?? null;
        if (index === null) {
          return { content: `L'espace de travail a déjà ${chart.workspace?.maxPanels ?? 8} fenêtres. Utilisez affichage « graphique » ou « superposer ».`, isError: true };
        }
        shown = `Indice ${label} ouvert dans la fenêtre ${index + 1} (symbole « ${hostSymbol} » de l'application, bougies calculées par elle).`;
      } else {
        chart.setSymbol?.(hostSymbol);
        shown = `Indice ${label} affiché sur ce graphique (symbole « ${hostSymbol} » de l'application, bougies calculées par elle).`;
      }
    }

    if (candles.length > 0) {
      const first = candles[0];
      const last = candles[candles.length - 1];
      let high = first;
      let low = first;
      for (const k of candles) {
        if (k.high > high.high) high = k;
        if (k.low < low.low) low = k;
      }
      shown +=
        `\nChiffres de ${label} sur ${candles.length} bougies communes${chart.timeframe ? ` (${chart.timeframe})` : ""} : ` +
        `${price(first.close)} le ${day(first.date)} → ${price(last.close)} le ${day(last.date)} (${pct(last.close / first.close - 1)}) ; ` +
        `plus haut ${price(high.high)} le ${day(high.date)}, plus bas ${price(low.low)} le ${day(low.date)}.`;
    } else if (missing.length) {
      shown += `\nChiffres indisponibles : ${missing.join(" ; ")}.`;
    }
    return { content: shown };
  },
};

/** Les trois outils, et quand chacun est proposé (voir `availableAiTools`). */
export const COMPARISON_TOOLS: AiTool[] = [SIDE_BY_SIDE_TOOL, MEASURE_TOOL, RATIO_TOOL];

export function comparisonToolAvailable(name: string, chart: AiChartContext): boolean | undefined {
  if (name === SIDE_BY_SIDE_TOOL.definition.name) return chart.workspace !== undefined;
  if (name === MEASURE_TOOL.definition.name) return chart.loadCandles !== undefined;
  if (name === RATIO_TOOL.definition.name) return ratioDisplays(chart).length > 0;
  return undefined;
}
