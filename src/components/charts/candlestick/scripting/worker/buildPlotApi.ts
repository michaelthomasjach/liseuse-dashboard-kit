import type { ScriptBandSeries, ScriptDrawingOutput, ScriptPlotSeries, ScriptTableOutput, ScriptTableRow } from "../interfaces/ScriptRunResult.interface";

/** Hard caps on `plot.table()`'s own output — the one `plot.*` call whose size a script directly
 *  controls (an accidental `rows` from an unbounded loop, or a giant string in a cell) rather than
 *  it being naturally bounded by the replay length the way `plots`/`drawings` already are. Silent
 *  truncation (not a thrown error) matches every other size limit this engine already has
 *  (`market.series()`'s own `maxSeriesLength`) — a script that exceeds one still runs. */
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_CELL_LENGTH = 200;

function truncateCell(value: string): string {
  return value.length > MAX_TABLE_CELL_LENGTH ? `${value.slice(0, MAX_TABLE_CELL_LENGTH - 1)}…` : value;
}

export interface PlotSeriesOptions {
  color?: string;
  /** Stroke width in px — default 1.5, matching every built-in line-shaped indicator's own
   *  hardcoded width (see `CustomIndicatorDef.lineWidth`'s own doc, which this ends up on). No
   *  effect on `histogram` (bars, not a stroke). */
  lineWidth?: number;
  /** Default `"solid"`. */
  lineStyle?: "solid" | "dashed" | "dotted";
}
export interface PlotBandOptions {
  color?: string;
  /** Width in px of the band's own upper/lower lines (the middle line is drawn slightly thicker,
   *  same relationship the built-in Bollinger Bands rendering already has). Default 1. */
  lineWidth?: number;
}
export interface PlotSignalArg {
  type?: string;
  price?: number;
  color?: string;
  shape?: string;
  /** A short label rendered next to the marker — `type: "BUY"` alone only picks the arrow's own
   *  direction, this is what actually puts the word "BUY" on the chart next to it. */
  text?: string;
}

export interface PlotApi {
  /** Continuous series, one point appended per bar — placed in its own sub-pane by default (the
   *  common case for a script-computed score/oscillator, which is rarely on the price scale). */
  line(name: string, value: number, options?: PlotSeriesOptions): void;
  area(name: string, value: number, options?: PlotSeriesOptions): void;
  histogram(name: string, value: number, options?: PlotSeriesOptions): void;
  /** Forces price-pane placement regardless of `line`/`area`/`histogram`'s own default — always
   *  drawn as a line (an overlay's own draw style isn't configurable the same way a sub-pane
   *  series' is, matching every built-in price-overlay indicator in this library). */
  overlay(name: string, value: number, options?: PlotSeriesOptions): void;
  /** Forces sub-pane placement — identical to `line`'s own default, kept as an explicit alias
   *  purely because the platform's own spec names both `plot.line`/`plot.panel` separately. */
  panel(name: string, value: number, options?: PlotSeriesOptions): void;
  /** A translucent fill between two curves, plus thin upper/lower lines and a computed middle
   *  line — own sub-pane by default (same `line`/`panel` pairing `overlay` already breaks out of).
   *  Same "same name across bars extends one continuous band" upsert rule as `line`/`overlay`. */
  band(name: string, upper: number, lower: number, options?: PlotBandOptions): void;
  /** Forces price-pane placement — the `band` counterpart to `overlay` (a volatility envelope
   *  around price, a high/low channel, anything that *is* a price rather than an oscillator). */
  bandOverlay(name: string, upper: number, lower: number, options?: PlotBandOptions): void;
  /** `arg` may be a bare `"BUY"`/`"SELL"`-style string (the platform's own shorthand — see the
   *  first example in its spec) or the full options object; `price` defaults to the current
   *  bar's own close when omitted, via `getCurrentClose`. */
  signal(arg: string | PlotSignalArg): void;
  point(value: number, options?: { color?: string; shape?: string; text?: string }): void;
  horizontal(price: number, options?: { color?: string }): void;
  vertical(options?: { color?: string }): void;
  /** A table overlay anchored to a corner of the price pane — neither a continuous series nor a
   *  per-bar marker, see `ScriptTableOutput`'s own doc: only the *most recent* call's own table is
   *  ever kept, so call this unconditionally every bar (like `plot.overlay`) rather than gating it
   *  behind `bar.isNew()`. `rows`/each cell string are silently truncated past this engine's own
   *  size limits rather than rejected. */
  table(rows: ScriptTableRow[], options?: { title?: string; columns?: string[]; position?: ScriptTableOutput["position"] }): void;
}

/** `plot.*`, closed over the current bar's own date/close (via the same kind of callback
 *  `market.*`/`chart.*` use for "which bar is this") and a pair of accumulators mutated across
 *  the whole replay loop — `getResult()` reads them once, after the loop in runScript.ts has
 *  finished, not per bar. A named series (`line`/`area`/`histogram`/`overlay`/`panel`) upserts
 *  into `plotsByName` so repeated calls with the same `name` extend one continuous series rather
 *  than starting a new one each time; a discrete marker (`signal`/`point`/`horizontal`/
 *  `vertical`) just appends to `drawings`, one entry per call. */
export function buildPlotApi(
  getCurrentDate: () => number,
  getCurrentClose: () => number | null
): {
  api: PlotApi;
  getResult: () => { plots: ScriptPlotSeries[]; bands: ScriptBandSeries[]; drawings: ScriptDrawingOutput[]; table: ScriptTableOutput | null };
} {
  const plotsByName = new Map<string, ScriptPlotSeries>();
  const bandsByName = new Map<string, ScriptBandSeries>();
  const drawings: ScriptDrawingOutput[] = [];
  let table: ScriptTableOutput | null = null;

  function upsertSeries(
    name: string,
    value: number,
    draw: ScriptPlotSeries["draw"],
    pane: ScriptPlotSeries["pane"],
    options: PlotSeriesOptions | undefined
  ) {
    let series = plotsByName.get(name);
    if (!series) {
      series = { name, draw, pane, color: options?.color, lineWidth: options?.lineWidth, lineStyle: options?.lineStyle, points: [] };
      plotsByName.set(name, series);
    }
    series.points.push({ date: getCurrentDate(), value });
  }

  function upsertBand(name: string, upper: number, lower: number, pane: ScriptBandSeries["pane"], options: PlotBandOptions | undefined) {
    let series = bandsByName.get(name);
    if (!series) {
      series = { name, pane, color: options?.color, lineWidth: options?.lineWidth, points: [] };
      bandsByName.set(name, series);
    }
    series.points.push({ date: getCurrentDate(), upper, lower });
  }

  const api: PlotApi = {
    line: (name, value, options) => upsertSeries(name, value, "line", "own", options),
    area: (name, value, options) => upsertSeries(name, value, "area", "own", options),
    histogram: (name, value, options) => upsertSeries(name, value, "histogram", "own", options),
    overlay: (name, value, options) => upsertSeries(name, value, "line", "overlay", options),
    panel: (name, value, options) => upsertSeries(name, value, "line", "own", options),
    band: (name, upper, lower, options) => upsertBand(name, upper, lower, "own", options),
    bandOverlay: (name, upper, lower, options) => upsertBand(name, upper, lower, "overlay", options),
    signal: (arg) => {
      const normalized: PlotSignalArg = typeof arg === "string" ? { type: arg } : arg;
      drawings.push({
        kind: "signal",
        date: getCurrentDate(),
        price: normalized.price ?? getCurrentClose() ?? undefined,
        type: normalized.type,
        color: normalized.color,
        shape: normalized.shape,
        text: normalized.text,
      });
    },
    point: (value, options) => {
      drawings.push({ kind: "point", date: getCurrentDate(), price: value, color: options?.color, shape: options?.shape, text: options?.text });
    },
    horizontal: (price, options) => {
      drawings.push({ kind: "horizontal", date: getCurrentDate(), price, color: options?.color });
    },
    vertical: (options) => {
      drawings.push({ kind: "vertical", date: getCurrentDate(), color: options?.color });
    },
    table: (rows, options) => {
      table = {
        title: options?.title,
        columns: options?.columns,
        position: options?.position,
        rows: rows.slice(0, MAX_TABLE_ROWS).map((row) => ({ cells: row.cells.map(truncateCell), color: row.color })),
      };
    },
  };

  return { api, getResult: () => ({ plots: [...plotsByName.values()], bands: [...bandsByName.values()], drawings, table }) };
}
