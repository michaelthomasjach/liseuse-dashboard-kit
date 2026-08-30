import type { ScriptDrawingOutput, ScriptPlotSeries, ScriptTableOutput, ScriptTableRow } from "../interfaces/ScriptRunResult.interface";

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
): { api: PlotApi; getResult: () => { plots: ScriptPlotSeries[]; drawings: ScriptDrawingOutput[]; table: ScriptTableOutput | null } } {
  const plotsByName = new Map<string, ScriptPlotSeries>();
  const drawings: ScriptDrawingOutput[] = [];
  let table: ScriptTableOutput | null = null;

  function upsertSeries(name: string, value: number, draw: ScriptPlotSeries["draw"], pane: ScriptPlotSeries["pane"], color: string | undefined) {
    let series = plotsByName.get(name);
    if (!series) {
      series = { name, draw, pane, color, points: [] };
      plotsByName.set(name, series);
    }
    series.points.push({ date: getCurrentDate(), value });
  }

  const api: PlotApi = {
    line: (name, value, options) => upsertSeries(name, value, "line", "own", options?.color),
    area: (name, value, options) => upsertSeries(name, value, "area", "own", options?.color),
    histogram: (name, value, options) => upsertSeries(name, value, "histogram", "own", options?.color),
    overlay: (name, value, options) => upsertSeries(name, value, "line", "overlay", options?.color),
    panel: (name, value, options) => upsertSeries(name, value, "line", "own", options?.color),
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

  return { api, getResult: () => ({ plots: [...plotsByName.values()], drawings, table }) };
}
