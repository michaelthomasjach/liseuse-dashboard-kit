import type { ScriptDrawingOutput, ScriptPlotSeries } from "../interfaces/ScriptRunResult.interface";

export interface PlotSeriesOptions {
  color?: string;
}
export interface PlotSignalArg {
  type?: string;
  price?: number;
  color?: string;
  shape?: string;
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
  point(value: number, options?: { color?: string; shape?: string }): void;
  horizontal(price: number, options?: { color?: string }): void;
  vertical(options?: { color?: string }): void;
}

/** `plot.*`, closed over the current bar's own date/close (via the same kind of callback
 *  `market.*`/`chart.*` use for "which bar is this") and a pair of accumulators mutated across
 *  the whole replay loop — `getResult()` reads them once, after the loop in runScript.ts has
 *  finished, not per bar. A named series (`line`/`area`/`histogram`/`overlay`/`panel`) upserts
 *  into `plotsByName` so repeated calls with the same `name` extend one continuous series rather
 *  than starting a new one each time; a discrete marker (`signal`/`point`/`horizontal`/
 *  `vertical`) just appends to `drawings`, one entry per call. */
export function buildPlotApi(getCurrentDate: () => number, getCurrentClose: () => number | null): { api: PlotApi; getResult: () => { plots: ScriptPlotSeries[]; drawings: ScriptDrawingOutput[] } } {
  const plotsByName = new Map<string, ScriptPlotSeries>();
  const drawings: ScriptDrawingOutput[] = [];

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
      });
    },
    point: (value, options) => {
      drawings.push({ kind: "point", date: getCurrentDate(), price: value, color: options?.color, shape: options?.shape });
    },
    horizontal: (price, options) => {
      drawings.push({ kind: "horizontal", date: getCurrentDate(), price, color: options?.color });
    },
    vertical: (options) => {
      drawings.push({ kind: "vertical", date: getCurrentDate(), color: options?.color });
    },
  };

  return { api, getResult: () => ({ plots: [...plotsByName.values()], drawings }) };
}
